class _EnvTracker {
  constructor() {
    this._phase = 'idle'; this._t0 = 0; this._v0 = 0;
    this._vel = 0; this._A = 0.01; this._D = 0.2; this._S = 0.5; this._R = 0.3;
  }
  _at(t) {
    const dt = Math.max(0, t - this._t0);
    // Auto-advance attack → decay → sustain based on elapsed time
    if (this._phase === 'attack') {
      const A = Math.max(0.001, this._A);
      if (dt < A) {
        return this._v0 + (this._vel - this._v0) * (dt / A);
      }
      // Advance to decay phase
      const dtD = dt - A;
      const D = Math.max(0.001, this._D * 0.25);
      const sus = this._S * this._vel;
      const decVal = sus + (this._vel - sus) * Math.exp(-dtD / D);
      if (dtD >= this._D * 3) return sus; // settled at sustain
      return decVal;
    }
    switch (this._phase) {
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
        target:'none', envA:0, envR:0, _enabled: false,
        ...(i===4 ? {metaTarget:null, metaTargetLFO:0} : {})
      })),
      comp: { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false },
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
    };

    // Persistent nodes — created once, live for the session
    // BiquadFilter as primary voice filter — stable with setTargetAtTime automation.
    // Original crash (rapid setValueAtTime at 20fps) is fixed; BiquadFilter is safe here.
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 800;
    this.filter.Q.value = 1;
    this.filter.channelCount = 2; this.filter.channelCountMode = 'explicit';
    this._filterPassthrough = null; // no longer used
    this._zdfActive = false;        // kept for guard compat — filter is always active now
    this.envGain    = ctx.createGain();    this.envGain.gain.value    = 0;
    this.outputGain = ctx.createGain();    this.outputGain.gain.value = 0.8;
    this.panner     = ctx.createStereoPanner(); this.panner.pan.value = 0;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.6;
    this.analyser.channelCount = 2; this.analyser.channelCountMode = 'explicit';

    this.preAnalyser = ctx.createAnalyser();
    this.preAnalyser.fftSize = 512; this.preAnalyser.smoothingTimeConstant = 0.6;
    this.preAnalyser.channelCount = 2; this.preAnalyser.channelCountMode = 'explicit';

    // Voice compressor — sits after filter (Option C: Dist → Filter → Comp)
    this._voiceComp = ctx.createDynamicsCompressor();
    this._voiceComp.threshold.value = -24;
    this._voiceComp.knee.value      = 6;
    this._voiceComp.ratio.value     = 4;
    this._voiceComp.attack.value    = 0.003;
    this._voiceComp.release.value   = 0.1;
    this._voiceComp.channelCount = 2; this._voiceComp.channelCountMode = 'explicit';

    // Distortion chain nodes
    this._distPre  = ctx.createGain();  this._distPre.gain.value  = 1;
    this._distNode = ctx.createWaveShaper(); this._distNode.oversample = 'none';
    this._distNode.curve = this._distCurve('soft', 0);
    // Tone filter — real BiquadFilter LP, used pre OR post distortion
    this._distTone = ctx.createBiquadFilter();
    this._distTone.type = 'lowpass';
    this._distTone.frequency.value = 18000;
    this._distTone.Q.value = 0.5;
    this._distToneBypass = ctx.createGain(); this._distToneBypass.gain.value = 1;
    this._distPost = ctx.createGain();  this._distPost.gain.value = 1;
    this._distWet  = ctx.createGain();  this._distWet.gain.value  = 0; // dry by default
    this._distDry  = ctx.createGain();  this._distDry.gain.value  = 1;
    this._distTonePost = false; // false = pre-dist, true = post-dist

    // Filter wet/dry mix nodes
    this.filterWet = ctx.createGain(); this.filterWet.gain.value = 1;
    this.filterDry = ctx.createGain(); this.filterDry.gain.value = 0;

    // Set all chain nodes to stereo so signal is never collapsed to mono
    [this.envGain, this.outputGain, this._voiceComp, this._distPre, this._distPost,
     this._distWet, this._distDry, this.filterWet, this.filterDry,
     this._distNode, this._distTone, this._distToneBypass].forEach(n => { n.channelCount = 2; n.channelCountMode = 'explicit'; });

    // Signal chain Option C (Dist → Filter → Comp):
    // OSCs → _distPre → [tone-pre] → _distNode → _distPost → _distWet → preAnalyser → filter → filterWet → envGain → _voiceComp → _tremoloGain
    //      ↘↗ _distDry ↗                                                           ↘ filterDry ↗
    this._tremoloGain = ctx.createGain(); this._tremoloGain.gain.value = 1;
    this._tremoloGain.channelCount = 2; this._tremoloGain.channelCountMode = 'explicit';
    // distPre → tone(pre) → distNode → distPost → distWet → preAnalyser → filter → filterWet → envGain → comp → tremoloGain
    this._distPre.connect(this._distTone);
    this._distTone.connect(this._distNode);
    this._distNode.connect(this._distPost);
    this._distPre.connect(this._distDry);
    this._distPost.connect(this._distWet);
    this._distWet.connect(this.preAnalyser);
    this._distDry.connect(this.preAnalyser);
    this.preAnalyser.connect(this.filter);
    this.filter.connect(this.filterWet);
    this.filterWet.connect(this.envGain);
    this.filterDry.connect(this.envGain);
    this.envGain.connect(this._voiceComp);
    this._voiceComp.connect(this.analyser);
    this._voiceComp.connect(this._tremoloGain);
    // 3-band EQ replaced with GainNode passthroughs — BiquadFilter peaking/shelf nodes
    // can produce bad state warnings from signal overflow; EQ gain=0 is transparent anyway.
    this._eqLow  = ctx.createGain(); this._eqLow.gain.value  = 1;
    this._eqMid  = ctx.createGain(); this._eqMid.gain.value  = 1;
    this._eqHigh = ctx.createGain(); this._eqHigh.gain.value = 1;
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

    // Per-note oscillators — created by buildOscChain on each noteOn
    this._activeOscs     = [];
    this._activeSubOsc   = null;
    this._activeOsc1Envs = [];
    this._activeOsc2Envs = [];
    this._activeSubEnv   = null;
    this._liveOsc        = null;

    // Noise chain: noiseNode → _noiseG(gain=1) → _noiseLvlGain(volume+LFO) → routing
    this._noiseG = ctx.createGain(); this._noiseG.gain.value = 1;
    this._noiseLvlGain = ctx.createGain(); this._noiseLvlGain.gain.value = 0;
    this._noiseG.connect(this._noiseLvlGain);
    // Noise filter mix
    this._noiseToFilt      = ctx.createGain(); this._noiseToFilt.gain.value      = 1;
    this._noiseFilterBypass= ctx.createGain(); this._noiseFilterBypass.gain.value = 0;
    this._noiseLvlGain.connect(this._noiseToFilt);
    this._noiseToFilt.connect(this._distPre);
    this._noiseToFilt.connect(this._distDry);
    this._noiseLvlGain.connect(this._noiseFilterBypass);
    this._noiseFilterBypass.connect(this.envGain);
    this._noiseNode = null;

    // Dedicated noise LFO: modulates _noiseLvlGain.gain (not overwritten by setTargetAtTime)
    this._noiseLfoOsc  = ctx.createOscillator();
    this._noiseLfoGain = ctx.createGain();
    this._noiseLfoOsc.type = 'sine';
    this._noiseLfoOsc.frequency.value = 0;
    this._noiseLfoGain.gain.value = 0;
    this._noiseLfoOsc.connect(this._noiseLfoGain);
    this._noiseLfoGain.connect(this._noiseLvlGain.gain);
    this._noiseLfoOsc.start();

    this._srcs = []; this._playing = false; // legacy compat

    // New breakpoint LFO engine — starts on first noteOn
    this.lfoEngine = new LFOEngine(this);
  }

  _distCurve(form, drive) {
    const n = 512, curve = new Float32Array(n);
    // downsample/bitcrush handled in real-time via ScriptProcessor — return identity curve
    if (form === 'downsample' || form === 'bitcrush') {
      for (let i = 0; i < n; i++) curve[i] = (i * 2) / n - 1;
      return curve;
    }
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      if (drive < 0.001) { curve[i] = x; continue; }
      const k = 1 + drive * 40;
      switch (form) {
        case 'tube': { // triode-style — asymmetric tanh with bias, 2nd+3rd harmonics
          const bias = 0.1 * drive;
          const v = x + bias;
          curve[i] = Math.tanh(v * k * 0.7) / Math.tanh(k * 0.7) - bias * 0.5;
          break;
        }
        case 'soft': // tanh saturation — smooth, musical
          curve[i] = Math.tanh(x * k) / Math.tanh(k);
          break;
        case 'hard': { // hard clip — transistor crunch
          curve[i] = Math.max(-1, Math.min(1, x * k));
          break;
        }
        case 'asym': { // asymmetric — overdrive with 2nd harmonic
          curve[i] = x >= 0
            ? Math.tanh(x * k) / Math.tanh(k)
            : Math.tanh(x * k * 0.4) / Math.tanh(k * 0.4) * 0.7;
          break;
        }
        case 'fold': { // wavefolder — metallic, Buchla-style
          let v = x * (1 + drive * 8);
          let iter = 0;
          while ((v > 1 || v < -1) && iter++ < 20) { v = v > 1 ? 2 - v : -2 - v; }
          curve[i] = v;
          break;
        }
        case 'fuzz': { // extreme square-ish — near-full wave clip
          const v = x * (1 + drive * 200);
          curve[i] = Math.sign(v) * Math.min(1, Math.abs(v) ** 0.15);
          break;
        }
        case 'rect': { // half-wave rectifier — adds octave-up character
          const v = Math.max(0, x) * k;
          curve[i] = Math.max(-1, Math.min(1, v)) * 2 - 0.5 * drive;
          break;
        }
        default: curve[i] = x;
      }
    }
    return curve;
  }

  // Rewire tone filter pre/post distortion. post=true → tone after dist node.
  _distSetTonePost(post) {
    try { this._distPre.disconnect(this._distTone); } catch(_) {}
    try { this._distTone.disconnect(); } catch(_) {}
    try { this._distNode.disconnect(this._distPost); } catch(_) {}
    if (post) {
      // pre → node → tone → post
      this._distPre.connect(this._distNode);
      this._distNode.connect(this._distTone);
      this._distTone.connect(this._distPost);
    } else {
      // pre → tone → node → post
      this._distPre.connect(this._distTone);
      this._distTone.connect(this._distNode);
      this._distNode.connect(this._distPost);
    }
    this._distTonePost = post;
  }

  _driveCurve(amount) { return this._distCurve('soft', amount); } // legacy compat

  _makePulseWave(pw) {
    const N = 256;
    const real = new Float32Array(N+1), imag = new Float32Array(N+1);
    real[0] = 2 * pw - 1;
    for (let n = 1; n <= N; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * pw);
    return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
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

  // Filter param helpers — work for both BiquadFilter and ZDF worklet
  _filterFreqParam()  { return this._zdfActive ? this.filter.parameters.get('cutoff')    : this.filter.frequency; }
  _filterResParam()   { return this._zdfActive ? this.filter.parameters.get('resonance')  : this.filter.Q; }

  _filterSetCutoff(hz, t, tc) {
    const v = Math.max(20, Math.min(20000, hz));
    try { this._filterFreqParam().setTargetAtTime(v, t, Math.max(0.005, tc ?? 0.05)); } catch(_) {}
  }
  _filterLFOSetCutoff(hz) {
    const v = Math.max(20, Math.min(20000, hz));
    if (!this._lfoOwnsFilterCutoff) {
      this._lfoOwnsFilterCutoff = true;
      try { this._filterFreqParam().cancelScheduledValues(0); } catch(_) {}
    }
    try { this._filterFreqParam().setTargetAtTime(v, this.ctx.currentTime, 0.008); } catch(_) {}
  }
  _filterRampCutoff(hz, t) {
    const v = Math.max(20, Math.min(20000, hz));
    try { this._filterFreqParam().exponentialRampToValueAtTime(v, t); } catch(_) {}
  }
  _filterSetResonance(q, t, tc) {
    const v = Math.max(0.01, Math.min(this._zdfActive ? 8 : 30, q));
    try { this._filterResParam().setTargetAtTime(v, t, Math.max(0.005, tc ?? 0.05)); } catch(_) {}
  }
  _filterLFOSetResonance(q) {
    const v = Math.max(0.01, Math.min(this._zdfActive ? 8 : 30, q));
    try { this._filterResParam().setTargetAtTime(v, this.ctx.currentTime, 0.008); } catch(_) {}
  }
  _filterCancelAndHold(t) {
    const p = this._filterFreqParam();
    if (!p) return;
    if (p.cancelAndHoldAtTime) { try { p.cancelAndHoldAtTime(t); } catch(_) {} }
    else { try { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); } catch(_) {} }
  }
  _filterSetType(type) {
    if (this._zdfActive) {
      const ft = type === 'highpass' ? 1 : type === 'bandpass' ? 2 : type === 'notch' ? 3 : 0;
      try { this.filter.parameters.get('filterType').setValueAtTime(ft, this.ctx.currentTime); } catch(_) {}
    } else {
      try { this.filter.type = type; } catch(_) {}
    }
  }

  // Switch filter engine: 'biquad' (native, alias-free) or 'zdf' (worklet, character)
  // Safe to call at any time — rewires preAnalyser → filter → filterWet in-place.
  _switchFilterEngine(mode) {
    if (mode === 'zdf' && !window._zdfWorkletReady) {
      console.warn('[Filter] ZDF worklet not ready yet'); return;
    }
    const p = this.p.filter;
    const now = this.ctx.currentTime;

    // Disconnect current filter
    try { this.preAnalyser.disconnect(this.filter); } catch(_) {}
    try { this.filter.disconnect(); } catch(_) {}

    if (mode === 'zdf') {
      try {
        const zdf = new AudioWorkletNode(this.ctx, 'zdf-filter', {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2]
        });
        zdf.parameters.get('cutoff').setValueAtTime(Math.max(20, Math.min(20000, p.cutoff)), now);
        zdf.parameters.get('resonance').setValueAtTime(Math.max(0.01, Math.min(8, p.resonance)), now);
        const ft = p.type === 'highpass' ? 1 : p.type === 'bandpass' ? 2 : p.type === 'notch' ? 3 : 0;
        zdf.parameters.get('filterType').setValueAtTime(ft, now);
        this.preAnalyser.connect(zdf); zdf.connect(this.filterWet);
        this.filter = zdf;
        this._zdfActive = true;
        this.p.filter.engine = 'zdf';
        console.log('[Filter] ZDF active on voice', this.id ?? '?');
      } catch(e) { console.warn('[Filter] ZDF switch failed:', e); this._switchFilterEngine('biquad'); }
    } else {
      const bq = this.ctx.createBiquadFilter();
      bq.type = p.type || 'lowpass';
      bq.frequency.value = Math.max(20, Math.min(20000, p.cutoff));
      bq.Q.value = Math.max(0.01, Math.min(30, p.resonance));
      bq.channelCount = 2; bq.channelCountMode = 'explicit';
      this.preAnalyser.connect(bq); bq.connect(this.filterWet);
      this.filter = bq;
      this._zdfActive = false;
      this.p.filter.engine = 'biquad';
      console.log('[Filter] BiquadFilter active on voice', this.id ?? '?');
    }
  }

  // Connects a gain node to all active side-voice detune AudioParams (for 'chorus' target)
  _connectChorusNode(gainNode) {
    try { gainNode.disconnect(); } catch(_) {}
    // Connect to side voices (all active oscs except the first = center)
    (this._activeOscs || []).forEach((o, i) => {
      if (i > 0) try { gainNode.connect(o.detune); } catch(_) {}
    });
  }

  // Build a PeriodicWave from standard waveform harmonics — needed to override
  // a previously-set custom PeriodicWave, since o.type = x silently fails in Chrome
  // after setPeriodicWave() has been called.
  _makeStdWave(type) {
    const H = 64; // number of harmonics
    const real = new Float32Array(H + 1);
    const imag = new Float32Array(H + 1);
    for (let k = 1; k <= H; k++) {
      switch (type) {
        case 'sawtooth':  imag[k] = -2 / (Math.PI * k) * (k % 2 === 0 ? 1 : -1); break;
        case 'square':    if (k % 2 !== 0) imag[k] = 4 / (Math.PI * k); break;
        case 'triangle':  if (k % 2 !== 0) imag[k] = (k % 4 === 1 ? 1 : -1) * 8 / (Math.PI * Math.PI * k * k); break;
        case 'sine':      if (k === 1) imag[k] = 1; break;
        default:          if (k === 1) imag[k] = 1; break;
      }
    }
    return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
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
    // cutoff/resonance intentionally excluded — old oscillator LFOs must NOT connect
    // to filter.frequency; filter modulation is handled by lfoEngine (JS timer) only
    if (t === 'volume')    return this.envGain.gain;
    return null; // 'cutoff','resonance','pitch','noiseAmt','chorus' → handled elsewhere
  }

  _connectLFO(i) {
    const { gain } = this.lfoNodes[i]; const p = this.p.lfos[i];
    try { gain.disconnect(); } catch(_) {} this.lfoNodes[i].connected = null;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    if (p._enabled === false || !p.target || p.target === 'none') return;
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
    const _cw1 = p.osc._customSamples?.length  ? this._makePeriodicWave(p.osc._customSamples)  : null;
    const _cw2 = p.osc2?._customSamples?.length ? this._makePeriodicWave(p.osc2._customSamples) : null;
    const _cws = p.sub?._customSamples?.length  ? this._makePeriodicWave(p.sub._customSamples)  : null;
    const oscParams = {
      osc1: {
        wave:   p.osc.waveform === 'pulse' ? 'square' : (p.osc.waveform === 'supersaw' ? 'sawtooth' : p.osc.waveform),
        customWave: _cw1,
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
        customWave: _cw2,
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
        customWave: _cws,
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
    this._osc1Count      = Math.max(1, p.osc.unison || 1); // how many entries in _activeOscs are OSC1
    this._activeSubOsc   = subOscNode;
    this._activeOsc1Envs = osc1Envs;
    this._activeOsc2Envs = osc2Envs;
    this._activeSubEnv   = subEnv;

    // Keep _liveOsc pointing to first osc for LFO pitch routing + bend
    this._liveOsc = oscs[0] || null;
    this._baseFreq = f; this._noteVelocity = velocity; this._playing = true;
    this._noteOnTime = now;
    this._lfoOwnsFilterCutoff = false; // allow ADSR to schedule filter envelope this note

    // Noise — set base level on _noiseLvlGain; do NOT cancelScheduledValues (kills LFO modulation)
    const _noiseVol = p.noise.volume * velocity;
    this._applyNoiseEnv(_noiseVol, p.noise.envShape, now, p.adsr);
    this._currentNoiseGain = this._noiseLvlGain.gain;
    // Apply pitch via playbackRate (semitones)
    if (this._noiseNode) {
      const pr = Math.pow(2, (p.noise.pitch ?? 0) / 12);
      this._noiseNode.playbackRate.setTargetAtTime(pr, now, 0.01);
    }

    // LFO reconnection for pitch / noiseAmt targets + LFO envelope attack
    for (let i = 0; i < this.lfoNodes.length; i++) {
      const lfo = this.lfoNodes[i];
      const lp = this.p.lfos[i];
      const t = lp.target;
      if (lp._enabled === false) { try { lfo.gain.disconnect(); } catch(_){} continue; }
      if (t === 'pitch' && this._liveOsc)    { try { lfo.gain.disconnect(); } catch(_){} lfo.gain.connect(this._liveOsc.detune); lfo.connected = 'pitch'; }
      if (t === 'noiseAmt') { try { lfo.gain.disconnect(); } catch(_){} lfo.gain.connect(this._noiseLvlGain.gain); lfo.connected = 'noiseAmt'; }
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

    // Filter envelope — skip if LFO engine owns the cutoff (avoids automation queue fight)
    const _lfoOwnsCutoff = this.lfoEngine && this.lfoEngine.slots.some(s => s.enabled && s.target === 'cutoff');
    if (!_lfoOwnsCutoff) {
      const base = Math.max(20, Math.min(20000, p.filter.cutoff));
      const peak = Math.max(21, Math.min(18000, base + p.filter.envAmount * velocity));
      const sustFreq = Math.max(20, Math.min(18000, base + (peak - base) * p.adsr.sustain));
      this._filterCancelAndHold(now);
      this._filterRampCutoff(peak, now + Math.max(0.001, p.adsr.attack));
      this._filterSetCutoff(sustFreq, now + p.adsr.attack, Math.max(0.001, p.adsr.decay) / 4);
    } else {
      // LFO owns cutoff — just cancel any stale automation and let the LFO drive
      this._lfoOwnsFilterCutoff = false; // reset so first LFO tick cancels cleanly
      this._filterCancelAndHold(now);
    }

    // LFO engine — phase-reset on note trigger
    if (this.lfoEngine) {
      this.lfoEngine.resetPhases();
      if (!this.lfoEngine.playing) this.lfoEngine.start();
    }

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
    this._noiseLvlGain.gain.setTargetAtTime(0, now + rel + 0.05, 0.01);
    const _lfoOwnsCutoffOff = this.lfoEngine && this.lfoEngine.slots.some(s => s.enabled && s.target === 'cutoff');
    if (!_lfoOwnsCutoffOff) this._filterSetCutoff(p.filter.cutoff, now, Math.max(0.01, rel / 3));
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

  // Apply noise volume + envShape envelope to _noiseLvlGain.gain at noteOn.
  // envShape: 'none'|'fade-up'|'fade-down'|'fade-out'
  // Uses ADSR attack/release times so envelope feels related to voice envelope.
  _applyNoiseEnv(targetVol, envShape, now, adsr) {
    const g = this._noiseLvlGain.gain;
    const lfoRate = this.p.noise.lfoRate ?? 0;
    const lfoDepth = lfoRate > 0 ? targetVol * 0.5 : 0;
    // Update LFO gain to match current volume (only if needed, no rate change)
    this._noiseLfoGain.gain.setTargetAtTime(lfoDepth, now, 0.02);

    const atk = Math.max(0.05, adsr?.attack  ?? 0.05);
    const rel = Math.max(0.1,  adsr?.release ?? 0.12);

    switch (envShape) {
      case 'fade-up':
        // Start silent, ramp up over attack time
        g.setValueAtTime(0, now);
        g.linearRampToValueAtTime(targetVol, now + atk);
        break;
      case 'fade-down':
        // Start at full, fade down over release time
        g.setValueAtTime(targetVol, now);
        g.linearRampToValueAtTime(0, now + rel);
        break;
      case 'fade-out':
        // Start at full, hold briefly, then fade to zero over release
        g.setValueAtTime(targetVol, now);
        g.setTargetAtTime(0, now + atk * 0.5, rel * 0.5);
        break;
      default: // 'none'
        g.setTargetAtTime(targetVol, now, 0.005);
        break;
    }
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
        // Clear custom samples so next noteOn uses the standard wave type
        this.p.osc._customSamples = null;
        // Only patch OSC1 nodes (first _osc1Count entries in _activeOscs)
        const n1 = this._osc1Count || 1;
        const osc1Nodes = (this._activeOscs || []).slice(0, n1);
        // Always use setPeriodicWave — o.type assignment silently fails in Chrome
        // after setPeriodicWave() was previously called on the oscillator node.
        const _stdWave = (val === 'pulse' || val === 'supersaw')
          ? null
          : this._makeStdWave(val);
        osc1Nodes.forEach(o => {
          try {
            if (val === 'pulse') {
              o.setPeriodicWave(this._makePulseWave(this.p.osc.pw ?? 0.5));
            } else if (val === 'supersaw') {
              o.setPeriodicWave(this._makeStdWave('sawtooth'));
            } else {
              o.setPeriodicWave(_stdWave);
            }
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
      // volume is applied on next noteOn via oscParams — no live patch needed
    }
    if (section === 'osc2') {
      if (!this.p.osc2) this.p.osc2 = {};
      this.p.osc2[key] = val;
      if (key === 'waveform' && this._activeOscs && this._activeOscs[1]) {
        const o = this._activeOscs[1];
        try { o.type = val === 'pulse' ? 'square' : val === 'supersaw' ? 'sawtooth' : val; } catch(_) {}
      }
    }
    if (section === 'sub') {
      if (!this.p.sub) this.p.sub = {};
      this.p.sub[key] = val;
      if (key === 'waveform' && this._activeSubOsc) {
        try { this._activeSubOsc.type = val === 'pulse' ? 'square' : val; } catch(_) {}
      }
    }
    if (section === 'noise') {
      this.p.noise[key] = val;
      if (key === 'volume') {
        if (this._playing) {
          const lvl = val * (this._noteVelocity || 1);
          this._noiseLvlGain.gain.setTargetAtTime(lvl, t, 0.01);
          if ((this.p.noise.lfoRate ?? 0) > 0) {
            this._noiseLfoGain.gain.setTargetAtTime(lvl * 0.5, t, 0.01);
          }
        }
      }
      if (key === 'lfoRate') {
        this._noiseLfoOsc.frequency.setTargetAtTime(Math.max(0.01, val), t, 0.01);
        if (this._playing) {
          const lvl = (this.p.noise.volume ?? 0) * (this._noteVelocity || 1);
          this._noiseLfoGain.gain.setTargetAtTime(val > 0 ? lvl * 0.5 : 0, t, 0.01);
        }
      }
      if (key === 'pitch' && this._noiseNode) {
        const pr = Math.pow(2, val / 12);
        this._noiseNode.playbackRate.setTargetAtTime(pr, t, 0.01);
      }
      if (key === 'envShape') { /* stored in p.noise.envShape — applied on next noteOn */ }
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
    if (section === 'adsr') {
      this.p.adsr[key] = val;
      // Live-update filter envelope peak if attack/decay/sustain changes while note held
      const _lfoOwnsCutoffAdsr = this.lfoEngine && this.lfoEngine.slots.some(s => s.enabled && s.target === 'cutoff');
      if (this._playing && !_lfoOwnsCutoffAdsr && (key === 'attack' || key === 'decay' || key === 'sustain')) {
        const base = Math.max(20, Math.min(20000, this.p.filter.cutoff));
        const peak = Math.max(21, Math.min(18000, base + this.p.filter.envAmount * (this._noteVelocity || 0.65)));
        const sust = Math.max(20, Math.min(18000, base + (peak - base) * this.p.adsr.sustain));
        if (key === 'attack') {
          this._filterCancelAndHold(t);
          this._filterRampCutoff(peak, t + Math.max(0.001, val));
        }
        if (key === 'decay')  this._filterSetCutoff(sust, t, Math.max(0.001, val) / 4);
      }
    }
    if (section === 'filter') {
      this.p.filter[key] = val;
      if (key === 'type')      this._filterSetType(val);
      if (key === 'cutoff')    this._filterSetCutoff(val, t, 0.05);
      if (key === 'resonance') this._filterSetResonance(val, t, 0.05);
      if (key === 'mix') {
        this.filterWet.gain.setTargetAtTime(val, t, 0.02);
        this.filterDry.gain.setTargetAtTime(1 - val, t, 0.02);
      }
      if (key === 'pan') this.panner.pan.setTargetAtTime(val, t, 0.01);
    }
    if (section === 'eq') {
      this.p.eq[key] = val; // stored for preset save/load; EQ nodes are passthroughs
    }
    if (section === 'fx') {
      this.p.fx[key] = val;
      if (key === 'reverbMix')   this._rvbWet.gain.setTargetAtTime(val, t, 0.02);
      if (key === 'reverbDecay') { this._rvbConv.buffer = this._makeImpulse(val); }
      if (key === 'delayMix')    this._dlyWet.gain.setTargetAtTime(val, t, 0.02);
      if (key === 'delayTime')   this._dlyNode.delayTime.setTargetAtTime(Math.max(0.01, val), t, 0.02);
      if (key === 'delayFB')     this._dlyFb.gain.setTargetAtTime(Math.min(0.95, val), t, 0.02);
    }
    if (section === 'comp') {
      this.p.comp[key] = val;
      if (key === 'threshold') this._voiceComp.threshold.setTargetAtTime(val, t, 0.01);
      if (key === 'knee')      this._voiceComp.knee.setTargetAtTime(val, t, 0.01);
      if (key === 'ratio')     this._voiceComp.ratio.setTargetAtTime(val, t, 0.01);
      if (key === 'attack')    this._voiceComp.attack.setTargetAtTime(val, t, 0.01);
      if (key === 'release')   this._voiceComp.release.setTargetAtTime(val, t, 0.01);
    }
    if (section === 'dist') {
      this.p.dist[key] = val;
      if (key === 'form' || key === 'drive') {
        this._distNode.curve = this._distCurve(this.p.dist.form, this.p.dist.drive);
        if (this.p.dist.mix >= 0.02) this._distNode.oversample = this.p.dist.drive > 0.3 ? '4x' : '2x';
      }
      if (key === 'tone')   { try { this._distTone.frequency.setTargetAtTime(Math.max(200, Math.min(18000, val)), t, 0.02); } catch(_) {} }
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
    if (section === 'twe') return; // TWE removed — no-op for preset backwards compat
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
    this.analyser.channelCount = 2;
    this.analyser.channelCountMode = 'explicit';
    this.analyser.channelInterpretation = 'speakers';
    this.analyser.connect(this.ctx.destination);

    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.knee.value = 6;
    this.comp.ratio.value = 4; this.comp.release.value = 0.25;
    this.comp.channelCount = 2; this.comp.channelCountMode = 'explicit';
    this.comp.connect(this.analyser);

    this.delay    = this.ctx.createDelay(2.0);
    this.delayFB  = this.ctx.createGain();
    this.delayWet = this.ctx.createGain();
    this.delayDry = this.ctx.createGain();
    this.delay.delayTime.value = 0.25; this.delayFB.gain.value  = 0.35;
    this.delayWet.gain.value   = 0.0;  this.delayDry.gain.value = 1.0;
    [this.delay, this.delayFB, this.delayWet, this.delayDry].forEach(n => {
      n.channelCount = 2; n.channelCountMode = 'explicit';
    });

    this.masterGain = this.ctx.createGain(); this.masterGain.gain.value = 0.75;

    // Master bus filter — sits between masterGain and the delay/dry split
    // Shapes the combined output of all voices before compression
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000; // open by default
    this.masterFilter.Q.value = 0.5;
    this.masterFilter.channelCount = 2; this.masterFilter.channelCountMode = 'explicit';

    this.masterGain.connect(this.masterFilter);
    this.masterFilter.connect(this.delayDry);
    this.masterFilter.connect(this.delay);
    this.delay.connect(this.delayFB); this.delayFB.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayDry.connect(this.comp); this.delayWet.connect(this.comp);

    this.voices = Array.from({length:3}, (_,i) => new WobblerVoice(this.ctx, this.masterGain, i));

    // Pre-register ZDF worklet — voices stay on BiquadFilter by default.
    // ZDF available on demand via voice._switchFilterEngine('zdf').
    window._zdfWorkletReady = false;
    this.ctx.audioWorklet.addModule('js/zdf-filter-worklet.js')
      .then(() => { window._zdfWorkletReady = true; console.log('[ZDF] Worklet registered — available on demand'); })
      .catch(e => console.warn('[ZDF] Worklet load failed:', e));

    // Global LFO engine — drives all enabled voices simultaneously
    // Each voice also has its own per-voice lfoEngine for individual control
    this.lfoEngine = new LFOEngine(this.voices);
    this.lfoEngine.bpm = this.bpm;

    this.polyMode = 'mono';       // 'mono' | 'poly' | 'chord'
    this._voiceNoteMap  = new Map(); // midiNote → WobblerVoice  (poly mode)
    this._chordSlotMap  = new Map(); // midiNote → {voice, slotIdx}  (chord mode)
  }
  noteOn(freq, vel = 0.65) {
    clearTimeout(this._silenceTimer);
    // Start global LFO engine on first note
    if (this.lfoEngine && !this.lfoEngine.playing) this.lfoEngine.start();
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
    if (this.lfoEngine) this.lfoEngine.bpm = bpm; // global engine
    this.voices.forEach(v => {
      v._bpm = bpm;
      if (v.lfoEngine) v.lfoEngine.bpm = bpm;
      v.p.lfos.forEach((lp,i) => {
        if (lp.bpmSync) v.lfoNodes[i].osc.frequency.setTargetAtTime((bpm/60)*lp.syncDiv/4, this.ctx.currentTime, 0.01);
      });
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
    const _afterResume = () => { this.voices.forEach(v => v.startLFOs()); };
    if (this.ctx.state !== 'suspended') { _afterResume(); return Promise.resolve(); }
    return this.ctx.resume().then(_afterResume);
  }
}

// ─────────────────────────────────────────────────────────
//  Sequencer — 16 steps × 3 voices, independent patterns
// ─────────────────────────────────────────────────────────
class Sequencer {
  constructor(synth) {
    this.synth = synth; this.bpm = 174; this.playing = false; this.step = -1; this._t = null;
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
