// ─────────────────────────────────────────────────────────
//  Wobbler Bass — Audio Engine + UI  (Web Audio API)
// ─────────────────────────────────────────────────────────

// ── Utilities ─────────────────────────────────────────────
function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function midiToNote(m) { return NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1); }

const VOICE_COLORS   = ['#5dbfa8','#d88860','#9d7bc9'];
const VOICE_LABELS   = ['VOICE 1','VOICE 2','VOICE 3'];
const WAVE_TYPES     = ['sine','sawtooth','square','triangle','pulse','supersaw'];
const FILTER_TYPES   = ['lowpass','highpass','bandpass','notch'];
const FILTER_LABELS  = ['LP','HP','BP','NCH'];
const LFO_TARGETS    = ['cutoff','resonance','volume','pitch','noiseAmt','chorus'];
const LFO_TARGET_LBL = ['CUTOFF','RESON','VOLUME','PITCH','NOISE','CHORUS'];
const NOISE_TYPES    = ['white','pink','brown','blue','violet'];
const NOISE_LABELS   = ['White','Pink','Brown','Blue','Violet'];
// Bass range C1(24)–G2(43)
const SEQ_NOTES = Array.from({length:20}, (_,i) => ({midi:24+i, name:midiToNote(24+i)}));

// ─────────────────────────────────────────────────────────
//  _EnvTracker — pure-JS ADSR state machine
//  Computes envelope value mathematically so noteOn/noteOff
//  never need to read AudioParam.value mid-automation.
// ─────────────────────────────────────────────────────────
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
        target:'cutoff', envA:0, envR:0, _enabled: i < 2,
        ...(i===4 ? {metaTarget:null, metaTargetLFO:0} : {})
      })),
      dist: { form:'soft', drive:0, tone:18000, mix:0, volume:1, bypassed:false },
      eq:   { lowGain:0, midGain:0, highGain:0, lowFreq:200, midFreq:1000, highFreq:6000, bypassed:false },
      fx:   { reverbMix:0, reverbDecay:2.0, delayMix:0, delayTime:0.375, delayFB:0.4, bypassed:false },
      filter: { type:'lowpass', cutoff:800, resonance:5, envAmount:2000, mix:1, bypassed:false },
      volume:0.8, pan:0, mute:false,
      twe: {
        chaos: 0, ratemod: false, barsTotal: 4, tweAmt: 1,
        main: {
          rate:2, depth:200, attack:0, decay:0, target:'cutoff', shape:'sine', bpmSync:false, syncDiv:4, triplet:false, dotted:false, _enabled:true,
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
    this._distNode.connect(this._distTone);
    this._distTone.connect(this._distPost);
    this._distPost.connect(this._distWet);
    this._distWet.connect(this.filter);
    this._distDry.connect(this.filter);
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

    // Persistent audio oscillators — always running, no start/stop per note
    // Frequency/type updated on noteOn. Envelope gain handles amplitude.
    this._mainOsc  = ctx.createOscillator();
    this._mainOscG = ctx.createGain(); this._mainOscG.gain.value = 0;
    this._mainUniPanner = ctx.createStereoPanner(); this._mainUniPanner.pan.value = 0;
    this._mainOsc.type = 'sawtooth';
    this._mainOsc.connect(this._mainOscG);
    this._mainOscG.connect(this._mainUniPanner);
    this._mainUniPanner.connect(this._distPre); this._mainUniPanner.connect(this._distDry); this._mainUniPanner.connect(this.filterDry);

    this._pulseOsc  = ctx.createOscillator();
    this._pulseOscG = ctx.createGain(); this._pulseOscG.gain.value = 0;
    this._pulseUniPanner = ctx.createStereoPanner(); this._pulseUniPanner.pan.value = 0;
    this._pulseOsc.connect(this._pulseOscG);
    this._pulseOscG.connect(this._pulseUniPanner);
    this._pulseUniPanner.connect(this._distPre); this._pulseUniPanner.connect(this._distDry); this._pulseUniPanner.connect(this.filterDry);

    this._ssG = ctx.createGain(); this._ssG.gain.value = 0;
    this._ssOscBank = [-10.5,-7,-3.5,0,3.5,7,10.5].map((baseSpread, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 440;
      const g = ctx.createGain(); g.gain.value = i === 3 ? 0.25 : 0.12;
      o.connect(g); g.connect(this._ssG);
      return { osc: o, gain: g, baseSpread };
    });
    this._ssG.connect(this._distPre); this._ssG.connect(this._distDry); this._ssG.connect(this.filterDry);

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

    // Unison extra oscillators: up to 7 additional voices (+ _mainOsc = 8 total)
    // Each has its own StereoPanner for stereo spread
    this._unisonExtraOscs = Array.from({length: 7}, () => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 440;
      const g = ctx.createGain(); g.gain.value = 0;
      const pan = ctx.createStereoPanner(); pan.pan.value = 0;
      o.connect(g); g.connect(pan);
      pan.connect(this._distPre); pan.connect(this._distDry); pan.connect(this.filterDry);
      return { osc: o, gain: g, panner: pan };
    });

    this._srcs = []; this._playing = false; // legacy compat
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

  // Re-applies detune spread + stereo pan + blend to all active unison voices at time t
  _applyUnisonDetune(t) {
    const p = this.p, now = t || this.ctx.currentTime;
    if (p.osc.waveform === 'supersaw') return; // supersaw has its own spread
    const uni = Math.max(1, Math.round(p.osc.unison || 1));
    const spread = p.osc.spread ?? 0.5;
    const vol = p.osc.volume * (this._noteVelocity || 0.65);
    const { centerVol, sideVol } = this._unisonVols(uni, p.osc.unisonBlend, vol);
    const isPulse = p.osc.waveform === 'pulse';
    const mainGain   = isPulse ? this._pulseOscG     : this._mainOscG;
    const mainOsc    = isPulse ? this._pulseOsc      : this._mainOsc;
    const mainPanner = isPulse ? this._pulseUniPanner : this._mainUniPanner;
    mainOsc.detune.setTargetAtTime(this._unisonCentOffset(0, uni, p.osc.cent, p.osc.unisonDetune), now, 0.01);
    mainGain.gain.setTargetAtTime(centerVol, now, 0.01);
    if (mainPanner) mainPanner.pan.setTargetAtTime(this._unisonPanPos(0, uni, spread), now, 0.01);
    this._unisonExtraOscs.forEach((u, i) => {
      const active = (i + 1) < uni;
      u.osc.detune.setTargetAtTime(this._unisonCentOffset(i + 1, uni, p.osc.cent, p.osc.unisonDetune), now, 0.01);
      u.gain.gain.setTargetAtTime(active ? sideVol : 0, now, 0.01);
      if (u.panner) u.panner.pan.setTargetAtTime(active ? this._unisonPanPos(i + 1, uni, spread) : 0, now, 0.01);
    });
  }

  // Connects a gain node to all active side-voice detune AudioParams (for 'chorus' target)
  _connectChorusNode(gainNode) {
    try { gainNode.disconnect(); } catch(_) {}
    const uni = Math.max(1, Math.round(this.p.osc.unison || 1));
    this._unisonExtraOscs.forEach((u, i) => {
      if ((i + 1) < uni) try { gainNode.connect(u.osc.detune); } catch(_) {}
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
      const wf = this.p.osc.waveform;
      if (wf === 'supersaw') {
        this._ssOscBank?.forEach(u => { try { gainNode.connect(u.osc.detune); } catch(_) {} });
      } else {
        [this._mainOsc, this._pulseOsc].forEach(o => {
          if (o) try { gainNode.connect(o.detune); } catch(_) {}
        });
        this._unisonExtraOscs?.forEach(u => { try { gainNode.connect(u.osc.detune); } catch(_) {} });
      }
      return true;
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
    // Start persistent audio oscillators
    this._mainOsc.start(t);
    this._pulseOsc.start(t);
    this._ssOscBank.forEach(s => s.osc.start(t));
    this._unisonExtraOscs.forEach(u => u.osc.start(t));
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
    const vol = p.osc.volume * velocity;

    // Cancel all osc gain schedules — including any post-release silencing queued by noteOff
    this._mainOscG.gain.cancelScheduledValues(now);  this._mainOscG.gain.setValueAtTime(0, now);
    this._pulseOscG.gain.cancelScheduledValues(now); this._pulseOscG.gain.setValueAtTime(0, now);
    this._ssG.gain.cancelScheduledValues(now);       this._ssG.gain.setValueAtTime(0, now);
    this._unisonExtraOscs.forEach(u => {
      u.gain.gain.cancelScheduledValues(now);
      u.gain.gain.setValueAtTime(u.gain.gain.value, now);
    });

    if (p.osc.waveform === 'supersaw') {
      this._ssOscBank.forEach((s, i) => {
        s.osc.frequency.setTargetAtTime(f, now, 0.003);
        s.osc.detune.value = p.osc.cent + s.baseSpread * p.osc.spread * 2;
      });
      this._ssG.gain.setTargetAtTime(vol, now, 0.002);
      this._currentOscFreq = this._ssOscBank[3].osc.frequency;
      this._currentOscDetune = this._ssOscBank[3].osc.detune;
      this._liveOsc = this._ssOscBank[3].osc;
      this._currentOscGain = this._ssG.gain;
    } else if (p.osc.waveform === 'pulse') {
      const uni = Math.max(1, Math.round(p.osc.unison || 1));
      const pw = this._makePulseWave(p.osc.pw);
      const uniVol = vol / Math.sqrt(uni);
      this._pulseOsc.setPeriodicWave(pw);
      const pulseSpread = p.osc.spread ?? 0.5;
      const { centerVol: pCtrVol, sideVol: pSideVol } = this._unisonVols(uni, p.osc.unisonBlend, uniVol * Math.sqrt(uni));
      this._pulseOsc.frequency.setTargetAtTime(f, now, 0.003);
      this._pulseOsc.detune.value = this._unisonCentOffset(0, uni, p.osc.cent, p.osc.unisonDetune);
      this._pulseOscG.gain.setTargetAtTime(pCtrVol, now, 0.002);
      if (this._pulseUniPanner) this._pulseUniPanner.pan.setValueAtTime(this._unisonPanPos(0, uni, pulseSpread), now);
      this._unisonExtraOscs.forEach((u, i) => {
        u.osc.setPeriodicWave(pw);
        u.osc.frequency.setTargetAtTime(f, now, 0.003);
        u.osc.detune.value = this._unisonCentOffset(i + 1, uni, p.osc.cent, p.osc.unisonDetune);
        const active = (i + 1) < uni;
        u.gain.gain.setTargetAtTime(active ? pSideVol : 0, now, 0.002);
        if (u.panner) u.panner.pan.setValueAtTime(active ? this._unisonPanPos(i + 1, uni, pulseSpread) : 0, now);
      });
      this._currentOscFreq = this._pulseOsc.frequency;
      this._currentOscDetune = this._pulseOsc.detune;
      this._liveOsc = this._pulseOsc;
      this._currentOscGain = this._pulseOscG.gain;
    } else {
      const uni = Math.max(1, Math.round(p.osc.unison || 1));
      const uniVol = vol / Math.sqrt(uni);
      this._mainOsc.type = p.osc.waveform;
      const mainSpread = p.osc.spread ?? 0.5;
      const { centerVol: mCtrVol, sideVol: mSideVol } = this._unisonVols(uni, p.osc.unisonBlend, uniVol * Math.sqrt(uni));
      this._mainOsc.frequency.setTargetAtTime(f, now, 0.003);
      this._mainOsc.detune.value = this._unisonCentOffset(0, uni, p.osc.cent, p.osc.unisonDetune);
      this._mainOscG.gain.setTargetAtTime(mCtrVol, now, 0.002);
      if (this._mainUniPanner) this._mainUniPanner.pan.setValueAtTime(this._unisonPanPos(0, uni, mainSpread), now);
      this._unisonExtraOscs.forEach((u, i) => {
        u.osc.type = p.osc.waveform;
        u.osc.frequency.setTargetAtTime(f, now, 0.003);
        u.osc.detune.value = this._unisonCentOffset(i + 1, uni, p.osc.cent, p.osc.unisonDetune);
        const active = (i + 1) < uni;
        u.gain.gain.setTargetAtTime(active ? mSideVol : 0, now, 0.002);
        if (u.panner) u.panner.pan.setValueAtTime(active ? this._unisonPanPos(i + 1, uni, mainSpread) : 0, now);
      });
      this._currentOscFreq = this._mainOsc.frequency;
      this._currentOscDetune = this._mainOsc.detune;
      this._liveOsc = this._mainOsc;
      this._currentOscGain = this._mainOscG.gain;
    }

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
      if (t === 'pitch')    { try { lfo.gain.disconnect(); } catch(_){} lfo.gain.connect(this._liveOsc.detune); lfo.connected = 'pitch'; }
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

    this._tweNoteOn(velocity);
  }

  bend(cents) {
    if (!this._baseFreq) return;
    const f = this._baseFreq * Math.pow(2, cents / 1200);
    const t = this.ctx.currentTime;
    if (this.p.osc.waveform === 'supersaw') {
      this._ssOscBank.forEach(s => s.osc.frequency.setTargetAtTime(f, t, 0.01));
    } else if (this._currentOscFreq) {
      this._currentOscFreq.setTargetAtTime(f, t, 0.01);
      this._unisonExtraOscs.forEach(u => u.osc.frequency.setTargetAtTime(f, t, 0.01));
    }
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
    // Silence osc gains after release completes (prevent leaking into next note)
    const afterRel = now + rel + 0.05;
    this._mainOscG.gain.setTargetAtTime(0, afterRel, 0.01);
    this._pulseOscG.gain.setTargetAtTime(0, afterRel, 0.01);
    this._ssG.gain.setTargetAtTime(0, afterRel, 0.01);
    this._noiseG.gain.setTargetAtTime(0, afterRel, 0.01);
    this._unisonExtraOscs.forEach(u => u.gain.gain.setTargetAtTime(0, afterRel, 0.01));
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
    const vol = this.p.osc.volume * vel;

    if (isFirst) {
      // Full noteOn for first chord note — triggers ADSR + sets up all oscs
      this.noteOn(freq, vel);
    } else {
      // Subsequent notes: just update the target slot's frequency
      if (slotIdx === 0) {
        const o = this.p.osc.waveform === 'pulse' ? this._pulseOsc : this._mainOsc;
        o.frequency.setTargetAtTime(f, t, 0.003);
        const g = this.p.osc.waveform === 'pulse' ? this._pulseOscG : this._mainOscG;
        g.gain.setTargetAtTime(vol, t, 0.002);
      } else if (slotIdx - 1 < this._unisonExtraOscs.length) {
        const u = this._unisonExtraOscs[slotIdx - 1];
        if (this.p.osc.waveform !== 'supersaw') {
          if (this.p.osc.waveform === 'pulse') {
            u.osc.setPeriodicWave(this._makePulseWave(this.p.osc.pw));
          } else {
            u.osc.type = this.p.osc.waveform;
          }
        }
        u.osc.frequency.setTargetAtTime(f, t, 0.003);
        u.osc.detune.value = 0; // no detune in chord mode
        u.gain.gain.setTargetAtTime(vol, t, 0.002);
      }
    }
  }

  // Releases a single unison slot. Triggers full noteOff only when all slots released.
  noteOffSlot(slotIdx) {
    if (!this._heldSlots) return;
    this._heldSlots.delete(slotIdx);
    const t = this.ctx.currentTime;
    // Silence the slot's oscillator
    if (slotIdx > 0 && slotIdx - 1 < this._unisonExtraOscs.length) {
      this._unisonExtraOscs[slotIdx - 1].gain.gain.setTargetAtTime(0, t, 0.02);
    }
    // If all slots released → trigger ADSR release
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
      if (key === 'pitch' && this._currentOscFreq && this._midiFreq) {
        const newFreq = this._midiFreq * Math.pow(2, val / 12);
        this._currentOscFreq.setTargetAtTime(newFreq, t, 0.01);
        this._unisonExtraOscs.forEach(u => u.osc.frequency.setTargetAtTime(newFreq, t, 0.01));
      }
      if (key === 'cent' || key === 'unisonDetune') {
        this._applyUnisonDetune(t);
      }
      if (key === 'volume' && this._currentOscGain) {
        this._applyUnisonDetune(t); // re-normalises per-voice gain
      }
      if (key === 'unison' || key === 'unisonBlend') {
        this._applyUnisonDetune(t);
      }
      if (key === 'pw' && this._liveOsc && this.p.osc.waveform === 'pulse') {
        this._liveOsc.setPeriodicWave(this._makePulseWave(val));
      }
      if (key === 'spread') {
        if (this._ssOscBank && this.p.osc.waveform === 'supersaw') {
          this._ssOscBank.forEach(({osc:o, baseSpread}) => {
            o.detune.setTargetAtTime(this.p.osc.cent + baseSpread * val * 2, t, 0.01);
          });
        } else {
          this._applyUnisonDetune(t); // also updates pan positions
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
function drawWaveform(canvas, type, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth  || 200;
  const H = canvas.offsetHeight || 82;
  if (!W || !H) return;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);

  c.fillStyle = '#030308'; c.fillRect(0, 0, W, H);

  // Grid — horizontal + vertical
  c.lineWidth = 0.5;
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  [0.25, 0.5, 0.75].forEach(x => { c.beginPath(); c.moveTo(x*W,0); c.lineTo(x*W,H); c.stroke(); });
  [0.25, 0.75].forEach(y => { c.beginPath(); c.moveTo(0,y*H); c.lineTo(W,y*H); c.stroke(); });
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();

  function sample(t) {
    const p = (t * 2) % 1;
    switch (type) {
      case 'sine':     return Math.sin(p * Math.PI * 2);
      case 'sawtooth': return 1 - 2*p;
      case 'square':   return p < 0.5 ? 1 : -1;
      case 'triangle': return p < 0.5 ? 4*p-1 : 3-4*p;
      case 'pulse':    return p < 0.25 ? 1 : -1; // 25% duty cycle preview
      case 'supersaw': { // sum of 3 detuned saws for preview
        const d = [0, 0.012, -0.009];
        return d.reduce((s, dt) => {
          const pp = ((t * 2) + dt) % 1;
          return s + (1 - 2*pp) * (dt === 0 ? 0.5 : 0.25);
        }, 0);
      }
      default:         return 0;
    }
  }

  const pad = 7, pts = W * 2;

  // Depth layers back→front using globalAlpha
  const layers = [
    { dy: 10, alpha: 0.12, blur: 0,  width: 1.5 },
    { dy:  6, alpha: 0.28, blur: 0,  width: 1.5 },
    { dy:  2, alpha: 0.55, blur: 3,  width: 2 },
    { dy:  0, alpha: 1.0,  blur: 10, width: 2 }
  ];

  layers.forEach(layer => {
    c.save();
    c.globalAlpha  = layer.alpha;
    c.strokeStyle  = color;
    c.shadowColor  = color;
    c.shadowBlur   = layer.blur;
    c.lineWidth    = layer.width;
    c.lineJoin     = 'round'; c.lineCap = 'round';
    const mid = H/2 + layer.dy;
    const amp = H/2 - pad - layer.dy * 0.4;
    c.beginPath();
    for (let i = 0; i <= pts; i++) {
      const t = i / pts, x = t * W;
      const y = mid - sample(t) * amp;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
    c.restore();
  });
}

// Live waveform drawing from analyser buffer
function drawLiveWaveform(canvas, buf, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 82;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#030308'; c.fillRect(0, 0, W, H);
  c.lineWidth = 0.5;
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  [0.25, 0.5, 0.75].forEach(x => { c.beginPath(); c.moveTo(x*W,0); c.lineTo(x*W,H); c.stroke(); });
  [0.25, 0.75].forEach(y => { c.beginPath(); c.moveTo(0,y*H); c.lineTo(W,y*H); c.stroke(); });
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.beginPath(); c.moveTo(0,H/2); c.lineTo(W,H/2); c.stroke();
  const sl = W / buf.length;
  c.save(); c.globalAlpha = 0.35; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 10; c.lineWidth = 4;
  c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < buf.length; i++) {
    const y = H/2 - (buf[i]/128-1) * (H/2-6);
    i === 0 ? c.moveTo(0,y) : c.lineTo(i*sl,y);
  }
  c.stroke(); c.restore();
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 6;
  c.lineWidth = 1.5; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < buf.length; i++) {
    const y = H/2 - (buf[i]/128-1) * (H/2-6);
    i === 0 ? c.moveTo(0,y) : c.lineTo(i*sl,y);
  }
  c.stroke();
}

// ─────────────────────────────────────────────────────────
//  Knob — canvas rotary, drag up/down, dblclick to type
// ─────────────────────────────────────────────────────────
function makeKnob({ parent, min, max, value, label, unit='', decimals=1, step=0, color='#00ffb2', onChange, defaultValue }) {
  const dpr = window.devicePixelRatio || 1, S = 44;
  const wrap = document.createElement('div'); wrap.className = 'knob-wrap';
  const canvas = document.createElement('canvas');
  canvas.width = S*dpr; canvas.height = S*dpr;
  canvas.style.cssText = `width:${S}px;height:${S}px;display:block;margin:0 auto`;
  canvas.title = 'Drag: adjust | Dblclick: type value | Ctrl+Click: reset to default';
  const valEl = document.createElement('div'); valEl.className = 'knob-val';
  const lblEl = document.createElement('div'); lblEl.className = 'knob-lbl'; lblEl.textContent = label;
  wrap.append(canvas, valEl, lblEl); parent.appendChild(wrap);

  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  let val = value;
  const defVal = defaultValue !== undefined ? defaultValue : value;

  function fmt(v) {
    const s = step ? Math.round(v/step)*step : v;
    return parseFloat(s.toFixed(decimals)) + unit;
  }
  let modNorm = null; // null = no modulation display
  function draw() {
    const n = (val-min)/(max-min), CX=S/2, CY=S/2, R=16;
    const a0 = 0.75*Math.PI, sweep = 1.5*Math.PI, a1 = a0 + n*sweep;
    c.clearRect(0,0,S,S);
    c.lineCap = 'round'; c.lineWidth = 3;
    c.beginPath(); c.arc(CX,CY,R,a0,a0+sweep); c.strokeStyle='#1c1c3a'; c.stroke();
    if (n > 0.005) { c.beginPath(); c.arc(CX,CY,R,a0,a1); c.strokeStyle=color; c.stroke(); }
    c.beginPath(); c.arc(CX,CY,4,0,Math.PI*2); c.fillStyle='#12122a'; c.fill();
    const ix=CX+(R-6)*Math.cos(a1), iy=CY+(R-6)*Math.sin(a1);
    c.beginPath(); c.arc(ix,iy,2.5,0,Math.PI*2); c.fillStyle='#fff'; c.fill();
    // Modulation ring — outer dot showing live modulated position
    if (modNorm !== null) {
      const Rm = R + 5, nm = Math.max(0, Math.min(1, modNorm));
      const am = a0 + nm * sweep;
      const mx = CX + Rm * Math.cos(am), my = CY + Rm * Math.sin(am);
      c.save();
      c.beginPath(); c.arc(CX,CY,Rm,a0,a0+sweep);
      c.strokeStyle='rgba(255,255,255,0.08)'; c.lineWidth=1.5; c.stroke();
      c.shadowColor = color; c.shadowBlur = 6;
      c.beginPath(); c.arc(mx,my,2.5,0,Math.PI*2);
      c.fillStyle = color; c.globalAlpha = 0.9; c.fill();
      c.restore();
    }
    valEl.textContent = fmt(val);
  }

  let sy, sv;
  canvas.style.cursor = 'ns-resize';
  canvas.addEventListener('pointerdown', e => {
    // Ctrl+Click (Cmd+Click on Mac) to reset to default
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      val = defVal;
      draw();
      onChange?.(val);
      return;
    }
    e.preventDefault(); sy=e.clientY; sv=val; canvas.setPointerCapture(e.pointerId);
    const onMove = e => {
      val = Math.max(min, Math.min(max, sv + (sy-e.clientY)*(max-min)/200));
      draw(); onChange?.(step ? Math.round(val/step)*step : val);
    };
    const onUp = () => { canvas.removeEventListener('pointermove',onMove); canvas.removeEventListener('pointerup',onUp); };
    canvas.addEventListener('pointermove',onMove); canvas.addEventListener('pointerup',onUp);
  });
  canvas.addEventListener('dblclick', () => {
    const s = prompt(`${label} [${min}–${max}]`, fmt(val));
    if (s===null) return;
    const parsed = parseFloat(s);
    if (!isNaN(parsed)) { val=Math.max(min,Math.min(max,parsed)); draw(); onChange?.(val); }
  });
  draw();
  return {
    setValue(v)       { val=Math.max(min,Math.min(max,v)); draw(); },
    setModValue(v)    { modNorm = v === null ? null : (Math.max(min,Math.min(max,v))-min)/(max-min); draw(); },
    clearModValue()   { modNorm = null; draw(); },
  };
}

// ─────────────────────────────────────────────────────────
//  Filter frequency response curve
// ─────────────────────────────────────────────────────────
function drawFilterCurve(canvas, filterNode, color, envAmount = 0, modCutoff = null) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 100, H = canvas.offsetHeight || 90;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);

  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 0.5;
  [100, 500, 1000, 5000, 10000].forEach(f => {
    const x = Math.log10(f / 20) / Math.log10(1000) * W;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
  });
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();

  const pts = W * 2;
  const freqs = new Float32Array(pts);
  const mags  = new Float32Array(pts);
  const phase = new Float32Array(pts);
  for (let i = 0; i < pts; i++) freqs[i] = 20 * Math.pow(1000, i / pts);
  filterNode.getFrequencyResponse(freqs, mags, phase);

  const dBRange = 30;
  const toY = m => H/2 - (20 * Math.log10(Math.max(1e-5, m)) / dBRange) * (H/2);

  // ENV ghost curve: show peak cutoff position using a temp filter
  if (envAmount > 0) {
    const tmp = filterNode.context.createBiquadFilter();
    tmp.type = filterNode.type;
    tmp.frequency.value = Math.min(20000, filterNode.frequency.value + envAmount);
    tmp.Q.value = filterNode.Q.value;
    const magsEnv = new Float32Array(pts);
    tmp.getFrequencyResponse(freqs, magsEnv, new Float32Array(pts));
    c.save(); c.globalAlpha = 0.25; c.strokeStyle = color;
    c.setLineDash([3, 3]); c.lineWidth = 1; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, toY(magsEnv[0]));
    for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(magsEnv[i]))));
    c.stroke(); c.setLineDash([]); c.restore();
  }

  // Fill
  c.save(); c.globalAlpha = 0.12; c.fillStyle = color;
  c.beginPath(); c.moveTo(0, toY(mags[0]));
  for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(mags[i]))));
  c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill(); c.restore();

  // Glow
  c.save(); c.globalAlpha = 0.4; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 8; c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(0, toY(mags[0]));
  for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(mags[i]))));
  c.stroke(); c.restore();

  // Main line
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 4;
  c.lineWidth = 1.5; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(0, toY(mags[0]));
  for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(mags[i]))));
  c.stroke();

  // Live modulation overlay: ghost curve at modulated cutoff + vertical cursor
  if (modCutoff !== null) {
    const tmp = filterNode.context.createBiquadFilter();
    tmp.type = filterNode.type;
    tmp.frequency.value = Math.max(20, Math.min(20000, modCutoff));
    tmp.Q.value = filterNode.Q.value;
    const magsMod = new Float32Array(pts);
    tmp.getFrequencyResponse(freqs, magsMod, new Float32Array(pts));

    // Ghost fill
    c.save(); c.globalAlpha = 0.18; c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, toY(magsMod[0]));
    for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(magsMod[i]))));
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill(); c.restore();

    // Ghost line
    c.save(); c.globalAlpha = 0.7; c.strokeStyle = '#ffffff';
    c.shadowColor = '#ffffff'; c.shadowBlur = 6; c.lineWidth = 1; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, toY(magsMod[0]));
    for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(magsMod[i]))));
    c.stroke(); c.restore();

    // Vertical cursor at modulated frequency
    const xMod = Math.log10(Math.max(20, modCutoff) / 20) / Math.log10(1000) * W;
    c.save(); c.globalAlpha = 0.6; c.strokeStyle = '#ffffff';
    c.shadowColor = '#ffffff'; c.shadowBlur = 4; c.lineWidth = 1;
    c.setLineDash([2, 3]);
    c.beginPath(); c.moveTo(xMod, 0); c.lineTo(xMod, H); c.stroke();
    c.setLineDash([]); c.restore();
  }
}

