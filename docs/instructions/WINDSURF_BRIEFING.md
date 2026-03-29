# WINDSURF BRIEFING — WOBBLER INTEGRATION
*Für Claude Sonnet in Windsurf*

---

## DEINE AUFGABE

Du integrierst die Audio-Engine aus einem separaten Synthesizer-Projekt
(Voice Module) in den Wobbler Web Prototype. Das Ergebnis ist eine neue,
vollständige Version des Wobbler Web Prototype mit:

1. Neuer OSC Engine (OSC1 + OSC2 + Sub + TZFM)
2. Neuer LFO Engine (Breakpoint-Kurven statt TWE)
3. Analyzer (Spectrogram + Oscilloscope)
4. AI Sound Generation Interface (Claude API)
5. Preset System (JSON, localStorage)

---

## REPOSITORIES & DATEIEN

**Wobbler Repo (Ziel):**
  https://github.com/timratig1976/wobbler
  Arbeitsverzeichnis: web-prototype/

**Wichtigste Dateien im Wobbler:**
  web-prototype/js/dsp.js           ← WobblerVoice + WobblerSynth + Sequencer
  web-prototype/js/ui-master.js     ← Master UI, Sequencer UI, Mixer
  web-prototype/js/ui-voice.js      ← Voice Panels
  web-prototype/js/ui-sections.js   ← Section Builders
  web-prototype/js/ui-widgets.js    ← Knob, Slider Widgets
  web-prototype/js/storage.js       ← Auto-Save localStorage
  web-prototype/js/main.js          ← Entry Point
  web-prototype/index.html          ← HTML Layout

**Neue Dateien die du erstellst:**
  web-prototype/js/osc-engine.js    ← buildOscChain + alle OSC-Funktionen
  web-prototype/js/lfo-engine.js    ← tickAllLFOs + Breakpoint-System
  web-prototype/js/lfo-presets.js   ← 60+ Kurven-Library
  web-prototype/js/lfo-canvas.js    ← Drawable Canvas-Editor
  web-prototype/js/analyzer.js      ← Spectrogram + Oscilloscope
  web-prototype/js/ai-interface.js  ← Claude API + Preset-Loader
  web-prototype/js/presets.js       ← Preset Save/Load/Export

---

## SCHRITT 1: OSC ENGINE ERSETZEN

### Was im Wobbler entfernt wird (aus WobblerVoice constructor in dsp.js)

Entferne diese Nodes und alles was sie benutzt:
  this._mainOsc, this._mainOscG, this._mainUniPanner
  this._pulseOsc, this._pulseOscG, this._pulseUniPann
  this._ssOscBank, this._ssG  (Supersaw)
  this._unisonExtraOscs  (7 extra Unison Oscs)
  this.tweMain, this.tweBody, this.tweStrikeOsc, this.tweTailOsc
  this._tweAuxOscs

Entferne diese Methoden aus WobblerVoice:
  _tickTWE()
  _tweCalcRate()
  _tweConnectTo()
  addTweAux(), removeTweAux()
  Alles mit twe. Prefix

Entferne aus p (Parameter-Objekt):
  p.twe  (das gesamte TWE-Konfigurationsobjekt)
  p.lfos[].waveform  (wird durch p.lfos[].points ersetzt)

### Was BLEIBT vom Wobbler (nicht anfassen!)
  this.filter, this.filterWet, this.filterDry
  this.envGain, this.outputGain, this.panner
  this._distPre, this._distNode, this._distTone, this._distPost, this._distWet, this._distDry
  this._tremoloGain
  this._eqLow, this._eqMid, this._eqHigh
  this._rvbConv, this._rvbWet, this._dlyNode, this._dlyWet, this._dlyFeed
  this.analyser
  this._envTracker (ADSR tracker — sehr saubere Implementierung, behalten)
  p.adsr, p.filter, p.dist, p.eq, p.fx, p.noise, p.volume, p.pan

### Neue OSC Engine (osc-engine.js)

Erstelle web-prototype/js/osc-engine.js mit folgenden Funktionen.
Diese Funktionen sind aus dem Voice Module portiert — hier sind die
exakten Implementierungen:

