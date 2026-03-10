// ─────────────────────────────────────────────────────────
//  Wobbler — Synthesizer Engine + UI
// ─────────────────────────────────────────────────────────

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// ── Piano constants ───────────────────────────────────────
const MIDI_MIN = 12, MIDI_MAX = 60;
const WHITE_W = 34, BLACK_W = 20;

const SEMITONE = [
  {name:'C',  black:false},{name:'C#',black:true },
  {name:'D',  black:false},{name:'D#',black:true },
  {name:'E',  black:false},{name:'F', black:false},
  {name:'F#', black:true },{name:'G', black:false},
  {name:'G#', black:true },{name:'A', black:false},
  {name:'A#', black:true },{name:'B', black:false},
];

const WAVE_SVG = {
  sine:     '<svg viewBox="0 0 30 16" fill="none"><path d="M1,8 Q5,1 9,8 Q13,15 17,8 Q21,1 25,8 Q29,15 30,8" stroke="currentColor" stroke-width="1.4"/></svg>',
  sawtooth: '<svg viewBox="0 0 30 16" fill="none"><path d="M1,15 L10,1 L10,15 L20,1 L20,15 L28,1" stroke="currentColor" stroke-width="1.4"/></svg>',
  square:   '<svg viewBox="0 0 30 16" fill="none"><path d="M1,15 L1,4 L12,4 L12,15 L18,15 L18,4 L29,4 L29,15" stroke="currentColor" stroke-width="1.4"/></svg>',
  triangle: '<svg viewBox="0 0 30 16" fill="none"><path d="M1,15 L8,1 L15,15 L22,1 L29,15" stroke="currentColor" stroke-width="1.4"/></svg>',
  noise:    '<svg viewBox="0 0 30 16" fill="none"><path d="M1,8 L3,5 L5,12 L7,4 L9,10 L12,2 L14,13 L17,6 L19,11 L22,4 L24,9 L27,6 L29,11" stroke="currentColor" stroke-width="1.4"/></svg>',
};
const WAVE_TYPES  = ['sine','sawtooth','square','triangle','noise'];
const LFO_WAVES   = ['sine','triangle','square','sawtooth'];
const FILTER_TYPES = [
  {id:'lp12',label:'LP 12'},{id:'lp24',label:'LP 24'},
  {id:'hp',  label:'HP'},   {id:'bp',  label:'BP'},
  {id:'notch',label:'NOTCH'},
];

const FACTORY_PRESETS = [
  {
    name:'★ Init',
    params:{
      oscAWave:'sawtooth',oscAOctave:0, oscADetune:0, oscALevel:1.0,
      oscBWave:'square',  oscBOctave:-1,oscBDetune:0, oscBLevel:0.5,
      filterType:'lp12',cutoff:800,resonance:5,drive:0.2,
      ampAttack:0.005,ampDecay:0.1,ampSustain:0.7,ampRelease:0.25,
      ampAtkCurve:0.2,ampDecCurve:0.7,ampRelCurve:0.5,
      fEnvAttack:0.005,fEnvDecay:0.3,fEnvSustain:0.1,fEnvRelease:0.2,
      fEnvAmount:3000,fEnvCurve:'exp',fEnvVariation:0,
      fEnvAtkCurve:0,fEnvDecCurve:0.8,fEnvRelCurve:0.5,
      pitchEnvAmount:0,pitchEnvAttack:0.002,pitchEnvDecay:0.15,
      lfoWave:'sine',lfoRate:4.0,lfoDepth:400,volume:0.65,
    },
    ampCurves:{atkCurve:0.2,decCurve:0.7,relCurve:0.5},
    fEnvCurves:{atkCurve:0,decCurve:0.8,relCurve:0.5},
  },
  {
    name:'★ Deep Wub',
    params:{
      oscAWave:'sawtooth',oscAOctave:-1,oscADetune:0, oscALevel:1.0,
      oscBWave:'square',  oscBOctave:-2,oscBDetune:0, oscBLevel:0.6,
      filterType:'lp24',cutoff:350,resonance:15,drive:0.45,
      ampAttack:0.005,ampDecay:0.15,ampSustain:0.85,ampRelease:0.35,
      ampAtkCurve:0.2,ampDecCurve:0.7,ampRelCurve:0.5,
      fEnvAttack:0.005,fEnvDecay:0.35,fEnvSustain:0.04,fEnvRelease:0.25,
      fEnvAmount:5500,fEnvCurve:'exp',fEnvVariation:0,
      fEnvAtkCurve:0,fEnvDecCurve:0.9,fEnvRelCurve:0.5,
      pitchEnvAmount:-12,pitchEnvAttack:0.002,pitchEnvDecay:0.12,
      lfoWave:'sine',lfoRate:3.0,lfoDepth:600,volume:0.7,
    },
    ampCurves:{atkCurve:0.2,decCurve:0.7,relCurve:0.5},
    fEnvCurves:{atkCurve:0,decCurve:0.9,relCurve:0.5},
  },
  {
    name:'★ Fast Wobble',
    params:{
      oscAWave:'sawtooth',oscAOctave:0,oscADetune:7, oscALevel:1.0,
      oscBWave:'sawtooth',oscBOctave:0,oscBDetune:-7,oscBLevel:0.8,
      filterType:'lp12',cutoff:500,resonance:10,drive:0.3,
      ampAttack:0.005,ampDecay:0.08,ampSustain:0.9,ampRelease:0.2,
      ampAtkCurve:0.2,ampDecCurve:0.7,ampRelCurve:0.5,
      fEnvAttack:0.005,fEnvDecay:0.08,fEnvSustain:0.2,fEnvRelease:0.15,
      fEnvAmount:4000,fEnvCurve:'exp',fEnvVariation:0.3,
      fEnvAtkCurve:0,fEnvDecCurve:0.8,fEnvRelCurve:0.5,
      pitchEnvAmount:0,pitchEnvAttack:0.002,pitchEnvDecay:0.1,
      lfoWave:'sine',lfoRate:12.0,lfoDepth:800,volume:0.65,
    },
    ampCurves:{atkCurve:0.2,decCurve:0.7,relCurve:0.5},
    fEnvCurves:{atkCurve:0,decCurve:0.8,relCurve:0.5},
  },
  {
    name:'★ Growl Bass',
    params:{
      oscAWave:'sawtooth',oscAOctave:0,oscADetune:0,  oscALevel:1.0,
      oscBWave:'square',  oscBOctave:0,oscBDetune:12, oscBLevel:0.7,
      filterType:'lp24',cutoff:600,resonance:18,drive:0.7,
      ampAttack:0.008,ampDecay:0.2,ampSustain:0.75,ampRelease:0.3,
      ampAtkCurve:0.2,ampDecCurve:0.7,ampRelCurve:0.5,
      fEnvAttack:0.008,fEnvDecay:0.45,fEnvSustain:0.15,fEnvRelease:0.3,
      fEnvAmount:6000,fEnvCurve:'exp',fEnvVariation:0.15,
      fEnvAtkCurve:0,fEnvDecCurve:0.9,fEnvRelCurve:0.5,
      pitchEnvAmount:-7,pitchEnvAttack:0.003,pitchEnvDecay:0.08,
      lfoWave:'triangle',lfoRate:6.0,lfoDepth:500,volume:0.7,
    },
    ampCurves:{atkCurve:0.2,decCurve:0.9,relCurve:0.5},
    fEnvCurves:{atkCurve:0,decCurve:0.9,relCurve:0.5},
  },
  {
    name:'★ Reese Bass',
    params:{
      oscAWave:'sawtooth',oscAOctave:0,oscADetune:5, oscALevel:1.0,
      oscBWave:'sawtooth',oscBOctave:0,oscBDetune:-5,oscBLevel:1.0,
      filterType:'lp12',cutoff:900,resonance:3,drive:0.15,
      ampAttack:0.01,ampDecay:0.2,ampSustain:0.95,ampRelease:0.4,
      ampAtkCurve:0.2,ampDecCurve:0.7,ampRelCurve:0.5,
      fEnvAttack:0.01,fEnvDecay:0.5,fEnvSustain:0.6,fEnvRelease:0.3,
      fEnvAmount:2000,fEnvCurve:'exp',fEnvVariation:0,
      fEnvAtkCurve:0,fEnvDecCurve:0.7,fEnvRelCurve:0.5,
      pitchEnvAmount:-5,pitchEnvAttack:0.005,pitchEnvDecay:0.3,
      lfoWave:'sine',lfoRate:0.5,lfoDepth:200,volume:0.7,
    },
    ampCurves:{atkCurve:0.2,decCurve:0.7,relCurve:0.5},
    fEnvCurves:{atkCurve:0,decCurve:0.7,relCurve:0.5},
  },
];

// ─────────────────────────────────────────────────────────
//  WobblerSynth — audio engine
// ─────────────────────────────────────────────────────────
class WobblerSynth {
  constructor() {
    this.ctx    = new (window.AudioContext || window.webkitAudioContext)();
    this.voices = new Map();
    this._nBuf  = null;

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.lfo      = this.ctx.createOscillator();
    this.lfoGain  = this.ctx.createGain();
    this.lfo.connect(this.lfoGain);
    this.lfo.start();

    this.lfo2      = this.ctx.createOscillator();
    this.lfo2Gain  = this.ctx.createGain();
    this.lfo2.connect(this.lfo2Gain);
    this.lfo2.start();

    this.p = {
      oscAWave:'sawtooth', oscAOctave:0, oscADetune:0, oscALevel:1.0,
      oscBWave:'square',   oscBOctave:-1,oscBDetune:0, oscBLevel:0.5,

      filterType:'lp12', cutoff:800, resonance:5, drive:0.2,
      oscAEnabled:true, oscBEnabled:true, filterEnabled:true,
      noiseType:'white', noiseLevel:0, noiseEnabled:false,

      ampAttack:0.005, ampDecay:0.1, ampSustain:0.7, ampRelease:0.25,
      ampAtkCurve:0.2, ampDecCurve:0.7, ampRelCurve:0.5,

      fEnvAttack:0.005, fEnvDecay:0.3, fEnvSustain:0.1, fEnvRelease:0.2,
      fEnvAmount:3000,  fEnvCurve:'exp', fEnvVariation:0,
      fEnvAtkCurve:0,   fEnvDecCurve:0.8, fEnvRelCurve:0.5,

      pitchBend:0, pitchBendRange:2,
      pitchEnvAmount:0, pitchEnvAttack:0.002, pitchEnvDecay:0.15,

      lfoEnabled:true,  lfoWave:'sine',     lfoRate:4.0,  lfoDepth:400,  lfoTarget:'cutoff',
      lfo2Enabled:false, lfo2Wave:'triangle', lfo2Rate:0.5, lfo2Depth:50,  lfo2Target:'pitch',
      volume:0.65,
    };

    this.lfo.type             = this.p.lfoWave;
    this.lfo.frequency.value  = this.p.lfoRate;
    this.lfoGain.gain.value   = this.p.lfoDepth;
    this.lfo2.type            = this.p.lfo2Wave;
    this.lfo2.frequency.value = this.p.lfo2Rate;
    this.lfo2Gain.gain.value  = 0; // lfo2 starts disabled
    this.masterGain.gain.value = this.p.volume;
  }