// ─────────────────────────────────────────────────────────
//  Noise preview canvas drawing
// ─────────────────────────────────────────────────────────
function drawNoisePreview(canvas, type, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 64, H = canvas.offsetHeight || 60;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,0.07)';
  c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();

  // Generate representative noise samples pseudo-randomly per type
  const pts = W * 2;
  const seed = NOISE_TYPES.indexOf(type) * 12345 + 6789;
  function rand(i) { let x = Math.sin(seed + i * 127.1) * 43758.5; return x - Math.floor(x); }

  const samples = [];
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0, last=0, prev=0, lw0=0,lw1=0;
  for (let i = 0; i < pts; i++) {
    const w = rand(i) * 2 - 1;
    let v = w;
    if (type === 'pink') {
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      v=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11*3; b6=w*0.115926;
    } else if (type === 'brown') {
      last=(last+0.02*w)/1.02; v=Math.max(-1,Math.min(1,last*3.5));
    } else if (type === 'blue') {
      v=w-prev; prev=w;
    } else if (type === 'violet') {
      const b=w-lw0; v=b-lw1; lw0=w; lw1=b;
    }
    samples.push(v);
  }
  const mx = samples.reduce((m,v)=>Math.max(m,Math.abs(v)),0.001);
  const norm = samples.map(v => v/mx);

  c.save();
  c.globalAlpha = 0.35; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 6; c.lineWidth = 3;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < pts; i++) {
    const x = (i/pts)*W, y = H/2 - norm[i]*(H/2-4);
    i===0 ? c.moveTo(x,y) : c.lineTo(x,y);
  }
  c.stroke(); c.restore();
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 4;
  c.lineWidth = 1; c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < pts; i++) {
    const x = (i/pts)*W, y = H/2 - norm[i]*(H/2-4);
    i===0 ? c.moveTo(x,y) : c.lineTo(x,y);
  }
  c.stroke();
}

// Noise panel component (right column of OSC section)
function createNoisePanel({ voice, color }) {
  const p = voice.p;
  const wrap = document.createElement('div'); wrap.className = 'osc-noise-strip';
  wrap.style.setProperty('--accent', color);

  // Two-column layout: controls left, canvas right (mirror filter/ADSR)
  const noiseCols = document.createElement('div'); noiseCols.className = 'noise-cols';
  const noiseLeft  = document.createElement('div'); noiseLeft.className  = 'noise-left';
  const noiseRight = document.createElement('div'); noiseRight.className = 'noise-right';
  noiseCols.append(noiseLeft, noiseRight);
  wrap.appendChild(noiseCols);

  // Left: header label + type nav row
  const noiseHdrLbl = document.createElement('span'); noiseHdrLbl.className = 'noise-strip-lbl'; noiseHdrLbl.textContent = 'NOISE';
  noiseLeft.appendChild(noiseHdrLbl);

  const typeRow = document.createElement('div'); typeRow.className = 'noise-type-row';
  const prevBtn = document.createElement('button'); prevBtn.className = 'noise-nav-btn'; prevBtn.textContent = '<';
  const typeLbl = document.createElement('span'); typeLbl.className = 'noise-strip-type-lbl';
  typeLbl.textContent = NOISE_LABELS[NOISE_TYPES.indexOf(p.noise.type)] || 'White';
  const nextBtn = document.createElement('button'); nextBtn.className = 'noise-nav-btn'; nextBtn.textContent = '>';
  typeRow.append(prevBtn, typeLbl, nextBtn);
  noiseLeft.appendChild(typeRow);

  // Left: level knob + filter mix knob
  const knobRow = document.createElement('div'); knobRow.className = 'knob-row';
  const _lvlKnob = makeKnob({ parent: knobRow, min: 0, max: 1, value: p.noise.volume, label: 'LEVEL', decimals: 2, color,
    onChange: v => voice.set('noise', 'volume', v) });
  voice._noiseKnob = _lvlKnob;
  makeKnob({ parent: knobRow, min: 0, max: 1, value: p.noise.filterMix ?? 1, label: 'FILT', decimals: 2, color: '#aaaaff',
    onChange: v => voice.set('noise', 'filterMix', v) });
  noiseLeft.appendChild(knobRow);

  // Right: noise waveform preview canvas
  const canvas = document.createElement('canvas'); canvas.className = 'noise-preview';
  noiseRight.appendChild(canvas);
  requestAnimationFrame(() => drawNoisePreview(canvas, p.noise.type, color));

  const setType = (type) => {
    typeLbl.textContent = NOISE_LABELS[NOISE_TYPES.indexOf(type)];
    voice.set('noise', 'type', type); // handles p.noise.type, cache invalidation, AND live node hot-swap
    requestAnimationFrame(() => drawNoisePreview(canvas, type, color));
  };
  prevBtn.addEventListener('click', () => { const i=NOISE_TYPES.indexOf(p.noise.type); setType(NOISE_TYPES[(i-1+NOISE_TYPES.length)%NOISE_TYPES.length]); });
  nextBtn.addEventListener('click', () => { const i=NOISE_TYPES.indexOf(p.noise.type); setType(NOISE_TYPES[(i+1)%NOISE_TYPES.length]); });

  return { element: wrap };
}

// ─────────────────────────────────────────────────────────
//  Reusable UI Components
// ─────────────────────────────────────────────────────────

// Parameter display (compact numerical, click to edit)
function createParamDisplay({ label, value, min, max, unit = '', color, onChange }) {
  const wrap = document.createElement('div'); wrap.className = 'osc-param';
  const lbl = document.createElement('span'); lbl.className = 'osc-param-lbl'; lbl.textContent = label;
  const val = document.createElement('span'); val.className = 'osc-param-val';
  val.textContent = (value >= 0 ? '+' : '') + value + unit;
  wrap.append(lbl, val);
  wrap.style.setProperty('--accent', color);
  
  wrap.addEventListener('click', () => {
    const input = prompt(`${label} [${min} to ${max}${unit}]`, value);
    if (input !== null) {
      const parsed = unit === '' ? parseInt(input) : parseFloat(input);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        onChange(clamped);
        val.textContent = (clamped >= 0 ? '+' : '') + clamped + unit;
      }
    }
  });
  
  return { element: wrap, setValue: (v) => { val.textContent = (v >= 0 ? '+' : '') + v + unit; } };
}

// Button group (waveform selector, filter type, etc.)
function createButtonGroup({ parent, options, activeValue, className = 'wave-btn', onChange }) {
  const row = document.createElement('div'); row.className = 'btn-row';
  parent.appendChild(row);
  const buttons = [];
  
  options.forEach(opt => {
    const b = document.createElement('button');
    b.className = className + (opt.value === activeValue ? ' active' : '');
    b.textContent = opt.label;
    b.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');
      onChange(opt.value);
    });
    row.appendChild(b);
    buttons.push(b);
  });
  
  return { element: row, buttons };
}

// Waveform canvas — static preview + live signal when playing
function createWaveformCanvas({ color, waveform, analyser }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'osc-wave-preview';
  let currentWaveform = waveform;

  if (analyser) {
    const buf = new Uint8Array(analyser.frequencyBinCount);
    function animate() {
      requestAnimationFrame(animate);
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
      if (peak > 3) {
        drawLiveWaveform(canvas, buf, color);
      } else {
        drawWaveform(canvas, currentWaveform, color);
      }
    }
    animate();
  } else {
    requestAnimationFrame(() => drawWaveform(canvas, waveform, color));
  }

  const redraw = (type) => { currentWaveform = type; if (!analyser) requestAnimationFrame(() => drawWaveform(canvas, type, color)); };
  return { element: canvas, redraw };
}

// Knob row builder
function createKnobRow({ parent, knobs, color }) {
  const row = document.createElement('div'); row.className = 'knob-row';
  parent.appendChild(row);
  
  const knobInstances = knobs.map(k => 
    makeKnob({ parent: row, color, ...k })
  );
  
  return { element: row, knobs: knobInstances };
}

// Module-scope helper used by standalone section builders
function addSectionToggle(secEl, onDisable, onEnable, startEnabled = true) {
  const hdr = secEl.querySelector('.sec-hdr');
  if (!hdr) return;
  const btn = document.createElement('button');
  btn.className = 'sec-bypass-btn' + (startEnabled ? ' active' : '');
  btn.textContent = startEnabled ? 'ON' : 'OFF';
  btn.title = 'Enable/disable this section';
  btn.addEventListener('click', () => {
    const isOn = btn.classList.toggle('active');
    btn.textContent = isOn ? 'ON' : 'OFF';
    secEl.classList.toggle('sec-bypassed', !isOn);
    isOn ? onEnable() : onDisable();
  });
  hdr.appendChild(btn);
  if (!startEnabled) secEl.classList.add('sec-bypassed');
}

// ─────────────────────────────────────────────────────────
//  Distortion transfer-function curve visualizer
// ─────────────────────────────────────────────────────────
function drawDistCurve(canvas, form, drive, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 120, H = canvas.offsetHeight || 80;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);

  // Grid lines
  c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(W/2, 0); c.lineTo(W/2, H); c.stroke();
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();
  // Identity reference line (linear)
  c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 0.8; c.setLineDash([3,3]);
  c.beginPath(); c.moveTo(0, H); c.lineTo(W, 0); c.stroke();
  c.setLineDash([]);

  // Compute transfer function
  function distSample(x) {
    if (drive < 0.001 && form !== 'soft') return x;
    const k = 1 + drive * 40;
    switch (form) {
      case 'soft': return drive < 0.001 ? x : Math.tanh(x * k) / Math.tanh(k);
      case 'hard': return Math.max(-1, Math.min(1, x * k));
      case 'fold': {
        let v = x * (1 + drive * 8);
        while (v > 1 || v < -1) v = v > 1 ? 2 - v : -2 - v;
        return v;
      }
      case 'asym': return x >= 0
        ? Math.tanh(x * k) / Math.tanh(k)
        : Math.tanh(x * k * 0.4) / Math.tanh(k * 0.4) * 0.7;
      case 'fuzz': {
        const v = x * (1 + drive * 200);
        return Math.sign(v) * Math.min(1, Math.abs(v) ** 0.2);
      }
      default: return x;
    }
  }

  // Glow pass
  c.save(); c.globalAlpha = 0.35; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 8; c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= W * 2; i++) {
    const x = (i / (W * 2)) * 2 - 1;           // -1 to +1
    const y = distSample(x);                     // -1 to +1 out
    const px = (x + 1) / 2 * W;
    const py = (1 - (y + 1) / 2) * H;
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke(); c.restore();

  // Main line
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 4;
  c.lineWidth = 1.5; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= W * 2; i++) {
    const x = (i / (W * 2)) * 2 - 1;
    const y = distSample(x);
    const px = (x + 1) / 2 * W;
    const py = (1 - (y + 1) / 2) * H;
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke();

  // Axis labels
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.font = `${6 / dpr}px Courier New`;
  c.fillText('IN', W - 12, H/2 - 3);
  c.fillText('OUT', 3, 8);
}

// ── EQ Section (3-band per voice) ─────────────────────────
function buildEQSection(container, eq, voice, color) {
  // Single horizontal row: all 6 knobs (LOW gain/freq, MID gain/freq, HIGH gain/freq)
  const knobRow = document.createElement('div'); knobRow.className = 'knob-row';
  container.appendChild(knobRow);
  [
    { key:'lowGain',  label:'LOW',   min:-18, max:18,    value:eq.lowGain,  decimals:1, unit:'dB' },
    { key:'lowFreq',  label:'L.FRQ', min:40,  max:800,   value:eq.lowFreq,  decimals:0, unit:'Hz' },
    { key:'midGain',  label:'MID',   min:-18, max:18,    value:eq.midGain,  decimals:1, unit:'dB' },
    { key:'midFreq',  label:'M.FRQ', min:200, max:8000,  value:eq.midFreq,  decimals:0, unit:'Hz' },
    { key:'highGain', label:'HIGH',  min:-18, max:18,    value:eq.highGain, decimals:1, unit:'dB' },
    { key:'highFreq', label:'H.FRQ', min:2000,max:16000, value:eq.highFreq, decimals:0, unit:'Hz' },
  ].forEach(cfg => makeKnob({ parent:knobRow, color, ...cfg, onChange: v => voice.set('eq', cfg.key, v) }));

  addSectionToggle(container,
    () => { voice.p.eq.bypassed = true;  const t = voice.ctx.currentTime;
            voice._eqLow.gain.setTargetAtTime(0, t, 0.01);
            voice._eqMid.gain.setTargetAtTime(0, t, 0.01);
            voice._eqHigh.gain.setTargetAtTime(0, t, 0.01); },
    () => { voice.p.eq.bypassed = false; const t = voice.ctx.currentTime;
            voice._eqLow.gain.setTargetAtTime(eq.lowGain,  t, 0.01);
            voice._eqMid.gain.setTargetAtTime(eq.midGain,  t, 0.01);
            voice._eqHigh.gain.setTargetAtTime(eq.highGain, t, 0.01); },
    !voice.p.eq.bypassed
  );
}

// ── FX Section (Reverb + Delay per voice) ─────────────────
function buildFXSection(container, fx, voice, color) {
  const cols = document.createElement('div');
  cols.style.cssText = 'display:flex;gap:12px;';
  container.appendChild(cols);

  // REVERB block
  const rvbBlock = document.createElement('div');
  rvbBlock.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;';
  cols.appendChild(rvbBlock);
  const rvbLbl = document.createElement('div');
  rvbLbl.style.cssText = 'font-size:9px;letter-spacing:2px;color:rgba(255,255,255,0.35);padding-bottom:2px;';
  rvbLbl.textContent = 'REVERB';
  rvbBlock.appendChild(rvbLbl);
  const rvbRow = document.createElement('div'); rvbRow.className = 'knob-row';
  rvbBlock.appendChild(rvbRow);
  [
    { key:'reverbMix',   label:'MIX',   min:0,   max:1,   value:fx.reverbMix,   decimals:2 },
    { key:'reverbDecay', label:'DECAY', min:0.1, max:8,   value:fx.reverbDecay, decimals:1, unit:'s' },
  ].forEach(cfg => makeKnob({ parent:rvbRow, color, ...cfg,
    onChange: v => voice.set('fx', cfg.key, v) }));

  // Divider
  const div = document.createElement('div');
  div.style.cssText = 'width:1px;background:#252545;margin:4px 0;';
  cols.appendChild(div);

  // DELAY block
  const dlyBlock = document.createElement('div');
  dlyBlock.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;';
  cols.appendChild(dlyBlock);
  const dlyLbl = document.createElement('div');
  dlyLbl.style.cssText = 'font-size:9px;letter-spacing:2px;color:rgba(255,255,255,0.35);padding-bottom:2px;';
  dlyLbl.textContent = 'DELAY';
  dlyBlock.appendChild(dlyLbl);
  const dlyRow = document.createElement('div'); dlyRow.className = 'knob-row';
  dlyBlock.appendChild(dlyRow);
  [
    { key:'delayMix',  label:'MIX',  min:0,    max:1,    value:fx.delayMix,  decimals:2 },
    { key:'delayTime', label:'TIME', min:0.01, max:2,    value:fx.delayTime, decimals:2, unit:'s' },
    { key:'delayFB',   label:'FB',   min:0,    max:0.95, value:fx.delayFB,   decimals:2 },
  ].forEach(cfg => makeKnob({ parent:dlyRow, color, ...cfg,
    onChange: v => voice.set('fx', cfg.key, v) }));

  addSectionToggle(container,
    () => { voice.p.fx.bypassed = true;  const t = voice.ctx.currentTime;
            voice._rvbWet.gain.setTargetAtTime(0, t, 0.02);
            voice._dlyWet.gain.setTargetAtTime(0, t, 0.02); },
    () => { voice.p.fx.bypassed = false; const t = voice.ctx.currentTime;
            voice._rvbWet.gain.setTargetAtTime(fx.reverbMix, t, 0.02);
            voice._dlyWet.gain.setTargetAtTime(fx.delayMix,  t, 0.02); },
    !voice.p.fx.bypassed
  );
}