```javascript
// ─── KONSTANTEN ───────────────────────────────────────────────
const OSC_DETUNE_SPREAD_MAX = 100; // cents

// ─── buildOscChain ────────────────────────────────────────────
// Baut OSC1 + OSC2 + Sub + Noise und verbindet sie zu targetGain.
// Gibt zurück: { oscs, subOscNode, osc1Envs, osc2Envs, subEnv }
//
// WICHTIG: targetGain = WobblerVoice._distPre (Eingang der Dist-Chain)
//
function buildOscChain(ctx, freq, t, targetGain, params) {
  // params = {
  //   osc1: { wave, oct, semi, det, cents, vol, voices, spread, width,
  //           ampA, ampD, ampS, ampR, modTarget, modDepth, lfoPitch,
  //           customWave },  // PeriodicWave oder null
  //   osc2: { wave, oct, semi, det, cents, vol, voices, spread, width,
  //           ampA, ampD, ampS, ampR, modTarget, modDepth, lfoPitch,
  //           customWave },
  //   sub:  { wave, oct, cents, vol, ampA, ampD, ampS, ampR, lfoPitch },
  //   noise: { vol, type, thruFilter },
  //   osc1Active, osc2Active, subActive,
  //   lfoGain_pitch,  // AudioNode oder null — für pitch LFO connects
  //   osc1LfoPitch,   // bool
  //   osc2LfoPitch,   // bool
  //   subLfoPitch,    // bool
  // }

  const oscs = [];
  const osc1Envs = [];
  const osc2Envs = [];
  let osc2nodes_ref = null;

  // Helper: volGain → envGain → [StereoPanner] → targetGain
  const makeVoiceChain = (voiceIdx, numVoices, volValue, width) => {
    const volGain = ctx.createGain();
    volGain.gain.value = volValue;
    const envGain = ctx.createGain();
    envGain.gain.value = 1;
    volGain.connect(envGain);
    if (numVoices > 1 && width > 0) {
      const panPos = ((voiceIdx / (numVoices - 1)) - 0.5) * 2 * width;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, panPos));
        envGain.connect(p);
        p.connect(targetGain);
      } else {
        envGain.connect(targetGain);
      }
    } else {
      envGain.connect(targetGain);
    }
    return { volGain, envGain };
  };

  // ── OSC 1 ──────────────────────────────────────────────────
  const p1 = params.osc1;
  const numV1 = params.osc1Active !== false ? Math.max(1, p1.voices || 1) : 0;
  const width1 = (p1.width || 80) / 100;
  const osc1nodes = [];

  for (let v = 0; v < numV1; v++) {
    const spreadCt = numV1 === 1 ? 0
      : ((v / (numV1 - 1)) - 0.5) * (p1.spread || 0);
    const o = ctx.createOscillator();
    if (p1.customWave) o.setPeriodicWave(p1.customWave);
    else o.type = p1.wave || 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = (p1.oct || 0) * 1200 + (p1.semi || 0) * 100
                   + (p1.det || 0) + (p1.cents || 0) + spreadCt;
    const { volGain, envGain } = makeVoiceChain(
      v, numV1, (p1.vol || 1) / Math.sqrt(numV1), width1
    );
    o.connect(volGain);
    if (params.lfoGain_pitch && params.osc1LfoPitch)
      params.lfoGain_pitch.connect(o.frequency);
    o.start(t);
    oscs.push(o);
    osc1nodes.push({ osc: o, gain: volGain, envGain });
    osc1Envs.push(envGain);
  }

  // ── OSC 2 ──────────────────────────────────────────────────
  let osc2mainNode = null, osc2mainGain = null;
  const osc2nodes = [];

  if (params.osc2Active && p1 && params.osc2 &&
      params.osc2.wave && params.osc2.wave !== 'off') {
    const p2 = params.osc2;
    const numV2 = Math.max(1, p2.voices || 1);
    const width2 = (p2.width || 80) / 100;
    osc2nodes_ref = osc2nodes;

    for (let v = 0; v < numV2; v++) {
      const spreadCt = numV2 === 1 ? 0
        : ((v / (numV2 - 1)) - 0.5) * (p2.spread || 0);
      const o2 = ctx.createOscillator();
      if (p2.customWave) o2.setPeriodicWave(p2.customWave);
      else o2.type = p2.wave || 'sine';
      o2.frequency.value = freq;
      o2.detune.value = (p2.oct || 0) * 1200 + (p2.semi || 0) * 100
                      + (p2.det || 0) + (p2.cents || 0) + spreadCt;
      const { volGain: g2, envGain: eg2 } = makeVoiceChain(
        v, numV2, (p2.vol || 0.5) / Math.sqrt(numV2), width2
      );
      o2.connect(g2);
      if (params.lfoGain_pitch && params.osc2LfoPitch)
        params.lfoGain_pitch.connect(o2.frequency);
      o2.start(t);
      oscs.push(o2);
      osc2nodes.push({ osc: o2, gain: g2, envGain: eg2, voiceIdx: v });
      osc2Envs.push(eg2);
      if (v === 0) { osc2mainNode = o2; osc2mainGain = g2; }
    }

    // TZFM Modulation
    const tzDepth = params.osc2.modDepth || 0;
    const modTarget = params.osc1?.modTarget || 'none';
    if (modTarget !== 'none' && osc1nodes.length && tzDepth > 0 && osc2mainNode) {
      const tzGain = ctx.createGain();
      tzGain.gain.value = tzDepth * freq; // pitch-invariant TZFM

      if (modTarget === 'osc2tzfm') {
        osc1nodes.forEach(({ osc }) => osc.connect(tzGain));
        tzGain.connect(osc2mainNode.frequency);
      } else if (modTarget === 'osc2am') {
        const dc = ctx.createConstantSource(); dc.offset.value = 1; dc.start();
        const amG = ctx.createGain(); amG.gain.value = tzDepth * 0.5;
        dc.connect(osc2mainGain.gain);
        osc1nodes.forEach(({ osc }) => { osc.connect(amG); amG.connect(osc2mainGain.gain); });
      }
    }

    const osc2ModTarget = params.osc2?.modTarget || 'none';
    if (osc2ModTarget === 'osc1tzfm' && (params.osc2?.modDepth || 0) > 0 && osc2mainNode) {
      const tzG2 = ctx.createGain();
      tzG2.gain.value = (params.osc2.modDepth || 0) * freq;
      osc2mainNode.connect(tzG2);
      osc1nodes.forEach(({ osc }) => tzG2.connect(osc.frequency));
    }
  }

  // ── SUB ──────────────────────────────────────────────────
  let subOscNode = null, subEnvGain = null;
  if (params.subActive && (params.sub?.vol || 0) > 0) {
    subOscNode = ctx.createOscillator();
    subOscNode.type = params.sub.wave || 'sine';
    subOscNode.frequency.value = freq;
    subOscNode.detune.value = (params.sub.oct ?? -2) * 1200 + (params.sub.cents || 0);
    const sg = ctx.createGain(); sg.gain.value = params.sub.vol || 0.6;
    subEnvGain = ctx.createGain(); subEnvGain.gain.value = 1;
    subOscNode.connect(sg); sg.connect(subEnvGain); subEnvGain.connect(targetGain);
    if (params.lfoGain_pitch && params.subLfoPitch)
      params.lfoGain_pitch.connect(subOscNode.frequency);
    subOscNode.start(t);
  }

  return { oscs, subOscNode, osc1Envs, osc2Envs, subEnv: subEnvGain };
}

// ─── applyOscEnvs ─────────────────────────────────────────────
// Formt die per-OSC envGain Nodes mit ADSR.
// Aufruf: direkt nach buildOscChain im noteOn.
function applyOscEnvs(t, osc1Envs, osc2Envs, subEnv, params) {
  const applyEnv = (envNode, A_ms, D_ms, S_lin) => {
    if (!envNode) return;
    const tA = Math.max(0.001, A_ms / 1000);
    const tD = Math.max(0.005, D_ms / 1000);
    envNode.gain.cancelScheduledValues(t);
    envNode.gain.setValueAtTime(0, t);
    envNode.gain.linearRampToValueAtTime(1, t + tA);
    envNode.gain.setTargetAtTime(Math.max(0, S_lin), t + tA, tD * 0.4);
  };
  if (osc1Envs?.length) osc1Envs.forEach(e =>
    applyEnv(e, params.osc1.ampA || 5, params.osc1.ampD || 150, params.osc1.ampS ?? 0.8));
  if (osc2Envs?.length) osc2Envs.forEach(e =>
    applyEnv(e, params.osc2.ampA || 5, params.osc2.ampD || 150, params.osc2.ampS ?? 0.8));
  if (subEnv)
    applyEnv(subEnv, params.sub.ampA || 2, params.sub.ampD || 80, params.sub.ampS ?? 0.9);
}

// ─── releaseOscEnvs ───────────────────────────────────────────
function releaseOscEnvs(t, osc1Envs, osc2Envs, subEnv, params) {
  const relEnv = (envNode, R_ms) => {
    if (!envNode) return;
    try {
      envNode.gain.cancelScheduledValues(t);
      envNode.gain.setTargetAtTime(0, t, Math.max(0.01, R_ms / 1000) * 0.4);
    } catch (e) {}
  };
  [...(osc1Envs || [])].forEach(e => relEnv(e, params.osc1.ampR || 100));
  [...(osc2Envs || [])].forEach(e => relEnv(e, params.osc2.ampR || 100));
  if (subEnv) relEnv(subEnv, params.sub.ampR || 60);
}
```