  // Quadratic-bezier shaped curve array for setValueCurveAtTime
  // curviness: -1=log (fast→slow), 0=linear, +1=exp (slow→fast initial change)
  _buildCurve(from, to, curviness, n = 64) {
    const c   = new Float32Array(n);
    const cpV = from + (to - from) * (0.5 + curviness * 0.5);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      c[i] = (1-t)*(1-t)*from + 2*t*(1-t)*cpV + t*t*to;
    }
    return c;
  }

  _noiseBuf() {
    if (this._nBuf) return this._nBuf;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._nBuf = buf;
    return buf;
  }

  _makeOsc(wave, freq) {
    if (wave === 'noise') {
      const s = this.ctx.createBufferSource();
      s.buffer = this._noiseBuf(); s.loop = true;
      return s;
    }
    const o = this.ctx.createOscillator();
    o.type = wave; o.frequency.value = freq;
    return o;
  }

  _distCurve(amt) {
    const n = 512, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      c[i] = ((3 + amt) * x * 20 * (Math.PI / 180)) / (Math.PI + amt * Math.abs(x));
    }
    return c;
  }

  _webFilterType(t) {
    return {lp12:'lowpass',lp24:'lowpass',hp:'highpass',bp:'bandpass',notch:'notch'}[t]||'lowpass';
  }

  _pinkNoiseBuf() {
    if (this._pnBuf) return this._pnBuf;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random()*2-1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
    this._pnBuf = buf; return buf;
  }

  _brownNoiseBuf() {
    if (this._bnBuf) return this._bnBuf;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = Math.max(-1, Math.min(1, last + (Math.random()*2-1)*0.02));
      d[i] = last;
    }
    this._bnBuf = buf; return buf;
  }

  _crackleBuf() {
    if (this._cnBuf) return this._cnBuf;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const x = Math.random()<0.0008 ? (Math.random()*2-1)*2 : (Math.random()*2-1)*0.003;
      d[i] = Math.max(-1, Math.min(1, x));
    }
    this._cnBuf = buf; return buf;
  }

  _buildCurveSteps(from, to, steps) {
    const n = 256, c = new Float32Array(n), ns = steps.length;
    for (let i = 0; i < n; i++) {
      const si = Math.min(ns-1, Math.floor((i/n)*ns));
      c[i] = from + (to-from)*(1-steps[si]);
    }
    return c;
  }

  _buildCurveBounce(from, to, freq=3, damp=5) {
    const n = 256, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i/(n-1);
      c[i] = to + (from-to)*Math.exp(-damp*t)*Math.abs(Math.cos(Math.PI*freq*t));
    }
    return c;
  }

  noteOn(midi) {
    if (this.voices.has(midi)) return;
    const ctx = this.ctx, now = ctx.currentTime, p = this.p;
    const baseFreq = midiToFreq(midi);

    // OSC A
    const oscA = this._makeOsc(p.oscAWave, baseFreq * Math.pow(2, p.oscAOctave));
    const gA   = ctx.createGain(); gA.gain.value = p.oscAEnabled ? p.oscALevel : 0;
    const pbCents = p.pitchBend * p.pitchBendRange * 100;
    if (oscA.detune) oscA.detune.value = p.oscADetune * 100 + pbCents;
    oscA.connect(gA);

    // OSC B
    const oscB = this._makeOsc(p.oscBWave, baseFreq * Math.pow(2, p.oscBOctave));
    const gB   = ctx.createGain(); gB.gain.value = p.oscBEnabled ? p.oscBLevel : 0;
    if (oscB.detune) oscB.detune.value = p.oscBDetune * 100 + pbCents;
    oscB.connect(gB);

    // Noise generator (always present for live level control)
    const nBuf = p.noiseType==='pink'    ? this._pinkNoiseBuf()  :
                 p.noiseType==='brown'   ? this._brownNoiseBuf() :
                 p.noiseType==='crackle' ? this._crackleBuf()    : this._noiseBuf();
    const noiseSrc  = ctx.createBufferSource();
    noiseSrc.buffer = nBuf; noiseSrc.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = p.noiseEnabled ? p.noiseLevel : 0;
    noiseSrc.connect(noiseGain);

    // Filter
    const f1 = ctx.createBiquadFilter();
    f1.type = this._webFilterType(p.filterType);
    f1.frequency.value = p.filterEnabled ? p.cutoff : 20000;
    f1.Q.value = p.filterEnabled ? p.resonance : 0;
    gA.connect(f1); gB.connect(f1); noiseGain.connect(f1);

    let f2 = null, filterOut = f1;
    if (p.filterType === 'lp24') {
      f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass'; f2.Q.value = p.resonance;
      f1.connect(f2); filterOut = f2;
    }

    const _isGlobalTarget = t => ['lfo1rate','lfo2rate'].includes(t);
    if (p.lfoEnabled  && !_isGlobalTarget(p.lfoTarget))  this._routeLFO(this.lfoGain,  {f1,f2,oscA,oscB,ampEnv,gA,gB}, p.lfoTarget);
    if (p.lfo2Enabled && !_isGlobalTarget(p.lfo2Target)) this._routeLFO(this.lfo2Gain, {f1,f2,oscA,oscB,ampEnv,gA,gB}, p.lfo2Target);

    // Filter envelope — per-note variation + mode-aware curve
    const varR   = () => 1 + (Math.random() * 2 - 1) * p.fEnvVariation;
    const varAmt = p.fEnvAmount * varR();
    const varDec = Math.max(0.01, p.fEnvDecay * (1 + (Math.random()-0.5)*p.fEnvVariation*0.6));
    const base   = p.filterEnabled ? p.cutoff : 20000;
    const peak   = Math.max(20, Math.min(20000, base + varAmt));
    const sust   = Math.max(20, Math.min(20000, base + varAmt * p.fEnvSustain));

    [f1, f2].filter(Boolean).forEach(f => {
      f.frequency.cancelScheduledValues(now);
      f.frequency.setValueAtTime(base, now);
      f.frequency.linearRampToValueAtTime(peak, now + p.fEnvAttack);
      let fDecC;
      if      (p.fEnvMode==='steps'  && p.fEnvSteps?.length)  fDecC = this._buildCurveSteps(peak, sust, p.fEnvSteps);
      else if (p.fEnvMode==='bounce')                          fDecC = this._buildCurveBounce(peak, sust, p.fEnvBounceFreq||3, p.fEnvBounceDamp||5);
      else                                                     fDecC = this._buildCurve(peak, sust, p.fEnvDecCurve);
      f.frequency.setValueCurveAtTime(fDecC, now + p.fEnvAttack, varDec);
    });

    // Pitch envelope
    if (Math.abs(p.pitchEnvAmount) > 0.01) {
      const pitchC = p.pitchEnvAmount * 100;
      [oscA, oscB].forEach(osc => {
        if (!osc.detune) return;
        const base = osc === oscA ? p.oscADetune * 100 : p.oscBDetune * 100;
        osc.detune.cancelScheduledValues(now);
        osc.detune.setValueAtTime(base + pitchC, now);
        osc.detune.setTargetAtTime(base, now + p.pitchEnvAttack, p.pitchEnvDecay / 3.5);
      });
    }

    // Drive
    const drive = ctx.createWaveShaper();
    drive.curve = this._distCurve(p.drive * 120);
    drive.oversample = '2x';
    filterOut.connect(drive);

    // Amp envelope with curves
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0, now);
    const atkC = this._buildCurve(0, 1, p.ampAtkCurve);
    ampEnv.gain.setValueCurveAtTime(atkC, now, Math.max(0.001, p.ampAttack));
    let decC;
    if      (p.ampMode==='steps'  && p.ampSteps?.length)  decC = this._buildCurveSteps(1, p.ampSustain, p.ampSteps);
    else if (p.ampMode==='bounce')                         decC = this._buildCurveBounce(1, p.ampSustain, p.ampBounceFreq||3, p.ampBounceDamp||5);
    else                                                   decC = this._buildCurve(1, p.ampSustain, p.ampDecCurve);
    ampEnv.gain.setValueCurveAtTime(decC, now + p.ampAttack, Math.max(0.001, p.ampDecay));
    drive.connect(ampEnv);
    ampEnv.connect(this.masterGain);

    oscA.start(now); oscB.start(now); noiseSrc.start(now);
    this.voices.set(midi, { midi, oscA, oscB, gA, gB, f1, f2, drive, ampEnv, noiseSrc, noiseGain });
  }

  noteOff(midi) {
    const v = this.voices.get(midi);
    if (!v) return;
    const now = this.ctx.currentTime, p = this.p;

    v.ampEnv.gain.cancelScheduledValues(now);
    v.ampEnv.gain.setValueAtTime(v.ampEnv.gain.value, now);
    const relC = this._buildCurve(v.ampEnv.gain.value, 0, p.ampRelCurve);
    v.ampEnv.gain.setValueCurveAtTime(relC, now, Math.max(0.01, p.ampRelease));

    [v.f1, v.f2].filter(Boolean).forEach(f => {
      f.frequency.cancelScheduledValues(now);
      f.frequency.setValueAtTime(f.frequency.value, now);
      f.frequency.linearRampToValueAtTime(p.cutoff, now + p.fEnvRelease);
    });

    const stopAt = (Math.max(p.ampRelease, p.fEnvRelease) + 0.15) * 1000;
    setTimeout(() => {
      try { v.oscA.stop(); v.oscB.stop(); v.noiseSrc?.stop(); } catch (_) {}
      this.voices.delete(midi);
    }, stopAt);
  }

  _routeLFO(lfoGain, voice, target) {
    switch (target) {
      case 'cutoff':
        lfoGain.connect(voice.f1.frequency);
        if (voice.f2) lfoGain.connect(voice.f2.frequency);
        break;
      case 'pitch':
        if (voice.oscA?.detune) lfoGain.connect(voice.oscA.detune);
        if (voice.oscB?.detune) lfoGain.connect(voice.oscB.detune);
        break;
      case 'amp':
        lfoGain.connect(voice.ampEnv.gain);
        break;
      case 'res':
        lfoGain.connect(voice.f1.Q);
        if (voice.f2) lfoGain.connect(voice.f2.Q);
        break;
      case 'noise':
        if (voice.noiseGain) lfoGain.connect(voice.noiseGain.gain);
        break;
      case 'oscAlevel': if (voice.gA) lfoGain.connect(voice.gA.gain); break;
      case 'oscBlevel': if (voice.gB) lfoGain.connect(voice.gB.gain); break;
      // 'none' / rate targets handled globally — no per-voice connection
    }
  }

  _curveToPeriodicWave(curve) {
    const N  = curve.length;
    const nh = Math.floor(N / 2);
    const real = new Float32Array(nh + 1);
    const imag = new Float32Array(nh + 1);
    for (let k = 1; k <= nh; k++) {
      let r = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const a = 2 * Math.PI * k * n / N;
        r  += curve[n] * Math.cos(a);
        im -= curve[n] * Math.sin(a);
      }
      real[k] = r * 2 / N;
      imag[k] = im * 2 / N;
    }
    real[0] = imag[0] = 0;
    return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  updateParam(name, value) {
    this.p[name] = value;
    switch (name) {
      case 'lfoRate':    this.lfo.frequency.value  = value; break;
      case 'lfo2Rate':   this.lfo2.frequency.value = value; break;
      case 'lfoWave':  this.lfo.setPeriodicWave(this._curveToPeriodicWave(LFOCurveCanvas.presetCurve(value))); break;
      case 'lfo2Wave': this.lfo2.setPeriodicWave(this._curveToPeriodicWave(LFOCurveCanvas.presetCurve(value))); break;
      case 'lfoCustomCurve':  this.lfo.setPeriodicWave(this._curveToPeriodicWave(value)); break;
      case 'lfo2CustomCurve': this.lfo2.setPeriodicWave(this._curveToPeriodicWave(value)); break;
      case 'lfoDepth':
        if (this.p.lfoEnabled) this.lfoGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
        break;
      case 'lfo2Depth':
        if (this.p.lfo2Enabled) this.lfo2Gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
        break;
      case 'lfoEnabled':
        this.lfoGain.gain.setTargetAtTime(
          value ? this.p.lfoDepth : 0, this.ctx.currentTime, 0.05); break;
      case 'lfo2Enabled':
        this.lfo2Gain.gain.setTargetAtTime(
          value ? this.p.lfo2Depth : 0, this.ctx.currentTime, 0.05); break;
      case 'lfoTarget': {
        try { this.lfoGain.disconnect(); } catch(_) {}
        if (value === 'lfo2rate') {
          this.lfoGain.connect(this.lfo2.frequency); // global cross-mod
        } else if (this.p.lfoEnabled) {
          this.voices.forEach(v => this._routeLFO(this.lfoGain, v, value));
        }
        break;
      }
      case 'lfo2Target': {
        try { this.lfo2Gain.disconnect(); } catch(_) {}
        if (value === 'lfo1rate') {
          this.lfo2Gain.connect(this.lfo.frequency); // global cross-mod
        } else if (this.p.lfo2Enabled) {
          this.voices.forEach(v => this._routeLFO(this.lfo2Gain, v, value));
        }
        break;
      }
      case 'volume':    this.masterGain.gain.value = value; break;
      // ── Oscillator waveform (live) ─────────────────────────
      case 'oscAWave':
        this.voices.forEach(v => { if (v.oscA.type !== undefined) v.oscA.type = value; });
        break;
      case 'oscBWave':
        this.voices.forEach(v => { if (v.oscB.type !== undefined) v.oscB.type = value; });
        break;
      // ── Oscillator pitch / detune (live smooth glide) ────────
      case 'oscAOctave':
        this.voices.forEach(v => {
          if (!v.oscA.frequency) return;
          v.oscA.frequency.setTargetAtTime(
            midiToFreq(v.midi) * Math.pow(2, value), this.ctx.currentTime, 0.01);
        }); break;
      case 'oscBOctave':
        this.voices.forEach(v => {
          if (!v.oscB.frequency) return;
          v.oscB.frequency.setTargetAtTime(
            midiToFreq(v.midi) * Math.pow(2, value), this.ctx.currentTime, 0.01);
        }); break;
      case 'oscADetune':
        this.voices.forEach(v => {
          if (v.oscA.detune) v.oscA.detune.setTargetAtTime(value * 100, this.ctx.currentTime, 0.01);
        }); break;
      case 'oscBDetune':
        this.voices.forEach(v => {
          if (v.oscB.detune) v.oscB.detune.setTargetAtTime(value * 100, this.ctx.currentTime, 0.01);
        }); break;
      // ── Filter (smooth) ───────────────────────────────────────
      case 'filterType':
        this.voices.forEach(v => {
          v.f1.type = this._webFilterType(value);
          if (v.f2) v.f2.type = this._webFilterType(value);
        }); break;
      case 'cutoff': {
        // cancelAndHoldAtTime stops any running setValueCurveAtTime (filter env)
        // so the cutoff slider always takes immediate effect
        const now = this.ctx.currentTime;
        const hold = f => {
          try { f.frequency.cancelAndHoldAtTime(now); }
          catch(_) { f.frequency.cancelScheduledValues(now); }
          f.frequency.setTargetAtTime(value, now, 0.012);
        };
        this.voices.forEach(v => { hold(v.f1); if (v.f2) hold(v.f2); });
        break;
      }
      case 'resonance':
        this.voices.forEach(v => {
          v.f1.Q.setTargetAtTime(value, this.ctx.currentTime, 0.008);
          if (v.f2) v.f2.Q.setTargetAtTime(value, this.ctx.currentTime, 0.008);
        }); break;
      case 'drive':
        this.voices.forEach(v => { v.drive.curve = this._distCurve(value * 120); }); break;
      // ── Filter env sustain target (live) ─────────────────────
      // When fEnvAmount or fEnvSustain changes, push filter toward the new sustain freq
      case 'fEnvAmount':
      case 'fEnvSustain': {
        const target = Math.max(20, Math.min(20000,
          this.p.cutoff + this.p.fEnvAmount * this.p.fEnvSustain));
        this.voices.forEach(v => {
          v.f1.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.02);
          if (v.f2) v.f2.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.02);
        }); break;
      }
      // ── Amp sustain (live — ramps to new level) ───────────────
      case 'ampSustain':
        this.voices.forEach(v => {
          v.ampEnv.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
        }); break;
      // ── Mix levels ───────────────────────────────────────────
      case 'oscALevel':
        this.voices.forEach(v => { v.gA.gain.setTargetAtTime(value, this.ctx.currentTime, 0.008); }); break;
      case 'oscBLevel':
        this.voices.forEach(v => { v.gB.gain.setTargetAtTime(value, this.ctx.currentTime, 0.008); }); break;
      // ── Pitch bend ──────────────────────────────────────────
      case 'pitchBend': {
        const cents = value * this.p.pitchBendRange * 100;
        const t = this.ctx.currentTime;
        this.voices.forEach(v => {
          if (v.oscA.detune) v.oscA.detune.setTargetAtTime(this.p.oscADetune*100 + cents, t, 0.003);
          if (v.oscB.detune) v.oscB.detune.setTargetAtTime(this.p.oscBDetune*100 + cents, t, 0.003);
        }); break;
      }
      // ── Enable / Disable ─────────────────────────────────────
      case 'oscAEnabled':
        this.voices.forEach(v => {
          v.gA.gain.setTargetAtTime(value ? this.p.oscALevel : 0, this.ctx.currentTime, 0.02);
        }); break;
      case 'oscBEnabled':
        this.voices.forEach(v => {
          v.gB.gain.setTargetAtTime(value ? this.p.oscBLevel : 0, this.ctx.currentTime, 0.02);
        }); break;
      case 'filterEnabled': {
        const t = this.ctx.currentTime;
        const fc = value ? this.p.cutoff : 20000;
        const fq = value ? this.p.resonance : 0;
        this.voices.forEach(v => {
          v.f1.frequency.setTargetAtTime(fc, t, 0.02);
          v.f1.Q.setTargetAtTime(fq, t, 0.02);
          if (v.f2) { v.f2.frequency.setTargetAtTime(fc, t, 0.02); v.f2.Q.setTargetAtTime(fq, t, 0.02); }
        }); break;
      }
      // ── Noise ────────────────────────────────────────────────
      case 'noiseLevel':
        if (this.p.noiseEnabled)
          this.voices.forEach(v => {
            if (v.noiseGain) v.noiseGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
          }); break;
      case 'noiseEnabled':
        this.voices.forEach(v => {
          if (v.noiseGain) v.noiseGain.gain.setTargetAtTime(
            value ? this.p.noiseLevel : 0, this.ctx.currentTime, 0.02);
        }); break;
    }
  }

  generateAIPattern() {
    const presets = [
      {lfoRate:4,  lfoDepth:400, cutoff:600,  fEnvAmount:3000,fEnvDecay:300,pitchEnvAmount:-12,pitchEnvDecay:150},
      {lfoRate:8,  lfoDepth:600, cutoff:400,  fEnvAmount:4500,fEnvDecay:150,pitchEnvAmount:-7, pitchEnvDecay:80 },
      {lfoRate:2,  lfoDepth:200, cutoff:900,  fEnvAmount:2000,fEnvDecay:500,pitchEnvAmount:0,  pitchEnvDecay:200},
      {lfoRate:16, lfoDepth:800, cutoff:300,  fEnvAmount:5500,fEnvDecay:80, pitchEnvAmount:-5, pitchEnvDecay:60 },
      {lfoRate:0.5,lfoDepth:150, cutoff:1100, fEnvAmount:1500,fEnvDecay:800,pitchEnvAmount:5,  pitchEnvDecay:300},
      {lfoRate:3,  lfoDepth:350, cutoff:500,  fEnvAmount:6000,fEnvDecay:200,pitchEnvAmount:-24,pitchEnvDecay:100},
    ];
    const p = presets[Math.floor(Math.random() * presets.length)];
    Object.entries(p).forEach(([id, val]) => animateSlider(id, val));
  }
}