// ── Distortion Section ────────────────────────────────────
function buildDistSection(container, dp, voice, color) {
  const FORMS = ['soft','hard','fold','asym','fuzz'];
  const FORM_LABELS = { soft:'SOFT', hard:'HARD', fold:'FOLD', asym:'ASYM', fuzz:'FUZZ' };
  const FORM_TIPS   = {
    soft: 'Tanh saturation — smooth tube warmth',
    hard: 'Hard clip — transistor crunch',
    fold: 'Wavefolder — metallic, Buchla-style',
    asym: 'Asymmetric clip — 2nd harmonic overdrive',
    fuzz: 'Extreme fuzz — near-square saturation',
  };

  // Two-column layout: left = controls, right = curve canvas (mirrors ADSR layout)
  const cols = document.createElement('div'); cols.className = 'dist-cols';
  container.appendChild(cols);

  const left = document.createElement('div'); left.className = 'dist-left';
  cols.appendChild(left);

  // Form selector row
  const formRow = document.createElement('div'); formRow.className = 'dist-form-row';
  left.appendChild(formRow);

  // Curve canvas (right side — fills column like adsr-canvas)
  const distRight = document.createElement('div'); distRight.className = 'dist-right';
  cols.appendChild(distRight);
  const distCvs = document.createElement('canvas'); distCvs.className = 'dist-canvas';
  distRight.appendChild(distCvs);

  const redrawDist = () => requestAnimationFrame(() =>
    drawDistCurve(distCvs, dp.form, dp.drive, color));

  FORMS.forEach(f => {
    const b = document.createElement('button');
    b.className = 'wave-btn' + (f === dp.form ? ' active' : '');
    b.textContent = FORM_LABELS[f]; b.title = FORM_TIPS[f];
    b.addEventListener('click', () => {
      formRow.querySelectorAll('.wave-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      voice.set('dist', 'form', f);
      redrawDist();
    });
    formRow.appendChild(b);
  });

  // Knob row
  const kr = document.createElement('div'); kr.className = 'knob-row';
  left.appendChild(kr);
  [
    { key:'drive',  label:'DRIVE',  min:0,   max:1,     value:dp.drive,  decimals:2 },
    { key:'tone',   label:'TONE',   min:200, max:18000, value:dp.tone,   decimals:0, unit:'Hz' },
    { key:'mix',    label:'MIX',    min:0,   max:1,     value:dp.mix,    decimals:2 },
    { key:'volume', label:'VOL',    min:0,   max:2,     value:dp.volume, decimals:2 },
  ].forEach(cfg => {
    makeKnob({ parent:kr, color, ...cfg, onChange: v => {
      voice.set('dist', cfg.key, v);
      if (cfg.key === 'drive') redrawDist();
    }});
  });

  // Initial draw
  redrawDist();

  addSectionToggle(container,
    () => { voice.p.dist.bypassed = true;  voice._distWet.gain.setTargetAtTime(0,       voice.ctx.currentTime, 0.01);
                                            voice._distDry.gain.setTargetAtTime(1,       voice.ctx.currentTime, 0.01); },
    () => { voice.p.dist.bypassed = false; voice._distWet.gain.setTargetAtTime(dp.mix,     voice.ctx.currentTime, 0.01);
                                            voice._distDry.gain.setTargetAtTime(1-dp.mix, voice.ctx.currentTime, 0.01); },
    !voice.p.dist.bypassed
  );
}

// Interactive ADSR canvas (Serum-style)
function buildADSRSection(container, adsrP, voice, color) {
  const SUSTAIN_W = 0.35; // fraction of canvas width reserved for sustain display

  // Two-column layout: knobs left, canvas right
  const adsrCols = document.createElement('div'); adsrCols.className = 'adsr-cols';
  container.appendChild(adsrCols);

  const adsrLeft  = document.createElement('div'); adsrLeft.className  = 'adsr-left';
  const adsrRight = document.createElement('div'); adsrRight.className = 'adsr-right';
  adsrCols.append(adsrLeft, adsrRight);

  // Canvas goes in right column
  const cvs = document.createElement('canvas'); cvs.className = 'adsr-canvas';
  adsrRight.appendChild(cvs);

  // Knob row goes in left column
  const knobRow = document.createElement('div'); knobRow.className = 'knob-row';
  adsrLeft.appendChild(knobRow);

  let knobRefs = {};

  // ── Drawing ────────────────────────────────────────────
  function getLayout(W, H) {
    const a = adsrP.attack, d = adsrP.decay, s = adsrP.sustain, r = adsrP.release;
    const total = a + d + r;                // time for ATK+DEC+REL
    const susW  = W * SUSTAIN_W;           // fixed sustain display width
    const dynW  = W - susW;                // width shared by A+D+R
    const toX = t => (t / total) * dynW;
    const toY = v => H - 6 - v * (H - 12);

    const x0 = 0,        y0 = toY(0);
    const xa = toX(a),   ya = toY(1);
    const xd = toX(a+d), yd = toY(s);
    const xs = xd + susW;                  // sustain end x (note-off)
    const xr = xs + toX(r), yr = toY(0);

    // Bezier control points driven by curve shape
    const ac = adsrP.atkCurve ?? 0;
    const dc = adsrP.decCurve ?? 0;
    const rc = adsrP.relCurve ?? 0;

    const atkCp  = { x: xa * 0.5, y: ya + (y0 - ya) * (0.5 + ac * 0.45) };
    const decCp  = { x: (xa+xd)*0.5, y: ya + (yd - ya) * (0.5 - dc * 0.45) };
    const relCp  = { x: xs + toX(r)*0.5, y: yd + (yr - yd) * (0.5 - rc * 0.45) };

    return { x0,y0, xa,ya, xd,yd, xs,yr,xr, susW,
             atkCp, decCp, relCp,
             noteOffX: xs };
  }

  function redraw() {
    const dpr = window.devicePixelRatio || 1;
    const W = cvs.offsetWidth || 200, H = cvs.offsetHeight || 90;
    if (!W || !H) return;
    cvs.width = W * dpr; cvs.height = H * dpr;
    const c = cvs.getContext('2d'); c.scale(dpr, dpr);
    c.fillStyle = '#030308'; c.fillRect(0, 0, W, H);

    const L = getLayout(W, H);

    // Grid lines
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 0.5;
    [0.25, 0.5, 0.75].forEach(v => {
      const y = H - 6 - v * (H - 12);
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    });

    // Note-off marker
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1;
    c.setLineDash([3,3]);
    c.beginPath(); c.moveTo(L.noteOffX, 0); c.lineTo(L.noteOffX, H); c.stroke();
    c.setLineDash([]);

    // Stage labels
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.font = '6px Courier New';
    c.fillText('A', 3, H - 2);
    c.fillText('D', L.xa + 3, H - 2);
    c.fillText('S', L.xd + 3, H - 2);
    c.fillText('R', L.xs + 3, H - 2);

    // Build path helper
    function buildPath() {
      c.beginPath();
      c.moveTo(L.x0, L.y0);
      c.quadraticCurveTo(L.atkCp.x, L.atkCp.y, L.xa, L.ya);
      c.quadraticCurveTo(L.decCp.x, L.decCp.y, L.xd, L.yd);
      c.lineTo(L.xs, L.yd);
      c.quadraticCurveTo(L.relCp.x, L.relCp.y, L.xr, L.yr);
    }

    // Fill
    buildPath();
    c.lineTo(W, H); c.lineTo(0, H); c.closePath();
    c.save(); c.globalAlpha = 0.14; c.fillStyle = color; c.fill(); c.restore();

    // Glow stroke
    buildPath();
    c.save(); c.globalAlpha = 0.35; c.strokeStyle = color;
    c.shadowColor = color; c.shadowBlur = 8; c.lineWidth = 3; c.lineJoin = 'round';
    c.stroke(); c.restore();

    // Main stroke
    buildPath();
    c.save(); c.strokeStyle = color; c.lineWidth = 1.5; c.lineJoin = 'round';
    c.shadowColor = color; c.shadowBlur = 3; c.stroke(); c.restore();

    // Endpoint handles
    [[L.xa,L.ya],[L.xd,L.yd],[L.xr,L.yr]].forEach(([x,y]) => {
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI*2);
      c.fillStyle = color; c.fill();
      c.strokeStyle = '#030308'; c.lineWidth = 1.5; c.stroke();
    });

    // Curve midpoint handles (small hollow circles)
    [L.atkCp, L.decCp, L.relCp].forEach(p => {
      c.beginPath(); c.arc(p.x, p.y, 3, 0, Math.PI*2);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.5; c.stroke();
    });
  }

  // ── Interaction ────────────────────────────────────────
  let drag = null;
  const HIT = 9; // hit radius in px

  function getCanvasPos(e) {
    const r = cvs.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function hitTest(mx, my, W, H) {
    const L = getLayout(W, H);
    const pts = [
      { key:'atkEnd',   x:L.xa,       y:L.ya },
      { key:'decEnd',   x:L.xd,       y:L.yd },
      { key:'relEnd',   x:L.xr,       y:L.yr },
      { key:'atkCurve', x:L.atkCp.x,  y:L.atkCp.y },
      { key:'decCurve', x:L.decCp.x,  y:L.decCp.y },
      { key:'relCurve', x:L.relCp.x,  y:L.relCp.y },
    ];
    for (const p of pts) {
      if (Math.hypot(mx - p.x, my - p.y) <= HIT) return p;
    }
    return null;
  }

  function onDown(e) {
    e.preventDefault();
    const W = cvs.offsetWidth, H = cvs.offsetHeight;
    const {x,y} = getCanvasPos(e);
    const hit = hitTest(x, y, W, H);
    if (hit) drag = { key: hit.key, startX: x, startY: y,
      startAtk: adsrP.attack, startDec: adsrP.decay, startSus: adsrP.sustain, startRel: adsrP.release,
      startAtkC: adsrP.atkCurve, startDecC: adsrP.decCurve, startRelC: adsrP.relCurve };
  }

  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    const W = cvs.offsetWidth, H = cvs.offsetHeight;
    const {x,y} = getCanvasPos(e);
    const dx = x - drag.startX, dy = y - drag.startY;
    const a = adsrP.attack, d = adsrP.decay, r = adsrP.release;
    const total = a + d + r;
    const dynW = W * (1 - SUSTAIN_W);
    const timePerPx = total / dynW;
    const valPerPx  = 1 / (H - 12);

    if (drag.key === 'atkEnd') {
      const v = Math.max(0.001, Math.min(2, drag.startAtk + dx * timePerPx));
      adsrP.attack = v; voice.set('adsr','attack',v);
      knobRefs.atk?.setValue(v);
    } else if (drag.key === 'decEnd') {
      const vt = Math.max(0.01, Math.min(2, drag.startDec + dx * timePerPx));
      const vs = Math.max(0, Math.min(1, drag.startSus - dy * valPerPx));
      adsrP.decay = vt; adsrP.sustain = vs;
      voice.set('adsr','decay',vt); voice.set('adsr','sustain',vs);
      knobRefs.dec?.setValue(vt); knobRefs.sus?.setValue(vs);
    } else if (drag.key === 'relEnd') {
      const v = Math.max(0.01, Math.min(4, drag.startRel + dx * timePerPx));
      adsrP.release = v; voice.set('adsr','release',v);
      knobRefs.rel?.setValue(v);
    } else if (drag.key === 'atkCurve') {
      const v = Math.max(-1, Math.min(1, drag.startAtkC - dy / 40));
      adsrP.atkCurve = v;
    } else if (drag.key === 'decCurve') {
      const v = Math.max(-1, Math.min(1, drag.startDecC - dy / 40));
      adsrP.decCurve = v;
    } else if (drag.key === 'relCurve') {
      const v = Math.max(-1, Math.min(1, drag.startRelC - dy / 40));
      adsrP.relCurve = v;
    }
    redraw();
  }

  function onUp() { drag = null; }

  cvs.addEventListener('mousedown',  onDown);
  cvs.addEventListener('touchstart', onDown, { passive:false });
  window.addEventListener('mousemove',  onMove);
  window.addEventListener('touchmove',  onMove, { passive:false });
  window.addEventListener('mouseup',    onUp);
  window.addEventListener('touchend',   onUp);

  // ── Knobs ──────────────────────────────────────────────
  knobRefs.atk = makeKnob({ parent:knobRow, min:0.001, max:2,  value:adsrP.attack,  label:'ATK', unit:'s', decimals:3, color, onChange: v => { adsrP.attack  = v; voice.set('adsr','attack', v);  redraw(); } });
  knobRefs.dec = makeKnob({ parent:knobRow, min:0.01,  max:2,  value:adsrP.decay,   label:'DEC', unit:'s', decimals:2, color, onChange: v => { adsrP.decay   = v; voice.set('adsr','decay',  v);  redraw(); } });
  knobRefs.sus = makeKnob({ parent:knobRow, min:0,     max:1,  value:adsrP.sustain, label:'SUS',           decimals:2, color, onChange: v => { adsrP.sustain = v; voice.set('adsr','sustain',v);  redraw(); } });
  knobRefs.rel = makeKnob({ parent:knobRow, min:0.01,  max:4,  value:adsrP.release, label:'REL', unit:'s', decimals:2, color, onChange: v => { adsrP.release = v; voice.set('adsr','release',v);  redraw(); } });

  setTimeout(() => redraw(), 30);
  return { redraw };
}