### WobblerVoice.noteOn — Integration

Ersetze den OSC-Block in WobblerVoice.noteOn() durch buildOscChain:

```javascript
// In WobblerVoice.noteOn(freq, velocity):

const oscParams = {
  osc1: {
    wave: this.p.osc.waveform,
    oct:  this.p.osc.pitch ? Math.round(this.p.osc.pitch / 12) : 0,
    semi: 0,
    det:  0,
    cents: this.p.osc.cent || 0,
    vol:  this.p.osc.volume || 0.8,
    voices: this.p.osc.unison || 1,
    spread: this.p.osc.unisonDetune || 20,
    width:  this.p.osc.spread ? this.p.osc.spread * 100 : 80,
    ampA: this.p.adsr.attack * 1000,
    ampD: this.p.adsr.decay * 1000,
    ampS: this.p.adsr.sustain,
    ampR: this.p.adsr.release * 1000,
    modTarget: this.p.osc1ModTarget || 'none',
    modDepth:  this.p.osc1ModDepth  || 0,
    lfoPitch:  this.p.osc1LfoPitch  || false,
  },
  osc2: {
    wave:   this.p.osc2?.waveform || 'sine',
    oct:    this.p.osc2?.oct || 0,
    semi:   this.p.osc2?.semi || 0,
    det:    this.p.osc2?.detune || 7,
    cents:  this.p.osc2?.cents || 0,
    vol:    this.p.osc2?.volume || 0.5,
    voices: this.p.osc2?.unison || 1,
    spread: this.p.osc2?.unisonDetune || 10,
    width:  80,
    ampA: this.p.adsr.attack * 1000,
    ampD: this.p.adsr.decay * 1000,
    ampS: this.p.adsr.sustain,
    ampR: this.p.adsr.release * 1000,
    modTarget: this.p.osc2ModTarget || 'none',
    modDepth:  this.p.osc2ModDepth  || 0,
    lfoPitch:  false,
  },
  sub: {
    wave:  this.p.sub?.waveform || 'sine',
    oct:   this.p.sub?.oct ?? -2,
    cents: this.p.sub?.cents || 0,
    vol:   this.p.sub?.volume || 0.6,
    ampA: 2, ampD: 80, ampS: 0.9, ampR: 60,
    lfoPitch: false,
  },
  noise: { vol: this.p.noise.volume || 0, type: this.p.noise.type || 'white' },
  osc1Active: this.p.osc1Active !== false,
  osc2Active: this.p.osc2Active === true,
  subActive:  this.p.subActive  === true,
  lfoGain_pitch: this._lfoGainPitch || null,
  osc1LfoPitch:  this.p.osc1LfoPitch || false,
  osc2LfoPitch:  false,
  subLfoPitch:   false,
};

// Target = this._distPre (Eingang der Dist-Chain des Wobblers)
const ctx = this.ctx;
const t   = ctx.currentTime;
const { oscs, subOscNode, osc1Envs, osc2Envs, subEnv } =
  buildOscChain(ctx, freq, t, this._distPre, oscParams);

applyOscEnvs(t, osc1Envs, osc2Envs, subEnv, oscParams);

// Store für noteOff
this._activeOscs    = oscs;
this._activeSubOsc  = subOscNode;
this._activeOsc1Envs = osc1Envs;
this._activeOsc2Envs = osc2Envs;
this._activeSubEnv   = subEnv;
```

### Neue Parameter-Defaults in WobblerVoice.p

Ergänze p in WobblerVoice constructor:

```javascript
p.osc1Active = true;
p.osc2Active = false;
p.subActive  = false;
p.osc1ModTarget = 'none';  // none / osc2tzfm / osc2am
p.osc1ModDepth  = 0.5;
p.osc2ModTarget = 'none';  // none / osc1tzfm / osc1am
p.osc2ModDepth  = 0.5;
p.osc1LfoPitch  = false;
p.osc2 = {
  waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0,
  volume: 0.5, unison: 1, unisonDetune: 10,
};
p.sub = {
  waveform: 'sine', oct: -2, cents: 0, volume: 0.6,
};
```

---

## SCHRITT 2: LFO ENGINE (TWE ERSETZEN)

### Neue Datei: web-prototype/js/lfo-engine.js