// ─────────────────────────────────────────────────────────
//  EnvCanvas — Interactive bezier envelope editor
// ─────────────────────────────────────────────────────────
class EnvCanvas {
  constructor(canvasId, envParams, color, onParamChange) {
    this.el     = document.getElementById(canvasId);
    if (!this.el) return;
    this.g      = this.el.getContext('2d');
    this.ep     = envParams;   // live param object
    this.color  = color;
    this.notify = onParamChange;
    this.drag   = null;
    this.HIT    = 12;
    this._size();
    this._bind();
    this.draw();
  }

  _size() {
    const r  = this.el.parentElement.getBoundingClientRect();
    this.W   = r.width || 300;
    this.H   = this.el.offsetHeight || 120;
    this.el.width  = this.W;
    this.el.height = this.H;
    this.P   = {t:12, r:10, b:18, l:8};
    this.IW  = this.W - this.P.l - this.P.r;
    this.IH  = this.H - this.P.t - this.P.b;
  }

  // Compute all pixel positions from current params
  _pts() {
    const e = this.ep, IW = this.IW, IH = this.IH, P = this.P;
    const SH   = e.susHold || 0.25;
    const tot  = e.attack + e.decay + SH + e.release;
    const atkX = P.l + (e.attack / tot) * IW;
    const decX = atkX + (e.decay  / tot) * IW;
    const susX = decX + (SH       / tot) * IW;
    const relX = susX + (e.release/ tot) * IW;
    const botY = P.t + IH;
    const topY = P.t;
    const susY = P.t + IH * (1 - e.sustain);

    // Bezier control points (one per segment)
    const atkCP = { x: P.l  + (atkX-P.l) * (0.5 + (e.atkCurve||0)*0.45),
                    y: botY + (topY-botY) * (0.5 - (e.atkCurve||0)*0.45) };
    const decCP = { x: atkX + (decX-atkX)*(0.5 - (e.decCurve||0)*0.45),
                    y: topY + (susY-topY)*(0.5 + (e.decCurve||0)*0.45) };
    const relCP = { x: susX + (relX-susX)*(0.5 - (e.relCurve||0)*0.45),
                    y: susY + (botY-susY)*(0.5 + (e.relCurve||0)*0.45) };

    return {atkX,decX,susX,relX,botY,topY,susY,atkCP,decCP,relCP,tot};
  }

  _bezMid(p0, cp, p1) {
    const t = 0.5, mt = 0.5;
    return {
      x: mt*mt*p0.x + 2*mt*t*cp.x + t*t*p1.x,
      y: mt*mt*p0.y + 2*mt*t*cp.y + t*t*p1.y,
    };
  }