// LFO Panel (complex 2-row layout with all controls)
function createLFOPanel({ parent, lfoIndex, lfoParams, color, voice, bpmGet }) {
  const lp = lfoParams;
  const row = document.createElement('div'); row.className = 'lfo-row';
  if (lp._enabled === false) row.classList.add('lfo-disabled');
  parent.appendChild(row);

  // HEADER: number + ON/OFF toggle
  const rowHdr = document.createElement('div'); rowHdr.className = 'lfo-row-hdr';
  row.appendChild(rowHdr);

  const num = document.createElement('div'); num.className = 'lfo-num'; num.textContent = lfoIndex + 1;
  rowHdr.appendChild(num);

  const body = document.createElement('div'); body.className = 'lfo-row-body';
  if (lp._enabled === false) body.style.display = 'none';

  const enBtn = document.createElement('button');
  enBtn.className = 'lfo-en-btn' + (lp._enabled !== false ? ' active' : '');
  enBtn.textContent = lp._enabled !== false ? 'ON' : 'OFF';
  enBtn.addEventListener('click', () => {
    const on = lp._enabled === false;
    lp._enabled = on;
    enBtn.textContent = on ? 'ON' : 'OFF';
    enBtn.classList.toggle('active', on);
    row.classList.toggle('lfo-disabled', !on);
    body.style.display = on ? '' : 'none';
    voice._connectLFO(lfoIndex);
  });
  rowHdr.appendChild(enBtn);
  row.appendChild(body);

  // TOP ROW: waveform · target · BPM sync · div
  const rowTop = document.createElement('div'); rowTop.className = 'lfo-row-top';
  body.appendChild(rowTop);

  // Waveform selector
  const waveWrap = document.createElement('div'); waveWrap.className = 'lfo-wave';
  const LFO_WAVE_ABBR = { sine: 'SIN', sawtooth: 'SAW', square: 'SQR', triangle: 'TRI', stepped: 'STP' };
  ['sine', 'sawtooth', 'square', 'triangle', 'stepped'].forEach(w => {
    const b = document.createElement('button');
    b.className = 'lfo-w-btn' + (lp.waveform === w ? ' active' : '');
    b.textContent = LFO_WAVE_ABBR[w];
    b.addEventListener('click', () => {
      waveWrap.querySelectorAll('.lfo-w-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      voice.updateLFO(lfoIndex, 'waveform', w, bpmGet());
    });
    waveWrap.appendChild(b);
  });
  rowTop.appendChild(waveWrap);

  // Target selector
  const tSel = document.createElement('select'); tSel.className = 'mini-sel';
  const LFO_TARGET_LBL = { none: '—', pitch: 'PITCH', cutoff: 'CUTOFF', resonance: 'RESONANCE', noiseAmt: 'NOISE' };
  ['none', 'pitch', 'cutoff', 'resonance', 'noiseAmt'].forEach(t => {
    const o = document.createElement('option'); o.value = t; o.textContent = LFO_TARGET_LBL[t];
    if (lp.target === t) o.selected = true;
    tSel.appendChild(o);
  });
  tSel.addEventListener('change', () => voice.updateLFO(lfoIndex, 'target', tSel.value, bpmGet()));
  rowTop.appendChild(tSel);

  // BPM sync button
  const syncBtn = document.createElement('button');
  syncBtn.className = 'lfo-sync-btn' + (lp.bpmSync ? ' active' : '');
  syncBtn.textContent = '♩';
  syncBtn.addEventListener('click', () => {
    const newSync = !lp.bpmSync;
    syncBtn.classList.toggle('active', newSync);
    voice.updateLFO(lfoIndex, 'bpmSync', newSync, bpmGet());
  });
  rowTop.appendChild(syncBtn);

  // Division selector
  const divSel = document.createElement('select'); divSel.className = 'mini-sel';
  [1, 2, 4, 8, 16].forEach(d => {
    const o = document.createElement('option'); o.value = d; o.textContent = `1/${d}`;
    if (lp.syncDiv === d) o.selected = true;
    divSel.appendChild(o);
  });
  divSel.addEventListener('change', () => voice.updateLFO(lfoIndex, 'syncDiv', parseInt(divSel.value), bpmGet()));
  rowTop.appendChild(divSel);

  // BOTTOM ROW: knobs (rate · phase · depth) + LFO5 meta
  const rowBot = document.createElement('div'); rowBot.className = 'lfo-row-bot';
  body.appendChild(rowBot);

  const rateMax = lp.bpmSync ? 10 : 20;
  const depMax = lp.target === 'pitch' ? 2400 : (lp.target === 'cutoff' ? 10000 : 1);
  const depDec = lp.target === 'pitch' || lp.target === 'cutoff' ? 0 : 2;

  ['rate', 'phase', 'depth'].forEach(key => {
    const kw = document.createElement('div'); kw.className = 'lfo-knob-wrap';
    const cfg = {
      rate: { min: 0.01, max: rateMax, value: lp.rate, label: 'RATE', unit: 'Hz', decimals: 2 },
      phase: { min: 0, max: 2 * Math.PI, value: lp.phase, label: 'PHASE', unit: '°', decimals: 0 },
      depth: { min: 0, max: depMax, value: lp.depth, label: 'DEPTH', decimals: depDec }
    }[key];
    makeKnob({ parent: kw, color, ...cfg, onChange: v => voice.updateLFO(lfoIndex, key, v, bpmGet()) });
    rowBot.appendChild(kw);
  });

  // ENV ATK / ENV REL knobs — ramp LFO depth in/out with note envelope
  [['envA', 'E.ATK'], ['envR', 'E.REL']].forEach(([key, label]) => {
    const kw = document.createElement('div'); kw.className = 'lfo-knob-wrap';
    makeKnob({ parent: kw, color, min: 0, max: 4, value: lp[key] ?? 0, label, unit:'s', decimals: 2,
      onChange: v => { lp[key] = v; } // consumed at noteOn/noteOff only
    });
    rowBot.appendChild(kw);
  });

  // LFO5 meta-modulation (right side of bottom row)
  if (lfoIndex === 4) {
    const metaWrap = document.createElement('div'); metaWrap.className = 'lfo-meta-row';
    const mLbl = document.createElement('span'); mLbl.className = 'lfo-meta-lbl'; mLbl.textContent = 'META';
    const mSel = document.createElement('select'); mSel.className = 'mini-sel'; mSel.title = 'Meta-modulate';
    [['none', '—'], ['rate', 'RATE'], ['depth', 'DEPT']].forEach(([v, l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l;
      if ((lp.metaTarget || 'none') === v) o.selected = true;
      mSel.appendChild(o);
    });
    mSel.addEventListener('change', () => voice.updateLFO(4, 'metaTarget', mSel.value === 'none' ? null : mSel.value, bpmGet()));
    const lnSel = document.createElement('select'); lnSel.className = 'mini-sel';
    [0, 1, 2, 3].forEach(n => {
      const o = document.createElement('option'); o.value = n; o.textContent = `LFO ${n + 1}`;
      if (lp.metaTargetLFO === n) o.selected = true;
      lnSel.appendChild(o);
    });
    lnSel.addEventListener('change', () => voice.updateLFO(4, 'metaTargetLFO', parseInt(lnSel.value), bpmGet()));
    metaWrap.append(mLbl, mSel, lnSel);
    rowBot.appendChild(metaWrap);
  }

  return { element: row, body };
}

// ─────────────────────────────────────────────────────────
//  Voice panel builder (using modular components)
// ─────────────────────────────────────────────────────────
function buildVoicePanel(col, voice, color, bpmGet) {
  const p = voice.p;

  // Create voice header with toggle
  const hdr = document.createElement('div');
  hdr.className = 'voice-header';
  hdr.textContent = `VOICE ${voice.id + 1}`;
  
  const toggleId = `voice-toggle-${voice.id}`;
  const wrap = document.createElement('label');
  wrap.className = 'voice-toggle'; wrap.htmlFor = toggleId;
  const cb  = document.createElement('input');
  cb.type = 'checkbox'; cb.id = toggleId; cb.checked = voice._enabled;
  const track = document.createElement('span'); track.className = 'voice-toggle-track';
  const lbl   = document.createElement('span'); lbl.className = 'voice-toggle-lbl'; lbl.textContent = voice._enabled ? 'ON' : 'OFF';
  wrap.append(cb, track, lbl);
  hdr.appendChild(wrap);
  col.appendChild(hdr);
  
  cb.addEventListener('change', () => {
    const on = cb.checked;
    lbl.textContent = on ? 'ON' : 'OFF';
    col.classList.toggle('voice-off', !on);
    voice._enabled = on;
    
    // Sync master M button
    const masterSection = document.getElementById('master-section');
    const muteBtn = masterSection?.querySelectorAll('.mix-mute-btn')[voice.id];
    if (muteBtn) muteBtn.classList.toggle('active', !on);
    
    const t = voice.ctx.currentTime;
    if (voice.ctx.state === 'running') {
      voice.outputGain.gain.setTargetAtTime(on ? p.volume : 0, t, 0.02);
    } else {
      voice.outputGain.gain.value = on ? p.volume : 0;
    }
    if (!on) voice._killSrcs();
  });

  function sec(title) {
    const d=document.createElement('div'); d.className='v-sec';
    d.innerHTML=`<div class="sec-hdr">${title}</div>`; col.appendChild(d); return d;
  }
  function kRow(parent) { const d=document.createElement('div'); d.className='knob-row'; parent.appendChild(d); return d; }
  function bRow(parent) { const d=document.createElement('div'); d.className='btn-row'; parent.appendChild(d); return d; }

  // OSC — filter-style layout: left (buttons + knobs), right (wave preview + noise)
  const oscS = sec('OSC');
  const oscCols = document.createElement('div'); oscCols.className = 'osc-cols';
  oscS.appendChild(oscCols);

  // LEFT: wave type buttons (top) + knob row (below)
  const oscLeft = document.createElement('div'); oscLeft.className = 'osc-left';
  oscCols.appendChild(oscLeft);

  const WAVE_ABBR = {sine:'SIN', sawtooth:'SAW', square:'SQR', triangle:'TRI', pulse:'PUL', supersaw:'S-SW'};
  const waveBtnRow = document.createElement('div'); waveBtnRow.className = 'btn-row';
  oscLeft.appendChild(waveBtnRow);
  const allWaveBtns = [];
  WAVE_TYPES.forEach((w) => {
    const b = document.createElement('button');
    b.className = 'wave-btn' + (p.osc.waveform === w ? ' active' : '');
    b.textContent = WAVE_ABBR[w]; b.dataset.waveform = w;
    waveBtnRow.appendChild(b); allWaveBtns.push(b);
  });

  const mainKnobRow = document.createElement('div'); mainKnobRow.className = 'knob-row';
  oscLeft.appendChild(mainKnobRow);
  makeKnob({ parent: mainKnobRow, min: -24,  max: 24,  value: p.osc.pitch,  label: 'PITCH', unit: 'st', decimals: 0, step: 1, color, onChange: v => voice.set('osc','pitch',v) });
  makeKnob({ parent: mainKnobRow, min: -100, max: 100, value: p.osc.cent,   label: 'CENT',  unit: '¢',  decimals: 0, step: 1, color, onChange: v => voice.set('osc','cent',v) });
  makeKnob({ parent: mainKnobRow, min: 0,    max: 1,   value: p.osc.volume, label: 'VOL',              decimals: 2,           color, onChange: v => voice.set('osc','volume',v) });
  const pwWrap  = document.createElement('div'); pwWrap.style.display  = 'none'; mainKnobRow.appendChild(pwWrap);
  const spdWrap = document.createElement('div'); spdWrap.style.display = 'none'; mainKnobRow.appendChild(spdWrap);
  makeKnob({ parent: pwWrap,  min: 0.1, max: 0.9, value: p.osc.pw,     label: 'PW',    decimals: 2, color, onChange: v => voice.set('osc','pw',v) });
  makeKnob({ parent: spdWrap, min: 0,   max: 1,   value: p.osc.spread, label: 'SPREAD',decimals: 2, color, onChange: v => voice.set('osc','spread',v) });
  const uniWrap = document.createElement('div'); uniWrap.style.display = 'flex'; uniWrap.style.gap = '0'; mainKnobRow.appendChild(uniWrap);
  makeKnob({ parent: uniWrap, min: 1, max: 8, value: p.osc.unison ?? 1, label: 'UNI', decimals: 0, step: 1, color,
    onChange: v => { voice.set('osc','unison', Math.round(v)); mainKnobRow.dispatchEvent(new Event('_uniChanged')); } });
  const uniDetWrap = document.createElement('div'); uniDetWrap.style.display = 'none'; uniWrap.appendChild(uniDetWrap);
  makeKnob({ parent: uniDetWrap, min: 0, max: 100, value: p.osc.unisonDetune ?? 20, label: 'DETUNE', unit: '¢', decimals: 0, step: 1, color,
    onChange: v => voice.set('osc','unisonDetune', v) });
  makeKnob({ parent: uniDetWrap, min: 0, max: 1, value: p.osc.unisonBlend ?? 1, label: 'BLEND', decimals: 2, color,
    onChange: v => voice.set('osc','unisonBlend', v) });

  // RIGHT: waveform preview (top half) + noise (bottom half)
  const oscRight = document.createElement('div'); oscRight.className = 'osc-right';
  oscCols.appendChild(oscRight);

  const waveCanvas = createWaveformCanvas({ color, waveform: p.osc.waveform, analyser: voice.analyser });
  oscRight.appendChild(waveCanvas.element);

  const noisePanel = createNoisePanel({ voice, color });
  oscRight.appendChild(noisePanel.element);

  function updateCtxKnobs(waveform) {
    pwWrap.style.display   = waveform === 'pulse'    ? '' : 'none';
    spdWrap.style.display  = waveform === 'supersaw' ? '' : 'none';
    uniWrap.style.display  = waveform === 'supersaw' ? 'none' : 'flex';
    uniDetWrap.style.display = (waveform !== 'supersaw' && (p.osc.unison ?? 1) > 1) ? '' : 'none';
  }
  updateCtxKnobs(p.osc.waveform);
  mainKnobRow.addEventListener('_uniChanged', () => { uniDetWrap.style.display = (p.osc.unison ?? 1) > 1 ? '' : 'none'; });
  allWaveBtns.forEach(b => b.addEventListener('click', () => {
    const w = b.dataset.waveform;
    allWaveBtns.forEach(x => x.classList.remove('active')); b.classList.add('active');
    voice.set('osc','waveform',w); waveCanvas.redraw(w); updateCtxKnobs(w);
  }));

  // Filter — 2-column layout
  const fS = sec('FILTER');
  const fCols = document.createElement('div'); fCols.className = 'filter-cols';
  fS.appendChild(fCols);

  // LEFT: type buttons + CUT/RES/ENV/DRIVE/MIX knobs
  const fLeft = document.createElement('div'); fLeft.className = 'filter-left';
  fCols.appendChild(fLeft);

  createButtonGroup({
    parent: fLeft,
    options: FILTER_TYPES.map((ft, idx) => ({ value: ft, label: FILTER_LABELS[idx] })),
    activeValue: p.filter.type,
    className: 'ftype-btn',
    onChange: ft => { voice.set('filter', 'type', ft); requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount)); }
  });

  const filterKnobRow = createKnobRow({
    parent: fLeft, color,
    knobs: [
      { min: 20,    max: 18000, value: p.filter.cutoff,    label: 'CUT',   decimals: 0, onChange: v => { voice.set('filter','cutoff',v);    requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount)); } },
      { min: 0,     max: 30,   value: p.filter.resonance, label: 'RES',   decimals: 1, onChange: v => { voice.set('filter','resonance',v); requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount)); } },
      { min: 0,     max: 12000,value: p.filter.envAmount, label: 'ENV',   decimals: 0, onChange: v => { voice.set('filter','envAmount',v); requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount)); } },
      { min: 0,     max: 1,    value: p.filter.mix,       label: 'MIX',   decimals: 2, onChange: v => voice.set('filter','mix',v) },
      { min: -1,    max: 1,    value: p.pan,              label: 'PAN',   decimals: 2, onChange: v => voice.set('filter','pan',v) }
    ]
  });
  const cutKnob = filterKnobRow.knobs[0];

  // RIGHT: live filter curve canvas
  const fRight = document.createElement('div'); fRight.className = 'filter-right';
  fCols.appendChild(fRight);

  const curveCvs = document.createElement('canvas'); curveCvs.className = 'filter-curve';
  fRight.appendChild(curveCvs);

  const freqLbls = document.createElement('div'); freqLbls.className = 'filter-curve-labels';
  freqLbls.innerHTML = '<span>20</span><span>1k</span><span>20k</span>';
  fRight.appendChild(freqLbls);

  // Ensure filter node matches p params before drawing (getFrequencyResponse needs .value in sync)
  voice.filter.type = p.filter.type;
  voice.filter.frequency.value = p.filter.cutoff;
  voice.filter.Q.value = p.filter.resonance;
  requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount));

  // ── Live modulation visualizer ─────────────────────────
  // Estimate modulated cutoff from active TWE + LFO sources and animate
  // the filter curve ghost + CUT knob ring at ~30fps while a note is held.
  function waveY(shape, phase) {
    switch (shape) {
      case 'sawtooth': return 2 * (phase % 1) - 1;
      case 'square':   return (phase % 1) < 0.5 ? 1 : -1;
      case 'triangle': return 2 * Math.abs(2 * (phase % 1) - 1) - 1;
      default:         return Math.sin(2 * Math.PI * phase); // sine
    }
  }

  function estimateModCutoff() {
    if (!voice._playing || !voice._noteOnTime) return null;
    const elapsed = voice.ctx.currentTime - voice._noteOnTime;
    const tw = p.twe;
    let mod = 0;
    // TWE MAIN
    if (!tw._bypassed && tw.main && tw.main._enabled !== false && tw.main.depth > 0
        && (tw.main.target === 'cutoff' || tw.main.target === undefined)
        && voice.tweMain.connected === 'cutoff') {
      mod += waveY(tw.main.shape, elapsed * voice._tweCalcRate(tw.main)) * tw.main.depth;
    }
    // TWE BODY (nested under main)
    const _twBody = tw.main?.body;
    if (!tw._bypassed && _twBody && _twBody._enabled !== false && _twBody.depth > 0
        && _twBody.target === 'cutoff' && voice.tweBody.connected === 'cutoff') {
      mod += waveY(_twBody.shape, elapsed * voice._tweCalcRate(_twBody)) * _twBody.depth;
    }
    // LFOs targeting cutoff
    p.lfos.forEach((lp, i) => {
      if (lp.target !== 'cutoff' || lp.depth <= 0) return;
      const node = voice.lfoNodes[i];
      if (!node || !node.connected) return;
      const phase = elapsed * lp.rate;
      mod += waveY(lp.waveform, phase) * lp.depth;
    });
    return mod !== 0 ? Math.max(20, Math.min(20000, p.filter.cutoff + mod)) : null;
  }

  // Estimate total modulation on noiseAmt target (same waveY helper)
  function estimateModNoiseAmt() {
    if (!voice._playing || !voice._noteOnTime) return null;
    const elapsed = voice.ctx.currentTime - voice._noteOnTime;
    const tw = p.twe;
    let mod = 0;
    if (tw._bypassed) return null;
    const scaledD = (sp) => (sp.target === 'volume' || sp.target === 'noiseAmt')
      ? Math.min(sp.depth / 15000, 1.0) : sp.depth;
    // TWE MAIN
    if (tw.main && tw.main._enabled !== false && tw.main.depth > 0
        && tw.main.target === 'noiseAmt' && voice.tweMain.connected === 'noiseAmt') {
      mod += waveY(tw.main.shape, elapsed * voice._tweCalcRate(tw.main)) * scaledD(tw.main);
    }
    // TWE BODY
    const _twBody = tw.main?.body;
    if (_twBody && _twBody._enabled !== false && _twBody.depth > 0
        && _twBody.target === 'noiseAmt' && voice.tweBody.connected === 'noiseAmt') {
      mod += waveY(_twBody.shape, elapsed * voice._tweCalcRate(_twBody)) * scaledD(_twBody);
    }
    // AUX lanes
    (tw.aux || []).forEach((als, i) => {
      const a = voice._tweAuxOscs[i];
      if (!a || !a.connected) return;
      if (als._enabled !== false && als.depth > 0 && als.target === 'noiseAmt') {
        mod += waveY(als.shape, elapsed * voice._tweCalcRate(als)) * scaledD(als);
      }
    });
    // LFOs targeting noiseAmt
    p.lfos.forEach((lp, i) => {
      if (lp.target !== 'noiseAmt' || lp.depth <= 0) return;
      const node = voice.lfoNodes[i];
      if (!node || !node.connected) return;
      mod += waveY(lp.waveform, elapsed * lp.rate) * lp.depth;
    });
    if (mod === 0) return null;
    return Math.max(0, Math.min(1, p.noise.volume + mod));
  }

  let _modRafId = null;
  let _lastModCutoff = null, _lastModNoise = null;
  let _lastModDrawTime = 0;
  function modAnimLoop(ts) {
    if (ts - _lastModDrawTime >= 50) { // ~20fps cap
      _lastModDrawTime = ts;
      const mc = estimateModCutoff();
      const changed = mc === null
        ? _lastModCutoff !== null
        : (_lastModCutoff === null || Math.abs(mc - _lastModCutoff) > 5);
      if (changed) {
        _lastModCutoff = mc;
        drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount, mc);
        cutKnob.setModValue(mc !== null ? mc : null);
      }
      // Noise knob ring
      const mn = estimateModNoiseAmt();
      const nChanged = mn !== _lastModNoise && (mn === null || _lastModNoise === null || Math.abs(mn - _lastModNoise) > 0.005);
      if (nChanged) {
        _lastModNoise = mn;
        voice._noiseKnob?.setModValue(mn);
      }
    }
    _modRafId = requestAnimationFrame(modAnimLoop);
  }
  // Intercept _playing writes to start/stop animation loop
  voice.__playing = voice._playing || false;
  Object.defineProperty(voice, '_playing', {
    get() { return this.__playing; },
    set(v) {
      this.__playing = v;
      if (v && !_modRafId) _modRafId = requestAnimationFrame(modAnimLoop);
      if (!v) {
        setTimeout(() => {
          if (!voice._playing) {
            if (_modRafId) { cancelAnimationFrame(_modRafId); _modRafId = null; }
            _lastModCutoff = null; _lastModNoise = null;
            cutKnob.clearModValue();
            voice._noiseKnob?.clearModValue();
            requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount));
          }
        }, 600);
      }
    },
    configurable: true
  });

  // Filter bypass toggle
  const FILTER_MOD_TARGETS = ['cutoff', 'resonance'];
  addSectionToggle(fS,
    () => { // Disable: allpass + disconnect all modulation from filter params
      voice.p.filter.bypassed = true;
      voice.filter.type = 'allpass';
      voice._filterBypassed = true;
      // Disconnect TWE MAIN/BODY if connected to cutoff or resonance
      if (FILTER_MOD_TARGETS.includes(voice.tweMain.connected)) {
        try { voice.tweMain.gain.disconnect(); } catch(_) {}
        voice.tweMain.connected = null;
      }
      if (FILTER_MOD_TARGETS.includes(voice.tweBody.connected)) {
        try { voice.tweBody.gain.disconnect(); } catch(_) {}
        voice.tweBody.connected = null;
      }
      // Disconnect LFOs targeting cutoff or resonance
      voice.lfoNodes.forEach((node, i) => {
        const tgt = p.lfos[i].target;
        if (FILTER_MOD_TARGETS.includes(tgt) && node.connected) {
          try { node.gain.disconnect(); } catch(_) {}
          node.connected = null;
        }
      });
    },
    () => { // Enable: restore type, reconnect modulations
      voice.p.filter.bypassed = false;
      voice._filterBypassed = false;
      voice.filter.type = p.filter.type;
      // Reconnect LFOs targeting cutoff or resonance
      voice.lfoNodes.forEach((_, i) => {
        if (FILTER_MOD_TARGETS.includes(p.lfos[i].target)) voice._connectLFO(i);
      });
      // TWE MAIN/BODY will reconnect naturally on next noteOn
    },
    !voice.p.filter.bypassed
  );

  // ADSR — interactive canvas
  const aS = sec('ADSR');
  buildADSRSection(aS, p.adsr, voice, color);

  // ── DISTORTION ────────────────────────────────────────────
  const distS = sec('DISTORTION');
  buildDistSection(distS, p.dist, voice, color);

  // ── TWE — Temporal Wobble Engine ──────────────────────────
  const tweS = sec('WOBBLE ENGINE'); tweS.classList.add('twe-sec');

  const TWE_SHAPES   = ['sine','sawtooth','square','triangle'];
  const TWE_SHAPE_ABBR = {sine:'SIN',sawtooth:'SAW',square:'SQR',triangle:'TRI'};
  const TWE_TARGETS  = ['cutoff','resonance','pitch','noiseAmt','pan','volume','chorus'];
  const TWE_DIVS     = [1,2,4,8,16,32];

  // ─ Preset bar ─
  const presetBar = document.createElement('div'); presetBar.className = 'twe-preset-bar';
  tweS.appendChild(presetBar);

  // ─ applyWobblePattern ─
  function applyWobblePattern(pattern) {
    if (pattern.main) {
      const src = pattern.main, ms = p.twe.main;
      ['rate','depth','target','shape','bpmSync','syncDiv','triplet','dotted'].forEach(k => { if (src[k] !== undefined) ms[k] = src[k]; });
      if (src.strike) Object.assign(ms.strike, src.strike);
      if (src.body)   Object.assign(ms.body,   src.body);
      if (src.tail)   Object.assign(ms.tail,   src.tail);
    }
    voice.set('twe', 'main.shape',      p.twe.main.shape);
    voice.set('twe', 'main.rate',       p.twe.main.rate);
    voice.set('twe', 'main.body.shape', p.twe.main.body.shape);
    voice.set('twe', 'main.body.rate',  p.twe.main.body.rate);
    rebuildTweUI();
  }

  // ─ Preset bar buttons ─
  Object.keys(WOBBLE_PRESETS).forEach(name => {
    const btn = document.createElement('button'); btn.className = 'twe-preset-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => { applyWobblePattern(WOBBLE_PRESETS[name]); showToast(`Pattern: ${name}`); });
    presetBar.appendChild(btn);
  });
  const _sep = document.createElement('div'); _sep.className = 'twe-preset-sep'; presetBar.appendChild(_sep);
  const randBtn = document.createElement('button'); randBtn.className = 'twe-preset-btn twe-preset-random'; randBtn.textContent = '🎲 RANDOM';
  randBtn.addEventListener('click', () => { applyWobblePattern(randomizeWobble()); showToast('Randomized wobble'); });
  presetBar.appendChild(randBtn);
  const aiBtn = document.createElement('button'); aiBtn.className = 'twe-preset-btn twe-preset-ai'; aiBtn.textContent = '✨ AI';
  aiBtn.addEventListener('click', () => { applyWobblePattern(aiGenerateWobble()); showToast('AI-generated wobble'); });
  presetBar.appendChild(aiBtn);

  // ─ Timeline canvas + redrawTwe ─
  const tweCvs = document.createElement('canvas'); tweCvs.className = 'twe-preview';
  tweS.appendChild(tweCvs);
  let _tweRafId = null;
  let _tweSelectedLane = 'main'; // 'main'|'strike'|'body'|'tail'|'aux.0'..
  const redrawTwe = () => {
    if (_tweRafId) { cancelAnimationFrame(_tweRafId); _tweRafId = null; }
    const tick = () => {
      const bpm = voice._bpm || 120;
      if (voice._playing && voice._noteOnTime != null) {
        drawTwePreview(tweCvs, p.twe, color, voice.ctx.currentTime - voice._noteOnTime, _tweSelectedLane, bpm);
        _tweRafId = requestAnimationFrame(tick);
      } else {
        drawTwePreview(tweCvs, p.twe, color, undefined, _tweSelectedLane, bpm);
        _tweRafId = null;
      }
    };
    requestAnimationFrame(tick);
  };
  (function poll() { if (!_tweRafId) redrawTwe(); setTimeout(poll, 200); })();

  // ─ Chaos / Ratemod row ─
  const tweHeader = document.createElement('div'); tweHeader.className = 'twe-header';
  tweS.appendChild(tweHeader);
  const chaosWrap = document.createElement('div'); chaosWrap.className = 'knob-row'; tweHeader.appendChild(chaosWrap);
  makeKnob({ parent:chaosWrap, min:0, max:1, value:p.twe.chaos, label:'CHAOS', decimals:2, color, onChange: v => { voice.set('twe','chaos',v); redrawTwe(); } });
  makeKnob({ parent:chaosWrap, min:0, max:1, value:p.twe.tweAmt??1, label:'AMT', decimals:2, color:'#ffdd88', onChange: v => { voice.set('twe','tweAmt',v); } });
  makeKnob({ parent:chaosWrap, min:1, max:16, value:p.twe.barsTotal??4, label:'BARS', decimals:0, step:1, color:'#aaaaff', onChange: v => { p.twe.barsTotal=Math.round(v); voice.set('twe','barsTotal',Math.round(v)); redrawTwe(); } });
  const rateModBtn = document.createElement('button'); rateModBtn.className = 'twe-ratemod-btn'; rateModBtn.textContent = 'RATE-MOD'; rateModBtn.title = 'STRIKE drives BODY rate';
  rateModBtn.classList.toggle('active', p.twe.ratemod);
  rateModBtn.addEventListener('click', () => { const v = !p.twe.ratemod; rateModBtn.classList.toggle('active',v); voice.set('twe','ratemod',v); });
  tweHeader.appendChild(rateModBtn);

  // ─ Pattern save/load bar ─
  const patBar = document.createElement('div'); patBar.className = 'twe-pat-bar'; tweS.appendChild(patBar);
  const patNameIn = document.createElement('input'); patNameIn.className = 'patch-name-input'; patNameIn.placeholder = 'wobble pattern…'; patNameIn.maxLength = 32; patBar.appendChild(patNameIn);
  const patSaveBtn = document.createElement('button'); patSaveBtn.className = 'patch-btn patch-save'; patSaveBtn.textContent = 'SAVE'; patBar.appendChild(patSaveBtn);
  const patSel = document.createElement('select'); patSel.className = 'patch-select twe-pat-sel'; patBar.appendChild(patSel);
  const refreshPatSel = () => {
    const pats = _getAllWobblePatterns(); patSel.innerHTML = '<option value="">── patterns ──</option>';
    Object.keys(pats).sort().forEach(k => { const o = document.createElement('option'); o.value=k; o.textContent=k; patSel.appendChild(o); });
  };
  refreshPatSel();
  const patLoadBtn = document.createElement('button'); patLoadBtn.className = 'patch-btn patch-load'; patLoadBtn.textContent = 'LOAD'; patBar.appendChild(patLoadBtn);
  const patDelBtn  = document.createElement('button'); patDelBtn.className  = 'patch-btn patch-del';  patDelBtn.textContent  = 'DEL';  patBar.appendChild(patDelBtn);
  patSaveBtn.addEventListener('click', () => { if (!patNameIn.value.trim()) { patNameIn.focus(); return; } if (saveWobblePattern(patNameIn.value, p.twe)) { refreshPatSel(); showToast(`Wobble saved: ${patNameIn.value}`); } });
  patLoadBtn.addEventListener('click', () => {
    const name = patSel.value; if (!name) return;
    const pat = _getAllWobblePatterns()[name]; if (!pat) return;
    Object.assign(p.twe, JSON.parse(JSON.stringify(pat.twe)));
    voice.set('twe','chaos',p.twe.chaos); voice.set('twe','ratemod',p.twe.ratemod);
    patNameIn.value = name; showToast(`Wobble loaded: ${name}`);
    rebuildTweUI();
  });
  patDelBtn.addEventListener('click', () => { const n=patSel.value; if(!n) return; if(!confirm(`Delete "${n}"?`)) return; deleteWobblePattern(n); refreshPatSel(); showToast(`Deleted: ${n}`); });

  // ─ Lanes container ─
  const lanesContainer = document.createElement('div'); lanesContainer.className = 'twe-lanes'; tweS.appendChild(lanesContainer);

  // ─ Draw curve helpers ─
  let _drawContainer = null, _isDrawing = false;
  const _genSamples = (shape, N) => {
    const s = new Float32Array(N);
    for (let i=0;i<N;i++) { const t=(i/N)*2*Math.PI; switch(shape) { case 'sine':s[i]=Math.sin(t);break; case 'sawtooth':s[i]=2*(i/N)-1;break; case 'square':s[i]=i<N/2?1:-1;break; case 'triangle':s[i]=1-Math.abs(4*i/N-2);break; default:s[i]=Math.sin(t); } }
    return s;
  };
  // Extended curve generator — all shapes return Float32Array of N samples in [-1, 1]
  const _genCurve = (name, N) => {
    const s = new Float32Array(N);
    const t = i => i / (N - 1); // 0..1
    switch (name) {
      case 'sine':      for(let i=0;i<N;i++) s[i]=Math.sin((i/N)*2*Math.PI); break;
      case 'sawtooth':  for(let i=0;i<N;i++) s[i]=2*(i/N)-1; break;
      case 'square':    for(let i=0;i<N;i++) s[i]=i<N/2?1:-1; break;
      case 'triangle':  for(let i=0;i<N;i++) s[i]=1-Math.abs(4*i/N-2); break;
      case 'rampup':    for(let i=0;i<N;i++) s[i]=t(i)*2-1; break;            // -1 → +1
      case 'rampdown':  for(let i=0;i<N;i++) s[i]=1-t(i)*2; break;            // +1 → -1
      case 'easein':    for(let i=0;i<N;i++) s[i]=t(i)*t(i)*t(i)*2-1; break; // cubic ease-in
      case 'easeout':   for(let i=0;i<N;i++){const v=1-t(i);s[i]=1-v*v*v*2;}break; // cubic ease-out
      case 'easeinout': for(let i=0;i<N;i++){const x=t(i);s[i]=(x<0.5?4*x*x*x:(1-(-2*x+2)**3/2))*2-1;}break;
      case 'expup':     for(let i=0;i<N;i++) s[i]=(Math.exp(t(i)*3)-1)/(Math.exp(3)-1)*2-1; break;
      case 'expdown':   for(let i=0;i<N;i++) s[i]=1-(Math.exp(t(i)*3)-1)/(Math.exp(3)-1)*2; break;
      case 'halfsine':  for(let i=0;i<N;i++) s[i]=Math.sin((i/N)*Math.PI); break; // 0→1→0, positive only
      case 'bounce': {
        for(let i=0;i<N;i++){
          const x=t(i), a=1-x;
          s[i]=a<0.36364?1-7.5625*a*a:a<0.72727?1-(7.5625*(a-0.54545)*(a-0.54545)+0.75):a<0.9091?1-(7.5625*(a-0.81818)*(a-0.81818)+0.9375):1-(7.5625*(a-0.95455)*(a-0.95455)+0.984375);
        }} break;
      case 'pulse':     for(let i=0;i<N;i++) s[i]=i<N*0.12?1:i<N*0.2?-0.4:0; break; // sharp hit + dip
      case 'stutter':   for(let i=0;i<N;i++) s[i]=Math.floor(i/(N/8))%2===0?1:-1; break; // 8 steps
      case 'random':    for(let i=0;i<N;i++) s[i]=Math.random()*2-1; break;
      default:          for(let i=0;i<N;i++) s[i]=Math.sin((i/N)*2*Math.PI);
    }
    return s;
  };
  // AI text→curve: parse natural language description
  const _aiGenCurve = (text, N) => {
    const q = text.toLowerCase().replace(/[^a-z0-9 ]/g,'');
    const has = (...words) => words.some(w => q.includes(w));
    if (has('bounce','spring','elastic')) return _genCurve('bounce', N);
    if (has('pulse','hit','click','snap','attack')) return _genCurve('pulse', N);
    if (has('stutter','step','gate','chop')) return _genCurve('stutter', N);
    if (has('random','noise','chaos','glitch')) return _genCurve('random', N);
    if (has('half sine','half sin','positive sine','rectif')) return _genCurve('halfsine', N);
    if (has('ease in out','smooth','s curve','scurve','sigmoid')) return _genCurve('easeinout', N);
    if (has('ease out','slow down','slowing','decelerat','brake')) return _genCurve('easeout', N);
    if (has('ease in','slow start','accelerat','build up','buildup')) return _genCurve('easein', N);
    if (has('exp','exponential','log','logarithm')) return has('down','fall','decay','drop') ? _genCurve('expdown', N) : _genCurve('expup', N);
    if (has('ramp down','fall','descend','drop','decay','fade out')) return _genCurve('rampdown', N);
    if (has('ramp up','rise','ascend','climb','fade in','grow')) return _genCurve('rampup', N);
    if (has('saw')) return _genCurve('sawtooth', N);
    if (has('square','rect')) return _genCurve('square', N);
    if (has('tri','triangle')) return _genCurve('triangle', N);
    if (has('sine','sin','smooth wave')) return _genCurve('sine', N);
    // fallback: sine
    return _genCurve('sine', N);
  };

  const openDrawCanvas = (sp, keyPrefix, shapeRow) => {
    if (_drawContainer) { _drawContainer.remove(); _drawContainer = null; }
    const wrap = document.createElement('div'); wrap.className = 'twe-draw-wrap'; _drawContainer = wrap;
    const cvs = document.createElement('canvas'); cvs.width=512; cvs.height=120; cvs.className='twe-draw-canvas';
    const N = 64;
    const ds = new Float32Array(sp.customShape ? sp.customShape.slice(0,N) : _genCurve(sp.shape==='custom'?'sine':sp.shape, N));
    const drawIt = () => {
      const g=cvs.getContext('2d'); const W=cvs.width,H=cvs.height;
      g.fillStyle='#04040e'; g.fillRect(0,0,W,H);
      g.strokeStyle='#1a1a38'; g.lineWidth=1;
      g.beginPath(); g.moveTo(0,H/2); g.lineTo(W,H/2); g.stroke();
      for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*W/4,0);g.lineTo(i*W/4,H);g.stroke();}
      g.strokeStyle=color; g.lineWidth=2; g.beginPath();
      for(let i=0;i<N;i++){const x=(i/N)*W,y=H/2-ds[i]*(H/2-6);i===0?g.moveTo(x,y):g.lineTo(x,y);}
      g.stroke();
    };
    const setSamp = (e) => {
      const r=cvs.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;
      const xi=Math.min(N-1,Math.floor(Math.max(0,Math.min(1,(cx-r.left)/r.width))*N));
      ds[xi]=-(Math.max(0,Math.min(1,(cy-r.top)/r.height))*2-1); drawIt();
    };
    cvs.addEventListener('mousedown', e=>{_isDrawing=true;setSamp(e);}); cvs.addEventListener('mousemove', e=>{if(_isDrawing)setSamp(e);}); cvs.addEventListener('mouseup',()=>_isDrawing=false); cvs.addEventListener('mouseleave',()=>_isDrawing=false);
    drawIt();

    // ── Preset row 1: standard + extended shapes ──
    const presetsRow = document.createElement('div'); presetsRow.className='twe-draw-presets';
    const CURVE_PRESETS = [
      { key:'sine',     lbl:'SIN' }, { key:'sawtooth', lbl:'SAW' }, { key:'square',   lbl:'SQR' }, { key:'triangle', lbl:'TRI' },
      { key:'rampup',   lbl:'↑'   }, { key:'rampdown', lbl:'↓'   }, { key:'easein',   lbl:'EI'  }, { key:'easeout',  lbl:'EO'  },
      { key:'easeinout',lbl:'S~'  }, { key:'expup',    lbl:'EXP↑'}, { key:'expdown',  lbl:'EXP↓'}, { key:'halfsine', lbl:'½SIN'},
      { key:'pulse',    lbl:'PLS' }, { key:'bounce',   lbl:'BNC' }, { key:'stutter',  lbl:'STP' }, { key:'random',   lbl:'RND' },
    ];
    CURVE_PRESETS.forEach(({key, lbl}) => {
      const pb=document.createElement('button'); pb.textContent=lbl; pb.className='twe-draw-preset-btn';
      pb.title=key; pb.addEventListener('click',()=>{ ds.set(_genCurve(key,N)); drawIt(); });
      presetsRow.appendChild(pb);
    });

    // ── AI row ──
    const aiRow = document.createElement('div'); aiRow.className='twe-draw-ai-row';
    const aiIn = document.createElement('input'); aiIn.type='text'; aiIn.placeholder='Describe curve… e.g. "ramp up", "slow down", "bounce"'; aiIn.className='twe-draw-ai-input';
    const aiBtn = document.createElement('button'); aiBtn.textContent='✨ Generate'; aiBtn.className='twe-draw-ai-btn';
    aiBtn.addEventListener('click', () => {
      const result = _aiGenCurve(aiIn.value || '', N);
      ds.set(result); drawIt();
    });
    aiIn.addEventListener('keydown', e => { if(e.key==='Enter') aiBtn.click(); });
    aiRow.append(aiIn, aiBtn);

    // ── Action row: Apply | Reset | Close ──
    const actRow = document.createElement('div'); actRow.className='twe-draw-btns';
    const applyBtn = document.createElement('button'); applyBtn.className='twe-draw-apply'; applyBtn.textContent='Apply';
    applyBtn.addEventListener('click', ()=>{
      sp.customShape=Array.from(ds); sp.shape='custom';
      voice.set('twe',`${keyPrefix}.shape`,'custom');
      shapeRow.querySelectorAll('.wave-btn').forEach(b=>b.classList.remove('active'));
      shapeRow.querySelector('.twe-draw-btn')?.classList.add('active');
      wrap.remove(); _drawContainer=null; redrawTwe();
    });
    const resetBtn = document.createElement('button'); resetBtn.className='twe-draw-reset'; resetBtn.textContent='Delete Custom';
    resetBtn.title='Clear custom shape and revert to Sine';
    resetBtn.addEventListener('click', ()=>{
      sp.customShape = null; sp.shape = 'sine';
      voice.set('twe', `${keyPrefix}.shape`, 'sine');
      shapeRow.querySelectorAll('.wave-btn').forEach(b=>b.classList.toggle('active', b.dataset.shape==='sine'));
      shapeRow.querySelector('.twe-draw-btn')?.classList.remove('active');
      wrap.remove(); _drawContainer=null; redrawTwe();
    });
    const closeBtn = document.createElement('button'); closeBtn.className='twe-draw-close'; closeBtn.textContent='✕';
    closeBtn.addEventListener('click',()=>{wrap.remove();_drawContainer=null;});
    actRow.append(applyBtn, resetBtn, closeBtn);

    wrap.append(cvs, presetsRow, aiRow, actRow);
    shapeRow.insertAdjacentElement('afterend', wrap);
  };

  // ─ UI helper: shape row ─
  const buildShapeRow = (parent, sp, keyPrefix) => {
    const row = document.createElement('div'); row.className='twe-shape-row';
    TWE_SHAPES.forEach(sh => {
      const b = document.createElement('button'); b.className='wave-btn'+(sh===sp.shape?' active':''); b.textContent=TWE_SHAPE_ABBR[sh]; b.dataset.shape=sh;
      b.addEventListener('click', e => {
        const s=e.target.closest('[data-shape]').dataset.shape;
        row.querySelectorAll('.wave-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        sp.shape=s; voice.set('twe',`${keyPrefix}.shape`,s); redrawTwe();
      });
      row.appendChild(b);
    });
    const drwBtn = document.createElement('button'); drwBtn.className='wave-btn twe-draw-btn'+(sp.shape==='custom'?' active':''); drwBtn.textContent='DRW'; drwBtn.title='Draw custom waveform';
    drwBtn.addEventListener('click', ()=>openDrawCanvas(sp, keyPrefix, row));
    row.appendChild(drwBtn);
    parent.appendChild(row);
    return row;
  };

  // ─ UI helper: target selector ─
  const buildTargetSel = (parent, sp, keyPrefix) => {
    const sel = document.createElement('select'); sel.className='twe-target-sel';
    TWE_TARGETS.forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t.toUpperCase();if(t===sp.target)o.selected=true;sel.appendChild(o);});
    sel.addEventListener('change', ()=>{ sp.target=sel.value; voice.set('twe',`${keyPrefix}.target`,sel.value); redrawTwe(); });
    parent.appendChild(sel); return sel;
  };

  // ─ UI helper: BPM sync row ─
  const buildBpmRow = (parent, sp, keyPrefix) => {
    const row = document.createElement('div'); row.className='twe-sync-row';
    const bpmBtn = document.createElement('button'); bpmBtn.className='twe-mod-btn'+(sp.bpmSync?' active':''); bpmBtn.textContent='BPM';
    const divSel = document.createElement('select'); divSel.className='twe-div-sel'; divSel.disabled=!sp.bpmSync;
    TWE_DIVS.forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=`1/${d}`;if(d===sp.syncDiv)o.selected=true;divSel.appendChild(o);});
    divSel.addEventListener('change',()=>{ sp.syncDiv=parseInt(divSel.value); voice.set('twe',`${keyPrefix}.syncDiv`,sp.syncDiv); redrawTwe(); });
    bpmBtn.addEventListener('click',()=>{ sp.bpmSync=!sp.bpmSync; voice.set('twe',`${keyPrefix}.bpmSync`,sp.bpmSync); bpmBtn.classList.toggle('active',sp.bpmSync); divSel.disabled=!sp.bpmSync; redrawTwe(); });
    const tripBtn = document.createElement('button'); tripBtn.className='twe-mod-btn'+(sp.triplet?' active':''); tripBtn.textContent='T';
    const dotBtn  = document.createElement('button'); dotBtn.className ='twe-mod-btn'+(sp.dotted ?' active':''); dotBtn.textContent ='D';
    tripBtn.addEventListener('click',()=>{ sp.triplet=!sp.triplet; if(sp.triplet){sp.dotted=false;dotBtn.classList.remove('active');} voice.set('twe',`${keyPrefix}.triplet`,sp.triplet); voice.set('twe',`${keyPrefix}.dotted`,sp.dotted); tripBtn.classList.toggle('active',sp.triplet); redrawTwe(); });
    dotBtn.addEventListener ('click',()=>{ sp.dotted =!sp.dotted;  if(sp.dotted ){sp.triplet=false;tripBtn.classList.remove('active');} voice.set('twe',`${keyPrefix}.dotted`,sp.dotted);   voice.set('twe',`${keyPrefix}.triplet`,sp.triplet); dotBtn.classList.toggle('active',sp.dotted); redrawTwe(); });
    row.append(bpmBtn, divSel, tripBtn, dotBtn); parent.appendChild(row);
  };

  // ─ UI helper: full lane controls ─
  const buildLaneControls = (parent, sp, keyPrefix, _unused, compact) => {
    buildShapeRow(parent, sp, keyPrefix);
    const ctrlRow = document.createElement('div'); ctrlRow.className='twe-ctrl-row';
    buildTargetSel(ctrlRow, sp, keyPrefix);
    makeKnob({ parent:ctrlRow, min:0.01, max:20,   value:sp.rate,         label:'RATE',   decimals:2, color, onChange:v=>{ sp.rate=v;  voice.set('twe',`${keyPrefix}.rate`,v);  redrawTwe(); }});
    makeKnob({ parent:ctrlRow, min:0,    max:15000, value:sp.depth,        label:'DEPTH',  decimals:0, color, onChange:v=>{ sp.depth=v; voice.set('twe',`${keyPrefix}.depth`,v); redrawTwe(); }});
    makeKnob({ parent:ctrlRow, min:0,    max:4,     value:sp.attack??0,    label:'ATK',    unit:'s', decimals:2, color:'#88ddff', onChange:v=>{ sp.attack=v; voice.set('twe',`${keyPrefix}.attack`,v); redrawTwe(); }});
    makeKnob({ parent:ctrlRow, min:0,    max:4,     value:sp.decay??0,     label:'DCY',    unit:'s', decimals:2, color:'#ffaa66', onChange:v=>{ sp.decay=v;  voice.set('twe',`${keyPrefix}.decay`,v);  redrawTwe(); }});
    if ('startBar' in sp) makeKnob({ parent:ctrlRow, min:0, max:(voice.p.twe.barsTotal||4)-1, value:sp.startBar??0, label:'BAR', decimals:0, step:1, color:'#aaaaff', onChange:v=>{ sp.startBar=Math.round(v); voice.set('twe',`${keyPrefix}.startBar`,Math.round(v)); redrawTwe(); }});
    parent.appendChild(ctrlRow);
    if (!compact) buildBpmRow(parent, sp, keyPrefix);
  };

  // Helper: mark a lane block as selected
  const selectLane = (id, block) => {
    _tweSelectedLane = id;
    lanesContainer.querySelectorAll('.twe-main-block,.twe-sub-block,.twe-aux-block').forEach(b=>b.classList.remove('twe-selected'));
    block.classList.add('twe-selected');
    redrawTwe();
  };

  // ─ Build main wobble section ─
  const buildMainSection = () => {
    const ms = p.twe.main;
    const mainBlock = document.createElement('div'); mainBlock.className='twe-main-block'+((_tweSelectedLane==='main')?' twe-selected':'');
    const hdr = document.createElement('div'); hdr.className='twe-block-hdr'; hdr.style.cursor='pointer';
    const enBtn = document.createElement('button'); enBtn.className='twe-lane-toggle'+(ms._enabled!==false?' active':''); enBtn.textContent=ms._enabled!==false?'ON':'OFF';
    const coreDiv = document.createElement('div'); coreDiv.className='twe-core-controls';
    const updateMain = () => { const on=ms._enabled!==false; enBtn.classList.toggle('active',on); enBtn.textContent=on?'ON':'OFF'; coreDiv.style.opacity=on?'':'0.4'; if(!on){try{voice.tweMain.gain.disconnect();}catch(_){}voice.tweMain.connected=null;} };
    enBtn.addEventListener('click', e=>{ e.stopPropagation(); ms._enabled=ms._enabled===false?true:false; updateMain(); redrawTwe(); });
    hdr.addEventListener('click', e=>{ if(e.target===enBtn) return; selectLane('main', mainBlock); });
    const lbl = document.createElement('span'); lbl.className='twe-block-lbl'; lbl.textContent='MAIN WOBBLE'; lbl.style.color=color;
    const expandBtn = document.createElement('button'); expandBtn.className='twe-expand-btn'; expandBtn.textContent='▼ STRIKE · BODY · TAIL';
    expandBtn.addEventListener('click', e=>{ e.stopPropagation(); const c=subDiv.style.display==='none'; subDiv.style.display=c?'':'none'; expandBtn.textContent=c?'▼ STRIKE · BODY · TAIL':'▶ STRIKE · BODY · TAIL'; });
    hdr.append(lbl, expandBtn, enBtn); mainBlock.appendChild(hdr);
    buildLaneControls(coreDiv, ms, 'main', false, false); mainBlock.appendChild(coreDiv);

    const subDiv = document.createElement('div'); subDiv.className='twe-sub-components';
    [{key:'strike',label:'⚡ STRIKE'},{key:'body',label:'▬ BODY'},{key:'tail',label:'∿ TAIL'}].forEach(({key,label})=>{
      const sub=ms[key];
      const subBlock=document.createElement('div'); subBlock.className='twe-sub-block'+((_tweSelectedLane===key)?' twe-selected':'');
      const subHdr=document.createElement('div'); subHdr.className='twe-sub-hdr'; subHdr.style.cursor='pointer';
      const subEn=document.createElement('button'); subEn.className='twe-lane-toggle'+(sub._enabled!==false?' active':''); subEn.textContent=sub._enabled!==false?'ON':'OFF';
      const subControls=document.createElement('div'); subControls.className='twe-sub-controls';
      const updateSub=()=>{ const on=sub._enabled!==false; subEn.classList.toggle('active',on); subEn.textContent=on?'ON':'OFF'; subControls.style.opacity=on?'':'0.4'; if(key==='body'&&!on){try{voice.tweBody.gain.disconnect();}catch(_){}voice.tweBody.connected=null;} };
      subEn.addEventListener('click', e=>{ e.stopPropagation(); sub._enabled=sub._enabled===false?true:false; updateSub(); redrawTwe(); });
      subHdr.addEventListener('click', e=>{ if(e.target===subEn) return; selectLane(key, subBlock); });
      const subLbl=document.createElement('span'); subLbl.className='twe-sub-lbl'; subLbl.textContent=label;
      subHdr.append(subLbl, subEn); subBlock.appendChild(subHdr);
      buildLaneControls(subControls, sub, `main.${key}`, true, false); subBlock.appendChild(subControls);
      updateSub(); subDiv.appendChild(subBlock);
    });
    mainBlock.appendChild(subDiv); updateMain(); lanesContainer.appendChild(mainBlock);
  };

  // ─ Build aux lane ─
  const buildAuxLane = (i) => {
    const als = p.twe.aux[i]; if(!als) return;
    const auxId = `aux.${i}`;
    const auxBlock=document.createElement('div'); auxBlock.className='twe-aux-block'+(_tweSelectedLane===auxId?' twe-selected':''); auxBlock.dataset.auxIndex=i;
    const hdr=document.createElement('div'); hdr.className='twe-block-hdr'; hdr.style.cursor='pointer';
    const enBtn=document.createElement('button'); enBtn.className='twe-lane-toggle'+(als._enabled!==false?' active':''); enBtn.textContent=als._enabled!==false?'ON':'OFF';
    const auxControls=document.createElement('div'); auxControls.className='twe-aux-controls';
    const updateAux=()=>{ const on=als._enabled!==false; enBtn.classList.toggle('active',on); enBtn.textContent=on?'ON':'OFF'; auxControls.style.opacity=on?'':'0.4'; if(!on){const a=voice._tweAuxOscs[i];if(a){try{a.gain.disconnect();}catch(_){}a.connected=null;}} };
    enBtn.addEventListener('click', e=>{ e.stopPropagation(); als._enabled=als._enabled===false?true:false; updateAux(); redrawTwe(); });
    hdr.addEventListener('click', e=>{ if(e.target===enBtn||e.target===removeBtn) return; selectLane(auxId, auxBlock); });
    const lbl=document.createElement('span'); lbl.className='twe-block-lbl'; lbl.textContent=`AUX ${i+1}`;
    const removeBtn=document.createElement('button'); removeBtn.className='twe-remove-btn'; removeBtn.textContent='✕';
    removeBtn.addEventListener('click', e=>{ e.stopPropagation();
      voice.set('twe',`aux.remove.${i}`,null); auxBlock.remove();
      lanesContainer.querySelectorAll('.twe-aux-block').forEach(b=>b.remove());
      p.twe.aux.forEach((_,j)=>buildAuxLane(j)); redrawTwe();
    });
    hdr.append(lbl, removeBtn, enBtn); auxBlock.appendChild(hdr);
    buildLaneControls(auxControls, als, `aux.${i}`, true, false); auxBlock.appendChild(auxControls);
    updateAux();
    const addBtn=lanesContainer.querySelector('.twe-add-aux-btn');
    if(addBtn) lanesContainer.insertBefore(auxBlock,addBtn); else lanesContainer.appendChild(auxBlock);
  };

  // ─ Rebuild entire lanes UI ─
  const rebuildTweUI = () => {
    lanesContainer.innerHTML='';
    buildMainSection();
    const addAuxBtn=document.createElement('button'); addAuxBtn.className='twe-add-aux-btn'; addAuxBtn.textContent='＋ ADD AUX LANE';
    addAuxBtn.addEventListener('click',()=>{ voice.set('twe','aux.add',null); buildAuxLane(p.twe.aux.length-1); redrawTwe(); });
    lanesContainer.appendChild(addAuxBtn);
    p.twe.aux.forEach((_,i)=>buildAuxLane(i));
    redrawTwe();
  };
  rebuildTweUI();

  // TWE bypass toggle
  addSectionToggle(tweS,
    () => {
      p.twe._bypassed = true; voice.p.twe._bypassed = true;
      const t = voice.ctx.currentTime;
      voice.tweMain.gain.gain.setTargetAtTime(0,t,0.005); try{voice.tweMain.gain.disconnect();}catch(_){} voice.tweMain.connected=null;
      voice.tweBody.gain.gain.setTargetAtTime(0,t,0.005); try{voice.tweBody.gain.disconnect();}catch(_){} voice.tweBody.connected=null;
      if(voice._tweStrikeGain){voice._tweStrikeGain.gain.setTargetAtTime(0,t,0.005);try{voice._tweStrikeGain.disconnect();}catch(_){}}
      if(voice._tweStrikeOsc){try{voice._tweStrikeOsc.stop(t+0.05);}catch(_){}}
      if(voice._tweTailOsc){try{voice._tweTailOsc.stop(t+0.05);}catch(_){}}
      voice._tweAuxOscs.forEach(a=>{a.gain.gain.setTargetAtTime(0,t,0.005);try{a.gain.disconnect();}catch(_){}a.connected=null;});
    },
    () => { p.twe._bypassed = false; voice.p.twe._bypassed = false; },
    !p.twe._bypassed
  );

  // Initial draw
  setTimeout(() => redrawTwe(), 50);

  // LFO bank (using modular components)
  const lS = sec('LFOs'); lS.classList.add('lfo-sec');
  for (let i = 0; i < 5; i++) {
    createLFOPanel({
      parent: lS,
      lfoIndex: i,
      lfoParams: p.lfos[i],
      color,
      voice,
      bpmGet
    });
  }

  // Sequencer section — header with inline play button top-right
  const seqS = document.createElement('div');
  seqS.className = 'v-sec voice-seq-section';
  seqS.id = `seq-${voice.id}`;
  const seqHdr = document.createElement('div');
  seqHdr.className = 'sec-hdr';
  seqHdr.innerHTML = '<span>SEQUENCER</span>';
  const seqPlayBtn = document.createElement('button');
  seqPlayBtn.className = 'voice-seq-play-btn';
  seqPlayBtn.textContent = '▶';
  seqPlayBtn.dataset.voiceId = voice.id;
  seqHdr.appendChild(seqPlayBtn);
  seqS.appendChild(seqHdr);
  col.appendChild(seqS);

  // ── EQ ────────────────────────────────────────────────────
  const eqS = sec('EQ');
  buildEQSection(eqS, p.eq, voice, color);

  // ── FX (Reverb + Delay) ───────────────────────────────────
  const fxS = sec('FX');
  buildFXSection(fxS, p.fx, voice, color);
}