```javascript
const LFO_POINTS = 512; // Auflösung der Breakpoint-Kurve

// ─── bpBake ───────────────────────────────────────────────────
// Interpoliert Breakpoints zu einem 512-Punkte Float32Array.
// tension: 0=linear, 1=ease-out, -1=ease-in
function bpBake(breakpoints) {
  const pts = [...breakpoints].sort((a, b) => a.x - b.x);
  const out = new Float32Array(LFO_POINTS);
  for (let i = 0; i < LFO_POINTS; i++) {
    const nx = i / (LFO_POINTS - 1);
    // Find segment
    let seg = pts.length - 2;
    for (let j = 0; j < pts.length - 1; j++) {
      if (nx <= pts[j + 1].x) { seg = j; break; }
    }
    const p0 = pts[seg], p1 = pts[seg + 1];
    if (p0.hard) { out[i] = p0.y; continue; }
    const t = p1.x === p0.x ? 0 : (nx - p0.x) / (p1.x - p0.x);
    const tension = p0.tension || 0;
    let tEased = t;
    if (tension > 0)  tEased = 1 - Math.pow(1 - t, 1 + tension * 3);
    if (tension < 0)  tEased = Math.pow(t, 1 - tension * 3);
    out[i] = p0.y + (p1.y - p0.y) * tEased;
  }
  return out;
}

// ─── LFOEngine ────────────────────────────────────────────────
// Pro WobblerVoice eine LFOEngine-Instanz.
// Verwaltet 5 parallele LFO-Slots mit Breakpoint-Kurven.
class LFOEngine {
  constructor(voice) {
    this.voice = voice;  // WobblerVoice reference
    this.timer = null;
    this.playing = false;
    this.bpm = 120;

    // 5 LFO Slots
    this.slots = Array.from({ length: 5 }, (_, i) => ({
      points:     bpBake([{ x:0, y:0.5, hard:false }, { x:1, y:0.5, hard:false }]),
      breakpoints: [{ x:0, y:0.5, hard:false }, { x:1, y:0.5, hard:false }],
      bars:   2,
      mult:   1.333,   // ×2D default
      target: i === 0 ? 'cutoff' : 'none',
      depth:  i === 0 ? 0.6 : 0,
      offset: 0,       // Phase-Offset (0..1) für Call & Response
      mode:   'normal', // normal / inverse / divide2 / divide3
      phase:  0,
      enabled: i < 2,
    }));
  }

  setSlotBreakpoints(slotIdx, breakpoints) {
    this.slots[slotIdx].breakpoints = breakpoints;
    this.slots[slotIdx].points = bpBake(breakpoints);
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    this.slots.forEach(s => { s.phase = s.offset; });
    this.playing = true;
    this.timer = setInterval(() => this._tick(), 16);
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  resetPhases() {
    // Aufruf bei noteOn für sauberen Phase-Reset (Trigger-Mode)
    this.slots.forEach(s => { s.phase = s.offset; });
  }

  _tick() {
    if (!this.playing) return;
    const v = this.voice;
    const ctx = v.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const barDur = 4 * 60 / this.bpm;

    this.slots.forEach(slot => {
      if (!slot.enabled || slot.target === 'none' || slot.depth < 0.01) return;

      const cycleDur = slot.bars * barDur;
      const advance  = 0.016 / cycleDur;

      // Phase-Modus
      let phase = slot.phase;
      if (slot.mode === 'inverse') phase = (phase + 0.5) % 1;

      slot.phase = (slot.phase + advance) % 1;

      const scaledPos = (phase * slot.mult) % 1;
      const idx = Math.min(LFO_POINTS - 1, Math.floor(scaledPos * LFO_POINTS));
      const val = slot.points[idx]; // 0..1

      this._applyValue(slot.target, val, slot.depth, t);
    });
  }

  _applyValue(target, val, depth, t) {
    const v = this.voice;
    const ctx = v.ctx;

    switch (target) {
      case 'cutoff': {
        const cutoff = v.p.filter.cutoff;
        // Log-Scale Sweep (identisch zum Voice Module)
        const lo = Math.max(20, cutoff * (1 - depth * 0.9));
        const hi = cutoff + depth * (18000 - cutoff);
        const hz = lo * Math.pow(Math.max(1, hi / lo), val);
        v.filter.frequency.setTargetAtTime(Math.max(20, hz), t, 0.006);
        break;
      }
      case 'resonance': {
        const q = v.p.filter.resonance * (1 + val * depth * 3);
        v.filter.Q.setTargetAtTime(Math.max(0.1, q), t, 0.01);
        break;
      }
      case 'pitch': {
        const cents = (val - 0.5) * 2 * depth * 100;
        if (v._activeOscs) {
          v._activeOscs.forEach(o => {
            try { o.detune.setTargetAtTime(cents, t, 0.005); } catch (e) {}
          });
        }
        break;
      }
      case 'amp':
      case 'tremolo': {
        const trem = 1 - depth * (1 - val) * 0.8;
        if (v._tremoloGain)
          v._tremoloGain.gain.setTargetAtTime(Math.max(0, trem), t, 0.01);
        break;
      }
      case 'drive': {
        const drv = Math.max(1, (v.p.dist.drive || 0.3) * (0.3 + val * 1.4));
        if (v._distPre)
          v._distPre.gain.setTargetAtTime(drv, t, 0.008);
        break;
      }
    }
  }
}
```

### Integration in WobblerVoice

Im WobblerVoice constructor (nach allen Node-Definitionen):
```javascript
this.lfoEngine = new LFOEngine(this);
```

Im WobblerVoice.noteOn():
```javascript
// Phase-Reset bei noteOn (Trigger-Mode)
this.lfoEngine.resetPhases();
if (!this.lfoEngine.playing) this.lfoEngine.start();
```

Im WobblerSynth.setBpm():
```javascript
this.voices.forEach(v => { v.lfoEngine.bpm = bpm; });
```

---

## SCHRITT 3: LFO PRESETS

### Neue Datei: web-prototype/js/lfo-presets.js

Erstelle diese Datei mit der vollständigen Kurven-Library.
Die Breakpoints folgen dem Format: `{ x: 0..1, y: 0..1, hard: bool, tension: -1..1 }`