  draw() {
    if (!this.el) return;
    const g = this.g, W = this.W, H = this.H, P = this.P;
    const pts = this._pts();
    const {atkX,decX,susX,relX,botY,topY,susY,atkCP,decCP,relCP} = pts;
    const mode = this.ep.mode || 'smooth';

    g.clearRect(0, 0, W, H);
    g.fillStyle = '#080810'; g.fillRect(0, 0, W, H);

    // Grid
    g.strokeStyle = 'rgba(255,255,255,0.04)'; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = P.l + (this.IW/4)*i;
      g.beginPath(); g.moveTo(x,P.t); g.lineTo(x,P.t+this.IH); g.stroke();
    }
    g.beginPath(); g.moveTo(P.l,P.t+this.IH/2); g.lineTo(P.l+this.IW,P.t+this.IH/2); g.stroke();

    // Mode-specific shape
    if      (mode === 'steps')  this._drawSteps (g, atkX,decX,susX,relX,botY,topY,susY,atkCP,relCP);
    else if (mode === 'bounce') this._drawBounce(g, atkX,decX,susX,relX,botY,topY,susY,atkCP,relCP);
    else                        this._drawSmooth(g, atkX,decX,susX,relX,botY,topY,susY,atkCP,decCP,relCP);

    // Labels
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.font = '9px monospace';
    g.fillText('A', atkX-4, H-3); g.fillText('D', decX-4, H-3); g.fillText('R', relX-4, H-3);

    // Draggable ADSR nodes
    [{x:atkX,y:topY,id:'atk'},{x:decX,y:susY,id:'dec'},{x:relX,y:botY,id:'rel'}].forEach(n => {
      const hot = this.drag?.id === n.id;
      g.beginPath(); g.arc(n.x,n.y,hot?7:5,0,Math.PI*2);
      g.fillStyle = hot?'#fff':'rgba(255,255,255,0.75)'; g.fill();
      g.strokeStyle='#000'; g.lineWidth=1; g.stroke();
    });

    // Curve handles (smooth mode only)
    if (mode === 'smooth') {
      const atkMid = this._bezMid({x:P.l,y:botY}, atkCP, {x:atkX,y:topY});
      const decMid = this._bezMid({x:atkX,y:topY}, decCP, {x:decX,y:susY});
      const relMid = this._bezMid({x:susX,y:susY}, relCP, {x:relX,y:botY});
      [{pt:atkMid,id:'atk-curve'},{pt:decMid,id:'dec-curve'},{pt:relMid,id:'rel-curve'}].forEach(h => {
        const hot = this.drag?.id === h.id;
        g.beginPath(); g.arc(h.pt.x,h.pt.y,hot?6:4,0,Math.PI*2);
        g.fillStyle = hot?this.color:'rgba(255,255,255,0.25)'; g.fill();
        g.strokeStyle=this.color; g.lineWidth=1; g.stroke();
      });
    }
  }

  _drawSmooth(g, atkX,decX,susX,relX,botY,topY,susY,atkCP,decCP,relCP) {
    const P = this.P;
    const path = () => {
      g.moveTo(P.l,botY);
      g.quadraticCurveTo(atkCP.x,atkCP.y,atkX,topY);
      g.quadraticCurveTo(decCP.x,decCP.y,decX,susY);
      g.lineTo(susX,susY);
      g.quadraticCurveTo(relCP.x,relCP.y,relX,botY);
    };
    g.beginPath(); path(); g.closePath(); g.fillStyle=this.color+'1a'; g.fill();
    g.beginPath(); path(); g.strokeStyle=this.color; g.lineWidth=2; g.stroke();
  }

  _drawSteps(g, atkX,decX,susX,relX,botY,topY,susY,atkCP,relCP) {
    const P = this.P, e = this.ep;
    const steps = e.steps || new Float32Array([1,0.75,0.5,0.28,0.14,0.06]);
    const n = steps.length;
    const stairs = Array.from({length:n},(_,i)=>({
      xs: atkX+(decX-atkX)*(i/n),
      xe: atkX+(decX-atkX)*((i+1)/n),
      y:  topY+(susY-topY)*(1-steps[i]),
    }));
    const path = () => {
      g.moveTo(P.l,botY);
      g.quadraticCurveTo(atkCP.x,atkCP.y,atkX,topY);
      stairs.forEach(s=>{ g.lineTo(s.xs,s.y); g.lineTo(s.xe,s.y); });
      g.lineTo(decX,susY); g.lineTo(susX,susY);
      g.quadraticCurveTo(relCP.x,relCP.y,relX,botY);
    };
    g.beginPath(); path(); g.closePath(); g.fillStyle=this.color+'1a'; g.fill();
    g.beginPath(); path(); g.strokeStyle=this.color; g.lineWidth=2; g.stroke();
    g.fillStyle=this.color; g.font='8px monospace';
    g.fillText(`${n} steps`, atkX+4, botY-4);
  }

  _drawBounce(g, atkX,decX,susX,relX,botY,topY,susY,atkCP,relCP) {
    const P = this.P, e = this.ep;
    const freq = e.bounceFreq||3, damp = e.bounceDamp||5, n = 128;
    const pts = Array.from({length:n+1},(_,i)=>{
      const t=i/n;
      return {x:atkX+(decX-atkX)*t, y:susY+(topY-susY)*Math.exp(-damp*t)*Math.abs(Math.cos(Math.PI*freq*t))};
    });
    const path = () => {
      g.moveTo(P.l,botY);
      g.quadraticCurveTo(atkCP.x,atkCP.y,atkX,topY);
      pts.forEach(p=>g.lineTo(p.x,p.y));
      g.lineTo(susX,susY);
      g.quadraticCurveTo(relCP.x,relCP.y,relX,botY);
    };
    g.beginPath(); path(); g.closePath(); g.fillStyle=this.color+'1a'; g.fill();
    g.beginPath(); path(); g.strokeStyle=this.color; g.lineWidth=2; g.stroke();
    g.fillStyle=this.color; g.font='8px monospace';
    g.fillText(`bounce ${freq.toFixed(1)}hz`, atkX+4, botY-4);
  }

  _hit(mx, my) {
    const {atkX,decX,susX,relX,botY,topY,susY,atkCP,decCP,relCP} = this._pts();
    const P = this.P, R = this.HIT;
    const decMid = this._bezMid({x:atkX,y:topY}, decCP, {x:decX,y:susY});
    const relMid = this._bezMid({x:susX,y:susY}, relCP, {x:relX,y:botY});
    const atkMid = this._bezMid({x:P.l, y:botY}, atkCP, {x:atkX,y:topY});

    if (Math.hypot(mx-decMid.x, my-decMid.y) < R) return {id:'dec-curve'};
    if (Math.hypot(mx-relMid.x, my-relMid.y) < R) return {id:'rel-curve'};
    if (Math.hypot(mx-atkMid.x, my-atkMid.y) < R) return {id:'atk-curve'};
    if (Math.hypot(mx-atkX,     my-topY     ) < R) return {id:'atk'};
    if (Math.hypot(mx-decX,     my-susY     ) < R) return {id:'dec'};
    if (Math.hypot(mx-relX,     my-botY     ) < R) return {id:'rel'};
    return null;
  }

  _bind() {
    const el = this.el;
    const pos = e => {
      const r = el.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return [src.clientX - r.left, src.clientY - r.top];
    };

    el.addEventListener('mousedown', e => {
      const h = this._hit(...pos(e)); if (!h) return;
      this.drag = h; this.draw();
    });
    el.addEventListener('mousemove', e => {
      const h = this._hit(...pos(e));
      el.style.cursor = h ? 'grab' : 'default';
      if (!this.drag) return;
      this._applyDrag(...pos(e));
    });
    window.addEventListener('mouseup', () => { if (this.drag) { this.drag = null; this.draw(); } });

    el.addEventListener('touchstart', e => {
      e.preventDefault();
      const h = this._hit(...pos(e)); if (!h) return;
      this.drag = h; this.draw();
    }, {passive:false});
    el.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!this.drag) return;
      this._applyDrag(...pos(e));
    }, {passive:false});
    el.addEventListener('touchend', e => { e.preventDefault(); this.drag = null; this.draw(); }, {passive:false});
  }

  _applyDrag(mx, my) {
    if (!this.drag) return;
    const e   = this.ep;
    const tot = e.attack + e.decay + (e.susHold||0.25) + e.release;
    const IW  = this.IW, IH = this.IH;

    // Convert pixel position to normalised time/value
    const t = Math.max(0, Math.min(1, (mx - this.P.l) / IW));
    const v = Math.max(0, Math.min(1, 1 - (my - this.P.t) / IH));

    switch (this.drag.id) {
      case 'atk':
        e.attack = Math.max(0.001, t * tot * 0.5);
        break;
      case 'dec':
        e.decay   = Math.max(0.005, (t * tot - e.attack) * 0.9);
        e.sustain = Math.max(0, Math.min(0.999, v));
        break;
      case 'rel':
        e.release = Math.max(0.01, (1 - t) * tot * 0.9);
        break;
      case 'atk-curve':
        e.atkCurve = Math.max(-1, Math.min(1, (v - 0.5) * 2));
        break;
      case 'dec-curve':
        e.decCurve = Math.max(-1, Math.min(1, (v - 0.5) * 2));
        break;
      case 'rel-curve':
        e.relCurve = Math.max(-1, Math.min(1, (v - 0.5) * 2));
        break;
    }

    this.notify(this.drag.id, e);
    this.draw();
  }

  refresh() { this._size(); this.draw(); }
}

// ─────────────────────────────────────────────────────────
//  Shared envelope param objects (canvas ↔ sliders ↔ synth)
// ─────────────────────────────────────────────────────────
const ampEP = {
  attack:0.005, decay:0.1, sustain:0.7, release:0.25, susHold:0.25,
  atkCurve:0.2, decCurve:0.7, relCurve:0.5,
  mode:'smooth',
  steps: new Float32Array([1,0.82,0.65,0.45,0.28,0.15,0.07,0.02]),
  bounceFreq:3, bounceDamp:5,
};
const fEnvEP = {
  attack:0.005, decay:0.3, sustain:0.1, release:0.2, susHold:0.25,
  atkCurve:0, decCurve:0.8, relCurve:0.5,
  mode:'smooth',
  steps: new Float32Array([1,0.78,0.55,0.32,0.18,0.09,0.04,0.01]),
  bounceFreq:2, bounceDamp:4,
};