// ─────────────────────────────────────────────────────────
//  Sequencer UI (builds individual sequencer in each voice column)
// ─────────────────────────────────────────────────────────
function buildSequencer(seq) {
  // Build sequencer for each voice in its own column
  seq.voices.forEach((vSeq, vIdx) => {
    const container = document.getElementById(`seq-${vIdx}`);
    if (!container) return;

    // Wire the play button already in the section header
    const playBtn = container.querySelector('.voice-seq-play-btn');
    if (playBtn) {
      const updateBtn = () => {
        playBtn.classList.toggle('active', vSeq.enabled);
        playBtn.textContent = vSeq.enabled ? '⏹' : '▶';
      };
      updateBtn();
      playBtn.addEventListener('click', () => {
        vSeq.enabled = !vSeq.enabled;
        updateBtn();
        if (vSeq.enabled) {
          // Start global clock if not already running
          if (!seq.playing) {
            seq.play();
            const mainPlayBtn = document.getElementById('play-btn');
            if (mainPlayBtn) { mainPlayBtn.classList.add('playing'); mainPlayBtn.textContent = 'STOP'; }
          }
        } else {
          // Stop hanging notes on this voice
          seq.synth.voices[vIdx].noteOff();
        }
      });
    }

    const grid = document.createElement('div'); 
    grid.className = 'seq-grid'; 
    container.appendChild(grid);
    
    const cells = [];
    vSeq.steps.forEach((s, i) => {
      const cell = document.createElement('div'); 
      cell.className = 'seq-cell';
      const stepBtn = document.createElement('button'); 
      stepBtn.className = 'seq-btn' + (s.active ? ' active' : ''); 
      stepBtn.textContent = i + 1;
      const noteSel = document.createElement('select'); 
      noteSel.className = 'seq-note';
      SEQ_NOTES.forEach(n => { 
        const o = document.createElement('option'); 
        o.value = n.midi; 
        o.textContent = n.name; 
        if (n.midi === s.note) o.selected = true; 
        noteSel.appendChild(o); 
      });
      const accBtn = document.createElement('button'); 
      accBtn.className = 'seq-acc' + (s.accent ? ' active' : ''); 
      accBtn.textContent = '!';
      stepBtn.addEventListener('click', () => { 
        s.active = !s.active; 
        stepBtn.classList.toggle('active', s.active); 
      });
      noteSel.addEventListener('change', () => { 
        s.note = parseInt(noteSel.value); 
      });
      accBtn.addEventListener('click', () => { 
        s.accent = !s.accent; 
        accBtn.classList.toggle('active', s.accent); 
      });
      cell.append(stepBtn, noteSel, accBtn); 
      grid.appendChild(cell); 
      cells.push({cell, stepBtn});
    });
    
    // Store cells for this voice
    if (!seq._voiceCells) seq._voiceCells = [];
    seq._voiceCells[vIdx] = cells;
  });
  
  // Update onStep to highlight current step across all 3 voice sequencers
  seq.onStep = idx => {
    if (seq._voiceCells) {
      seq._voiceCells.forEach(cells => {
        cells.forEach(({stepBtn}, i) => stepBtn.classList.toggle('playing', i === idx));
      });
    }
  };
}