```javascript
// tension: 0=linear, 1=ease-out (konvex), -1=ease-in (konkav)
// hard: true = sofortiger Sprung, keine Interpolation
const mk = (x, y, hard = false, tension = 0) => ({ x, y, hard, tension });

const LFO_PRESET_LIBRARY = {

  // CLASSIC WAVEFORMS
  sine:       [mk(0,.5), mk(.25,1), mk(.5,.5), mk(.75,0), mk(1,.5)],
  sawup:      [mk(0,0,true), mk(.99,1,true), mk(1,0,true)],
  sawdn:      [mk(0,1,true), mk(.99,0,true), mk(1,1,true)],
  square:     [mk(0,1,true), mk(.5,1,true), mk(.5,0,true), mk(1,0,true)],
  triangle:   [mk(0,0), mk(.5,1), mk(1,0)],

  // DnB WOBBLE CLASSICS
  dnbsaw:     [mk(0,0,true), mk(.02,1,false,1), mk(.48,.05,false,1),
               mk(.5,0,true), mk(.52,1,false,1), mk(.98,.05,false,1), mk(1,0,true)],
  wubwub:     [mk(0,0,true), mk(.02,1,false,1), mk(.5,0,true),
               mk(.52,1,false,1), mk(1,.1,false,1)],
  triplet:    [mk(0,0), mk(.17,1,false,-1), mk(.33,0),
               mk(.5,1,false,-1), mk(.67,0), mk(.83,1,false,-1), mk(1,0)],
  acid:       [mk(0,0,true), mk(.01,1,false,1), mk(.3,.4,false,1),
               mk(.7,.1,false,1), mk(1,0)],
  fastsaw:    [mk(0,0,true), mk(.49,1,true), mk(.5,0,true), mk(.99,1,true), mk(1,0,true)],
  rubber:     [mk(0,1,false,1), mk(.1,0,false,-1), mk(.6,.7,false,1), mk(1,1)],
  dnbpump:    [mk(0,0,true), mk(.01,1,true), mk(.24,0,true), mk(.25,0,true),
               mk(.26,1,true), mk(.49,0,true), mk(.5,0,true), mk(.51,1,true),
               mk(.74,0,true), mk(.75,0,true), mk(.76,1,true), mk(.99,0,true), mk(1,0,true)],

  // NEURO
  neurozap:   [mk(0,0,true), mk(.01,1,true), mk(.04,.7,true), mk(.1,.2,true),
               mk(.15,.6,true), mk(.22,.1,true), mk(.5,0,true), mk(.51,1,true),
               mk(.55,.5,true), mk(.65,.1,true), mk(1,0,true)],
  neuroglitch:[mk(0,.8,true), mk(.07,.1,true), mk(.14,.95,true), mk(.2,.3,true),
               mk(.28,1,true), mk(.35,.15,true), mk(.42,.7,true), mk(.5,.05,true),
               mk(.57,.85,true), mk(.65,.2,true), mk(.72,.6,true), mk(.85,.1,true), mk(1,.4,true)],
  neuro:      [mk(0,.8,true), mk(.1,.1,true), mk(.2,.9,true), mk(.35,.2,true),
               mk(.5,1,true), mk(.65,.1,true), mk(.8,.7,true), mk(1,.3,true)],

  // LIQUID
  liquid:     [mk(0,.3), mk(.25,.8,false,-1), mk(.5,1,false,1), mk(.75,.6,false,1), mk(1,.3)],
  breathe:    [mk(0,.1,false,-1), mk(.4,.05,false,-1), mk(.7,1,false,1),
               mk(.9,.85,false,1), mk(1,.1,false,1)],
  flow:       [mk(0,.5), mk(.35,1,false,1), mk(.55,.6,false,1),
               mk(.7,.3,false,-1), mk(1,.5)],
  halftime:   [mk(0,.1,false,-1), mk(.35,.05,false,-1), mk(.65,1,false,1),
               mk(.88,.75,false,1), mk(1,.1,false,1)],

  // STEPS / SEQUENCER
  stair4:     [mk(0,.1,true), mk(.25,.1,true), mk(.25,.45,true), mk(.5,.45,true),
               mk(.5,.75,true), mk(.75,.75,true), mk(.75,1,true), mk(1,1,true)],
  stair4dn:   [mk(0,1,true), mk(.25,1,true), mk(.25,.7,true), mk(.5,.7,true),
               mk(.5,.35,true), mk(.75,.35,true), mk(.75,.05,true), mk(1,.05,true)],
  stairirr:   [mk(0,.8,true), mk(.12,.8,true), mk(.12,.2,true), mk(.25,.2,true),
               mk(.25,1,true), mk(.4,1,true), mk(.4,.45,true), mk(.6,.45,true),
               mk(.6,.9,true), mk(.75,.9,true), mk(.75,.1,true), mk(1,.1,true)],
  step4:      [mk(0,1,true), mk(.25,1,true), mk(.25,.3,true), mk(.5,.3,true),
               mk(.5,.8,true), mk(.75,.8,true), mk(.75,.1,true), mk(1,.1,true)],

  // FILTER SHAPES
  pluck:      [mk(0,0,true), mk(.02,1,false,1), mk(.25,.3,false,1), mk(.6,.05), mk(1,0)],
  gate:       [mk(0,1,true), mk(.5,1,true), mk(.5,0,true), mk(.75,0,true), mk(.75,1,true), mk(1,1,true)],
  sidechain:  [mk(0,0,true), mk(0,0,false,-1), mk(.35,.7,false,-1), mk(.7,.95,false,-1), mk(1,1)],
  wah:        [mk(0,.1), mk(.3,.9,false,-1), mk(.6,.2,false,1), mk(1,.1)],

  // MISC
  bounce:     [mk(0,1,false,1), mk(.15,0,false,-1), mk(.35,.55,false,1),
               mk(.5,0,false,-1), mk(.65,.28,false,1), mk(.78,0,false,-1), mk(1,0)],
  expup:      [mk(0,0,false,-1), mk(.5,.05,false,-1), mk(.8,.4,false,-1), mk(1,1,false,-1)],
  expdown:    [mk(0,1,false,1), mk(.2,.6,false,1), mk(.5,.2,false,1), mk(.8,.04,false,1), mk(1,0)],
  shark:      [mk(0,0,true), mk(.01,1,true), mk(.25,.6,false,1), mk(.6,.15,false,1), mk(1,0,false,1)],
};

function loadLFOPreset(slotIdx, presetName, lfoEngine) {
  const pts = LFO_PRESET_LIBRARY[presetName];
  if (!pts) return;
  lfoEngine.setSlotBreakpoints(slotIdx, pts);
}
```