function syncAmpToSynth() {
  synth.p.ampAttack    = ampEP.attack;
  synth.p.ampDecay     = ampEP.decay;
  synth.p.ampRelease   = ampEP.release;
  synth.p.ampAtkCurve  = ampEP.atkCurve;
  synth.p.ampDecCurve  = ampEP.decCurve;
  synth.p.ampRelCurve  = ampEP.relCurve;
  synth.p.ampMode      = ampEP.mode || 'smooth';
  synth.p.ampSteps     = ampEP.steps;
  synth.p.ampBounceFreq= ampEP.bounceFreq || 3;
  synth.p.ampBounceDamp= ampEP.bounceDamp || 5;
  synth.updateParam('ampSustain', ampEP.sustain);
  syncSliders(['ampAttack','ampDecay','ampSustain','ampRelease']);
}
function syncFEnvToSynth() {
  synth.p.fEnvAttack    = fEnvEP.attack;
  synth.p.fEnvDecay     = fEnvEP.decay;
  synth.p.fEnvRelease   = fEnvEP.release;
  synth.p.fEnvAtkCurve  = fEnvEP.atkCurve;
  synth.p.fEnvDecCurve  = fEnvEP.decCurve;
  synth.p.fEnvRelCurve  = fEnvEP.relCurve;
  synth.p.fEnvMode      = fEnvEP.mode || 'smooth';
  synth.p.fEnvSteps     = fEnvEP.steps;
  synth.p.fEnvBounceFreq= fEnvEP.bounceFreq || 3;
  synth.p.fEnvBounceDamp= fEnvEP.bounceDamp || 5;
  synth.updateParam('fEnvSustain', fEnvEP.sustain);
  syncSliders(['fEnvAttack','fEnvDecay','fEnvSustain','fEnvRelease']);
}

// Push synth.p values back to slider DOM elements
function syncSliders(ids) {
  const map = {
    ampAttack:  [ampEP.attack*1000,  'ampAttack' ],
    ampDecay:   [ampEP.decay*1000,   'ampDecay'  ],
    ampSustain: [ampEP.sustain*100,  'ampSustain'],
    ampRelease: [ampEP.release*1000, 'ampRelease'],
    fEnvAttack: [fEnvEP.attack*1000, 'fEnvAttack'],
    fEnvDecay:  [fEnvEP.decay*1000,  'fEnvDecay' ],
    fEnvSustain:[fEnvEP.sustain*100, 'fEnvSustain'],
    fEnvRelease:[fEnvEP.release*1000,'fEnvRelease'],
  };
  ids.forEach(id => {
    const entry = map[id]; if (!entry) return;
    const el = document.getElementById(id); if (!el) return;
    el.value = entry[0];
    const vEl = document.getElementById(id + '-v');
    if (vEl) vEl.textContent = fmtValue(id, entry[0]);
  });
}

// ─────────────────────────────────────────────────────────
//  UI — waveform / filter type selectors
// ─────────────────────────────────────────────────────────
function buildWaveSel(containerId, waves, active, onChange) {
  const el = document.getElementById(containerId); if (!el) return;
  el.innerHTML = '';
  waves.forEach(w => {
    const btn = document.createElement('button');
    btn.className = 'wave-btn' + (w === active ? ' active' : '');
    btn.innerHTML = WAVE_SVG[w] || w; btn.title = w;
    btn.addEventListener('click', () => {
      el.querySelectorAll('.wave-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(w);
    });
    el.appendChild(btn);
  });
}

function buildFilterTypeSel() {
  const el = document.getElementById('filterType-sel'); if (!el) return;
  FILTER_TYPES.forEach(ft => {
    const btn = document.createElement('button');
    btn.className = 'ftype-btn' + (ft.id === synth.p.filterType ? ' active' : '');
    btn.textContent = ft.label;
    btn.addEventListener('click', () => {
      el.querySelectorAll('.ftype-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      synth.updateParam('filterType', ft.id);
      filterVizDraw?.();
    });
    el.appendChild(btn);
  });
}

// ─────────────────────────────────────────────────────────
//  LFOCurveCanvas — drawable LFO waveform editor with mult tiling
// ─────────────────────────────────────────────────────────
class LFOCurveCanvas {
  constructor(canvasId, lfoNum, onChange) {
    this.canvas     = document.getElementById(canvasId);
    this.lfoNum     = lfoNum;
    this.onChange   = onChange;
    this.N          = 128;
    this._baseCurve = LFOCurveCanvas.presetCurve('sine');
    this.mult       = 1;
    this._painting  = false;
    this._lastIdx   = -1;
    if (!this.canvas) return;
    this._initCanvas();
    this._bindEvents();
    this.draw();
  }

  static presetCurve(name) {
    const N = 128;
    const c = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / N;
      switch (name) {
        case 'sine':     c[i] = Math.sin(2 * Math.PI * t); break;
        case 'triangle': c[i] = t < 0.25 ? t*4 : t < 0.75 ? 2-t*4 : t*4-4; break;
        case 'saw':      c[i] = 2*t - 1; break;
        case 'ramp':     c[i] = 1 - 2*t; break;
        case 'square':   c[i] = t < 0.5 ? 1 : -1; break;
        case 'bounce':   c[i] = Math.abs(Math.sin(2 * Math.PI * t)) * 2 - 1; break;
        case 'sah': {
          const steps = 8, sv = [];
          for (let s = 0; s < steps; s++) sv[s] = Math.random() * 2 - 1;
          c[i] = sv[Math.floor(t * steps)]; break;
        }
        default: c[i] = Math.sin(2 * Math.PI * t);
      }
    }
    return c;
  }

  // Tile _baseCurve mult times into a 128-pt output (what the audio engine uses)
  _tileCurve() {
    if (this.mult === 1) return this._baseCurve;
    const N = this.N, tileLen = Math.floor(N / this.mult);
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      out[i] = this._baseCurve[Math.floor((i % tileLen) / tileLen * N)];
    }
    return out;
  }

  setMult(n) {
    this.mult = n;
    this._lastIdx = -1;
    this.draw();
    this.onChange(this._tileCurve());
  }

  _initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const W = this.canvas.offsetWidth  || 220;
    const H = this.canvas.offsetHeight || 64;
    this.canvas.width  = W * dpr;
    this.canvas.height = H * dpr;
    this._W = W; this._H = H; this._dpr = dpr;
  }

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', e => {
      this._painting = true;
      this.canvas.setPointerCapture(e.pointerId);
      this._paint(e);
    });
    this.canvas.addEventListener('pointermove', e => {
      if (this._painting) this._paint(e);
    });
    const stop = () => { this._painting = false; this._lastIdx = -1; };
    this.canvas.addEventListener('pointerup',    stop);
    this.canvas.addEventListener('pointerleave', stop);
  }

  _paint(e) {
    const rect    = this.canvas.getBoundingClientRect();
    const xFrac   = (e.clientX - rect.left) / rect.width;
    const tileLen = Math.floor(this.N / this.mult);
    // Map canvas x → position within the single tile (base curve)
    const xN  = Math.floor(xFrac * tileLen);
    const val = Math.max(-1, Math.min(1, 1 - 2 * (e.clientY - rect.top) / rect.height));
    const prev = this._lastIdx;
    if (prev >= 0 && Math.abs(xN - prev) > 1) {
      const y0 = this._baseCurve[prev], y1 = val;
      const steps = Math.abs(xN - prev);
      for (let s = 0; s <= steps; s++) {
        const t  = s / steps;
        const xi = Math.round(prev + t * (xN - prev));
        if (xi >= 0 && xi < tileLen) this._baseCurve[xi] = y0 + t * (y1 - y0);
      }
    } else if (xN >= 0 && xN < tileLen) {
      this._baseCurve[xN] = val;
    }
    this._lastIdx = xN;
    this.draw();
    this.onChange(this._tileCurve());
  }

  applyPreset(name) {
    this._baseCurve = LFOCurveCanvas.presetCurve(name);
    this.draw();
    this.onChange(this._tileCurve());
  }

  draw() {
    if (!this.canvas) return;
    const { _W: W, _H: H, _dpr: dpr, N } = this;
    const display = this._tileCurve();
    const g = this.canvas.getContext('2d');
    g.save();
    g.scale(dpr, dpr);

    g.clearRect(0, 0, W, H);
    g.fillStyle = '#07070f';
    g.fillRect(0, 0, W, H);

    // Base grid lines
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, H/2); g.lineTo(W, H/2); g.stroke();
    [0.25, 0.5, 0.75].forEach(t => {
      g.beginPath(); g.moveTo(t*W, 0); g.lineTo(t*W, H); g.stroke();
    });

    const accent = this.lfoNum === 1 ? '#a060e0' : '#60a0e0';
    const fill   = this.lfoNum === 1 ? 'rgba(160,96,224,0.13)' : 'rgba(96,160,224,0.13)';

    // Filled area
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const x = i / N * W;
      const y = (1 - display[i]) / 2 * H;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.lineTo(W, H/2); g.lineTo(0, H/2); g.closePath();
    g.fillStyle = fill;
    g.fill();

    // Curve stroke
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const x = i / N * W;
      const y = (1 - display[i]) / 2 * H;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = accent;
    g.lineWidth = 2;
    g.stroke();

    // Tile separator lines (dashed, visible above the curve)
    if (this.mult > 1) {
      g.setLineDash([2, 3]);
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = 1;
      for (let t = 1; t < this.mult; t++) {
        const x = (t / this.mult) * W;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      }
      g.setLineDash([]);
      // ×N label
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.font = `bold 9px monospace`;
      g.textAlign = 'right';
      g.fillText(`\u00d7${this.mult}`, W - 4, 12);
      g.textAlign = 'left';
    }

    g.restore();
  }
}

// ─────────────────────────────────────────────────────────
//  Filter frequency response visualizer
// ─────────────────────────────────────────────────────────
function initFilterViz() {
  const canvas = document.getElementById('filter-viz');
  if (!canvas) return () => {};

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth  || 400;
  const H   = canvas.offsetHeight || 88;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);

  // dB range: +9 dB at top → -48 dB at bottom (57 dB total)
  const DB_TOP = 9, DB_BOT = -48, DB_RANGE = DB_TOP - DB_BOT;
  const dbToY  = db  => H * (1 - (db - DB_BOT) / DB_RANGE);
  const fToX   = f   => Math.log(Math.max(20, f) / 20) / Math.log(1000) * W;

  const N = W;
  const freqs = new Float32Array(N);
  for (let i = 0; i < N; i++) freqs[i] = 20 * Math.pow(1000, i / (N - 1));
  const mag   = new Float32Array(N);
  const phase = new Float32Array(N);

  return function draw() {
    const p = synth.p;
    const dummy = synth.ctx.createBiquadFilter();
    dummy.type            = synth._webFilterType(p.filterType);
    dummy.frequency.value = Math.max(20, p.cutoff);
    dummy.Q.value         = Math.max(0.001, p.resonance);
    dummy.getFrequencyResponse(freqs, mag, phase);
    if (p.filterType === 'lp24') for (let i = 0; i < N; i++) mag[i] *= mag[i];

    // Background
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#06060e';
    g.fillRect(0, 0, W, H);

    // Grid — frequency verticals
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(f => {
      const x = fToX(f);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    });
    // Grid — dB horizontals
    [0, -12, -24].forEach(db => {
      const y = dbToY(db);
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    });
    // 0 dB reference line slightly brighter
    g.strokeStyle = 'rgba(255,255,255,0.1)';
    g.beginPath(); g.moveTo(0, dbToY(0)); g.lineTo(W, dbToY(0)); g.stroke();

    const ac = '#ff783c';

    // Filled area under curve
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const db = 20 * Math.log10(Math.max(1e-5, mag[i]));
      const y  = Math.max(0, Math.min(H, dbToY(db)));
      if (i === 0) g.moveTo(0, y); else g.lineTo(i, y);
    }
    g.lineTo(W, H); g.lineTo(0, H); g.closePath();
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   'rgba(255,120,60,0.28)');
    grad.addColorStop(0.6, 'rgba(255,120,60,0.08)');
    grad.addColorStop(1,   'rgba(255,120,60,0.02)');
    g.fillStyle = grad;
    g.fill();

    // Response curve stroke
    g.beginPath();
    for (let i = 0; i < N; i++) {
      const db = 20 * Math.log10(Math.max(1e-5, mag[i]));
      const y  = Math.max(0, Math.min(H, dbToY(db)));
      if (i === 0) g.moveTo(0, y); else g.lineTo(i, y);
    }
    g.strokeStyle = ac;
    g.lineWidth = 2;
    g.stroke();

    // Cutoff vertical guide
    const cx = fToX(p.cutoff);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, H);
    g.strokeStyle = 'rgba(255,120,60,0.2)';
    g.lineWidth = 1; g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]);

    // Dot on curve at cutoff
    const ci = Math.round(cx / W * (N - 1));
    if (ci >= 0 && ci < N) {
      const db = 20 * Math.log10(Math.max(1e-5, mag[ci]));
      g.beginPath(); g.arc(cx, Math.max(0, Math.min(H, dbToY(db))), 4, 0, Math.PI * 2);
      g.fillStyle = ac; g.fill();
    }

    // Labels — frequency axis
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.font = `${9}px monospace`;
    [[100,'100'],[1000,'1k'],[10000,'10k']].forEach(([f, lbl]) => {
      g.fillText(lbl, fToX(f) + 2, H - 3);
    });
    // dB labels
    [[0,'0dB'],[-24,'-24']].forEach(([db, lbl]) => {
      g.fillText(lbl, W - 26, dbToY(db) - 3);
    });

    // Cutoff frequency label
    const cutLbl = p.cutoff >= 1000 ? `${(p.cutoff/1000).toFixed(1)}k` : `${Math.round(p.cutoff)}Hz`;
    g.fillStyle = 'rgba(255,120,60,0.85)';
    g.font = `bold 9px monospace`;
    g.fillText(cutLbl, Math.min(cx + 4, W - 32), 11);
  };
}