// ─────────────────────────────────────────────────────────
//  Master section
// ─────────────────────────────────────────────────────────
function buildMaster(container, synth) {
  // Per-voice mix strip
  const mixRow=document.createElement('div'); mixRow.className='mix-row'; container.appendChild(mixRow);
  synth.voices.forEach((v,i)=>{
    const col=document.createElement('div'); col.className='mix-col'; mixRow.appendChild(col);
    col.innerHTML=`<div class="mix-lbl" style="color:${VOICE_COLORS[i]}">${VOICE_LABELS[i]}</div>`;
    const kr=document.createElement('div'); kr.className='knob-row'; col.appendChild(kr);
    makeKnob({parent:kr,min:0,max:1, value:v.p.volume,label:'VOL',decimals:2,color:VOICE_COLORS[i],onChange:val=>{
      v.p.volume = val;
      if (v._enabled) v.outputGain.gain.setTargetAtTime(val, v.ctx.currentTime, 0.01);
    }});
    makeKnob({parent:kr,min:-1,max:1,value:v.p.pan,label:'PAN',decimals:2,color:VOICE_COLORS[i],onChange:val=>{
      v.p.pan = val;
      v.panner.pan.setTargetAtTime(val, v.ctx.currentTime, 0.01);
    }});
    const btnRow=document.createElement('div'); btnRow.className='mix-btn-row'; col.appendChild(btnRow);
    const muteBtn=document.createElement('button'); muteBtn.className='mix-mute-btn'; muteBtn.textContent='M';
    muteBtn.addEventListener('click',()=>{
      v._enabled = !v._enabled;
      muteBtn.classList.toggle('active', !v._enabled);
      const voiceCol = document.getElementById(`voice-${i+1}`);
      const toggle = voiceCol?.querySelector(`#voice-toggle-${i}`);
      if (toggle) toggle.checked = v._enabled;
      if (voiceCol) voiceCol.classList.toggle('voice-off', !v._enabled);
      const t = v.ctx.currentTime;
      v.outputGain.gain.setTargetAtTime(v._enabled ? v.p.volume : 0, t, 0.02);
      if (!v._enabled) v._killSrcs();
    });
    const soloBtn=document.createElement('button'); soloBtn.className='mix-solo-btn'; soloBtn.textContent='S';
    soloBtn.addEventListener('click',()=>{
      const isSolo=soloBtn.classList.contains('active');
      mixRow.querySelectorAll('.mix-solo-btn').forEach(b=>b.classList.remove('active'));
      if (!isSolo) {
        soloBtn.classList.add('active');
        synth.voices.forEach((voice, idx) => {
          const enable = idx === i;
          voice._enabled = enable;
          const vCol = document.getElementById(`voice-${idx+1}`);
          const vToggle = vCol?.querySelector(`#voice-toggle-${idx}`);
          if (vToggle) vToggle.checked = enable;
          if (vCol) vCol.classList.toggle('voice-off', !enable);
          voice.outputGain.gain.setTargetAtTime(enable ? voice.p.volume : 0, voice.ctx.currentTime, 0.02);
          if (!enable) voice._killSrcs();
        });
      } else {
        synth.voices.forEach((voice, idx) => {
          voice._enabled = true;
          const vCol = document.getElementById(`voice-${idx+1}`);
          const vToggle = vCol?.querySelector(`#voice-toggle-${idx}`);
          if (vToggle) vToggle.checked = true;
          if (vCol) vCol.classList.remove('voice-off');
          voice.outputGain.gain.setTargetAtTime(voice.p.volume, voice.ctx.currentTime, 0.02);
        });
      }
    });
    btnRow.append(muteBtn,soloBtn);
  });

  // FX row
  const fxRow=document.createElement('div'); fxRow.className='knob-row fx-row'; container.appendChild(fxRow);
  const s=synth;
  makeKnob({parent:fxRow,min:0,max:1,   value:s.masterGain.gain.value,label:'MASTER',     decimals:2,color:'#ddd',onChange:v=>s.masterGain.gain.setTargetAtTime(v,s.ctx.currentTime,0.01)});
  makeKnob({parent:fxRow,min:0.01,max:1,value:s.delay.delayTime.value,label:'DLY-T',unit:'s',decimals:2,color:'#888',onChange:v=>s.delay.delayTime.setTargetAtTime(v,s.ctx.currentTime,0.01)});
  makeKnob({parent:fxRow,min:0,max:0.9, value:s.delayFB.gain.value,   label:'DLY-FB',     decimals:2,color:'#888',onChange:v=>s.delayFB.gain.setTargetAtTime(v,s.ctx.currentTime,0.01)});
  makeKnob({parent:fxRow,min:0,max:1,   value:s.delayWet.gain.value,  label:'DLY-MX',     decimals:2,color:'#888',onChange:v=>s.delayWet.gain.setTargetAtTime(v,s.ctx.currentTime,0.01)});

  // POLY / MONO toggle
  const polyWrap = document.createElement('div');
  polyWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;margin-left:8px;';
  const polyBtn = document.createElement('button');
  polyBtn.className = 'poly-mode-btn';
  polyBtn.style.cssText = 'font-size:9px;letter-spacing:2px;padding:4px 10px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:#12122a;color:rgba(255,255,255,0.4);cursor:pointer;transition:all 0.15s;';
  polyBtn.textContent = 'MONO';
  polyBtn.title = 'MONO: all voices layer on the same note\nPOLY: one voice lane per note (3-note max)\nCHORD: each chord note → a unison slot within one lane';
  const polyLbl = document.createElement('div');
  polyLbl.style.cssText = 'font-size:8px;letter-spacing:1px;color:rgba(255,255,255,0.25);';
  polyLbl.textContent = 'MODE';
  const MODE_CYCLE = ['mono', 'poly', 'chord'];
  const MODE_COLOR = { mono: 'rgba(255,255,255,0.4)', poly: '#00ffb2', chord: '#a855f7' };
  const MODE_BORDER = { mono: 'rgba(255,255,255,0.15)', poly: '#00ffb2', chord: '#a855f7' };
  function syncPolyBtn() {
    const m = synth.polyMode;
    polyBtn.textContent = m.toUpperCase();
    polyBtn.style.color = MODE_COLOR[m];
    polyBtn.style.borderColor = MODE_BORDER[m];
  }
  polyBtn.addEventListener('_syncLabel', syncPolyBtn);
  polyBtn.addEventListener('click', () => {
    const idx = MODE_CYCLE.indexOf(synth.polyMode);
    synth.polyMode = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
    synth.voices.forEach(v => { v.noteOff(); v._heldSlots = new Set(); });
    synth._voiceNoteMap.clear();
    synth._chordSlotMap.clear();
    syncPolyBtn();
  });
  polyWrap.append(polyBtn, polyLbl);
  fxRow.appendChild(polyWrap);
}