---

## SCHRITT 4: ANALYZER

### Neue Datei: web-prototype/js/analyzer.js

```javascript
class Analyzer {
  constructor(analyserNode, canvas) {
    this.analyser = analyserNode;
    this.canvas   = canvas;
    this.mode     = 'oscilloscope'; // 'oscilloscope' | 'spectrogram'
    this.running  = false;
    this._rafId   = null;
    this._spectroBuffer = null; // für Spectrogram History
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  setMode(mode) { this.mode = mode; }

  _loop() {
    if (!this.running) return;
    this.mode === 'spectrogram' ? this._drawSpectrogram() : this._drawOscilloscope();
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _drawOscilloscope() {
    const cv = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width  = cv.offsetWidth  * dpr;
    const H = cv.height = cv.offsetHeight * dpr;
    const c = cv.getContext('2d');
    c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
    if (!this.analyser) return;

    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);

    // Zero-crossing sync für stabiles Bild
    let start = 0;
    for (let i = 1; i < buf.length / 2; i++) {
      if (buf[i - 1] < 128 && buf[i] >= 128) { start = i; break; }
    }

    c.beginPath(); c.strokeStyle = '#00e09a'; c.lineWidth = 1.5;
    const slice = W / (buf.length / 2);
    for (let i = 0; i < buf.length / 2; i++) {
      const x = i * slice;
      const y = ((buf[start + i] || 128) / 255) * H;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }

  _drawSpectrogram() {
    const cv = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width  = cv.offsetWidth  * dpr;
    const H = cv.height = cv.offsetHeight * dpr;
    if (!this.analyser) return;

    // Init buffer
    if (!this._spectroBuffer || this._spectroBuffer.width !== W) {
      this._spectroBuffer = document.createElement('canvas');
      this._spectroBuffer.width  = W;
      this._spectroBuffer.height = H;
    }

    const sb = this._spectroBuffer;
    const sc = sb.getContext('2d');

    // Shift left by 2px
    sc.drawImage(sb, -2, 0);

    // New column on the right
    const fftSize = this.analyser.frequencyBinCount;
    const freqData = new Uint8Array(fftSize);
    this.analyser.getByteFrequencyData(freqData);

    for (let i = 0; i < H; i++) {
      // Log frequency mapping
      const freq_norm = Math.pow(i / H, 2);
      const binIdx = Math.floor(freq_norm * fftSize);
      const val = freqData[fftSize - 1 - binIdx] / 255;
      // Color: dark → green → yellow → red
      const r = val > 0.5 ? Math.floor((val - 0.5) * 2 * 255) : 0;
      const g = Math.floor(val < 0.5 ? val * 2 * 200 : (1 - (val - 0.5) * 2) * 200);
      const b = 0;
      sc.fillStyle = `rgba(${r},${g},${b},${0.3 + val * 0.7})`;
      sc.fillRect(W - 2, H - i - 1, 2, 1);
    }

    // Draw buffer to main canvas
    const c = cv.getContext('2d');
    c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
    c.drawImage(sb, 0, 0);
  }
}
```

---

## SCHRITT 5: AI SOUND GENERATION

### Neue Datei: web-prototype/js/ai-interface.js

```javascript
// AI Sound Generation Interface
// Nutzt Anthropic API über das Artifact-System (kein Backend nötig)

const AI_SYSTEM_PROMPT = `Du bist ein DnB/Neurofunk Sound Designer für einen Web Audio Synthesizer.
Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt. Kein Text davor oder danach.

Das JSON-Format ist:
{
  "name": "Preset Name",
  "description": "Kurze Beschreibung",
  "osc1": {
    "waveform": "sawtooth",  // sawtooth|square|triangle|sine
    "pitch": 0,              // Semitones -24..24
    "cent": 0,               // Cents -100..100
    "volume": 0.8,           // 0..1
    "unison": 1,             // 1..9
    "unisonDetune": 20,      // Cents 0..100
    "spread": 0.5            // Stereo width 0..1
  },
  "osc2": {
    "waveform": "sine",      // off|sawtooth|square|triangle|sine
    "oct": 0,                // -2..2
    "semi": 0,
    "detune": 7,
    "cents": 0,
    "volume": 0.5,
    "unison": 1
  },
  "osc1Active": true,
  "osc2Active": false,
  "subActive": false,
  "osc1ModTarget": "none",   // none|osc2tzfm|osc2am
  "osc1ModDepth": 0.5,
  "sub": {
    "waveform": "sine",
    "oct": -2,
    "volume": 0.6
  },
  "filter": {
    "type": "lowpass",       // lowpass|highpass|bandpass|notch
    "cutoff": 800,           // Hz 20..18000
    "resonance": 5           // 0.1..24
  },
  "adsr": {
    "attack": 0.005,         // Sekunden
    "decay": 0.25,
    "sustain": 0.4,
    "release": 0.12
  },
  "dist": {
    "form": "soft",          // off|soft|hard|fold|bit
    "drive": 0,              // 0..1
    "mix": 0                 // 0..1
  },
  "fx": {
    "reverbMix": 0,
    "delayMix": 0
  },
  "lfos": [
    {
      "preset": "dnbsaw",    // Name aus LFO_PRESET_LIBRARY oder "custom"
      "bars": 2,             // 1|2|4|8|16
      "mult": 1.333,         // 1|2|4|8|1.5|3|6|0.667|1.333|2.667
      "target": "cutoff",   // cutoff|resonance|pitch|amp|drive|none
      "depth": 0.65,         // 0..1
      "offset": 0,           // 0..1 Phase-Offset für Call&Response
      "mode": "normal"       // normal|inverse|divide2|divide3
    },
    {
      "preset": "none",
      "bars": 2, "mult": 1, "target": "none", "depth": 0,
      "offset": 0, "mode": "normal"
    },
    {
      "preset": "none",
      "bars": 4, "mult": 1, "target": "none", "depth": 0,
      "offset": 0, "mode": "normal"
    }
  ],
  "sequencer": {
    "patterns": [
      [{"active":true,"note":42,"accent":false}, ... 16 steps],
      [{"active":false,"note":42,"accent":false}, ... 16 steps],
      [{"active":false,"note":42,"accent":false}, ... 16 steps]
    ]
  }
}