// ─────────────────────────────────────────────────────────
//  UI — sliders
// ─────────────────────────────────────────────────────────
function fmtValue(id, raw) {
  if (id === 'cutoff')         return `${Math.round(raw)} Hz`;
  if (['lfoRate','lfo2Rate'].includes(id))  return `${parseFloat(raw).toFixed(2)} Hz`;
  if (['lfoDepth','lfo2Depth'].includes(id)) return `${Math.round(raw)} Hz`;
  if (id === 'resonance')      return parseFloat(raw).toFixed(1);
  if (id === 'fEnvAmount')     return (raw >= 0 ? '+' : '') + Math.round(raw) + ' Hz';
  if (id === 'pitchEnvAmount') return (raw >= 0 ? '+' : '') + parseFloat(raw).toFixed(1) + ' st';
  if (['drive','oscALevel','oscBLevel','volume',
       'ampSustain','fEnvSustain','fEnvVariation','noiseLevel'].includes(id)) return `${Math.round(raw)}%`;
  if (['ampAttack','ampDecay','ampRelease',
       'fEnvAttack','fEnvDecay','fEnvRelease',
       'pitchEnvAttack','pitchEnvDecay'].includes(id)) return `${Math.round(raw)} ms`;
  if (['oscAOctave','oscBOctave','oscADetune','oscBDetune'].includes(id))
    return (raw > 0 ? '+' : '') + Math.round(raw);
  return raw;
}

// Inverse of toSynthVal — convert synth.p value back to slider raw value
function toSliderVal(id, synthVal) {
  if (id === 'noiseLevel') return (synthVal / 0.25) * 100;
  if (['drive','oscALevel','oscBLevel','volume',
       'ampSustain','fEnvSustain','fEnvVariation'].includes(id)) return synthVal * 100;
  if (['ampAttack','ampDecay','ampRelease',
       'fEnvAttack','fEnvDecay','fEnvRelease',
       'pitchEnvAttack','pitchEnvDecay'].includes(id)) return synthVal * 1000;
  return synthVal;
}

const SLIDER_IDS = [
  'cutoff','resonance','drive',
  'oscAOctave','oscADetune','oscALevel',
  'oscBOctave','oscBDetune','oscBLevel',
  'ampAttack','ampDecay','ampSustain','ampRelease',
  'fEnvAttack','fEnvDecay','fEnvSustain','fEnvRelease','fEnvAmount','fEnvVariation',
  'pitchEnvAmount','pitchEnvAttack','pitchEnvDecay',
  'lfoRate','lfoDepth','lfo2Rate','lfo2Depth',
  'noiseLevel',
  'volume',
];

function toSynthVal(id, raw) {
  if (['drive','oscALevel','oscBLevel','volume'].includes(id)) return raw / 100;
  if (['ampSustain','fEnvSustain','fEnvVariation'].includes(id)) return raw / 100;
  // Noise is broadband so sounds louder than tones at the same gain; scale down by 0.25
  if (id === 'noiseLevel') return (raw / 100) * 0.25;
  if (['ampAttack','ampDecay','ampRelease',
       'fEnvAttack','fEnvDecay','fEnvRelease',
       'pitchEnvAttack','pitchEnvDecay'].includes(id)) return raw / 1000;
  return raw;
}

function animateSlider(id, target) {
  const el = document.getElementById(id); if (!el) return;
  const start = parseFloat(el.value), t0 = Date.now(), dur = 900;
  const tick = () => {
    const p = Math.min((Date.now() - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.value = start + (target - start) * e;
    el.dispatchEvent(new Event('input'));
    if (p < 1) requestAnimationFrame(tick);
  };
  tick();
}

function initSliders() {
  document.querySelectorAll('input[type="range"]').forEach(sl => {
    const vEl = document.getElementById(sl.id + '-v');
    if (vEl) vEl.textContent = fmtValue(sl.id, parseFloat(sl.value));

    sl.addEventListener('input', () => {
      const raw = parseFloat(sl.value);
      if (vEl) vEl.textContent = fmtValue(sl.id, raw);
      const val = toSynthVal(sl.id, raw);
      synth.updateParam(sl.id, val);

      // Sync amp env param object & redraw canvas
      if (['ampAttack','ampDecay','ampSustain','ampRelease'].includes(sl.id)) {
        ampEP.attack  = parseFloat(document.getElementById('ampAttack').value)  / 1000;
        ampEP.decay   = parseFloat(document.getElementById('ampDecay').value)   / 1000;
        ampEP.sustain = parseFloat(document.getElementById('ampSustain').value) / 100;
        ampEP.release = parseFloat(document.getElementById('ampRelease').value) / 1000;
        ampCanvas?.draw();
      }
      // Sync filter env param object & redraw canvas
      if (['fEnvAttack','fEnvDecay','fEnvSustain','fEnvRelease'].includes(sl.id)) {
        fEnvEP.attack  = parseFloat(document.getElementById('fEnvAttack').value)  / 1000;
        fEnvEP.decay   = parseFloat(document.getElementById('fEnvDecay').value)   / 1000;
        fEnvEP.sustain = parseFloat(document.getElementById('fEnvSustain').value) / 100;
        fEnvEP.release = parseFloat(document.getElementById('fEnvRelease').value) / 1000;
        fEnvCanvas?.draw();
      }
      if (['pitchEnvAmount','pitchEnvAttack','pitchEnvDecay'].includes(sl.id)) {
        updatePitchEnvSvg();
      }
      if (['cutoff','resonance'].includes(sl.id)) {
        filterVizDraw?.();
      }
      // Header volume track fill
      if (sl.id === 'volume') {
        const pct = ((raw - parseFloat(sl.min)) / (parseFloat(sl.max) - parseFloat(sl.min))) * 100;
        sl.style.setProperty('--pct', pct.toFixed(1));
      }
    });
    // Initialise volume fill on load
    if (sl.id === 'volume') {
      const raw = parseFloat(sl.value);
      const pct = ((raw - parseFloat(sl.min)) / (parseFloat(sl.max) - parseFloat(sl.min))) * 100;
      sl.style.setProperty('--pct', pct.toFixed(1));
    }
  });
}

// ─────────────────────────────────────────────────────────
//  Envelope auto-generator
// ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────
//  AI Generators
// ─────────────────────────────────────────────────────────
function generateAIFilterSweep() {
  const modes = ['smooth','steps','bounce'];
  const mode  = modes[Math.floor(Math.random()*modes.length)];
  // Interesting filter configs
  const configs = [
    {cutoff:200,  res:18, amt:8000,  dec:150, sus:5 },
    {cutoff:400,  res:12, amt:5000,  dec:300, sus:8 },
    {cutoff:600,  res:20, amt:6000,  dec:80,  sus:3 },
    {cutoff:300,  res:15, amt:9000,  dec:200, sus:2 },
    {cutoff:150,  res:22, amt:12000, dec:400, sus:5 },
    {cutoff:500,  res:10, amt:4000,  dec:500, sus:12},
  ];
  const c = configs[Math.floor(Math.random()*configs.length)];
  animateSlider('cutoff',      c.cutoff);
  animateSlider('resonance',   c.res);
  animateSlider('fEnvAmount',  c.amt);
  animateSlider('fEnvDecay',   c.dec);
  animateSlider('fEnvSustain', c.sus);
  // Set fenv mode + regenerate
  fEnvEP.mode = mode;
  if (mode === 'bounce') {
    fEnvEP.bounceFreq = 1.5 + Math.random()*4;
    fEnvEP.bounceDamp = 2   + Math.random()*6;
  } else if (mode === 'steps') {
    const n = 4 + Math.floor(Math.random()*10);
    fEnvEP.steps = new Float32Array(n);
    let v = 0.98;
    for (let i=0;i<n;i++) { v=Math.max(0.01,v-(0.7/n+Math.random()*0.5/n)); fEnvEP.steps[i]=v; }
  }
  document.querySelectorAll('[data-canvas="fenv"].env-mode-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.mode===mode);
  });
  fEnvCanvas?.draw(); syncFEnvToSynth();
}

function generateAIEnvelopes() {
  const modes = ['smooth','steps','bounce'];
  ampEP.mode   = modes[Math.floor(Math.random()*modes.length)];
  fEnvEP.mode  = modes[Math.floor(Math.random()*modes.length)];
  autoGenEnv(ampEP,  ampCanvas);
  autoGenEnv(fEnvEP, fEnvCanvas);
  // Sync mode button UI
  ['amp','fenv'].forEach(cvs => {
    const ep = cvs==='amp' ? ampEP : fEnvEP;
    document.querySelectorAll(`[data-canvas="${cvs}"].env-mode-btn`).forEach(b=>{
      b.classList.toggle('active', b.dataset.mode===ep.mode);
    });
  });
}

function generateAISoundLayer() {
  const waves = ['sawtooth','square','triangle','sine'];
  const wA = waves[Math.floor(Math.random()*waves.length)];
  const wB = waves[Math.floor(Math.random()*waves.length)];
  const detA = Math.round((Math.random()-0.5)*10);
  const detB = Math.round((Math.random()-0.5)*10);
  const levB = 20 + Math.floor(Math.random()*60);
  const nTypes = ['white','pink','brown','crackle'];
  const nType  = nTypes[Math.floor(Math.random()*nTypes.length)];
  const nLevel = Math.floor(Math.random()*30);
  // Apply OSC waveforms
  synth.updateParam('oscAWave', wA);
  document.querySelectorAll('#oscAWave-sel .wave-btn').forEach(b=>b.classList.toggle('active',b.dataset.wave===wA));
  synth.updateParam('oscBWave', wB);
  document.querySelectorAll('#oscBWave-sel .wave-btn').forEach(b=>b.classList.toggle('active',b.dataset.wave===wB));
  animateSlider('oscADetune', detA);
  animateSlider('oscBDetune', detB);
  animateSlider('oscBLevel',  levB);
  // Apply noise
  synth.updateParam('noiseType', nType);
  document.querySelectorAll('.noise-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===nType));
  animateSlider('noiseLevel', nLevel);
}

function autoGenEnv(ep, canvas) {
  const mode = ep.mode || 'smooth';
  if (mode === 'steps') {
    const n = 4 + Math.floor(Math.random() * 12); // 4–16 steps
    ep.steps = new Float32Array(n);
    let val = 0.98;
    for (let i = 0; i < n; i++) {
      val = Math.max(0.01, val - (0.4/n + Math.random()*(1.4/n)));
      ep.steps[i] = Math.max(0.01, val + (Math.random()-0.5)*0.1);
    }
    ep.steps[n-1] = Math.min(ep.steps[n-1], 0.08);
  } else if (mode === 'bounce') {
    ep.bounceFreq = 1 + Math.random() * 6;
    ep.bounceDamp = 2 + Math.random() * 7;
  } else {
    ep.atkCurve = (Math.random()-0.5) * 1.6;
    ep.decCurve = Math.random() * 1.6 - 0.3;
    ep.relCurve = Math.random() * 1.4 - 0.2;
  }
  canvas?.draw();
  if (canvas === ampCanvas) syncAmpToSynth();
  if (canvas === fEnvCanvas) syncFEnvToSynth();
}

// ─────────────────────────────────────────────────────────
//  Preset system
// ─────────────────────────────────────────────────────────
function getUserPresets() {
  try { return JSON.parse(localStorage.getItem('wobbler-presets') || '[]'); }
  catch (_) { return []; }
}

function getAllPresets() {
  return [...FACTORY_PRESETS, ...getUserPresets()];
}

function savePreset(name) {
  if (!name.trim()) return;
  const users = getUserPresets();
  const idx   = users.findIndex(p => p.name === name);
  const data  = {
    name,
    params: { ...synth.p },
    ampCurves:  { atkCurve: ampEP.atkCurve,  decCurve: ampEP.decCurve,  relCurve: ampEP.relCurve  },
    fEnvCurves: { atkCurve: fEnvEP.atkCurve, decCurve: fEnvEP.decCurve, relCurve: fEnvEP.relCurve },
  };
  if (idx >= 0) users[idx] = data; else users.push(data);
  localStorage.setItem('wobbler-presets', JSON.stringify(users));
  updatePresetSelect(name);
}

function deletePreset(name) {
  const users = getUserPresets().filter(p => p.name !== name);
  localStorage.setItem('wobbler-presets', JSON.stringify(users));
  updatePresetSelect();
}

function applyPreset(presetData) {
  Object.assign(synth.p, presetData.params);

  // Sync env canvas param objects
  ampEP.attack  = synth.p.ampAttack;  ampEP.decay   = synth.p.ampDecay;
  ampEP.sustain = synth.p.ampSustain; ampEP.release = synth.p.ampRelease;
  if (presetData.ampCurves) Object.assign(ampEP, presetData.ampCurves);

  fEnvEP.attack  = synth.p.fEnvAttack;  fEnvEP.decay   = synth.p.fEnvDecay;
  fEnvEP.sustain = synth.p.fEnvSustain; fEnvEP.release = synth.p.fEnvRelease;
  if (presetData.fEnvCurves) Object.assign(fEnvEP, presetData.fEnvCurves);

  // Update all sliders (triggers input → synth.updateParam for live params)
  SLIDER_IDS.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.value = toSliderVal(id, synth.p[id]);
    el.dispatchEvent(new Event('input'));
  });

  // Update waveform buttons
  setActiveWaveBtn('oscAWave-sel', synth.p.oscAWave);
  setActiveWaveBtn('oscBWave-sel', synth.p.oscBWave);
  setActiveWaveBtn('lfoWave-sel',  synth.p.lfoWave);

  // Update filter type buttons
  document.querySelectorAll('#filterType-sel .ftype-btn').forEach((btn, i) => {
    btn.classList.toggle('active', FILTER_TYPES[i]?.id === synth.p.filterType);
  });

  // Redraw canvases
  ampCanvas?.draw();
  fEnvCanvas?.draw();
  updatePitchEnvSvg();
}

