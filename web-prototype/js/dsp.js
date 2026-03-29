class _EnvTracker {
  constructor() {
    this._phase = 'idle'; this._t0 = 0; this._v0 = 0;
    this._vel = 0; this._A = 0.01; this._D = 0.2; this._S = 0.5; this._R = 0.3;
  }
  _at(t) {
    const dt = Math.max(0, t - this._t0);
    switch (this._phase) {
      case 'attack':  return this._v0 + (this._vel - this._v0) * Math.min(1, dt / Math.max(0.001, this._A));
      case 'decay':   { const sus = this._S * this._vel; return sus + (this._vel - sus) * Math.exp(-dt / Math.max(0.001, this._D * 0.25)); }
      case 'sustain': return this._S * this._vel;
      case 'release': return this._v0 * Math.exp(-dt / Math.max(0.001, this._R * 0.25));
      default:        return 0;
    }
  }
  noteOn(now, vel, A, D, S) {
    const cur = this._at(now);
    this._phase = 'attack'; this._t0 = now; this._v0 = cur;
    this._vel = vel; this._A = A; this._D = D; this._S = S;
    return cur;
  }
  noteOff(now, R) {
    const cur = this._at(now);
    this._phase = 'release'; this._t0 = now; this._v0 = cur; this._R = R;
    return cur;
  }
}

// ─────────────────────────────────────────────────────────
//  WobblerVoice — OSC + Noise + Filter + 5 LFOs + ADSR
//  Persistent nodes; only OSC/Noise sources recreated per note
// ─────────────────────────────────────────────────────────
class WobblerVoice {
  constructor(ctx, masterIn, id) {
    this.ctx = ctx; this.id = id;
    this._nBuf = null; this._srcs = []; this._bpm = 120;
    this._envTracker = new _EnvTracker();

    this.p = {
      osc:    { waveform:'sawtooth', pitch:0, cent:0, volume:0.8, pw:0.5, spread:0.5, unison:1, unisonDetune:20, unisonBlend:1 },
      noise:  { volume:0, type:'white', filterMix:1 },
      adsr:   { attack:0.005, decay:0.25, sustain:0.4, release:0.12, atkCurve:0, decCurve:0, relCurve:0 },
      lfos:   Array.from({length:5}, (_,i) => ({
        waveform:'sine', rate:4, depth:0, phase:0, bpmSync:false, syncDiv:4,
        target:'cutoff', envA:0, envR:0, _enabled: false,
        ...(i===4 ? {metaTarget:null, metaTargetLFO:0} : {})
      })),
      dist: { form:'soft', drive:0, tone:18000, mix:0, volume:1, bypassed:false },
      eq:   { lowGain:0, midGain:0, highGain:0, lowFreq:200, midFreq:1000, highFreq:6000, bypassed:false },
      fx:   { reverbMix:0, reverbDecay:2.0, delayMix:0, delayTime:0.375, delayFB:0.4, bypassed:false },
      filter: { type:'lowpass', cutoff:800, resonance:5, envAmount:2000, mix:1, bypassed:false },
      osc1Active: id === 0,
      osc2Active: id === 1,
      subActive:  id === 2,
      osc1ModTarget: 'none',
      osc1ModDepth:  0.5,
      osc2ModTarget: 'none',
      osc2ModDepth:  0.5,
      osc1LfoPitch:  false,
      osc2: { waveform:'sine', oct:0, semi:0, detune:7, cents:0, volume:0.5, unison:1, unisonDetune:10 },
      sub:  { waveform:'sine', oct:-2, cents:0, volume:0.6 },
      volume:0.8, pan:0, mute:false,
      twe: {
        chaos: 0, ratemod: false, barsTotal: 4, tweAmt: 1, _bypassed: true,
        main: {
          rate:2, depth:0, attack:0, decay:0, target:'cutoff', shape:'sine', bpmSync:false, syncDiv:4, triplet:false, dotted:false, _enabled:true,
          strike: { rate:8,  depth:0, attack:0, decay:0.4, startBar:0, target:'noiseAmt', shape:'sine', bpmSync:false, syncDiv:8,  triplet:false, dotted:false, _enabled:true },
          body:   { rate:4,  depth:0, attack:0, decay:0,   startBar:0, target:'cutoff',   shape:'sine', bpmSync:false, syncDiv:4,  triplet:false, dotted:false, _enabled:true },
          tail:   { rate:2,  depth:0, attack:0, decay:0.6, startBar:0, target:'pitch',    shape:'sine', bpmSync:false, syncDiv:2,  triplet:false, dotted:false, _enabled:true },
        },
        aux: [],
      },
    };

    // Persistent nodes — created once, live for the session
    this.filter     = ctx.createBiquadFilter();
    this.filter.type = 'lowpass'; this.filter.frequency.value = 800; this.filter.Q.value = 5;
    this.envGain    = ctx.createGain();    this.envGain.gain.value    = 0;
    this.outputGain = ctx.createGain();    this.outputGain.gain.value = 0.8;
    this.panner     = ctx.createStereoPanner(); this.panner.pan.value = 0;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.6;

    this.preAnalyser = ctx.createAnalyser();
    this.preAnalyser.fftSize = 512; this.preAnalyser.smoothingTimeConstant = 0.6;

    // Distortion chain nodes
    this._distPre  = ctx.createGain();  this._distPre.gain.value  = 1;
    this._distNode = ctx.createWaveShaper(); this._distNode.oversample = 'none';
    this._distNode.curve = this._distCurve('soft', 0);
    this._distTone = ctx.createBiquadFilter();
    this._distTone.type = 'lowpass'; this._distTone.frequency.value = 18000; this._distTone.Q.value = 0.5;
    this._distPost = ctx.createGain();  this._distPost.gain.value = 1;
    this._distWet  = ctx.createGain();  this._distWet.gain.value  = 0; // dry by default
    this._distDry  = ctx.createGain();  this._distDry.gain.value  = 1;

    // Filter wet/dry mix nodes
    this.filterWet = ctx.createGain(); this.filterWet.gain.value = 1;
    this.filterDry = ctx.createGain(); this.filterDry.gain.value = 0;

    // sources → _distPre → _distNode → _distTone → _distPost → _distWet → filter
    //         ↘ _distDry ↗
    // filter → filterWet → envGain
    //       ↘ filterDry ↗
    this._tremoloGain = ctx.createGain(); this._tremoloGain.gain.value = 1;
    this._distPre.connect(this._distNode);
    this._distPre.connect(this._distDry);
    this._distNode.connect(this._distTone);
    this._distTone.connect(this._distPost);
    this._distPost.connect(this._distWet);
    this._distWet.connect(this.preAnalyser);
    this._distDry.connect(this.preAnalyser);
    this.preAnalyser.connect(this.filter);
    this.filter.connect(this.filterWet);
    this.filterWet.connect(this.envGain);
    this.filterDry.connect(this.envGain);
    this.envGain.connect(this.analyser);
    this.envGain.connect(this._tremoloGain);
    // 3-band EQ: low shelf → mid peak → high shelf
    this._eqLow  = ctx.createBiquadFilter(); this._eqLow.type  = 'lowshelf';  this._eqLow.frequency.value  = 200;  this._eqLow.gain.value  = 0;
    this._eqMid  = ctx.createBiquadFilter(); this._eqMid.type  = 'peaking';   this._eqMid.frequency.value  = 1000; this._eqMid.gain.value  = 0; this._eqMid.Q.value = 1;
    this._eqHigh = ctx.createBiquadFilter(); this._eqHigh.type = 'highshelf'; this._eqHigh.frequency.value = 6000; this._eqHigh.gain.value = 0;
    this._tremoloGain.connect(this._eqLow);
    this._eqLow.connect(this._eqMid);
    this._eqMid.connect(this._eqHigh);
    this._eqHigh.connect(this.outputGain);
    this.outputGain.connect(this.panner);
    this.panner.connect(masterIn);

    // FX: Reverb (convolver) + Delay — parallel sends from outputGain
    this._rvbConv = ctx.createConvolver();
    this._rvbConv.buffer = this._makeImpulse(2.0);
    this._rvbWet  = ctx.createGain(); this._rvbWet.gain.value = 0;
    this._dlyNode = ctx.createDelay(4.0); this._dlyNode.delayTime.value = 0.375;
    this._dlyFb   = ctx.createGain(); this._dlyFb.gain.value = 0.4;
    this._dlyWet  = ctx.createGain(); this._dlyWet.gain.value = 0;
    // Reverb chain: outputGain → _rvbWet → _rvbConv → masterIn
    this.outputGain.connect(this._rvbWet);
    this._rvbWet.connect(this._rvbConv);
    this._rvbConv.connect(masterIn);
    // Delay chain: outputGain → _dlyWet → _dlyNode ⟲ _dlyFb + → masterIn
    this.outputGain.connect(this._dlyWet);
    this._dlyWet.connect(this._dlyNode);
    this._dlyNode.connect(this._dlyFb);
    this._dlyFb.connect(this._dlyNode);
    this._dlyNode.connect(masterIn);

    this._lfosStarted = false;
    this._enabled = true;

    // 5 persistent LFOs — created now, started after first user gesture
    this.lfoNodes = Array.from({length:5}, (_, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const quantizer = ctx.createWaveShaper();
      const lp = this.p.lfos[i];
      osc.type = 'sine'; osc.frequency.value = lp.rate; gain.gain.value = 0;
      osc.connect(gain);
      return { osc, quantizer, gain, connected:null, stepped:false };
    });
    this.lfoNodes.forEach((_,i) => this._connectLFO(i));

    // TWE — Temporal Wobble Engine persistent oscillators
    this.tweMain = { osc: ctx.createOscillator(), gain: ctx.createGain(), connected: null };
    this.tweMain.osc.type = 'sine'; this.tweMain.osc.frequency.value = 2;
    this.tweMain.gain.gain.value = 0; this.tweMain.osc.connect(this.tweMain.gain);

    this.tweBody = { osc: ctx.createOscillator(), gain: ctx.createGain(), connected: null };
    this.tweBody.osc.type = 'sine'; this.tweBody.osc.frequency.value = 4;
    this.tweBody.gain.gain.value = 0; this.tweBody.osc.connect(this.tweBody.gain);

    this._tweAuxOscs = []; // dynamic aux lane oscillators
    this._tweStrikeOsc = null; this._tweTailOsc = null;

    // Per-note oscillators — created by buildOscChain on each noteOn
    this._activeOscs     = [];
    this._activeSubOsc   = null;
    this._activeOsc1Envs = [];
    this._activeOsc2Envs = [];
    this._activeSubEnv   = null;
    this._liveOsc        = null;

    this._noiseG = ctx.createGain(); this._noiseG.gain.value = 0;
    // Noise filter mix: _noiseToFilt controls how much noise enters the filter chain;
    // _noiseFilterBypass sends noise directly past the filter to envGain.
    this._noiseToFilt      = ctx.createGain(); this._noiseToFilt.gain.value      = 1; // filterMix=1 default
    this._noiseFilterBypass= ctx.createGain(); this._noiseFilterBypass.gain.value = 0; // filterMix=1 default
    this._noiseG.connect(this._noiseToFilt);
    this._noiseToFilt.connect(this._distPre);
    this._noiseToFilt.connect(this._distDry);
    this._noiseG.connect(this._noiseFilterBypass);
    this._noiseFilterBypass.connect(this.envGain);
    this._noiseNode = null; // created + started in startLFOs()

    this._srcs = []; this._playing = false; // legacy compat

    // New breakpoint LFO engine — starts on first noteOn
    this.lfoEngine = new LFOEngine(this);
  }