Verfügbare LFO-Preset-Namen (preset-Feld): sine, sawup, sawdn, square, dnbsaw, wubwub, 
triplet, acid, fastsaw, rubber, neurozap, neuroglitch, neuro, liquid, breathe, flow, 
halftime, stair4, stairirr, pluck, gate, sidechain, wah, bounce, expup, expdown, shark

Für Call & Response: LFO 1 ist CALL (offset:0), LFO 2 ist RESPONSE (offset: 0.25..0.5),
LFO 3 ist COUNTER (mode: "inverse").

Wähle Parameter die zum Prompt passen. DnB = 170-174 BPM Kontext.`;

async function generatePreset(prompt, currentState = null) {
  const messages = [];

  if (currentState) {
    messages.push({
      role: 'user',
      content: `Aktueller Synthesizer-State als Kontext:\n${JSON.stringify(currentState, null, 2)}`
    });
    messages.push({
      role: 'assistant',
      content: 'Verstanden. Ich habe den aktuellen State als Basis.'
    });
  }

  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: AI_SYSTEM_PROMPT,
      messages,
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Strip possible markdown fences
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function applyPresetToSynth(preset, synth, seq) {
  synth.voices.forEach((voice, i) => {
    // OSC
    if (preset.osc1) {
      voice.set('osc', 'waveform', preset.osc1.waveform || 'sawtooth');
      voice.set('osc', 'pitch',    preset.osc1.pitch    || 0);
      voice.set('osc', 'cent',     preset.osc1.cent     || 0);
      voice.set('osc', 'volume',   preset.osc1.volume   ?? 0.8);
      voice.set('osc', 'unison',   preset.osc1.unison   || 1);
      voice.set('osc', 'unisonDetune', preset.osc1.unisonDetune || 20);
    }
    if (preset.osc2) {
      voice.p.osc2 = { ...voice.p.osc2, ...preset.osc2 };
    }
    voice.p.osc1Active = preset.osc1Active !== false;
    voice.p.osc2Active = preset.osc2Active === true;
    voice.p.subActive  = preset.subActive  === true;
    voice.p.osc1ModTarget = preset.osc1ModTarget || 'none';
    voice.p.osc1ModDepth  = preset.osc1ModDepth  || 0.5;
    if (preset.sub) voice.p.sub = { ...voice.p.sub, ...preset.sub };

    // Filter
    if (preset.filter) {
      voice.set('filter', 'type',      preset.filter.type      || 'lowpass');
      voice.set('filter', 'cutoff',    preset.filter.cutoff    || 800);
      voice.set('filter', 'resonance', preset.filter.resonance || 5);
    }

    // ADSR
    if (preset.adsr) {
      voice.set('adsr', 'attack',  preset.adsr.attack  || 0.005);
      voice.set('adsr', 'decay',   preset.adsr.decay   || 0.25);
      voice.set('adsr', 'sustain', preset.adsr.sustain ?? 0.4);
      voice.set('adsr', 'release', preset.adsr.release || 0.12);
    }

    // Dist + FX
    if (preset.dist) {
      voice.set('dist', 'form',  preset.dist.form  || 'off');
      voice.set('dist', 'drive', preset.dist.drive || 0);
      voice.set('dist', 'mix',   preset.dist.mix   || 0);
    }
    if (preset.fx) {
      voice.set('fx', 'reverbMix', preset.fx.reverbMix || 0);
      voice.set('fx', 'delayMix',  preset.fx.delayMix  || 0);
    }

    // LFOs
    if (preset.lfos && voice.lfoEngine) {
      preset.lfos.forEach((lfoConf, slotIdx) => {
        if (slotIdx >= voice.lfoEngine.slots.length) return;
        const slot = voice.lfoEngine.slots[slotIdx];
        slot.bars    = lfoConf.bars   || 2;
        slot.mult    = lfoConf.mult   || 1;
        slot.target  = lfoConf.target || 'none';
        slot.depth   = lfoConf.depth  || 0;
        slot.offset  = lfoConf.offset || 0;
        slot.mode    = lfoConf.mode   || 'normal';
        slot.enabled = slot.target !== 'none' && slot.depth > 0;
        if (lfoConf.preset && LFO_PRESET_LIBRARY[lfoConf.preset]) {
          slot.breakpoints = LFO_PRESET_LIBRARY[lfoConf.preset];
          slot.points = bpBake(slot.breakpoints);
        }
      });
    }
  });

  // Sequencer
  if (preset.sequencer?.patterns && seq) {
    preset.sequencer.patterns.forEach((pattern, vIdx) => {
      if (!seq.voices[vIdx]) return;
      pattern.forEach((step, sIdx) => {
        if (!seq.voices[vIdx].steps[sIdx]) return;
        seq.voices[vIdx].steps[sIdx].active = step.active || false;
        seq.voices[vIdx].steps[sIdx].note   = step.note   || 42;
        seq.voices[vIdx].steps[sIdx].accent = step.accent || false;
      });
    });
  }
}
```

---

## SCHRITT 6: PRESET SYSTEM

### Neue Datei: web-prototype/js/presets.js