function setActiveWaveBtn(containerId, wave) {
  const el = document.getElementById(containerId); if (!el) return;
  el.querySelectorAll('.wave-btn').forEach(btn => btn.classList.toggle('active', btn.title === wave));
}

function updatePresetSelect(selectName) {
  const sel = document.getElementById('preset-select'); if (!sel) return;
  const all = getAllPresets();
  sel.innerHTML = '<option value="">— select preset —</option>';

  const factGroup = document.createElement('optgroup'); factGroup.label = 'Factory';
  const userGroup = document.createElement('optgroup'); userGroup.label = 'Saved';
  let hasUser = false;

  all.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = p.name;
    if (p.name === selectName) opt.selected = true;
    if (p.name.startsWith('★')) factGroup.appendChild(opt);
    else { userGroup.appendChild(opt); hasUser = true; }
  });

  sel.appendChild(factGroup);
  if (hasUser) sel.appendChild(userGroup);
}

// ─────────────────────────────────────────────────────────
//  Pitch ENV simple SVG visualizer
// ─────────────────────────────────────────────────────────
function updatePitchEnvSvg() {
  const el = document.getElementById('penv-path'); if (!el) return;
  const amt   = parseFloat(document.getElementById('pitchEnvAmount')?.value || 0);
  const atkMs = parseFloat(document.getElementById('pitchEnvAttack')?.value || 2);
  const decMs = parseFloat(document.getElementById('pitchEnvDecay')?.value  || 150);
  const W = 120, H = 36, mid = H / 2;
  const peakY = amt >= 0 ? 2 : H - 2;
  const tot   = Math.max(1, atkMs + decMs + 50);
  const ax    = (atkMs / tot) * W;
  const dx    = ax + (decMs / tot) * W;
  el.setAttribute('d', `M0,${mid} L${ax.toFixed(1)},${peakY} L${dx.toFixed(1)},${mid} L${W},${mid}`);
}

// ─────────────────────────────────────────────────────────
//  Piano keyboard builder
// ─────────────────────────────────────────────────────────
const keyElems = new Map();

function whitesBefore(midi) {
  let n = 0;
  for (let m = MIDI_MIN; m < midi; m++)
    if (!SEMITONE[(m - MIDI_MIN) % 12].black) n++;
  return n;
}

function buildPiano() {
  const piano  = document.getElementById('piano');
  const lblRow = document.getElementById('oct-lbl-row');
  piano.innerHTML = lblRow.innerHTML = '';
  let whites = 0;

  for (let m = MIDI_MIN; m <= MIDI_MAX; m++) {
    const s      = SEMITONE[(m - MIDI_MIN) % 12];
    const octNum = Math.floor(m / 12) - 1;

    if (!s.black) {
      const el = document.createElement('div');
      el.className = 'wkey'; el.dataset.midi = m;
      const lbl = document.createElement('span');
      lbl.className = 'klabel';
      lbl.textContent = s.name === 'C' ? `C${octNum}` : s.name;
      el.appendChild(lbl);
      const bind = document.createElement('span');
      bind.className = 'kbind'; bind.dataset.bindMidi = m;
      el.appendChild(bind);
      piano.appendChild(el);
      keyElems.set(m, el); whites++;
    } else {
      const wc = whitesBefore(m);
      const el = document.createElement('div');
      el.className = 'bkey';
      el.style.left = (wc * WHITE_W - BLACK_W / 2) + 'px';
      el.dataset.midi = m;
      const lbl = document.createElement('span');
      lbl.className = 'klabel'; lbl.textContent = s.name;
      el.appendChild(lbl);
      const bind = document.createElement('span');
      bind.className = 'kbind'; bind.dataset.bindMidi = m;
      el.appendChild(bind);
      piano.appendChild(el);
      keyElems.set(m, el);
    }
  }
  piano.style.width = (whites * WHITE_W) + 'px';

  for (let oct = 0; oct <= 4; oct++) {
    const midi = MIDI_MIN + oct * 12;
    const x    = whitesBefore(midi) * WHITE_W;
    const sep  = document.createElement('div');
    sep.className = 'oct-sep'; sep.style.left = x + 'px';
    piano.appendChild(sep);
    const lbl = document.createElement('div');
    lbl.className = 'oct-lbl'; lbl.style.left = (x + 3) + 'px';
    lbl.textContent = `OCT ${Math.floor(midi / 12) - 1}`;
    lblRow.appendChild(lbl);
  }
}

// ─────────────────────────────────────────────────────────
//  Mouse / touch playback
// ─────────────────────────────────────────────────────────
let ptrDown = false;
function kDown(midi) { keyElems.get(midi)?.classList.add('active');    synth.noteOn(midi);  }
function kUp(midi)   { keyElems.get(midi)?.classList.remove('active'); synth.noteOff(midi); }
function midiOf(el)  { const v = parseInt(el?.dataset?.midi,10); return isNaN(v)?null:v; }

document.addEventListener('DOMContentLoaded', () => {
  const piano = document.getElementById('piano');
  piano.addEventListener('mousedown', e => {
    const el = e.target.closest('[data-midi]'); if (!el) return;
    ptrDown = true; kDown(midiOf(el));
  });
  piano.addEventListener('mouseover', e => {
    if (!ptrDown) return;
    const el = e.target.closest('[data-midi]'); if (!el) return;
    keyElems.forEach((elem, midi) => { if (elem.classList.contains('active') && elem !== el) kUp(midi); });
    if (!el.classList.contains('active')) kDown(midiOf(el));
  });
  window.addEventListener('mouseup', () => {
    if (!ptrDown) return; ptrDown = false;
    keyElems.forEach((el, midi) => { if (el.classList.contains('active')) kUp(midi); });
  });
  piano.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-midi]');
      if (el) kDown(midiOf(el));
    }
  }, {passive:false});
  piano.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('[data-midi]');
      if (el) kUp(midiOf(el));
    }
  }, {passive:false});
});

// ─────────────────────────────────────────────────────────
//  Computer keyboard
// ─────────────────────────────────────────────────────────
let activeOctave = 2;
const heldKeys   = new Set();
const W_KEYS = ['a','s','d','f','g','h','j','k'];
const W_SEMI = [0,2,4,5,7,9,11,12];
const B_KEYS = ['w','e','r','t','y','u'];
const B_SEMI = [1,3,6,8,10];

function octBaseMidi() { return MIDI_MIN + activeOctave * 12; }
function kbToMidi(key) {
  const base = octBaseMidi();
  const wi = W_KEYS.indexOf(key);
  if (wi >= 0) { const m = base + W_SEMI[wi]; return m <= MIDI_MAX ? m : null; }
  const bi = B_KEYS.indexOf(key);
  if (bi >= 0 && bi < B_SEMI.length) { const m = base + B_SEMI[bi]; return m <= MIDI_MAX ? m : null; }
  return null;
}