// ─────────────────────────────────────────────────────────
//  Visualizer with Toggle + Metrics
// ─────────────────────────────────────────────────────────
function buildVisualizer(container, analyser) {
  const vizWrap = document.createElement('div'); vizWrap.className = 'viz-container';
  container.appendChild(vizWrap);

  // Controls row
  const controls = document.createElement('div'); controls.className = 'viz-controls';
  const waveBtn = document.createElement('button'); waveBtn.className = 'viz-toggle-btn active'; waveBtn.textContent = 'WAVE';
  const specBtn = document.createElement('button'); specBtn.className = 'viz-toggle-btn'; specBtn.textContent = 'SPEC';
  const metrics = document.createElement('div'); metrics.className = 'viz-metrics';
  metrics.innerHTML = `
    <span class="viz-metric">PEAK: <span class="viz-metric-val" id="viz-peak">0.0</span></span>
    <span class="viz-metric">RMS: <span class="viz-metric-val" id="viz-rms">0.0</span></span>
    <span class="viz-metric">FUND: <span class="viz-metric-val" id="viz-fund">—</span></span>
    <span class="viz-metric">CPU: <span class="viz-metric-val" id="viz-cpu">—</span></span>
    <span class="viz-metric">LAT: <span class="viz-metric-val" id="viz-lat">—</span></span>
  `;
  controls.append(waveBtn, specBtn, metrics);
  vizWrap.appendChild(controls);

  // Canvas
  const canvas = document.createElement('canvas'); canvas.id = 'viz';
  vizWrap.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  const c = canvas.getContext('2d');
  const timeBuf = new Uint8Array(analyser.frequencyBinCount);
  const freqBuf = new Uint8Array(analyser.frequencyBinCount);
  let mode = 'wave';

  waveBtn.addEventListener('click', () => {
    mode = 'wave'; waveBtn.classList.add('active'); specBtn.classList.remove('active');
  });
  specBtn.addEventListener('click', () => {
    mode = 'spec'; specBtn.classList.add('active'); waveBtn.classList.remove('active');
  });

  let _rafLast = performance.now(), _rafSmooth = 16.67;
  function draw(rafNow) {
    requestAnimationFrame(draw);
    _rafSmooth = _rafSmooth * 0.92 + (rafNow - _rafLast) * 0.08;
    _rafLast = rafNow;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    c.scale(dpr, dpr);
    c.fillStyle = '#06061a'; c.fillRect(0, 0, W, H);

    if (mode === 'wave') {
      analyser.getByteTimeDomainData(timeBuf);
      c.beginPath(); c.strokeStyle = '#00ffb2'; c.lineWidth = 1.5;
      const sl = W / timeBuf.length;
      let peak = 0;
      for (let i = 0; i < timeBuf.length; i++) {
        const v = timeBuf[i] / 128 - 1;
        peak = Math.max(peak, Math.abs(v));
        const y = H / 2 - v * (H / 2 - 4);
        i === 0 ? c.moveTo(0, y) : c.lineTo(i * sl, y);
      }
      c.stroke();
      // Update peak metric
      document.getElementById('viz-peak').textContent = peak.toFixed(2);
    } else {
      analyser.getByteFrequencyData(freqBuf);
      const barCount = 128;
      const barWidth = W / barCount;
      let peakIdx = 0, peakVal = 0;
      for (let i = 0; i < barCount; i++) {
        const barHeight = (freqBuf[i] / 255) * (H - 4);
        if (freqBuf[i] > peakVal) { peakVal = freqBuf[i]; peakIdx = i; }
        const hue = 180 - (freqBuf[i] / 255) * 60;
        c.fillStyle = `hsl(${hue}, 70%, 50%)`;
        c.fillRect(i * barWidth, H - barHeight, barWidth - 1, barHeight);
      }
      // Fundamental frequency detection (simple peak finding)
      const nyquist = analyser.context.sampleRate / 2;
      const fundFreq = (peakIdx / barCount) * nyquist;
      document.getElementById('viz-fund').textContent = fundFreq > 20 ? Math.round(fundFreq) + ' Hz' : '—';
    }

    // RMS calculation
    let sumSq = 0;
    for (let i = 0; i < timeBuf.length; i++) {
      const v = timeBuf[i] / 128 - 1;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / timeBuf.length);
    document.getElementById('viz-rms').textContent = rms.toFixed(2);

    // CPU (RAF frame time) + audio latency
    const cpuPct = Math.min(999, Math.max(0, Math.round((_rafSmooth / 16.67 - 1) * 100)));
    const cpuEl = document.getElementById('viz-cpu');
    if (cpuEl) {
      const ctx = analyser.context;
      const idle = ctx.state === 'suspended';
      cpuEl.textContent = idle ? 'IDLE' : cpuPct + '%';
      cpuEl.style.color = idle ? '#555' : cpuPct > 50 ? '#ff4444' : cpuPct > 20 ? '#ffaa00' : '#00ffb2';
    }
    const latEl = document.getElementById('viz-lat');
    if (latEl) {
      const ctx = analyser.context;
      const lat = Math.round(((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000);
      latEl.textContent = lat > 0 ? lat + 'ms' : '—';
      latEl.style.color = lat > 50 ? '#ff4444' : lat > 20 ? '#ffaa00' : '#00ffb2';
    }
  }
  draw(performance.now());
}

// ─────────────────────────────────────────────────────────
//  TWE preview canvas
// ─────────────────────────────────────────────────────────
function drawTwePreview(canvas, tweP, color, elapsedSec, selectedLane, bpm) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 70;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);
  const isLive = elapsedSec !== undefined;

  const _bpm      = bpm || 120;
  const barSec    = (60 / _bpm) * 4;                   // seconds per bar
  const barsTotal = Math.max(1, tweP.barsTotal || 4);
  const DURATION  = barsTotal * barSec;                // total canvas window in seconds
  const NOTE_OFF  = 0.5;                               // note-off at 50% of window
  const cx = H / 2;
  const pts = W * 2;

  // Bar grid lines
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);
  for (let bar = 0; bar <= barsTotal; bar++) {
    const xBar = (bar / barsTotal) * W;
    const isBeat1 = (bar % 4 === 0);
    c.strokeStyle = isBeat1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
    c.lineWidth = isBeat1 ? 1 : 0.5;
    c.beginPath(); c.moveTo(xBar, 0); c.lineTo(xBar, H); c.stroke();
    if (bar > 0 && bar < barsTotal) {
      c.fillStyle = 'rgba(255,255,255,0.2)'; c.font = `${5 / dpr}px Courier New`;
      c.fillText(bar + 1, xBar + 2, 8);
    }
  }
  // Centre line
  c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(0, cx); c.lineTo(W, cx); c.stroke();

  // note-on / note-off markers
  const xOff = NOTE_OFF * W;
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
  c.setLineDash([3,3]);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, H); c.stroke();
  c.beginPath(); c.moveTo(xOff, 0); c.lineTo(xOff, H); c.stroke();
  c.setLineDash([]);

  // Labels
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.font = `${6 / dpr}px Courier New`;
  c.fillText('ON', 3, H - 3); c.fillText('OFF', xOff + 3, H - 3);
  c.fillText('1', 3, 8); // bar 1 label

  function waveY(t, shape, rate, customSamples) {
    if (shape === 'custom' && customSamples && customSamples.length) {
      const phase = ((t * rate % 1) + 1) % 1;
      const N = customSamples.length;
      const fi = phase * N;
      const i0 = Math.floor(fi) % N, i1 = (i0 + 1) % N, fr = fi - Math.floor(fi);
      return customSamples[i0] * (1 - fr) + customSamples[i1] * fr;
    }
    const p = t * rate * 2 * Math.PI;
    switch (shape) {
      case 'sawtooth': return (((t * rate) % 1) * 2 - 1);
      case 'square':   return Math.sin(p) >= 0 ? 1 : -1;
      case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(p));
      default:         return Math.sin(p);
    }
  }

  const ms = tweP.main || {};
  const allSlots = [ms, ms.strike||{}, ms.body||{}, ms.tail||{}, ...(tweP.aux||[])];
  const maxDepth = Math.max(...allSlots.map(s => (s ? (s.depth||0) : 0)), 1); // include disabled for stable scale

  function drawSlot(slotP, tStart, slotColor, baseAlpha, slotId) {
    if (!slotP || slotP.depth <= 0) return;
    const disabled = slotP._enabled === false;
    const isSel = slotId === selectedLane;
    const normDepth = slotP.depth / maxDepth;
    const alpha = disabled ? Math.min(baseAlpha * 0.25, 0.18) : (isSel ? Math.min(baseAlpha * 1.4, 1) : baseAlpha);
    c.save(); c.globalAlpha = alpha; c.strokeStyle = slotColor;
    c.shadowColor = slotColor; c.shadowBlur = isSel ? 10 : 4;
    c.lineWidth = isSel ? 2.5 : (disabled ? 1 : 1.5); c.lineJoin = 'round';
    if (isSel) { c.setLineDash([]); } else if (disabled) { c.setLineDash([3,3]); }
    c.beginPath();
    let started = false;
    for (let i = 0; i < pts; i++) {
      const t = (i / pts) * DURATION;
      if (t < tStart) continue;
      const tRel = t - tStart;
      const env = (slotP.decay||0) > 0 ? Math.exp(-tRel * 4 / Math.max(0.05, slotP.decay)) : 1;
      const y = waveY(tRel, slotP.shape, slotP.rate, slotP.customShape) * normDepth * env;
      const px = (t / DURATION) * W;
      const py = cx - y * (cx - 4);
      if (!started) { c.moveTo(px, py); started = true; } else { c.lineTo(px, py); }
    }
    c.stroke(); c.setLineDash([]); c.restore();
  }

  const mainColor   = '#ffffff';
  const strikeColor = '#ff8844';
  const bodyColor   = color;
  const tailColor   = '#44aaff';
  const auxColors   = ['#cc44ff','#ffcc00','#44ffcc','#ff4488'];

  // Draw non-selected lanes first (underneath), selected on top
  // startBar converts bar position → seconds using barSec
  const slots = [
    { sp: ms,            tS: 0,                                         col: mainColor,   a: isLive?0.4:0.6,  id: 'main'   },
    { sp: ms.strike||{}, tS: (ms.strike?.startBar||0) * barSec,         col: strikeColor, a: isLive?0.5:0.75, id: 'strike' },
    { sp: ms.body||{},   tS: (ms.body?.startBar||0)   * barSec,         col: bodyColor,   a: isLive?0.6:0.9,  id: 'body'   },
    { sp: ms.tail||{},   tS: NOTE_OFF * DURATION + (ms.tail?.startBar||0) * barSec, col: tailColor, a: isLive?0.5:0.75, id: 'tail' },
    ...(tweP.aux||[]).map((als,i)=>({ sp:als, tS:(als.startBar||0)*barSec, col:auxColors[i%auxColors.length], a:isLive?0.55:0.8, id:`aux.${i}` })),
  ];
  slots.filter(s=>s.id !== selectedLane).forEach(s=>drawSlot(s.sp, s.tS, s.col, s.a, s.id));
  const sel = slots.find(s=>s.id === selectedLane);
  if (sel) drawSlot(sel.sp, sel.tS, sel.col, sel.a, sel.id);

  // Live mode: playhead + dots
  if (isLive) {
    const elapsed = Math.min(elapsedSec, DURATION);
    const xPlay = (elapsed / DURATION) * W;
    c.save(); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.shadowColor = '#ffffff'; c.shadowBlur = 6;
    c.beginPath(); c.moveTo(xPlay, 0); c.lineTo(xPlay, H); c.stroke(); c.restore();

    slots.forEach(({ sp, tS, col, id }) => {
      if (!sp || sp.depth <= 0 || sp._enabled === false || elapsed < tS) return;
      const tRel = elapsed - tS;
      const env  = (sp.decay||0) > 0 ? Math.exp(-tRel * 4 / Math.max(0.05, sp.decay)) : 1;
      const y    = waveY(tRel, sp.shape, sp.rate, sp.customShape) * (sp.depth / maxDepth) * env;
      const py   = cx - y * (cx - 4);
      const isSel = id === selectedLane;
      c.save(); c.fillStyle=col; c.shadowColor=col; c.shadowBlur=isSel?14:8; c.globalAlpha=0.95;
      c.beginPath(); c.arc(xPlay, py, isSel?5:3.5, 0, Math.PI*2); c.fill(); c.restore();
    });
  }

  // Legend
  const legendItems = [
    ['M',mainColor,'main'],['S',strikeColor,'strike'],['B',bodyColor,'body'],['T',tailColor,'tail'],
    ...(tweP.aux||[]).map((_,i)=>[`A${i+1}`,auxColors[i%auxColors.length],`aux.${i}`])
  ];
  legendItems.forEach(([lbl, col, id], i) => {
    const isSel = id === selectedLane;
    const isOff = allSlots[i]?._enabled === false;
    c.fillStyle=col; c.font= isSel ? 'bold 7px Courier New' : '6px Courier New';
    c.globalAlpha = isOff ? 0.3 : (isSel ? 1.0 : 0.7);
    c.fillText(isSel ? `[${lbl}]` : lbl, W - (isSel?18:14), 8+i*12);
  });
}

// ─────────────────────────────────────────────────────────
//  TWE Preset Patterns (Shaperbox-style)
// ─────────────────────────────────────────────────────────
const WOBBLE_PRESETS = {
  'Basic': { main: {
    rate:2, depth:200, target:'cutoff', shape:'sine', bpmSync:true, syncDiv:4, triplet:false, dotted:false,
    strike: { rate:8,  depth:0,   decay:0.3, target:'noiseAmt', shape:'sine', bpmSync:true, syncDiv:8,  triplet:false, dotted:false },
    body:   { rate:4,  depth:400, decay:0,   target:'cutoff',   shape:'sine', bpmSync:true, syncDiv:4,  triplet:false, dotted:false },
    tail:   { rate:2,  depth:0,   decay:0.5, target:'pitch',    shape:'sine', bpmSync:true, syncDiv:2,  triplet:false, dotted:false },
  }},
  'Stutter': { main: {
    rate:4, depth:300, target:'cutoff', shape:'square', bpmSync:true, syncDiv:8, triplet:false, dotted:false,
    strike: { rate:16, depth:300, decay:0.15, target:'cutoff',    shape:'square', bpmSync:true, syncDiv:16, triplet:false, dotted:false },
    body:   { rate:8,  depth:500, decay:0,   target:'cutoff',    shape:'square', bpmSync:true, syncDiv:8,  triplet:false, dotted:false },
    tail:   { rate:4,  depth:150, decay:0.3, target:'resonance', shape:'square', bpmSync:true, syncDiv:4,  triplet:false, dotted:false },
  }},
  'Scratch': { main: {
    rate:8, depth:400, target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:16, triplet:false, dotted:false,
    strike: { rate:32, depth:200, decay:0.1, target:'pitch',  shape:'sawtooth', bpmSync:true, syncDiv:32, triplet:false, dotted:false },
    body:   { rate:16, depth:600, decay:0,   target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:16, triplet:false, dotted:false },
    tail:   { rate:8,  depth:100, decay:0.2, target:'pitch',  shape:'sawtooth', bpmSync:true, syncDiv:8,  triplet:false, dotted:false },
  }},
  'Tape': { main: {
    rate:1, depth:250, target:'cutoff', shape:'triangle', bpmSync:true, syncDiv:2, triplet:false, dotted:false,
    strike: { rate:4, depth:100, decay:0.4, target:'pitch',  shape:'sine',     bpmSync:true, syncDiv:4, triplet:false, dotted:false },
    body:   { rate:2, depth:300, decay:0,   target:'cutoff', shape:'triangle', bpmSync:true, syncDiv:2, triplet:false, dotted:false },
    tail:   { rate:1, depth:200, decay:0.8, target:'pitch',  shape:'sine',     bpmSync:true, syncDiv:1, triplet:false, dotted:false },
  }},
  'Pitch': { main: {
    rate:2, depth:200, target:'pitch', shape:'sine', bpmSync:true, syncDiv:4, triplet:false, dotted:false,
    strike: { rate:8, depth:250, decay:0.2, target:'pitch', shape:'triangle', bpmSync:true, syncDiv:8, triplet:false, dotted:false },
    body:   { rate:4, depth:200, decay:0,   target:'pitch', shape:'sine',     bpmSync:true, syncDiv:4, triplet:false, dotted:false },
    tail:   { rate:2, depth:300, decay:0.6, target:'pitch', shape:'sine',     bpmSync:true, syncDiv:2, triplet:false, dotted:false },
  }},
  'Reverse': { main: {
    rate:4, depth:300, target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:8, triplet:false, dotted:false,
    strike: { rate:16, depth:0,   decay:0.2, target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:16, triplet:false, dotted:false },
    body:   { rate:8,  depth:450, decay:0,   target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:8,  triplet:false, dotted:false },
    tail:   { rate:4,  depth:250, decay:0.5, target:'cutoff', shape:'triangle', bpmSync:true, syncDiv:4,  triplet:false, dotted:false },
  }},
  'Triplet': { main: {
    rate:2, depth:200, target:'cutoff', shape:'sine', bpmSync:true, syncDiv:4, triplet:true, dotted:false,
    strike: { rate:8, depth:200, decay:0.25, target:'noiseAmt',  shape:'sine', bpmSync:true, syncDiv:8, triplet:true, dotted:false },
    body:   { rate:4, depth:350, decay:0,    target:'cutoff',    shape:'sine', bpmSync:true, syncDiv:4, triplet:true, dotted:false },
    tail:   { rate:2, depth:150, decay:0.4,  target:'resonance', shape:'sine', bpmSync:true, syncDiv:2, triplet:true, dotted:false },
  }},
  'Dotted': { main: {
    rate:2, depth:300, target:'cutoff', shape:'square', bpmSync:true, syncDiv:4, triplet:false, dotted:true,
    strike: { rate:8, depth:180, decay:0.3, target:'cutoff', shape:'square', bpmSync:true, syncDiv:8, triplet:false, dotted:true },
    body:   { rate:4, depth:400, decay:0,   target:'cutoff', shape:'square', bpmSync:true, syncDiv:4, triplet:false, dotted:true },
    tail:   { rate:2, depth:120, decay:0.5, target:'pan',    shape:'square', bpmSync:true, syncDiv:2, triplet:false, dotted:true },
  }},
};

function randomizeWobble() {
  const targets = ['cutoff','resonance','pitch','noiseAmt','pan','volume'];
  const shapes = ['sine','sawtooth','square','triangle'];
  const divs = [1,2,4,8,16,32];
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randFloat = (min, max) => Math.random() * (max - min) + min;
  const lane = (rMin, rMax, dMin, dMax, hasDecay) => ({
    rate: randFloat(rMin, rMax), depth: randInt(dMin, dMax), decay: hasDecay ? randFloat(0.1, 0.8) : 0,
    target: rand(targets), shape: rand(shapes),
    bpmSync: Math.random() > 0.3, syncDiv: rand(divs), triplet: false, dotted: false,
    _enabled: true
  });
  return { main: Object.assign(lane(1, 8, 100, 500, false), {
    strike: lane(4, 20, 0, 400, true),
    body:   lane(2, 12, 200, 700, false),
    tail:   lane(1, 8, 0, 350, true),
  }) };
}

function aiGenerateWobble() {
  // AI-inspired: weighted archetypes (bass wobble, dubstep, glitch, ambient)
  const archetypes = [
    { name: 'bass', weight: 0.4 },
    { name: 'dubstep', weight: 0.3 },
    { name: 'glitch', weight: 0.2 },
    { name: 'ambient', weight: 0.1 }
  ];
  const r = Math.random();
  let acc = 0, archetype = 'bass';
  for (const a of archetypes) {
    acc += a.weight;
    if (r <= acc) { archetype = a.name; break; }
  }

  const targets = ['cutoff','resonance','pitch','noiseAmt','pan','volume'];
  const shapes = ['sine','sawtooth','square','triangle'];
  const divs = [1,2,4,8,16,32];
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randFloat = (min, max) => Math.random() * (max - min) + min;

  if (archetype === 'bass') {
    return { main: {
      rate:2, depth:randInt(300,500), target:'cutoff', shape:rand(['sine','triangle']), bpmSync:true, syncDiv:4, triplet:false, dotted:false, _enabled:true,
      strike: { rate:8,  depth:randInt(100,250), decay:0.2, target:'noiseAmt',  shape:'sine',               bpmSync:true, syncDiv:8,  triplet:false, dotted:false, _enabled:true },
      body:   { rate:4,  depth:randInt(400,600), decay:0,   target:'cutoff',    shape:rand(['sine','triangle']), bpmSync:true, syncDiv:4,  triplet:false, dotted:false, _enabled:true },
      tail:   { rate:2,  depth:randInt(50,150),  decay:0.5, target:'resonance', shape:'sine',               bpmSync:true, syncDiv:2,  triplet:false, dotted:false, _enabled:true },
    }};
  } else if (archetype === 'dubstep') {
    return { main: {
      rate:4, depth:randInt(600,900), target:'cutoff', shape:rand(['square','sawtooth']), bpmSync:true, syncDiv:8, triplet:false, dotted:false, _enabled:true,
      strike: { rate:16, depth:randInt(200,400), decay:0.15, target:'cutoff',    shape:'square',                     bpmSync:true, syncDiv:16, triplet:false,             dotted:false, _enabled:true },
      body:   { rate:8,  depth:randInt(500,800), decay:0,    target:'cutoff',    shape:rand(['square','sawtooth']),   bpmSync:true, syncDiv:8,  triplet:Math.random()>0.7, dotted:false, _enabled:true },
      tail:   { rate:4,  depth:randInt(100,250), decay:0.3,  target:'resonance', shape:'square',                     bpmSync:true, syncDiv:4,  triplet:false,             dotted:false, _enabled:true },
    }};
  } else if (archetype === 'glitch') {
    return { main: {
      rate:8, depth:randInt(400,700), target:rand(['cutoff','pitch']), shape:rand(shapes), bpmSync:true, syncDiv:16, triplet:false, dotted:false, _enabled:true,
      strike: { rate:32, depth:randInt(150,300), decay:0.1, target:rand(['pitch','noiseAmt']), shape:rand(shapes), bpmSync:true, syncDiv:32, triplet:false, dotted:false, _enabled:true },
      body:   { rate:16, depth:randInt(300,600), decay:0,   target:rand(['cutoff','pitch']),   shape:rand(shapes), bpmSync:true, syncDiv:16, triplet:false, dotted:false, _enabled:true },
      tail:   { rate:8,  depth:randInt(80,200),  decay:0.2, target:rand(['pan','pitch']),      shape:rand(shapes), bpmSync:true, syncDiv:8,  triplet:false, dotted:false, _enabled:true },
    }};
  } else { // ambient
    return { main: {
      rate:1, depth:randInt(200,400), target:'cutoff', shape:rand(['sine','triangle']), bpmSync:true, syncDiv:2, triplet:false, dotted:false, _enabled:true,
      strike: { rate:2, depth:randInt(50,150),  decay:0.6, target:'cutoff',    shape:'sine',     bpmSync:true, syncDiv:2, triplet:false, dotted:false, _enabled:true },
      body:   { rate:1, depth:randInt(200,400), decay:0,   target:'cutoff',    shape:'triangle', bpmSync:true, syncDiv:1, triplet:false, dotted:false, _enabled:true },
      tail:   { rate:1, depth:randInt(100,250), decay:1.0, target:'resonance', shape:'sine',     bpmSync:true, syncDiv:1, triplet:false, dotted:false, _enabled:true },
    }};
  }
}

// ─────────────────────────────────────────────────────────
//  TWE Pattern Library
// ─────────────────────────────────────────────────────────
const WOBBLE_PAT_KEY = 'wobbler-wobble-patterns';

function _getAllWobblePatterns() {
  try { return JSON.parse(localStorage.getItem(WOBBLE_PAT_KEY) || '{}'); } catch(_) { return {}; }
}
function saveWobblePattern(name, tweP) {
  if (!name.trim()) return false;
  const pats = _getAllWobblePatterns();
  pats[name.trim()] = { name: name.trim(), createdAt: new Date().toISOString(), twe: JSON.parse(JSON.stringify(tweP)) };
  localStorage.setItem(WOBBLE_PAT_KEY, JSON.stringify(pats));
  return true;
}
function deleteWobblePattern(name) {
  const pats = _getAllWobblePatterns();
  delete pats[name];
  localStorage.setItem(WOBBLE_PAT_KEY, JSON.stringify(pats));
}

// ─────────────────────────────────────────────────────────
//  Patch Engine  (sound + TWE/LFO modulation + sequence)
// ─────────────────────────────────────────────────────────
const PATCH_STORAGE_KEY = 'wobbler-patches';
const AUTO_SAVE_KEY     = 'wobbler-autosave';