```javascript
const PRESET_STORAGE_KEY = 'wobbler_presets_v1';
const MAX_SLOTS = 8;

function savePreset(synth, seq, name, slotIdx) {
  const presets = loadAllPresets();
  presets[slotIdx] = {
    name: name || `Preset ${slotIdx + 1}`,
    savedAt: Date.now(),
    data: synthToJSON(synth, seq),
  };
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

function loadPreset(synth, seq, slotIdx) {
  const presets = loadAllPresets();
  const slot = presets[slotIdx];
  if (!slot) return false;
  applyPresetToSynth(slot.data, synth, seq);
  return true;
}

function loadAllPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function synthToJSON(synth, seq) {
  // Capture state from first voice as template
  // (Multi-Voice presets later)
  const v = synth.voices[0];
  return {
    osc1:      { ...v.p.osc },
    osc2:      { ...v.p.osc2 },
    sub:       { ...v.p.sub  },
    osc1Active: v.p.osc1Active,
    osc2Active: v.p.osc2Active,
    subActive:  v.p.subActive,
    osc1ModTarget: v.p.osc1ModTarget,
    osc1ModDepth:  v.p.osc1ModDepth,
    filter:    { ...v.p.filter },
    adsr:      { ...v.p.adsr   },
    dist:      { ...v.p.dist   },
    fx:        { ...v.p.fx     },
    lfos: v.lfoEngine.slots.map(s => ({
      bars:    s.bars,
      mult:    s.mult,
      target:  s.target,
      depth:   s.depth,
      offset:  s.offset,
      mode:    s.mode,
      enabled: s.enabled,
      breakpoints: s.breakpoints,
    })),
    sequencer: {
      patterns: seq.voices.map(vSeq =>
        vSeq.steps.map(s => ({ active: s.active, note: s.note, accent: s.accent }))
      ),
    },
  };
}

function exportPreset(synth, seq, name) {
  const data = {
    name, version: 1,
    savedAt: new Date().toISOString(),
    data: synthToJSON(synth, seq),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/\s+/g, '_')}.wobbler.json`;
  a.click();
}

function importPreset(file, synth, seq, onSuccess) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const data = parsed.data || parsed;
      applyPresetToSynth(data, synth, seq);
      onSuccess(parsed.name || 'Imported');
    } catch (err) {
      console.error('Import failed:', err);
    }
  };
  reader.readAsText(file);
}
```

---

## SCHRITT 7: HTML EINBINDEN

In web-prototype/index.html, vor dem schließenden `</body>`:

```html
<!-- New engine files — load order matters -->
<script src="js/lfo-presets.js"></script>
<script src="js/lfo-engine.js"></script>
<script src="js/osc-engine.js"></script>
<script src="js/analyzer.js"></script>
<script src="js/ai-interface.js"></script>
<script src="js/presets.js"></script>
```

Füge einen AI-Prompt-Bar oben im Header hinzu:

```html
<div id="ai-bar" style="display:flex;gap:8px;align-items:center;padding:8px;background:#0a0a0a;border-bottom:1px solid #222">
  <input id="ai-prompt" type="text" placeholder="Describe your sound... e.g. dark neurofunk bass with triplet wobble"
    style="flex:1;background:#141414;border:1px solid #333;color:#ccc;padding:6px 10px;font-family:monospace;font-size:11px;border-radius:3px">
  <button id="ai-generate-btn" style="padding:6px 14px;background:#00e09a;border:none;color:#000;font-family:monospace;font-size:11px;cursor:pointer;border-radius:3px;font-weight:bold">
    GENERATE
  </button>
  <span id="ai-status" style="font-size:10px;color:#555;min-width:80px"></span>
</div>
```

Wire in main.js:
```javascript
document.getElementById('ai-generate-btn')?.addEventListener('click', async () => {
  const prompt = document.getElementById('ai-prompt').value.trim();
  if (!prompt) return;
  const status = document.getElementById('ai-status');
  status.textContent = 'generating...';
  try {
    const preset = await generatePreset(prompt);
    applyPresetToSynth(preset, synth, seq);
    status.textContent = `✓ ${preset.name}`;
  } catch (e) {
    status.textContent = 'error';
    console.error(e);
  }
});
```

---

## REIHENFOLGE DER IMPLEMENTIERUNG

1. osc-engine.js erstellen + in dsp.js integrieren (WobblerVoice TWE entfernen, buildOscChain rein)
2. lfo-presets.js erstellen
3. lfo-engine.js erstellen + in WobblerVoice integrieren
4. analyzer.js erstellen + in main.js/buildVisualizer integrieren
5. presets.js erstellen
6. ai-interface.js erstellen
7. index.html: Script-Tags + AI-Bar

Nach jedem Schritt: Browser testen, Konsole auf Fehler prüfen.

---

## WICHTIGE CONSTRAINTS

- Keine neuen npm-Dependencies — alles vanilla JS
- Alle neuen Dateien im Verzeichnis web-prototype/js/
- Storage-Struktur von storage.js (autoSave/autoLoad) NICHT anfassen
- WobblerSynth.analyser bleibt der Master-Analyser für alle 3 Voices
- bpBake() muss identisch zu dieser Implementierung sein — die Formel für die
  tension-basierte Interpolation muss exakt stimmen sonst klingen Presets falsch
- applyPresetToSynth() nutzt voice.set() für alle Parameter die es gibt —
  nicht direkt in voice.p schreiben außer für neue Parameter die set() nicht kennt

---

## KONTEXT FÜR WINDSURF

Der Wobbler Web Prototype hat bereits:
- 3-Voice Polyphonie (WobblerVoice × 3)
- 16-Step Sequencer (3 unabhängige Patterns)
- Filter, Distortion, 3-Band EQ, Reverb, Delay
- Auto-Save localStorage
- Web MIDI

Was du hinzufügst:
- OSC1 + OSC2 + Sub + TZFM (klingt besser als der aktuelle Wobbler-OSC)
- Breakpoint-LFO statt TWE (flexibler, drawable, 60+ Presets)
- Spectrogram + verbesserter Oscilloscope
- AI Sound Generation (Claude API, direkt im Browser)
- Preset System (8 Slots, Export/Import)