function shiftOctave(d) {
  heldKeys.forEach(k => { const m = kbToMidi(k); if (m !== null) kUp(m); });
  heldKeys.clear();
  activeOctave = Math.max(0, Math.min(3, activeOctave + d));
  updateOctaveDisplay();
}

function updateOctaveDisplay() {
  const base   = octBaseMidi();
  const octNum = Math.floor(base / 12) - 1;
  document.getElementById('oct-display').textContent = `C${octNum}–B${octNum}`;
  document.querySelectorAll('[data-bind-midi]').forEach(el => { el.textContent = ''; });
  W_KEYS.forEach((key, i) => {
    const midi = base + W_SEMI[i]; if (midi > MIDI_MAX) return;
    const el = keyElems.get(midi); if (el) { const b = el.querySelector('.kbind'); if (b) b.textContent = key.toUpperCase(); }
  });
  B_KEYS.forEach((key, i) => {
    if (i >= B_SEMI.length) return;
    const midi = base + B_SEMI[i]; if (midi > MIDI_MAX) return;
    const el = keyElems.get(midi); if (el) { const b = el.querySelector('.kbind'); if (b) b.textContent = key.toUpperCase(); }
  });
  const wrap = document.querySelector('.kb-wrap');
  if (wrap) wrap.scrollTo({left: Math.max(0, whitesBefore(base) * WHITE_W - 40), behavior:'smooth'});
}

document.addEventListener('keydown', e => {
  if (e.repeat || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'z') { shiftOctave(-1); return; }
  if (k === 'x') { shiftOctave(+1); return; }
  if (heldKeys.has(k)) return;
  const midi = kbToMidi(k);
  if (midi !== null) { heldKeys.add(k); kDown(midi); }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (!heldKeys.has(k)) return;
  heldKeys.delete(k);
  const midi = kbToMidi(k);
  if (midi !== null) kUp(midi);
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('oct-down')?.addEventListener('click', () => shiftOctave(-1));
  document.getElementById('oct-up')?.  addEventListener('click', () => shiftOctave(+1));
  document.getElementById('gen-ai')?.  addEventListener('click', () => {
    synth.generateAIPattern();
    const btn = document.getElementById('gen-ai');
    btn.textContent = '⟳ Generating…';
    setTimeout(() => { btn.textContent = '✦ AI Wobble Pattern'; }, 950);
  });
  document.querySelectorAll('#fEnvCurve-sel .curve-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#fEnvCurve-sel .curve-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      synth.p.fEnvCurve = btn.dataset.curve;
    });
  });

  // Enable/disable panel toggles
  document.querySelectorAll('.panel-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.toggle('active');
      btn.closest('.panel')?.classList.toggle('panel-disabled', !isActive);
      synth.updateParam(btn.dataset.param, isActive);
    });
  });

  // Envelope mode buttons
  document.querySelectorAll('.env-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.env-mode-btns').querySelectorAll('.env-mode-btn')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cvs = btn.dataset.canvas;
      const ep  = cvs === 'amp' ? ampEP : fEnvEP;
      ep.mode   = btn.dataset.mode;
      if (cvs === 'amp') { ampCanvas?.draw();  syncAmpToSynth();  }
      else               { fEnvCanvas?.draw(); syncFEnvToSynth(); }
    });
  });

  // Envelope auto-generate buttons
  document.querySelectorAll('.env-auto-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cvs = btn.dataset.canvas;
      autoGenEnv(cvs === 'amp' ? ampEP : fEnvEP, cvs === 'amp' ? ampCanvas : fEnvCanvas);
    });
  });

  // LFO target descriptions
  const LFO_TARGET_DESCS = {
    cutoff:    'Filter cutoff frequency → wobble',
    pitch:     'OSC A + B detune → vibrato (both oscillators)',
    amp:       'Master volume → tremolo',
    res:       'Filter resonance (Q) → resonance sweep',
    noise:     'Noise generator level → texture pulse',
    oscAlevel: 'OSC A volume only → amplitude mod',
    oscBlevel: 'OSC B volume only → amplitude mod',
    lfo2rate:  'LFO 2 rate → speed variation (cross-mod)',
    lfo1rate:  'LFO 1 rate → speed variation (cross-mod)',
  };

  // LFO target buttons
  document.querySelectorAll('.lfo-target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const param  = btn.dataset.lfo;
      const target = btn.dataset.target;
      const lfoNum = param === 'lfoTarget' ? '1' : '2';
      btn.closest('.lfo-target-sel')
         ?.querySelectorAll('.lfo-target-btn')
         .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      synth.updateParam(param, target);
      // Update routing chip in panel header
      const chip = document.getElementById(`lfo${lfoNum}-chip`);
      if (chip) chip.textContent = btn.textContent.trim();
      // Update description line
      const desc = document.getElementById(`lfo${lfoNum}-desc`);
      if (desc) desc.textContent = LFO_TARGET_DESCS[target] || target;
    });
  });

  // Noise type buttons
  document.querySelectorAll('.noise-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.noise-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      synth.updateParam('noiseType', btn.dataset.type);
    });
  });

  // Pitch bend wheel
  {
    const wheel  = document.getElementById('pb-wheel');
    const thumb  = document.getElementById('pb-thumb');
    const valEl  = document.getElementById('pb-val');
    const WHEEL_H = 120, THUMB_H = 22;
    const TRAVEL  = (WHEEL_H - THUMB_H) / 2 - 6;
    let dragging = false, startY = 0, startBend = 0;

    const setThumb = bend => {
      if (!thumb) return;
      const offset = -bend * TRAVEL;
      thumb.style.top = `calc(50% - ${THUMB_H/2}px + ${offset}px)`;
      thumb.style.background = bend === 0 ? '' : 'var(--a-osc,#4a80ff)';
      if (valEl) {
        const cts = Math.round(bend * synth.p.pitchBendRange * 100);
        valEl.textContent = cts === 0 ? '0¢' : (cts > 0 ? `+${cts}¢` : `${cts}¢`);
      }
    };

    const applyBend = bend => { synth.updateParam('pitchBend', bend); setThumb(bend); };
    const release   = ()   => { if (!dragging) return; dragging = false; applyBend(0); };

    wheel?.addEventListener('mousedown', e => {
      e.preventDefault(); dragging = true;
      startY = e.clientY; startBend = synth.p.pitchBend;
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      applyBend(Math.max(-1, Math.min(1, startBend + (startY - e.clientY) / TRAVEL)));
    });
    window.addEventListener('mouseup', release);

    wheel?.addEventListener('touchstart', e => {
      e.preventDefault(); dragging = true;
      startY = e.touches[0].clientY; startBend = synth.p.pitchBend;
    }, {passive:false});
    window.addEventListener('touchmove', e => {
      if (!dragging) return;
      applyBend(Math.max(-1, Math.min(1, startBend + (startY - e.touches[0].clientY) / TRAVEL)));
    }, {passive:false});
    window.addEventListener('touchend', release);

    document.querySelectorAll('.pb-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pb-range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        synth.p.pitchBendRange = parseInt(btn.dataset.range);
        setThumb(synth.p.pitchBend);
      });
    });
  }

  // AI card buttons
  const aiFlash = (btn, label) => {
    const orig = btn.textContent;
    btn.textContent = label; btn.style.opacity='0.6';
    setTimeout(() => { btn.textContent = orig; btn.style.opacity=''; }, 900);
  };
  document.getElementById('ai-wobble-btn')?.addEventListener('click', e => {
    synth.generateAIPattern(); aiFlash(e.target, '✓ Applied!');
  });
  document.getElementById('ai-filter-btn')?.addEventListener('click', e => {
    generateAIFilterSweep(); aiFlash(e.target, '✓ Applied!');
  });
  document.getElementById('ai-env-btn')?.addEventListener('click', e => {
    generateAIEnvelopes(); aiFlash(e.target, '✓ Applied!');
  });
  document.getElementById('ai-layer-btn')?.addEventListener('click', e => {
    generateAISoundLayer(); aiFlash(e.target, '✓ Applied!');
  });

  // Preset bar
  document.getElementById('preset-save-btn')?.addEventListener('click', () => {
    const name = document.getElementById('preset-name')?.value.trim();
    if (!name) { document.getElementById('preset-name')?.focus(); return; }
    savePreset(name);
    const btn = document.getElementById('preset-save-btn');
    btn.textContent = '✓ Saved'; setTimeout(() => { btn.textContent = '💾 Save'; }, 1200);
  });

  document.getElementById('preset-load-btn')?.addEventListener('click', () => {
    const sel = document.getElementById('preset-select');
    if (!sel || sel.value === '') return;
    const preset = getAllPresets()[parseInt(sel.value, 10)];
    if (preset) applyPreset(preset);
  });

  document.getElementById('preset-del-btn')?.addEventListener('click', () => {
    const sel = document.getElementById('preset-select');
    if (!sel || sel.value === '') return;
    const all = getAllPresets();
    const preset = all[parseInt(sel.value, 10)];
    if (!preset || preset.name.startsWith('★')) return; // can't delete factory presets
    if (confirm(`Delete "${preset.name}"?`)) deletePreset(preset.name);
  });
});

document.addEventListener('pointerdown', () => {
  if (synth.ctx.state === 'suspended') synth.ctx.resume();
}, {once:true});

// ─────────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────────
const synth = new WobblerSynth();

// ── FIX: use updateParam so live voices get waveform change ──
buildWaveSel('oscAWave-sel', WAVE_TYPES, synth.p.oscAWave, w => synth.updateParam('oscAWave', w));
buildWaveSel('oscBWave-sel', WAVE_TYPES, synth.p.oscBWave, w => synth.updateParam('oscBWave', w));

let filterVizDraw = null;
buildFilterTypeSel();
buildPiano();
initSliders();
updateOctaveDisplay();
updatePitchEnvSvg();

// Interactive envelope canvases (created after DOM ready so sizes are available)
let ampCanvas = null, fEnvCanvas = null;
window.addEventListener('load', () => {
  ampCanvas  = new EnvCanvas('amp-env-canvas', ampEP,  '#22b8a0', () => syncAmpToSynth());
  fEnvCanvas = new EnvCanvas('fenv-canvas',    fEnvEP, '#e09020', () => syncFEnvToSynth());
  filterVizDraw = initFilterViz();
  filterVizDraw();

  // LFO curve editors
  const lfoCurve1 = new LFOCurveCanvas('lfo1-curve', 1, c => synth.updateParam('lfoCustomCurve',  c));
  const lfoCurve2 = new LFOCurveCanvas('lfo2-curve', 2, c => synth.updateParam('lfo2CustomCurve', c));

  // Preset buttons
  document.querySelectorAll('.lfo-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.lfo === '1' ? lfoCurve1 : lfoCurve2;
      target.applyPreset(btn.dataset.preset);
    });
  });

  // MULT (cycle multiplier) buttons
  document.querySelectorAll('.lfo-mult-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const curve = btn.dataset.lfo === '1' ? lfoCurve1 : lfoCurve2;
      btn.closest('.lfo-mult-row')
         ?.querySelectorAll('.lfo-mult-btn')
         .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      curve.setMult(parseInt(btn.dataset.mult));
    });
  });

  updatePresetSelect();
});