  _distCurve(form, drive) {
    const n = 512, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      if (drive < 0.001 && form !== 'soft') { curve[i] = x; continue; }
      const k = 1 + drive * 40;
      switch (form) {
        case 'soft': // tanh saturation — smooth tube warmth
          curve[i] = drive < 0.001 ? x : Math.tanh(x * k) / Math.tanh(k);
          break;
        case 'hard': { // hard clip with pre-boost
          const v = x * k;
          curve[i] = Math.max(-1, Math.min(1, v));
          break;
        }
        case 'fold': { // wavefolder — reflects at ±1
          let v = x * (1 + drive * 8);
          while (v > 1 || v < -1) { v = v > 1 ? 2 - v : v < -1 ? -2 - v : v; }
          curve[i] = v;
          break;
        }
        case 'asym': { // asymmetric — overdrive with positive-bias 2nd harmonic
          curve[i] = x >= 0
            ? Math.tanh(x * k) / Math.tanh(k)
            : Math.tanh(x * k * 0.4) / Math.tanh(k * 0.4) * 0.7;
          break;
        }
        case 'fuzz': { // extreme square-ish clipping
          const v = x * (1 + drive * 200);
          curve[i] = Math.sign(v) * Math.min(1, Math.abs(v) ** 0.2);
          break;
        }
        default: curve[i] = x;
      }
    }
    return curve;
  }

  _driveCurve(amount) { return this._distCurve('soft', amount); } // legacy compat

  _makePulseWave(pw) {
    const N = 256;
    const real = new Float32Array(N+1), imag = new Float32Array(N+1);
    real[0] = 2 * pw - 1;
    for (let n = 1; n <= N; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * pw);
    return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  // ── TWE helpers ──────────────────────────────────────────
  _tweCalcRate(sp) {
    if (!sp.bpmSync) return Math.max(0.01, sp.rate);
    let r = (this._bpm / 60) * sp.syncDiv / 4;
    if (sp.triplet) r *= 2 / 3;
    if (sp.dotted)  r *= 3 / 2;
    return Math.max(0.01, r);
  }

  // Returns detune (cents) for unison voice i out of N, centered on baseCent
  _unisonCentOffset(i, n, baseCent, spreadCents) {
    if (n <= 1) return baseCent;
    const frac = i / (n - 1) - 0.5; // -0.5 to +0.5
    return baseCent + frac * (spreadCents || 0);
  }

  // Pan position for unison voice i (0=main) spread evenly across stereo field
  _unisonPanPos(i, uni, spread) {
    if (uni <= 1) return 0;
    return ((i / (uni - 1)) * 2 - 1) * Math.min(Math.abs(spread ?? 0.5), 1.0);
  }

  // RMS-normalised per-voice volumes for Serum-style blend.
  // blend=0 → only center voice; blend=1 → all voices equal (old behaviour).
  _unisonVols(uni, blend, vol) {
    const b = Math.max(0, Math.min(1, blend ?? 1));
    const norm = 1 / Math.sqrt(1 + (uni - 1) * b * b);
    return { centerVol: vol * norm, sideVol: vol * b * norm };
  }

  // Unison is now applied per-note in buildOscChain — this is a no-op kept for compat
  _applyUnisonDetune(_t) {}

  // Connects a gain node to all active side-voice detune AudioParams (for 'chorus' target)
  _connectChorusNode(gainNode) {
    try { gainNode.disconnect(); } catch(_) {}
    // Connect to side voices (all active oscs except the first = center)
    (this._activeOscs || []).forEach((o, i) => {
      if (i > 0) try { gainNode.connect(o.detune); } catch(_) {}
    });
  }

  _tweGetTarget(target) {
    const filterBypassed = this._filterBypassed;
    switch (target) {
      case 'cutoff':    return filterBypassed ? null : this.filter.frequency;
      case 'resonance': return filterBypassed ? null : this.filter.Q;
      case 'pan':       return this.panner.pan;
      case 'volume':    return this._tremoloGain.gain;
      case 'pitch':     return this._currentOscDetune || null;
      case 'noiseAmt':  return this._currentNoiseGain || null;
      default:          return filterBypassed ? null : this.filter.frequency;
    }
  }

  // Connect a TWE gain node to the right target(s).
  // For 'pitch': fans out to ALL active oscillator detune params so the full
  // supersaw bank and all unison voices are modulated equally.
  _tweConnectGain(gainNode, target) {
    if (target === 'pitch') {
      (this._activeOscs || []).forEach(o => { try { gainNode.connect(o.detune); } catch(_) {} });
      if (this._activeSubOsc) { try { gainNode.connect(this._activeSubOsc.detune); } catch(_) {} }
      return (this._activeOscs || []).length > 0;
    }
    if (target === 'chorus') {
      this._connectChorusNode(gainNode);
      const uni = Math.max(1, Math.round(this.p.osc.unison || 1));
      return uni > 1; // only active when side voices exist
    }
    const mt = this._tweGetTarget(target);
    if (mt) { gainNode.connect(mt); return true; }
    return false;
  }

  _makePeriodicWave(samples) {
    const N = samples.length;
    const real = new Float32Array(N/2+1), imag = new Float32Array(N/2+1);
    for (let k=1; k<=N/2; k++) {
      let re=0, im=0;
      for (let n=0; n<N; n++) { const a=2*Math.PI*k*n/N; re+=samples[n]*Math.cos(a); im-=samples[n]*Math.sin(a); }
      real[k]=re*2/N; imag[k]=im*2/N;
    }
    return this.ctx.createPeriodicWave(real, imag, {disableNormalization:false});
  }

  _tweApplyShape(osc, sp) {
    if (sp.shape === 'custom' && sp.customShape) {
      osc.setPeriodicWave(this._makePeriodicWave(sp.customShape));
    } else {
      try { osc.type = sp.shape || 'sine'; } catch(_) { osc.type = 'sine'; }
    }
  }

  _tweNoteOn(velocity) {
    const ctx = this.ctx, now = ctx.currentTime, tw = this.p.twe;
    if (tw._bypassed) return;

    const chaos = tw.chaos;
    const tweAmt = tw.tweAmt ?? 1;
    const rand = () => 1 + (Math.random() * 2 - 1) * chaos;
    // Normalize/clamp depth per target to prevent instability
    const scaledDepth = (sp, raw) => {
      if (sp.target === 'volume' || sp.target === 'noiseAmt') return Math.min(raw / 15000, 1.0);
      if (sp.target === 'cutoff') {
        const base = this.p.filter.cutoff;
        return Math.min(raw, Math.max(0, Math.min(base - 20, 20000 - base)));
      }
      if (sp.target === 'resonance') return Math.min(raw, Math.max(0, this.p.filter.resonance - 0.001));
      if (sp.target === 'pitch' || sp.target === 'chorus') return (raw / 15000) * 1200; // full knob = 1 octave (1200¢)
      return raw;
    };
    // Apply attack ramp + optional in-note decay to a persistent gain node
    const applyEnv = (gainParam, depth, sp, t0) => {
      const atk = sp.attack || 0, dec = sp.decay || 0;
      this._cancelAndHold(gainParam, t0);
      if (atk > 0) {
        gainParam.setValueAtTime(0, t0);
        gainParam.linearRampToValueAtTime(depth, t0 + atk);
        if (dec > 0) gainParam.linearRampToValueAtTime(0.0001, t0 + atk + dec);
      } else if (dec > 0) {
        gainParam.setValueAtTime(depth, t0);
        gainParam.linearRampToValueAtTime(0.0001, t0 + dec);
      } else {
        gainParam.setValueAtTime(depth, t0);
      }
    };
    // Apply attack + exponential decay for one-shot lanes (strike/tail)
    const applyOneShot = (gainParam, depth, sp, t0) => {
      const atk = sp.attack || 0, dec = Math.max(0.05, sp.decay || 0.4);
      gainParam.cancelScheduledValues(t0);
      gainParam.setValueAtTime(0, t0);
      if (atk > 0) {
        gainParam.linearRampToValueAtTime(depth, t0 + atk);
        gainParam.exponentialRampToValueAtTime(0.0001, t0 + atk + dec);
      } else {
        gainParam.setValueAtTime(depth, t0);
        gainParam.exponentialRampToValueAtTime(0.0001, t0 + dec);
      }
      return atk + dec; // total duration
    };

    // Cancel any pending startDelay timers from previous note
    clearTimeout(this._tweBodyDelayTimer);
    clearTimeout(this._tweStrikeDelayTimer);
    (this._tweAuxDelayTimers || []).forEach(t => clearTimeout(t));
    this._tweAuxDelayTimers = [];

    // MAIN CORE — primary persistent wobble oscillator (no startDelay)
    clearTimeout(this._tweMainTimer);
    const ms = tw.main || {};
    try { this.tweMain.gain.disconnect(); } catch(_) {}
    this.tweMain.connected = null;
    if (ms.depth > 0 && ms._enabled !== false) {
      this._tweApplyShape(this.tweMain.osc, ms);
      this.tweMain.osc.frequency.setValueAtTime(this._tweCalcRate(ms) * rand(), now);
      applyEnv(this.tweMain.gain.gain, scaledDepth(ms, ms.depth) * tweAmt * rand() * velocity, ms, now);
      if (this._tweConnectGain(this.tweMain.gain, ms.target)) this.tweMain.connected = ms.target;
    }

    // MAIN STRIKE — one-shot transient on noteOn (with optional startDelay)
    const ss = ms.strike || {};
    if (ss.depth > 0 && ss._enabled !== false) {
      const fireStrike = () => {
        if (this._tweStrikeOsc) { try { this._tweStrikeOsc.stop(); } catch(_) {} }
        if (this._tweStrikeGain) { try { this._tweStrikeGain.disconnect(); } catch(_) {} this._tweStrikeGain = null; }
        const t0 = ctx.currentTime;
        const gain = ctx.createGain();
        const dep = scaledDepth(ss, ss.depth) * tweAmt * rand() * velocity;
        const dur = applyOneShot(gain.gain, dep, ss, t0);
        // ConstantSourceNode outputs 1 immediately — gain envelope shapes depth+decay.
        // OscillatorNode starts at sin(0)=0 so the effect would be inaudible during a short ADSR.
        const strikeOsc = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
        if (strikeOsc.offset) strikeOsc.offset.value = 1;
        else { this._tweApplyShape(strikeOsc, ss); strikeOsc.frequency.value = this._tweCalcRate(ss) * rand(); }
        strikeOsc.connect(gain);
        if (tw.ratemod && (ms.body||{}).depth > 0) gain.connect(this.tweBody.osc.frequency);
        this._tweConnectGain(gain, ss.target);
        strikeOsc.start(t0); strikeOsc.stop(t0 + dur + 0.2);
        this._tweStrikeOsc = strikeOsc; this._tweStrikeGain = gain; // both tracked for cleanup
      };
      const sDelay = (ss.startBar || 0) * (60000 / this._bpm) * 4;
      if (sDelay > 0) this._tweStrikeDelayTimer = setTimeout(fireStrike, sDelay);
      else fireStrike();
    }

    // MAIN BODY — persistent osc, starts after startDelay
    clearTimeout(this._tweBodyTimer);
    const bs = ms.body || {};
    try { this.tweBody.gain.disconnect(); } catch(_) {}
    this.tweBody.connected = null;
    if (bs.depth > 0 && bs._enabled !== false) {
      const connectBody = () => {
        const t0 = ctx.currentTime;
        this._tweApplyShape(this.tweBody.osc, bs);
        this.tweBody.osc.frequency.setValueAtTime(this._tweCalcRate(bs) * rand(), t0);
        applyEnv(this.tweBody.gain.gain, scaledDepth(bs, bs.depth) * tweAmt * rand() * velocity, bs, t0);
        if (this._tweConnectGain(this.tweBody.gain, bs.target)) this.tweBody.connected = bs.target;
      };
      const bDelay = (bs.startBar || 0) * (60000 / this._bpm) * 4;
      if (bDelay > 0) this._tweBodyDelayTimer = setTimeout(connectBody, bDelay);
      else connectBody();
    }

    // AUX LANES — independent persistent wobble lanes (with optional startDelay each)
    (tw.aux || []).forEach((als, i) => {
      const a = this._tweAuxOscs[i];
      if (!a) return;
      clearTimeout(a._timer);
      try { a.gain.disconnect(); } catch(_) {}
      a.connected = null;
      if (als.depth > 0 && als._enabled !== false) {
        const connectAux = () => {
          const t0 = ctx.currentTime;
          this._tweApplyShape(a.osc, als);
          a.osc.frequency.setValueAtTime(this._tweCalcRate(als) * rand(), t0);
          applyEnv(a.gain.gain, scaledDepth(als, als.depth) * tweAmt * rand() * velocity, als, t0);
          if (this._tweConnectGain(a.gain, als.target)) a.connected = als.target;
        };
        const aDelay = (als.startBar || 0) * (60000 / this._bpm) * 4;
        const t = aDelay > 0 ? setTimeout(connectAux, aDelay) : (connectAux(), null);
        this._tweAuxDelayTimers[i] = t;
      }
    });
  }

  _tweNoteOff(releaseTime) {
    const ctx = this.ctx, now = ctx.currentTime, tw = this.p.twe;
    const rel = releaseTime || 0.12;
    const ms = tw.main || {};

    // Cancel any startDelay timers that haven't fired yet
    clearTimeout(this._tweBodyDelayTimer);
    clearTimeout(this._tweStrikeDelayTimer);
    (this._tweAuxDelayTimers || []).forEach(t => clearTimeout(t));
    this._tweAuxDelayTimers = [];

    // Fade MAIN CORE gain out
    if (this.tweMain.connected) {
      this.tweMain.gain.gain.setTargetAtTime(0, now, rel / 4);
      clearTimeout(this._tweMainTimer);
      this._tweMainTimer = setTimeout(() => {
        try { this.tweMain.gain.disconnect(); } catch(_) {}
        this.tweMain.connected = null;
        if (ms.target === 'volume') this._tremoloGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
      }, (rel + 0.3) * 1000);
    }

    // Fade MAIN BODY gain out
    if (this.tweBody.connected) {
      this.tweBody.gain.gain.setTargetAtTime(0, now, rel / 4);
      clearTimeout(this._tweBodyTimer);
      this._tweBodyTimer = setTimeout(() => {
        try { this.tweBody.gain.disconnect(); } catch(_) {}
        this.tweBody.connected = null;
        const bs = ms.body || {};
        if (bs.target === 'volume') this._tremoloGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
      }, (rel + 0.3) * 1000);
    }

    // MAIN TAIL — one-shot osc fires at noteOff (with optional startDelay)
    const ts = ms.tail || {};
    if (ts.depth > 0 && ts._enabled !== false) {
      const rand = () => 1 + (Math.random() * 2 - 1) * (tw.chaos || 0);
      const tweAmt = tw.tweAmt ?? 1;
      const scaledDepth = (sp, raw) => {
        if (sp.target === 'volume' || sp.target === 'noiseAmt') return Math.min(raw / 15000, 1.0);
        if (sp.target === 'cutoff') { const base = this.p.filter.cutoff; return Math.min(raw, Math.max(0, Math.min(base - 20, 20000 - base))); }
        if (sp.target === 'resonance') return Math.min(raw, Math.max(0, this.p.filter.resonance - 0.001));
        if (sp.target === 'pitch' || sp.target === 'chorus') return (raw / 15000) * 1200; // full knob = 1 octave (1200¢)
        return raw;
      };
      const applyOneShot = (gainParam, depth, sp, t0) => {
        const atk = sp.attack || 0, dec = Math.max(0.05, sp.decay || 0.4);
        gainParam.cancelScheduledValues(t0); gainParam.setValueAtTime(0, t0);
        if (atk > 0) { gainParam.linearRampToValueAtTime(depth, t0 + atk); gainParam.exponentialRampToValueAtTime(0.0001, t0 + atk + dec); }
        else { gainParam.setValueAtTime(depth, t0); gainParam.exponentialRampToValueAtTime(0.0001, t0 + dec); }
        return atk + dec;
      };
      const fireTail = () => {
        if (this._tweTailOsc) { try { this._tweTailOsc.stop(); } catch(_) {} }
        if (this._tweTailGain) { try { this._tweTailGain.disconnect(); } catch(_) {} this._tweTailGain = null; }
        const t0 = ctx.currentTime;
        const gain = ctx.createGain();
        const dep = scaledDepth(ts, ts.depth) * tweAmt * rand();
        const dur = applyOneShot(gain.gain, dep, ts, t0);
        // ConstantSourceNode outputs 1 immediately — gain envelope shapes depth+decay.
        // OscillatorNode starts at sin(0)=0 so the effect would be inaudible during a short ADSR.
        const src = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
        if (src.offset) src.offset.value = 1;
        else { this._tweApplyShape(src, ts); src.frequency.value = this._tweCalcRate(ts) * rand(); }
        src.connect(gain);
        this._tweConnectGain(gain, ts.target);
        src.start(t0); src.stop(t0 + dur + 0.2);
        this._tweTailOsc = src; this._tweTailGain = gain; // both tracked for cleanup
      };
      const tDelay = (ts.startBar || 0) * (60000 / this._bpm) * 4;
      if (tDelay > 0) setTimeout(fireTail, tDelay); else fireTail();
    }

    // Fade AUX LANES out
    (tw.aux || []).forEach((als, i) => {
      const a = this._tweAuxOscs[i];
      if (!a || !a.connected) return;
      a.gain.gain.setTargetAtTime(0, now, rel / 4);
      clearTimeout(a._timer);
      a._timer = setTimeout(() => {
        try { a.gain.disconnect(); } catch(_) {}
        a.connected = null;
        if (als.target === 'volume') this._tremoloGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
      }, (rel + 0.3) * 1000);
    });
  }

  _noiseBuf() {
    if (this._nBuf && this._nBufType === this.p.noise.type) return this._nBuf;
    this._nBufType = this.p.noise.type;
    const sr = this.ctx.sampleRate;
    const len = sr * 4; // 4 s — long enough that loop seam is imperceptible
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    switch (this.p.noise.type) {
      case 'white':
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        break;
      case 'pink': {
        // Voss-McCartney 7-filter approximation, tuned coefficients
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < len; i++) {
          const w = Math.random()*2-1;
          b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
          b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
          b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
          d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
        }
        break;
      }
      case 'brown': {
        // Leaky integrator: -6 dB/oct rolloff (true Brownian / red noise)
        let acc = 0;
        for (let i = 0; i < len; i++) {
          acc += (Math.random() * 2 - 1) * 0.05;
          acc *= 0.998; // leak prevents unbounded drift
          d[i] = acc;
        }
        // Normalise to full range
        let mx = 0; for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(d[i]));
        if (mx > 0) for (let i = 0; i < len; i++) d[i] /= mx;
        break;
      }
      case 'blue': {
        // First-order difference: +6 dB/oct (differentiated white)
        let prev = 0;
        for (let i = 0; i < len; i++) { const w = Math.random()*2-1; d[i] = w - prev; prev = w; }
        let mx = 0; for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(d[i]));
        if (mx > 0) for (let i = 0; i < len; i++) d[i] /= mx;
        break;
      }
      case 'violet': {
        // Second-order difference: +12 dB/oct (double-differentiated, ultra-bright)
        let p0 = 0, p1 = 0;
        for (let i = 0; i < len; i++) { const w=Math.random()*2-1; const b=w-p0; d[i]=b-p1; p0=w; p1=b; }
        let mx = 0; for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(d[i]));
        if (mx > 0) for (let i = 0; i < len; i++) d[i] /= mx;
        break;
      }
    }
    // RMS-normalise to 0.5 so all types sit at the same perceived loudness
    let rms = 0;
    for (let i = 0; i < len; i++) rms += d[i] * d[i];
    rms = Math.sqrt(rms / len);
    if (rms > 0) { const g = 0.5 / rms; for (let i = 0; i < len; i++) d[i] = Math.max(-1, Math.min(1, d[i] * g)); }
    return (this._nBuf = buf);
  }

  _makeImpulse(decaySec) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * Math.max(0.1, decaySec));
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      }
    }
    return buf;
  }

  _lfoStaticDest(t) {
    if (t === 'cutoff')    return this._filterBypassed ? null : this.filter.frequency;
    if (t === 'resonance') return this._filterBypassed ? null : this.filter.Q;
    if (t === 'volume')    return this.envGain.gain;
    return null; // 'pitch','noiseAmt','chorus' → per-note connection
  }

  _connectLFO(i) {
    const { gain } = this.lfoNodes[i]; const p = this.p.lfos[i];
    try { gain.disconnect(); } catch(_) {} this.lfoNodes[i].connected = null;
    if (p._enabled === false) { gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01); return; }
    // LFO5 meta-modulation targets LFO1–4 rate or depth
    if (i === 4 && p.metaTarget != null && p.metaTargetLFO >= 0 && p.metaTargetLFO < 4) {
      const tgt = this.lfoNodes[p.metaTargetLFO];
      if (p.metaTarget === 'rate')  gain.connect(tgt.osc.frequency);
      if (p.metaTarget === 'depth') gain.connect(tgt.gain.gain);
      this.lfoNodes[i].connected = 'meta'; return;
    }
    if (p.target === 'chorus') {
      this._connectChorusNode(gain);
      this.lfoNodes[i].connected = 'chorus'; return;
    }
    const dest = this._lfoStaticDest(p.target);
    if (dest) {
      // Cutoff: clamp depth so filter.frequency never goes below 20Hz (prevents BiquadFilter instability)
      if (p.target === 'cutoff') {
        const safeDepth = Math.max(0, this.p.filter.cutoff - 20);
        gain.gain.setValueAtTime(Math.min(p.depth, safeDepth), this.ctx.currentTime);
      }
      gain.connect(dest); this.lfoNodes[i].connected = p.target;
    }
  }

  _steppedCurve(nSteps = 8, n = 4096) {
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n-1)) * 2 - 1;
      const s = Math.round((x+1)/2*(nSteps-1))/(nSteps-1)*2-1;
      c[i] = Math.max(-1, Math.min(1, s));
    }
    return c;
  }

  _setLFOWaveform(i, waveform) {
    const node = this.lfoNodes[i];
    if (waveform === 'stepped') {
      if (!node.stepped) {
        try { node.osc.disconnect(); } catch(_) {}
        node.quantizer.curve = this._steppedCurve();
        node.osc.type = 'sawtooth';
        node.osc.connect(node.quantizer);
        node.quantizer.connect(node.gain);
        node.stepped = true;
      }
    } else {
      if (node.stepped) {
        try { node.osc.disconnect(); } catch(_) {}
        try { node.quantizer.disconnect(); } catch(_) {}
        node.osc.connect(node.gain);
        node.stepped = false;
      }
      node.osc.type = waveform;
    }
  }

  startLFOs() {
    if (this._lfosStarted) return;
    this._lfosStarted = true;
    const t = this.ctx.currentTime;
    this.lfoNodes.forEach((node, i) => {
      const lp = this.p.lfos[i];
      const rate = Math.max(0.01, lp.rate);
      const offset = lp.phase / (2 * Math.PI * rate);
      node.osc.start(Math.max(0, t - offset));
    });
    this.tweMain.osc.start(t);
    this.tweBody.osc.start(t);
    this._tweAuxOscs.forEach(a => { try { a.osc.start(t); } catch(_) {} });
    // Persistent noise source
    const nn = this.ctx.createBufferSource();
    nn.buffer = this._noiseBuf(); nn.loop = true;
    nn.connect(this._noiseG); nn.start(t);
    this._noiseNode = nn;
  }

  _recreateLFO(i, bpm = 120) {
    const node = this.lfoNodes[i], p = this.p.lfos[i];
    try { node.osc.disconnect(); } catch(_) {}
    try { node.osc.stop(); } catch(_) {}
    if (node.stepped) { try { node.quantizer.disconnect(); } catch(_) {} }
    const osc = this.ctx.createOscillator();
    const rate = p.bpmSync ? (bpm/60)*p.syncDiv/4 : p.rate;
    osc.frequency.value = rate;
    node.osc = osc; node.stepped = false;
    osc.connect(node.gain); // temp; _setLFOWaveform may rewire
    const offset = p.phase / (2 * Math.PI * rate);
    osc.start(this.ctx.currentTime - offset);
    this._setLFOWaveform(i, p.waveform);
    this._connectLFO(i);
  }

  updateLFO(i, key, val, bpm = 120) {
    this.p.lfos[i][key] = val;
    const p = this.p.lfos[i], lfo = this.lfoNodes[i];
    if (key === 'waveform') this._setLFOWaveform(i, val);
    if (key === 'rate')     lfo.osc.frequency.setTargetAtTime(val, this.ctx.currentTime, 0.01);
    if (key === 'depth') {
      const applied = p.target === 'cutoff'
        ? Math.min(val, Math.max(0, this.p.filter.cutoff - 20))
        : val;
      lfo.gain.gain.setTargetAtTime(applied, this.ctx.currentTime, 0.01);
    }
    if (key === 'bpmSync' || key === 'syncDiv') {
      if (p.bpmSync) lfo.osc.frequency.setTargetAtTime((bpm/60)*p.syncDiv/4, this.ctx.currentTime, 0.01);
    }
    if (key === 'phase')    this._recreateLFO(i, bpm);
    if (key === 'target' || key === 'metaTarget' || key === 'metaTargetLFO') this._connectLFO(i);
  }

  _cancelAndHold(param, now) {
    if (param.cancelAndHoldAtTime) {
      param.cancelAndHoldAtTime(now);
    } else {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
    }
  }

  noteOn(freq, velocity = 0.65) {
    if (this.p.mute) return;
    const ctx = this.ctx, now = ctx.currentTime, p = this.p;
    this._midiFreq = freq;
    const f = freq * Math.pow(2, p.osc.pitch / 12);

    // Stop + clean up previous note's oscillators
    stopOscs(this._activeOscs, this._activeSubOsc, now + 0.01);
    this._activeOscs = []; this._activeSubOsc = null;
    this._activeOsc1Envs = []; this._activeOsc2Envs = []; this._activeSubEnv = null;

    // Build OSC chain via new engine
    const oscParams = {
      osc1: {
        wave:   p.osc.waveform === 'pulse' ? 'square' : (p.osc.waveform === 'supersaw' ? 'sawtooth' : p.osc.waveform),
        oct:    p.osc.pitch ? Math.round(p.osc.pitch / 12) : 0,
        semi:   0,
        det:    0,
        cents:  p.osc.cent || 0,
        vol:    p.osc.volume || 0.8,
        voices: p.osc.unison || 1,
        spread: p.osc.unisonDetune || 20,
        width:  p.osc.spread ? p.osc.spread * 100 : 80,
        ampA:   p.adsr.attack  * 1000,
        ampD:   p.adsr.decay   * 1000,
        ampS:   p.adsr.sustain,
        ampR:   p.adsr.release * 1000,
        modTarget: p.osc1ModTarget || 'none',
        modDepth:  p.osc1ModDepth  || 0,
        lfoPitch:  p.osc1LfoPitch  || false,
      },
      osc2: {
        wave:   p.osc2?.waveform || 'sine',
        oct:    p.osc2?.oct  || 0,
        semi:   p.osc2?.semi || 0,
        det:    p.osc2?.detune || 7,
        cents:  p.osc2?.cents  || 0,
        vol:    p.osc2?.volume || 0.5,
        voices: p.osc2?.unison || 1,
        spread: p.osc2?.unisonDetune || 10,
        width:  80,
        ampA:   p.adsr.attack  * 1000,
        ampD:   p.adsr.decay   * 1000,
        ampS:   p.adsr.sustain,
        ampR:   p.adsr.release * 1000,
        modTarget: p.osc2ModTarget || 'none',
        modDepth:  p.osc2ModDepth  || 0,
        lfoPitch:  false,
      },
      sub: {
        wave:   p.sub?.waveform || 'sine',
        oct:    p.sub?.oct ?? -2,
        cents:  p.sub?.cents || 0,
        vol:    p.sub?.volume || 0.6,
        ampA: 2, ampD: 80, ampS: 0.9, ampR: 60,
        lfoPitch: false,
      },
      noise:       { vol: p.noise.volume || 0, type: p.noise.type || 'white' },
      osc1Active:  p.osc1Active !== false,
      osc2Active:  p.osc2Active === true,
      subActive:   p.subActive  === true,
      lfoGain_pitch: null,
      osc1LfoPitch:  p.osc1LfoPitch || false,
      osc2LfoPitch:  false,
      subLfoPitch:   false,
    };

    const { oscs, subOscNode, osc1Envs, osc2Envs, subEnv } =
      buildOscChain(ctx, f, now, this._distPre, oscParams);

    applyOscEnvs(now, osc1Envs, osc2Envs, subEnv, oscParams);

    this._activeOscs     = oscs;
    this._activeSubOsc   = subOscNode;
    this._activeOsc1Envs = osc1Envs;
    this._activeOsc2Envs = osc2Envs;
    this._activeSubEnv   = subEnv;

    // Keep _liveOsc pointing to first osc for LFO pitch routing + bend
    this._liveOsc = oscs[0] || null;
    this._baseFreq = f; this._noteVelocity = velocity; this._playing = true;
    this._noteOnTime = now;

    // Noise — persistent node, just update gain
    this._noiseG.gain.cancelScheduledValues(now);
    this._noiseG.gain.setTargetAtTime(p.noise.volume * velocity, now, 0.002);
    this._currentNoiseGain = this._noiseG.gain;

    // LFO reconnection for pitch / noiseAmt targets + LFO envelope attack
    for (let i = 0; i < this.lfoNodes.length; i++) {
      const lfo = this.lfoNodes[i];
      const lp = this.p.lfos[i];
      const t = lp.target;
      if (lp._enabled === false) { try { lfo.gain.disconnect(); } catch(_){} continue; }
      if (t === 'pitch' && this._liveOsc)    { try { lfo.gain.disconnect(); } catch(_){} lfo.gain.connect(this._liveOsc.detune); lfo.connected = 'pitch'; }
      if (t === 'noiseAmt') { try { lfo.gain.disconnect(); } catch(_){} lfo.gain.connect(this._noiseG.gain);    lfo.connected = 'noiseAmt'; }
      if (t === 'chorus')   { this._connectChorusNode(lfo.gain); lfo.connected = 'chorus'; }
      // LFO envelope: if envA > 0 ramp depth in from 0 over attack
      const applied = lp.target === 'cutoff' ? Math.min(lp.depth, Math.max(0, this.p.filter.cutoff - 20)) : lp.depth;
      if (lp.envA > 0.005) {
        lfo.gain.gain.cancelScheduledValues(now);
        lfo.gain.gain.setValueAtTime(0, now);
        lfo.gain.gain.linearRampToValueAtTime(applied, now + lp.envA);
      } else {
        lfo.gain.gain.setTargetAtTime(applied, now, 0.01);
      }
    }

    // ADSR on envGain — _envTracker gives mathematically exact current level,
    // eliminating any reliance on AudioParam.value mid-automation.
    const g = this.envGain.gain;
    const attack = Math.max(0.001, p.adsr.attack);
    const currentLevel = this._envTracker.noteOn(now, velocity, attack, p.adsr.decay, p.adsr.sustain);
    this._cancelAndHold(g, now);
    const isRetrigger = currentLevel > 0.01;
    if (isRetrigger) {
      g.setValueAtTime(currentLevel, now);
      g.linearRampToValueAtTime(velocity, now + attack);
      g.setTargetAtTime(p.adsr.sustain * velocity, now + attack, p.adsr.decay / 4);
    } else {
      const fadeIn = 0.003;
      g.setValueAtTime(0, now);
      if (attack <= fadeIn) {
        g.linearRampToValueAtTime(velocity, now + attack);
        g.setTargetAtTime(p.adsr.sustain * velocity, now + attack, p.adsr.decay / 4);
      } else {
        g.linearRampToValueAtTime(velocity * 0.1, now + fadeIn);
        g.linearRampToValueAtTime(velocity, now + attack);
        g.setTargetAtTime(p.adsr.sustain * velocity, now + attack, p.adsr.decay / 4);
      }
    }

    // Filter envelope — hold current position to avoid click on retrigger
    const fc = this.filter.frequency, base = p.filter.cutoff;
    const peak = Math.min(18000, base + p.filter.envAmount * velocity);
    this._cancelAndHold(fc, now);
    fc.linearRampToValueAtTime(peak, now + Math.max(0.001, p.adsr.attack));
    fc.setTargetAtTime(base + (peak - base) * p.adsr.sustain, now + p.adsr.attack, p.adsr.decay / 4);

    // LFO engine — phase-reset on note trigger
    if (this.lfoEngine) {
      this.lfoEngine.resetPhases();
      if (!this.lfoEngine.playing) this.lfoEngine.start();
    }

    this._tweNoteOn(velocity);
  }

  bend(cents) {
    if (!this._baseFreq) return;
    const f = this._baseFreq * Math.pow(2, cents / 1200);
    const t = this.ctx.currentTime;
    (this._activeOscs || []).forEach(o => { try { o.frequency.setTargetAtTime(f, t, 0.01); } catch(_) {} });
    if (this._activeSubOsc) { try { this._activeSubOsc.frequency.setTargetAtTime(f, t, 0.01); } catch(_) {} }
  }

  noteOff() {
    if (!this._playing) return;
    this._playing = false;
    const ctx = this.ctx, now = ctx.currentTime, p = this.p, rel = Math.max(0.01, p.adsr.release);
    this._tweNoteOff(rel);
    const g = this.envGain.gain;
    const releaseFrom = this._envTracker.noteOff(now, rel);
    this._cancelAndHold(g, now);
    g.setValueAtTime(releaseFrom, now);
    g.linearRampToValueAtTime(0, now + rel);
    // Release new osc engine envs + schedule stop after release
    const _oscP = {
      osc1: { ampR: this.p.adsr.release * 1000 },
      osc2: { ampR: this.p.adsr.release * 1000 },
      sub:  { ampR: this.p.adsr.release * 1000 },
    };
    releaseOscEnvs(now, this._activeOsc1Envs, this._activeOsc2Envs, this._activeSubEnv, _oscP);
    const stopAt = now + rel + 0.1;
    stopOscs(this._activeOscs, this._activeSubOsc, stopAt);
    this._noiseG.gain.setTargetAtTime(0, now + rel + 0.05, 0.01);
    this.filter.frequency.setTargetAtTime(p.filter.cutoff, now, rel / 3);
    for (let i = 0; i < this.lfoNodes.length; i++) {
      const lfo = this.lfoNodes[i];
      const lp = this.p.lfos[i];
      if (lp._enabled === false) continue;
      if (lp.target === 'pitch' || lp.target === 'noiseAmt' || lp.target === 'chorus') this._connectLFO(i);
      // LFO envelope: ramp depth to 0 over release if envR > 0
      if (lp.envR > 0.005 && lp.depth > 0) {
        const lg = lfo.gain.gain;
        if (lg.cancelAndHoldAtTime) { lg.cancelAndHoldAtTime(now); } else { lg.cancelScheduledValues(now); lg.setValueAtTime(lg.value, now); }
        lg.linearRampToValueAtTime(0, now + Math.max(lp.envR, rel));
      }
    }
  }

  // ── Chord-slot methods (CHORD poly mode) ─────────────────
  // Assigns a single unison slot to a specific chord note frequency.
  // First slot triggers the full ADSR; subsequent slots just update frequency.
  noteOnSlot(slotIdx, freq, vel) {
    if (!this._heldSlots) this._heldSlots = new Set();
    const isFirst = this._heldSlots.size === 0;
    this._heldSlots.add(slotIdx);
    const t = this.ctx.currentTime;
    const f = freq * Math.pow(2, this.p.osc.pitch / 12);

    if (isFirst) {
      this.noteOn(freq, vel);
    } else {
      // Update frequency of the corresponding active osc slot
      const osc = (this._activeOscs || [])[slotIdx];
      if (osc) { try { osc.frequency.setTargetAtTime(f, t, 0.003); } catch(_) {} }
    }
  }

  // Releases a single unison slot. Triggers full noteOff only when all slots released.
  noteOffSlot(slotIdx) {
    if (!this._heldSlots) return;
    this._heldSlots.delete(slotIdx);
    if (this._heldSlots.size === 0) this.noteOff();
  }

  _killSrcs() {
    // Persistent oscs never stop — this is intentionally a no-op
    this._srcs.splice(0);
  }

  set(section, key, val) {
    const t = this.ctx.currentTime;
    if (section === 'osc') {
      this.p.osc[key] = val;
      if (key === 'pitch' && this._midiFreq) {
        const newFreq = this._midiFreq * Math.pow(2, val / 12);
        this._baseFreq = newFreq;
        (this._activeOscs || []).forEach(o => { try { o.frequency.setTargetAtTime(newFreq, t, 0.01); } catch(_) {} });
        if (this._activeSubOsc) { try { this._activeSubOsc.frequency.setTargetAtTime(newFreq, t, 0.01); } catch(_) {} }
      }
      if (key === 'waveform') {
        const webType = val === 'pulse' ? 'square' : val === 'supersaw' ? 'sawtooth' : val;
        (this._activeOscs || []).forEach(o => {
          try {
            if (val === 'pulse') { o.setPeriodicWave(this._makePulseWave(this.p.osc.pw ?? 0.5)); }
            else { o.type = webType; }
          } catch(_) {}
        });
      }
      if (key === 'pw') {
        const pw = val ?? 0.5;
        if (this.p.osc.waveform === 'pulse') {
          const wave = this._makePulseWave(pw);
          (this._activeOscs || []).forEach(o => { try { o.setPeriodicWave(wave); } catch(_) {} });
        }
      }
    }
    if (section === 'noise') {
      this.p.noise[key] = val;
      if (key === 'volume' && this._currentNoiseGain) {
        this._currentNoiseGain.setTargetAtTime(val * (this._noteVelocity || 0.65), t, 0.01);
      }
      if (key === 'filterMix') {
        const t = this.ctx.currentTime;
        this._noiseToFilt.gain.setTargetAtTime(val, t, 0.01);
        this._noiseFilterBypass.gain.setTargetAtTime(1 - val, t, 0.01);
      }
      if (key === 'type') {
        // Invalidate cached buffer so _noiseBuf() regenerates with the new type
        this._nBuf = null; this._nBufType = null;
        // Hot-swap the live noise source node
        if (this._noiseNode) {
          try { this._noiseNode.stop(); this._noiseNode.disconnect(); } catch(_) {}
        }
        const nn = this.ctx.createBufferSource();
        nn.buffer = this._noiseBuf(); nn.loop = true;
        nn.connect(this._noiseG); nn.start();
        this._noiseNode = nn;
      }
    }
    if (section === 'adsr')  this.p.adsr[key] = val;
    if (section === 'filter') {
      this.p.filter[key] = val;
      if (key === 'type')      this.filter.type = val;
      if (key === 'cutoff') {
        this.filter.frequency.setTargetAtTime(Math.max(20, val), t, 0.01);
        // Re-clamp all LFOs targeting cutoff so depth never pushes frequency negative
        this.lfoNodes.forEach((lfoNode, li) => {
          if (this.p.lfos[li].target === 'cutoff' && lfoNode.connected === 'cutoff') {
            const safeDepth = Math.max(0, val - 20);
            lfoNode.gain.gain.setTargetAtTime(Math.min(this.p.lfos[li].depth, safeDepth), t, 0.01);
          }
        });
      }
      if (key === 'resonance') this.filter.Q.setTargetAtTime(val, t, 0.01);
      if (key === 'mix') {
        this.filterWet.gain.setTargetAtTime(val, t, 0.02);
        this.filterDry.gain.setTargetAtTime(1 - val, t, 0.02);
      }
      if (key === 'pan') this.panner.pan.setTargetAtTime(val, t, 0.01);
    }
    if (section === 'eq') {
      this.p.eq[key] = val;
      if (key === 'lowGain')  this._eqLow.gain.setTargetAtTime(val, t, 0.01);
      if (key === 'midGain')  this._eqMid.gain.setTargetAtTime(val, t, 0.01);
      if (key === 'highGain') this._eqHigh.gain.setTargetAtTime(val, t, 0.01);
      if (key === 'lowFreq')  this._eqLow.frequency.setTargetAtTime(val, t, 0.01);
      if (key === 'midFreq')  this._eqMid.frequency.setTargetAtTime(val, t, 0.01);
      if (key === 'highFreq') this._eqHigh.frequency.setTargetAtTime(val, t, 0.01);
    }
    if (section === 'fx') {
      this.p.fx[key] = val;
      if (key === 'reverbMix')   this._rvbWet.gain.setTargetAtTime(val, t, 0.02);
      if (key === 'reverbDecay') { this._rvbConv.buffer = this._makeImpulse(val); }
      if (key === 'delayMix')    this._dlyWet.gain.setTargetAtTime(val, t, 0.02);
      if (key === 'delayTime')   this._dlyNode.delayTime.setTargetAtTime(Math.max(0.01, val), t, 0.02);
      if (key === 'delayFB')     this._dlyFb.gain.setTargetAtTime(Math.min(0.95, val), t, 0.02);
    }
    if (section === 'dist') {
      this.p.dist[key] = val;
      if (key === 'form' || key === 'drive') {
        this._distNode.curve = this._distCurve(this.p.dist.form, this.p.dist.drive);
        if (this.p.dist.mix >= 0.02) this._distNode.oversample = this.p.dist.drive > 0.3 ? '4x' : '2x';
      }
      if (key === 'tone')   this._distTone.frequency.setTargetAtTime(Math.max(200, val), t, 0.01);
      if (key === 'volume') this._distPost.gain.setTargetAtTime(val, t, 0.01);
      if (key === 'mix') {
        this._distWet.gain.setTargetAtTime(val, t, 0.02);
        this._distDry.gain.setTargetAtTime(1 - val, t, 0.02);
        this._distNode.oversample = val < 0.02 ? 'none' : (this.p.dist.drive > 0.3 ? '4x' : '2x');
      }
    }
    if (section === 'out') {
      if (key === 'volume') { this.p.volume = val; this.outputGain.gain.setTargetAtTime(val, t, 0.01); }
      if (key === 'pan')    { this.p.pan    = val; this.panner.pan.setTargetAtTime(val, t, 0.01); }
      if (key === 'mute')   { this.p.mute   = val; if (val) this._killSrcs(); }
    }
    if (section === 'twe') {
      if (key === 'chaos')    { this.p.twe.chaos    = val; return; }
      if (key === 'ratemod')   { this.p.twe.ratemod  = val; return; }
      if (key === 'barsTotal') { this.p.twe.barsTotal = val; return; }
      if (key === 'tweAmt')    { this.p.twe.tweAmt   = val; return; }

      // Add / remove aux lanes
      if (key === 'aux.add') {
        this.p.twe.aux.push({ rate:2, depth:0, attack:0, decay:0, startBar:0, target:'cutoff', shape:'sine', bpmSync:false, syncDiv:4, triplet:false, dotted:false, _enabled:true });
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = 2; gain.gain.value = 0;
        osc.connect(gain);
        if (this._lfosStarted) osc.start(t);
        this._tweAuxOscs.push({ osc, gain, connected: null, _timer: null });
        return;
      }
      if (key.startsWith('aux.remove.')) {
        const i = parseInt(key.split('.')[2]);
        const a = this._tweAuxOscs[i];
        if (a) { try { a.gain.disconnect(); a.osc.stop(); } catch(_) {} }
        this._tweAuxOscs.splice(i, 1);
        this.p.twe.aux.splice(i, 1);
        return;
      }

      const parts = key.split('.');
      if (parts[0] === 'main') {
        if (parts.length === 2) {
          // main core param: main.shape / main.rate / etc.
          const param = parts[1];
          this.p.twe.main[param] = val;
          const ms = this.p.twe.main;
          if (['rate','bpmSync','syncDiv','triplet','dotted'].includes(param)) {
            this.tweMain.osc.frequency.setTargetAtTime(this._tweCalcRate(ms), t, 0.01);
          }
          if (param === 'shape') {
            try { this.tweMain.osc.stop(); this.tweMain.osc.disconnect(); } catch(_) {}
            const newOsc = this.ctx.createOscillator();
            newOsc.frequency.value = this.tweMain.osc.frequency.value;
            this._tweApplyShape(newOsc, ms);
            newOsc.connect(this.tweMain.gain); newOsc.start(t);
            this.tweMain.osc = newOsc;
          }
          if (param === 'depth') {
            let mDepth = val;
            if (ms.target === 'volume' || ms.target === 'noiseAmt') mDepth = Math.min(val / 15000, 1.0);
            else if (ms.target === 'cutoff') { const b = this.p.filter.cutoff; mDepth = Math.min(val, Math.max(0, Math.min(b - 20, 20000 - b))); }
            else if (ms.target === 'resonance') mDepth = Math.min(val, Math.max(0, this.p.filter.resonance - 0.001));
            if (this.tweMain.connected) this.tweMain.gain.gain.setTargetAtTime(mDepth, t, 0.01);
          }
          if (param === 'target') {
            try { this.tweMain.gain.disconnect(); } catch(_) {}
            this.tweMain.connected = null;
            if (ms.depth > 0 && ms._enabled !== false && this._tweConnectGain(this.tweMain.gain, val)) this.tweMain.connected = val;
          }
        } else if (parts.length === 3) {
          // main sub-component: main.body.shape / main.strike.rate / etc.
          const sub = parts[1], param = parts[2]; // sub = 'body'|'strike'|'tail'
          if (this.p.twe.main[sub]) {
            this.p.twe.main[sub][param] = val;
            if (sub === 'body') {
              const bs = this.p.twe.main.body;
              if (['rate','bpmSync','syncDiv','triplet','dotted'].includes(param)) {
                this.tweBody.osc.frequency.setTargetAtTime(this._tweCalcRate(bs), t, 0.01);
              }
              if (param === 'shape') {
                try { this.tweBody.osc.stop(); this.tweBody.osc.disconnect(); } catch(_) {}
                const newOsc = this.ctx.createOscillator();
                newOsc.frequency.value = this.tweBody.osc.frequency.value;
                this._tweApplyShape(newOsc, bs);
                newOsc.connect(this.tweBody.gain); newOsc.start(t);
                this.tweBody.osc = newOsc;
              }
              if (param === 'depth') {
                let bDepth = val;
                if (bs.target === 'volume' || bs.target === 'noiseAmt') bDepth = Math.min(val / 15000, 1.0);
                else if (bs.target === 'cutoff') { const b = this.p.filter.cutoff; bDepth = Math.min(val, Math.max(0, Math.min(b - 20, 20000 - b))); }
                else if (bs.target === 'resonance') bDepth = Math.min(val, Math.max(0, this.p.filter.resonance - 0.001));
                if (this.tweBody.connected) this.tweBody.gain.gain.setTargetAtTime(bDepth, t, 0.01);
              }
              if (param === 'target') {
                try { this.tweBody.gain.disconnect(); } catch(_) {}
                this.tweBody.connected = null;
                if (bs.depth > 0 && bs._enabled !== false && this._tweConnectGain(this.tweBody.gain, val)) this.tweBody.connected = val;
              }
            }
            // strike/tail are one-shot — changes take effect on next note
          }
        }
      } else if (parts[0] === 'aux') {
        const i = parseInt(parts[1]), param = parts[2];
        const als = this.p.twe.aux[i];
        const a   = this._tweAuxOscs[i];
        if (als && a && param) {
          als[param] = val;
          if (['rate','bpmSync','syncDiv','triplet','dotted'].includes(param)) {
            a.osc.frequency.setTargetAtTime(this._tweCalcRate(als), t, 0.01);
          }
          if (param === 'shape') {
            try { a.osc.stop(); a.osc.disconnect(); } catch(_) {}
            const newOsc = this.ctx.createOscillator();
            newOsc.frequency.value = a.osc.frequency.value;
            this._tweApplyShape(newOsc, als);
            newOsc.connect(a.gain); newOsc.start(t);
            a.osc = newOsc;
          }
          if (param === 'depth') {
            const aDepth = als.target === 'volume' ? Math.min(val, 1.0) : val;
            if (a.connected) a.gain.gain.setTargetAtTime(aDepth, t, 0.01);
          }
          if (param === 'target') {
            try { a.gain.disconnect(); } catch(_) {}
            a.connected = null;
            if (als.depth > 0 && als._enabled !== false && this._tweConnectGain(a.gain, val)) a.connected = val;
          }
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
//  WobblerSynth — 3 voices + master FX chain
// ─────────────────────────────────────────────────────────
class WobblerSynth {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.bpm = 120;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.connect(this.ctx.destination);

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.knee.value = 6;
    this.comp.ratio.value = 4; this.comp.release.value = 0.25;
    this.comp.connect(this.analyser);

    this.delay    = this.ctx.createDelay(2.0);
    this.delayFB  = this.ctx.createGain();
    this.delayWet = this.ctx.createGain();
    this.delayDry = this.ctx.createGain();
    this.delay.delayTime.value = 0.25; this.delayFB.gain.value  = 0.35;
    this.delayWet.gain.value   = 0.0;  this.delayDry.gain.value = 1.0;

    this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 0.75;
    this.masterGain.connect(this.delayDry);
    this.masterGain.connect(this.delay);
    this.delay.connect(this.delayFB); this.delayFB.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayDry.connect(this.comp); this.delayWet.connect(this.comp);

    this.voices = Array.from({length:3}, (_,i) => new WobblerVoice(this.ctx, this.masterGain, i));
    this.polyMode = 'mono';       // 'mono' | 'poly' | 'chord'
    this._voiceNoteMap  = new Map(); // midiNote → WobblerVoice  (poly mode)
    this._chordSlotMap  = new Map(); // midiNote → {voice, slotIdx}  (chord mode)
  }
  noteOn(freq, vel = 0.65) {
    clearTimeout(this._silenceTimer);
    const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
    this._currentMidiNote = midiNote;
    if (this.polyMode === 'mono') {
      // MONO: all enabled voices layer on the same note
      this.voices.forEach(v => { if (v._enabled) v.noteOn(freq, vel); });
    } else if (this.polyMode === 'poly') {
      // POLY: one whole voice lane per note
      const enabled = this.voices.filter(v => v._enabled);
      if (!enabled.length) return;
      if (this._voiceNoteMap.has(midiNote)) {
        this._voiceNoteMap.get(midiNote).noteOff();
        this._voiceNoteMap.delete(midiNote);
      }
      const free = enabled.find(v => !v._playing);
      const target = free || enabled[0];
      target.noteOn(freq, vel);
      this._voiceNoteMap.set(midiNote, target);
    } else {
      // CHORD: assign note to a unison slot within the first enabled voice
      const voice = this.voices.find(v => v._enabled);
      if (!voice) return;
      if (this._chordSlotMap.has(midiNote)) {
        const { voice: ov, slotIdx } = this._chordSlotMap.get(midiNote);
        ov.noteOffSlot(slotIdx);
        this._chordSlotMap.delete(midiNote);
      }
      const maxSlots = Math.max(1, Math.round(voice.p.osc.unison || 1));
      if (!voice._heldSlots) voice._heldSlots = new Set();
      let freeSlot = -1;
      for (let i = 0; i < maxSlots; i++) { if (!voice._heldSlots.has(i)) { freeSlot = i; break; } }
      if (freeSlot === -1) { freeSlot = 0; voice.noteOffSlot(0); this._chordSlotMap.forEach((v,k) => { if(v.slotIdx===0) this._chordSlotMap.delete(k); }); }
      voice.noteOnSlot(freeSlot, freq, vel);
      this._chordSlotMap.set(midiNote, { voice, slotIdx: freeSlot });
    }
  }
  noteOff(midiNote) {
    if (this.polyMode === 'mono') {
      this.voices.forEach(v => v.noteOff());
    } else if (this.polyMode === 'poly') {
      if (midiNote !== undefined && this._voiceNoteMap.has(midiNote)) {
        this._voiceNoteMap.get(midiNote).noteOff();
        this._voiceNoteMap.delete(midiNote);
      }
    } else {
      if (midiNote !== undefined && this._chordSlotMap.has(midiNote)) {
        const { voice, slotIdx } = this._chordSlotMap.get(midiNote);
        voice.noteOffSlot(slotIdx);
        this._chordSlotMap.delete(midiNote);
      }
    }
    clearTimeout(this._silenceTimer);
    this._silenceTimer = setTimeout(() => {
      if (!this.voices.some(v => v._playing)) this.ctx.suspend();
    }, 3000);
  }
  setBpm(bpm) {
    this.bpm = bpm;
    this.voices.forEach(v => {
      v._bpm = bpm;
      if (v.lfoEngine) v.lfoEngine.bpm = bpm;
      v.p.lfos.forEach((lp,i) => {
        if (lp.bpmSync) v.lfoNodes[i].osc.frequency.setTargetAtTime((bpm/60)*lp.syncDiv/4, this.ctx.currentTime, 0.01);
      });
      const bs = (v.p.twe.main || {}).body || {};
      if (bs.bpmSync && v.tweBody.connected) {
        v.tweBody.osc.frequency.setTargetAtTime(v._tweCalcRate(bs), this.ctx.currentTime, 0.01);
      }
    });
  }
  bend(cents) {
    this._pitchBendCents = cents;
    this.voices.forEach(v => v.bend(cents));
  }

  setSolo(idx) {
    this._soloIdx = idx;
    this.voices.forEach((v, i) => {
      const silenced = idx >= 0 && i !== idx;
      v.outputGain.gain.setTargetAtTime(silenced ? 0 : v.p.volume, this.ctx.currentTime, 0.02);
    });
  }
  resume() {
    if (this.ctx.state !== 'suspended') {
      this.voices.forEach(v => v.startLFOs());
      return Promise.resolve();
    }
    return this.ctx.resume().then(() => {
      this.voices.forEach(v => v.startLFOs());
    });
  }
}

// ─────────────────────────────────────────────────────────
//  Sequencer — 16 steps × 3 voices, independent patterns
// ─────────────────────────────────────────────────────────
class Sequencer {
  constructor(synth) {
    this.synth = synth; this.bpm = 120; this.playing = false; this.step = -1; this._t = null;
    // 3 separate 16-step patterns (one per voice)
    this.voices = Array.from({length:3}, () => ({
      steps: Array.from({length:16}, (_,i) => ({ active:(i%4===0), note:36, accent:false })),
      enabled: false // starts disabled; per-voice play button enables it
    }));
    this.onStep = null;
  }
  _tick() {
    if (!this.playing) return;
    this.step = (this.step + 1) % 16;
    
    // Trigger each voice independently based on its pattern
    this.voices.forEach((vSeq, vIdx) => {
      if (!vSeq.enabled) return; // Skip if this voice's sequencer is disabled
      const st = vSeq.steps[this.step];
      if (st.active && this.synth.voices[vIdx]._enabled) {
        const freq = 440 * Math.pow(2, (st.note - 69) / 12);
        const vel = st.accent ? 0.9 : 0.65;
        this.synth.voices[vIdx].noteOn(freq, vel);
        setTimeout(() => this.synth.voices[vIdx].noteOff(), (60 / this.bpm) * 0.8 * 1000);
      }
    });
    
    if (this.onStep) this.onStep(this.step);
    this._t = setTimeout(() => this._tick(), (60 / this.bpm / 4) * 1000);
  }
  play()    { if (this.playing) return; this.playing = true; this.step = -1; this.synth.resume().then(() => this._tick()); }
  stop()    { this.playing = false; clearTimeout(this._t); this.step = -1; this.synth.voices.forEach(v => v.noteOff()); if (this.onStep) this.onStep(-1); }
  setBpm(b) { this.bpm = b; this.synth.setBpm(b); }
}

// ─────────────────────────────────────────────────────────
//  Waveform preview — Serum-style glowing line
// ─────────────────────────────────────────────────────────