function autoSave(synth, seq) {
  try { localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(capturePatch('__autosave__', synth, seq))); } catch(_) {}
}
function autoLoad(synth, seq, bpmSet, rebuildAll) {
  try {
    const raw = localStorage.getItem(AUTO_SAVE_KEY);
    if (!raw) return false;
    const patch = JSON.parse(raw);
    applyPatchToAudio(patch, synth, seq, bpmSet);
    rebuildAll();
    return true;
  } catch(_) { return false; }
}

function _getAllPatches() {
  try { return JSON.parse(localStorage.getItem(PATCH_STORAGE_KEY) || '{}'); } catch(_) { return {}; }
}
function _saveAllPatches(patches) {
  localStorage.setItem(PATCH_STORAGE_KEY, JSON.stringify(patches));
}

function capturePatch(name, synth, seq) {
  return {
    version: 3,
    name,
    createdAt: new Date().toISOString(),
    voices: synth.voices.map(v => JSON.parse(JSON.stringify(v.p))),
    voicesEnabled: synth.voices.map(v => v._enabled),
    seqVoices: seq.voices.map(vSeq => ({
      enabled: vSeq.enabled,
      steps: vSeq.steps.map(s => ({ note: s.note, active: s.active, accent: s.accent }))
    })),
    master: {
      bpm: seq.bpm,
      masterGain: synth.masterGain.gain.value,
      delayTime: synth.delay.delayTime.value,
      delayFB: synth.delayFB.gain.value,
      delayWet: synth.delayWet.gain.value,
    }
  };
}

function savePatch(name, synth, seq) {
  if (!name.trim()) return false;
  const patches = _getAllPatches();
  patches[name.trim()] = capturePatch(name.trim(), synth, seq);
  _saveAllPatches(patches);
  return true;
}

function deletePatch(name) {
  const patches = _getAllPatches();
  delete patches[name];
  _saveAllPatches(patches);
}

function applyPatchToAudio(patch, synth, seq, bpmSet) {
  const t = synth.ctx.currentTime;

  // Voices — deep assign params then sync audio nodes
  patch.voices.forEach((vp, i) => {
    const v = synth.voices[i]; if (!v) return;
    
    // Migration: add missing defaults for new features
    if (!vp.twe.main) vp.twe.main = { rate:2, depth:200, attack:0, decay:0, target:'cutoff', shape:'sine', bpmSync:false, syncDiv:4, triplet:false, dotted:false, _enabled:true,
      strike: { rate:8, depth:0, attack:0, decay:0.4, startBar:0, target:'noiseAmt', shape:'sine', bpmSync:false, syncDiv:8, triplet:false, dotted:false, _enabled:true },
      body:   { rate:4, depth:0, attack:0, decay:0,   startBar:0, target:'cutoff',   shape:'sine', bpmSync:false, syncDiv:4, triplet:false, dotted:false, _enabled:true },
      tail:   { rate:2, depth:0, attack:0, decay:0.6, startBar:0, target:'pitch',    shape:'sine', bpmSync:false, syncDiv:2, triplet:false, dotted:false, _enabled:true } };
    if (!vp.twe.main.strike) vp.twe.main.strike = { rate:8, depth:0, attack:0, decay:0.4, startBar:0, target:'noiseAmt', shape:'sine', bpmSync:false, syncDiv:8, triplet:false, dotted:false, _enabled:true };
    if (!vp.twe.main.body)   vp.twe.main.body   = { rate:4, depth:0, attack:0, decay:0,   startBar:0, target:'cutoff',   shape:'sine', bpmSync:false, syncDiv:4, triplet:false, dotted:false, _enabled:true };
    if (!vp.twe.main.tail)   vp.twe.main.tail   = { rate:2, depth:0, attack:0, decay:0.6, startBar:0, target:'pitch',    shape:'sine', bpmSync:false, syncDiv:2, triplet:false, dotted:false, _enabled:true };
    if (!vp.twe.aux) vp.twe.aux = [];
    if (vp.twe.barsTotal === undefined) vp.twe.barsTotal = 4;
    // Migrate attack/startDelay/startBar into existing sub-components
    if (!('attack' in vp.twe.main)) vp.twe.main.attack = 0;
    if (!('decay'  in vp.twe.main)) vp.twe.main.decay  = 0;
    ['strike','body','tail'].forEach(k => {
      const sub = vp.twe.main[k]; if (!sub) return;
      if (!('attack'   in sub)) sub.attack   = 0;
      if (!('decay'    in sub)) sub.decay    = 0;
      if (!('startBar' in sub)) sub.startBar = sub.startDelay || 0; // migrate seconds→0 (bars)
    });
    (vp.twe.aux || []).forEach(a => {
      if (!('attack'   in a)) a.attack   = 0;
      if (!('startBar' in a)) a.startBar = 0;
    });
    (vp.lfos || []).forEach((lp, i) => { if (lp._enabled === undefined) lp._enabled = i < 2; });
    if (vp.noise.filterMix === undefined) vp.noise.filterMix = 1;
    if (vp.twe.tweAmt      === undefined) vp.twe.tweAmt      = 1;
    if (!vp.eq) vp.eq = { lowGain:0, midGain:0, highGain:0, lowFreq:200, midFreq:1000, highFreq:6000 };
    if (!vp.fx) vp.fx = { reverbMix:0, reverbDecay:2.0, delayMix:0, delayTime:0.375, delayFB:0.4 };
    if (vp.filter.bypassed  === undefined) vp.filter.bypassed  = false;
    if (vp.eq.bypassed      === undefined) vp.eq.bypassed      = false;
    if (vp.fx.bypassed      === undefined) vp.fx.bypassed      = false;
    if (!vp.dist) vp.dist = { form:'soft', drive:0, tone:18000, mix:0, volume:1 };
    if (vp.dist.bypassed    === undefined) vp.dist.bypassed    = false;
    if (!vp.twe._bypassed)  vp.twe._bypassed = false;
    if (vp.osc.unison       === undefined) vp.osc.unison       = 1;
    if (vp.osc.unisonDetune === undefined) vp.osc.unisonDetune = 20;
    if (vp.osc.unisonBlend  === undefined) vp.osc.unisonBlend  = 1;
    vp.lfos.forEach(lp => { if (lp.envA === undefined) lp.envA = 0; if (lp.envR === undefined) lp.envR = 0; });
    
    Object.assign(v.p, JSON.parse(JSON.stringify(vp)));
    if (patch.voicesEnabled) {
      v._enabled = patch.voicesEnabled[i] !== false;
      v.outputGain.gain.setValueAtTime(v._enabled ? vp.volume : 0, t);
    }

    // Sync persistent audio nodes — use direct .value so getFrequencyResponse works immediately
    // Filter (respect bypass state)
    v._filterBypassed = vp.filter.bypassed === true;
    v.filter.type = v._filterBypassed ? 'allpass' : vp.filter.type;
    v.filter.frequency.value = vp.filter.cutoff;
    v.filter.frequency.setValueAtTime(vp.filter.cutoff, t);
    v.filter.Q.value = vp.filter.resonance;
    v.filter.Q.setValueAtTime(vp.filter.resonance, t);
    if (vp.dist) {
      v._distNode.curve = v._distCurve(vp.dist.form, vp.dist.drive);
      v._distTone.frequency.setValueAtTime(vp.dist.tone, t);
      v._distPost.gain.setValueAtTime(vp.dist.volume, t);
      // Distortion bypass state
      const distBypassed = vp.dist.bypassed === true;
      v._distWet.gain.setValueAtTime(distBypassed ? 0 : vp.dist.mix, t);
      v._distDry.gain.setValueAtTime(distBypassed ? 1 : 1 - vp.dist.mix, t);
    }
    v.filterWet.gain.setValueAtTime(vp.filter.mix ?? 1, t);
    v.filterDry.gain.setValueAtTime(1 - (vp.filter.mix ?? 1), t);
    v.panner.pan.setValueAtTime(vp.pan, t);
    if (vp.fx) {
      v._rvbConv.buffer = v._makeImpulse(vp.fx.reverbDecay);
      v._dlyNode.delayTime.setValueAtTime(Math.max(0.01, vp.fx.delayTime), t);
      v._dlyFb.gain.setValueAtTime(Math.min(0.95, vp.fx.delayFB), t);
      // FX bypass state
      const fxBypassed = vp.fx.bypassed === true;
      v._rvbWet.gain.setValueAtTime(fxBypassed ? 0 : vp.fx.reverbMix, t);
      v._dlyWet.gain.setValueAtTime(fxBypassed ? 0 : vp.fx.delayMix,  t);
    }
    v.outputGain.gain.setValueAtTime(v._enabled ? vp.volume : 0, t);

    // LFOs
    vp.lfos.forEach((lp, li) => {
      const node = v.lfoNodes[li]; if (!node) return;
      node.osc.frequency.setValueAtTime(lp.rate, t);
      node.gain.gain.setValueAtTime(lp.depth, t);
      try { node.osc.type = lp.waveform === 'stepped' ? 'sine' : lp.waveform; } catch(_) {}
      v._connectLFO(li);
    });

    // EQ restore (respect bypass state)
    if (vp.eq) {
      const eqBypassed = vp.eq.bypassed === true;
      v._eqLow.gain.setValueAtTime(eqBypassed ? 0 : vp.eq.lowGain, t);
      v._eqMid.gain.setValueAtTime(eqBypassed ? 0 : vp.eq.midGain, t);
      v._eqHigh.gain.setValueAtTime(eqBypassed ? 0 : vp.eq.highGain, t);
      v._eqLow.frequency.setValueAtTime(vp.eq.lowFreq ?? 200, t);
      v._eqMid.frequency.setValueAtTime(vp.eq.midFreq ?? 1000, t);
      v._eqHigh.frequency.setValueAtTime(vp.eq.highFreq ?? 6000, t);
    }

    // TWE bypass state
    if (vp.twe._bypassed) {
      v.tweMain.gain.gain.setValueAtTime(0, t);
      v.tweBody.gain.gain.setValueAtTime(0, t);
    }

    // TWE persistent oscs — sync MAIN core + BODY rate/shape
    const tweMain = vp.twe?.main; if (tweMain) { v._tweApplyShape(v.tweMain.osc, tweMain); v.tweMain.osc.frequency.setValueAtTime(v._tweCalcRate(tweMain), t); }
    const tweBody = vp.twe?.main?.body; if (tweBody) { v._tweApplyShape(v.tweBody.osc, tweBody); v.tweBody.osc.frequency.setValueAtTime(v._tweCalcRate(tweBody), t); }
  });

  // Sequencer — per-voice (v3) or legacy single-pattern (v2)
  if (patch.seqVoices) {
    patch.seqVoices.forEach((vSeq, i) => {
      if (!seq.voices[i]) return;
      seq.voices[i].enabled = vSeq.enabled || false;
      vSeq.steps.forEach((step, si) => {
        if (seq.voices[i].steps[si]) Object.assign(seq.voices[i].steps[si], step);
      });
    });
  }

  // Master
  if (patch.master) {
    const m = patch.master;
    if (m.bpm && bpmSet) bpmSet(m.bpm);
    if (m.masterGain != null) synth.masterGain.gain.setValueAtTime(m.masterGain, t);
    if (m.delayTime != null) synth.delay.delayTime.setValueAtTime(m.delayTime, t);
    if (m.delayFB   != null) synth.delayFB.gain.setValueAtTime(m.delayFB, t);
    if (m.delayWet  != null) synth.delayWet.gain.setValueAtTime(m.delayWet, t);
  }
}

function exportPatch(patch) {
  const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wobbler-${(patch.name || 'patch').replace(/\s+/g,'-')}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}

function importPatch(callback) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.addEventListener('change', () => {
    const file = inp.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { try { callback(JSON.parse(e.target.result)); } catch(_) { alert('Invalid patch file'); } };
    reader.readAsText(file);
  });
  inp.click();
}

function buildPatchBar(container, synth, seq, rebuildAll) {
  const bar = document.createElement('div'); bar.className = 'patch-bar';
  container.prepend(bar);

  const nameIn = document.createElement('input');
  nameIn.className = 'patch-name-input'; nameIn.placeholder = 'patch name…'; nameIn.maxLength = 40;
  bar.appendChild(nameIn);

  const saveBtn = document.createElement('button'); saveBtn.className = 'patch-btn patch-save'; saveBtn.textContent = 'SAVE';
  saveBtn.addEventListener('click', () => {
    if (!nameIn.value.trim()) { nameIn.focus(); return; }
    if (savePatch(nameIn.value, synth, seq)) { refreshSelect(); showToast(`Saved: ${nameIn.value}`); }
  });
  bar.appendChild(saveBtn);

  const sep = document.createElement('div'); sep.className = 'patch-sep'; bar.appendChild(sep);

  const patchSel = document.createElement('select'); patchSel.className = 'patch-select';
  bar.appendChild(patchSel);

  function refreshSelect() {
    const patches = _getAllPatches();
    patchSel.innerHTML = '<option value="">── load patch ──</option>';
    Object.keys(patches).sort().forEach(k => {
      const o = document.createElement('option'); o.value = k; o.textContent = k;
      patchSel.appendChild(o);
    });
  }
  refreshSelect();

  const loadBtn = document.createElement('button'); loadBtn.className = 'patch-btn patch-load'; loadBtn.textContent = 'LOAD';
  loadBtn.addEventListener('click', () => {
    const name = patchSel.value; if (!name) return;
    const patch = _getAllPatches()[name]; if (!patch) return;
    applyPatchToAudio(patch, synth, seq, bpm => { synth.bpm = bpm; seq.setBpm(bpm); });
    rebuildAll(patch);
    nameIn.value = name;
    showToast(`Loaded: ${name}`);
  });
  bar.appendChild(loadBtn);

  const delBtn = document.createElement('button'); delBtn.className = 'patch-btn patch-del'; delBtn.textContent = 'DEL';
  delBtn.addEventListener('click', () => {
    const name = patchSel.value; if (!name) return;
    if (!confirm(`Delete patch "${name}"?`)) return;
    deletePatch(name); refreshSelect(); showToast(`Deleted: ${name}`);
  });
  bar.appendChild(delBtn);

  const sep2 = document.createElement('div'); sep2.className = 'patch-sep'; bar.appendChild(sep2);

  const expBtn = document.createElement('button'); expBtn.className = 'patch-btn'; expBtn.textContent = 'EXPORT';
  expBtn.addEventListener('click', () => {
    const name = patchSel.value || nameIn.value || 'patch';
    exportPatch(capturePatch(name, synth, seq));
  });
  bar.appendChild(expBtn);

  const impBtn = document.createElement('button'); impBtn.className = 'patch-btn'; impBtn.textContent = 'IMPORT';
  impBtn.addEventListener('click', () => {
    importPatch(patch => {
      const patches = _getAllPatches();
      const name = patch.name || `imported-${Date.now()}`;
      patches[name] = patch; _saveAllPatches(patches);
      applyPatchToAudio(patch, synth, seq, bpm => { synth.bpm = bpm; seq.setBpm(bpm); });
      rebuildAll(patch); refreshSelect();
      nameIn.value = name; showToast(`Imported: ${name}`);
    });
  });
  bar.appendChild(impBtn);
}

function showToast(msg) {
  let t = document.getElementById('wobbler-toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'wobbler-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#00ffb2;color:#050510;padding:6px 18px;border-radius:3px;font-size:10px;letter-spacing:1px;z-index:9999;pointer-events:none;transition:opacity 0.3s';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.style.opacity = '0', 1800);
}

// ─────────────────────────────────────────────────────────
//  Web MIDI
// ─────────────────────────────────────────────────────────
const MIDI_CC = {
   1: (v,s) => s.voices.forEach(vo => vo.updateLFO(0,'depth',(v/127)*4000,s.bpm)),   // mod wheel → LFO1 depth
   7: (v,s) => s.masterGain.gain.setTargetAtTime(v/127,s.ctx.currentTime,0.01),       // channel volume
  71: (v,s) => s.voices.forEach(vo => vo.set('filter','resonance',(v/127)*30)),       // filter res
  74: (v,s) => s.voices.forEach(vo => vo.set('filter','cutoff',20+(v/127)*17980)),    // filter cutoff
  73: (v,s) => s.voices.forEach(vo => vo.set('adsr','attack', 0.001+(v/127)*1.999)), // attack
  72: (v,s) => s.voices.forEach(vo => vo.set('adsr','release',0.01 +(v/127)*3.99)),  // release
  75: (v,s) => s.voices.forEach(vo => vo.set('adsr','decay',  0.01 +(v/127)*1.99)),  // decay
};

// Held-note tracker for last-note priority (monophonic)
const _heldNotes = new Map(); // midi note → velocity

function handleMIDI(e, synth) {
  if (!e.data || e.data.length < 2) return;
  const [s0, d1, d2=0] = e.data;
  const type = s0 & 0xF0;
  if (type === 0x90 && d2 > 0) {                           // note on
    _heldNotes.set(d1, d2 / 127);
    synth._currentMidiNote = d1;
    synth.resume().then(() => synth.noteOn(midiToFreq(d1), d2 / 127));
  } else if (type === 0x80 || (type === 0x90 && d2 === 0)) { // note off
    _heldNotes.delete(d1);
    if (synth.polyMode !== 'mono') {
      synth.noteOff(d1); // poly/chord: release only the voice/slot playing this note
    } else if (d1 === synth._currentMidiNote) {
      if (_heldNotes.size > 0) {
        // Fall back to most recently held note (last-note priority)
        const notes = [..._heldNotes.keys()];
        const fallback = notes[notes.length - 1];
        synth._currentMidiNote = fallback;
        synth.noteOn(midiToFreq(fallback), _heldNotes.get(fallback));
      } else {
        synth.noteOff(); // no more held notes → release
      }
    }
    // If released note isn't the current one → ignore (don't cut playing note)
  } else if (type === 0xB0) {                               // CC
    const fn = MIDI_CC[d1]; if (fn) fn(d2, synth);
  } else if (type === 0xE0) {                               // pitch bend ±200 cents
    const raw = (d2 << 7) | d1;
    synth.bend(((raw - 8192) / 8192) * 200);
  }
}

function setupMIDI(synth) {
  const el = document.getElementById('midi-status');
  if (!navigator.requestMIDIAccess) {
    if (el) el.textContent = 'NO MIDI'; return;
  }
  navigator.requestMIDIAccess({ sysex: false }).then(access => {
    function connect(acc) {
      acc.inputs.forEach(port => { port.onmidimessage = e => handleMIDI(e, synth); });
      const n = acc.inputs.size;
      if (el) { el.textContent = `MIDI: ${n} PORT${n!==1?'S':''}`; el.classList.toggle('active', n > 0); }
    }
    connect(access);
    access.onstatechange = () => connect(access);
  }).catch(() => { if (el) el.textContent = 'MIDI DENIED'; });
}

// ─────────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const synth = new WobblerSynth();
  const seq   = new Sequencer(synth);
  const bpmGet = () => seq.bpm;

  function buildAllVoices() {
    synth.voices.forEach((v,i) => {
      const col = document.getElementById(`voice-${i+1}`);
      if (!col) return;
      col.innerHTML = '';
      col.style.setProperty('--accent', VOICE_COLORS[i]);
      buildVoicePanel(col, v, VOICE_COLORS[i], bpmGet);
    });
  }

  function buildSeq() {
    buildSequencer(seq);
  }

  function rebuildAll() {
    buildAllVoices();
    buildSeq();
  }

  // Initial build
  buildAllVoices();
  buildSeq();

  // Auto-load last session
  const bpmSet = v => { seq.setBpm(v); const bi = document.getElementById('bpm-input'); if (bi) bi.value = v; const bd = document.getElementById('bpm-display'); if (bd) bd.textContent = v; };
  if (autoLoad(synth, seq, bpmSet, rebuildAll)) showToast('Session restored');

  // Master
  const masterEl=document.getElementById('master-section');
  buildMaster(masterEl, synth);
  buildPatchBar(masterEl, synth, seq, rebuildAll);
  buildVisualizer(masterEl, synth.analyser);

  // Piano keyboard
  const pianoEl = document.getElementById('piano-section');
  if (pianoEl) buildPianoKeyboard(pianoEl, synth);

  // Auto-save: on page close + every 10s + debounced after every param change
  window.addEventListener('beforeunload', () => autoSave(synth, seq));
  setInterval(() => autoSave(synth, seq), 10_000);

  let _saveTimer = null;
  const debouncedSave = () => { clearTimeout(_saveTimer); _saveTimer = setTimeout(() => autoSave(synth, seq), 800); };
  synth.voices.forEach(v => {
    const _origSet = v.set.bind(v);
    v.set = function(section, key, val) { _origSet(section, key, val); debouncedSave(); };
  });

  // Header controls
  const playBtn  = document.getElementById('play-btn');
  const bpmInput = document.getElementById('bpm-input');
  const bpmDisp  = document.getElementById('bpm-display');

  playBtn?.addEventListener('click', () => {
    if (seq.playing) {
      seq.stop(); playBtn.textContent='▶ PLAY'; playBtn.classList.remove('playing');
    } else {
      seq.play(); playBtn.textContent='■ STOP'; playBtn.classList.add('playing');
    }
  });

  function updateBpm(v) {
    const bpm=Math.max(40,Math.min(240,v));
    if(bpmInput)  bpmInput.value=bpm;
    if(bpmDisp)   bpmDisp.textContent=bpm;
    seq.setBpm(bpm);
  }
  bpmInput?.addEventListener('input', () => updateBpm(parseInt(bpmInput.value)||120));
  document.getElementById('bpm-up')?.addEventListener('click', () => updateBpm(seq.bpm+1));
  document.getElementById('bpm-down')?.addEventListener('click', () => updateBpm(seq.bpm-1));

  // Web MIDI
  setupMIDI(synth);

  // Unlock AudioContext
  document.addEventListener('pointerdown', () => synth.resume(), {once:true});
});
