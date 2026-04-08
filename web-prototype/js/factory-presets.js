// ─────────────────────────────────────────────────────────
//  factory-presets.js — Built-in patch library
//  Format: same as capturePatch() v3 — loaded via applyPatchToAudio()
//  Requires: lfo-presets.js (LFO_PRESET_LIBRARY, bpBake)
// ─────────────────────────────────────────────────────────

function _lfoSlot(overrides) {
  return Object.assign({
    breakpoints:[{x:0,y:.5,hard:false},{x:1,y:.5,hard:false}],
    bars:    2, mult: 1, target: 'none', depth: 0.6,
    offset:  0, mode: 'normal', phase: 0, enabled: false,
    presetName: 'none', modMin: 0, modMax: 1,
    envA: 0, envR: 0,
  }, overrides);
}

// ── DNB CALL & RESPONSE ───────────────────────────────────
//  174 BPM · 4 bars · ×1D (mult=0.667)
//  Cycle: 8272ms (dotted). Call peak: t=110ms. Response: t=2069ms.
//  Overtones start: t=3034ms, peak: t=4966ms.

const _BP_CALL = [
  { x:0.00, y:0.00, hard:true,  tension: 0 },
  { x:0.02, y:1.00, hard:false, tension: 1 },
  { x:0.18, y:0.85, hard:false, tension: 1 },
  { x:0.35, y:0.40, hard:false, tension: 1 },
  { x:0.55, y:0.10, hard:false, tension: 1 },
  { x:0.70, y:0.05, hard:false, tension: 1 },
  { x:0.85, y:0.02, hard:false, tension:-1 },
  { x:1.00, y:0.00, hard:true,  tension: 0 },
];

const _BP_RESPONSE = [
  { x:0.00, y:0.00, hard:true,  tension: 0 },
  { x:0.08, y:0.30, hard:false, tension:-1 },
  { x:0.25, y:0.70, hard:false, tension:-1 },
  { x:0.42, y:0.90, hard:false, tension: 1 },
  { x:0.58, y:0.60, hard:false, tension: 1 },
  { x:0.72, y:0.25, hard:false, tension: 1 },
  { x:0.88, y:0.05, hard:false, tension: 1 },
  { x:1.00, y:0.00, hard:true,  tension: 0 },
];

const _BP_COUNTER_DRIVE = [
  { x:0.00, y:0.80, hard:true,  tension: 0 },
  { x:0.05, y:1.00, hard:false, tension: 1 },
  { x:0.20, y:0.70, hard:false, tension: 1 },
  { x:0.40, y:0.30, hard:false, tension:-1 },
  { x:0.60, y:0.15, hard:false, tension:-1 },
  { x:0.75, y:0.05, hard:false, tension:-1 },
  { x:0.90, y:0.30, hard:false, tension: 1 },
  { x:1.00, y:0.80, hard:true,  tension: 0 },
];

const _BP_OVERTONES = [
  { x:0.00, y:0.00, hard:true,  tension: 0 },
  { x:0.55, y:0.00, hard:true,  tension: 0 },
  { x:0.55, y:0.00, hard:false, tension:-1 },
  { x:0.72, y:0.25, hard:false, tension:-1 },
  { x:0.82, y:0.65, hard:false, tension:-1 },
  { x:0.90, y:1.00, hard:false, tension: 1 },
  { x:0.96, y:0.60, hard:false, tension: 1 },
  { x:1.00, y:0.00, hard:true,  tension: 0 },
];

const _dnbCallResponse = {
  version: 3,
  name: 'Call & Response — 174 BPM, 4 Bar, ×1D',
  createdAt: new Date().toISOString(),
  voicesEnabled: [true, false, false],
  master: { bpm: 174, masterGain: 0.85, delayTime: 0.172, delayFB: 0.35, delayWet: 0.08 },
  seqVoices: [
    { enabled: false, steps: Array.from({length:16}, (_,i) => ({ note:36, active: [0,4,8,12].includes(i), accent: i===0 })) },
    { enabled: false, steps: Array.from({length:16}, () => ({ note:36, active:false, accent:false })) },
    { enabled: false, steps: Array.from({length:16}, () => ({ note:36, active:false, accent:false })) },
  ],
  voices: [
    // Voice 0 — OSC1 sawtooth · tube dist · all 4 LFO slots active
    {
      volume: 0.85, pan: 0,
      osc1Active: true, osc2Active: false, subActive: true,
      osc1ModTarget: 'none', osc1ModDepth: 0.5,
      osc2ModTarget: 'none', osc2ModDepth: 0.5,
      osc1LfoPitch: false,
      osc: {
        waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.9,
        unison: 2, unisonDetune: 18, spread: 0.6, unisonBlend: 0.8, pw: 0.5,
      },
      osc2: { waveform: 'sawtooth', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.4, unison: 1, unisonDetune: 10 },
      sub:  { waveform: 'sine', oct: -2, cents: 0, volume: 0.55, unison: 1 },
      adsr: { attack: 0.004, decay: 0.18, sustain: 0.72, release: 0.22 },
      filter: { type: 'lowpass', cutoff: 420, resonance: 5.5, envAmount: 800, mix: 1, bypassed: false },
      dist:  { form: 'tube', drive: 0.38, tone: 12000, mix: 0.55, volume: 1, bypassed: false },
      eq:    { lowGain: 2, midGain: -1, highGain: 0, lowFreq: 180, midFreq: 900, highFreq: 6000, bypassed: false },
      fx:    { reverbMix: 0.04, reverbDecay: 1.2, delayMix: 0.06, delayTime: 0.172, delayFB: 0.3, bypassed: false },
      noise: { volume: 0, type: 'white', filterMix: 1 },
      lfos: [
        // SLOT 0 — CALL: cutoff leader, snaps open t=110ms, exp fall
        _lfoSlot({
          breakpoints: _BP_CALL,
          presetName: 'custom',
          bars: 4, mult: 0.667, target: 'cutoff',
          depth: 0.72, offset: 0, mode: 'normal', enabled: true,
          modMin: 0.12, modMax: 0.78,
        }),
        // SLOT 1 — RESPONSE: cutoff answerer, offset=0.375 (~1.5 beats = t≈2069ms)
        _lfoSlot({
          breakpoints: _BP_RESPONSE,
          presetName: 'custom',
          bars: 4, mult: 0.667, target: 'cutoff',
          depth: 0.48, offset: 0.375, mode: 'normal', enabled: true,
          modMin: 0.08, modMax: 0.60,
        }),
        // SLOT 2 — COUNTER-DRIVE: drive counter, mode=inverse (phase-flip)
        _lfoSlot({
          breakpoints: _BP_COUNTER_DRIVE,
          presetName: 'custom',
          bars: 4, mult: 0.667, target: 'drive',
          depth: 0.55, offset: 0, mode: 'inverse', enabled: true,
          modMin: 0.0, modMax: 0.65,
        }),
        // SLOT 3 — OVERTONES: resonance, flat → rise bar 3 → peak t≈4966ms → snap 0
        _lfoSlot({
          breakpoints: _BP_OVERTONES,
          presetName: 'custom',
          bars: 4, mult: 0.667, target: 'resonance',
          depth: 0.35, offset: 0, mode: 'normal', enabled: true,
          modMin: 0.0, modMax: 0.55,
        }),
        // SLOT 4 — unused
        _lfoSlot({}),
      ],
    },
    // Voice 1 & 2 — minimal defaults
    {
      volume: 0.7, pan: 0,
      osc1Active: true, osc2Active: false, subActive: false,
      osc1ModTarget: 'none', osc1ModDepth: 0.5,
      osc2ModTarget: 'none', osc2ModDepth: 0.5,
      osc1LfoPitch: false,
      osc: { waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.8, unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5 },
      osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.5, unison: 1, unisonDetune: 10 },
      sub:  { waveform: 'sine', oct: -2, cents: 0, volume: 0.6, unison: 1 },
      adsr: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 },
      filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 1200, mix: 1, bypassed: false },
      dist: { form: 'soft', drive: 0, tone: 18000, mix: 0, volume: 1, bypassed: false },
      eq:   { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 6000, bypassed: false },
      fx:   { reverbMix: 0, reverbDecay: 2, delayMix: 0, delayTime: 0.375, delayFB: 0.4, bypassed: false },
      noise: { volume: 0, type: 'white', filterMix: 1 },
      lfos: Array.from({length:5}, () => _lfoSlot({})),
    },
    {
      volume: 0.7, pan: 0,
      osc1Active: true, osc2Active: false, subActive: false,
      osc1ModTarget: 'none', osc1ModDepth: 0.5,
      osc2ModTarget: 'none', osc2ModDepth: 0.5,
      osc1LfoPitch: false,
      osc: { waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.8, unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5 },
      osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.5, unison: 1, unisonDetune: 10 },
      sub:  { waveform: 'sine', oct: -2, cents: 0, volume: 0.6, unison: 1 },
      adsr: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 },
      filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 1200, mix: 1, bypassed: false },
      dist: { form: 'soft', drive: 0, tone: 18000, mix: 0, volume: 1, bypassed: false },
      eq:   { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 6000, bypassed: false },
      fx:   { reverbMix: 0, reverbDecay: 2, delayMix: 0, delayTime: 0.375, delayFB: 0.4, bypassed: false },
      noise: { volume: 0, type: 'white', filterMix: 1 },
      lfos: Array.from({length:5}, () => _lfoSlot({})),
    },
  ],
};

// ── NEUROFUNK REESE ───────────────────────────────────────
//  174 BPM · 2 bars · ×2 (mult=2)
//  Hard clip distortion → lowpass filter sweep → comp glue

const _BP_NEURO_REESE_FILTER = [
  { x:0.00, y:0.10, hard:true,  tension: 0 },
  { x:0.10, y:0.35, hard:false, tension: 1 },
  { x:0.35, y:0.85, hard:false, tension:-1 },
  { x:0.60, y:0.45, hard:false, tension:-1 },
  { x:0.80, y:0.20, hard:false, tension: 1 },
  { x:1.00, y:0.10, hard:true,  tension: 0 },
];

const _BP_NEURO_REESE_DRIVE = [
  { x:0.00, y:0.60, hard:true,  tension: 0 },
  { x:0.15, y:0.90, hard:false, tension: 1 },
  { x:0.40, y:0.75, hard:false, tension:-1 },
  { x:0.65, y:0.85, hard:false, tension: 1 },
  { x:0.85, y:0.50, hard:false, tension:-1 },
  { x:1.00, y:0.60, hard:true,  tension: 0 },
];

const _neurofunkReese = {
  version: 3,
  name: 'Neurofunk Reese — 174 BPM, 2 Bar, ×2',
  createdAt: new Date().toISOString(),
  voicesEnabled: [true, false, false],
  master: { bpm: 174, masterGain: 0.9, delayTime: 0.172, delayFB: 0.3, delayWet: 0.06 },
  seqVoices: [
    { enabled: false, steps: Array.from({length:16}, (_,i) => ({ note:36, active: [0,4,8,12].includes(i), accent: [0,8].includes(i) })) },
    { enabled: false, steps: Array.from({length:16}, () => ({ note:36, active:false, accent:false })) },
    { enabled: false, steps: Array.from({length:16}, () => ({ note:36, active:false, accent:false })) },
  ],
  voices: [
    {
      volume: 0.9, pan: 0,
      osc1Active: true, osc2Active: true, subActive: true,
      osc1ModTarget: 'none', osc1ModDepth: 0.5,
      osc2ModTarget: 'none', osc2ModDepth: 0.5,
      osc1LfoPitch: false,
      osc: {
        waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.85,
        unison: 3, unisonDetune: 22, spread: 0.7, unisonBlend: 0.9, pw: 0.5,
      },
      osc2: { waveform: 'sawtooth', oct: 0, semi: 7, detune: -12, cents: 0, volume: 0.6, unison: 2, unisonDetune: 15 },
      sub:  { waveform: 'sine', oct: -1, cents: 0, volume: 0.7, unison: 1 },
      adsr: { attack: 0.008, decay: 0.25, sustain: 0.75, release: 0.35 },
      filter: { type: 'lowpass', cutoff: 280, resonance: 7.5, envAmount: 600, mix: 1, bypassed: false },
      dist:  { form: 'hard', drive: 0.65, tone: 8500, mix: 0.75, volume: 1, bypassed: false },
      comp:  { threshold:-28, knee:8, ratio:6, attack:0.001, release:0.08, bypassed:false },
      eq:    { lowGain: 3, midGain: -2, highGain: 1, lowFreq: 150, midFreq: 1200, highFreq: 5500, bypassed: false },
      fx:    { reverbMix: 0.03, reverbDecay: 0.8, delayMix: 0.05, delayTime: 0.172, delayFB: 0.25, bypassed: false },
      noise: { volume: 0.08, type: 'pink', filterMix: 0.6 },
      lfos: [
        // SLOT 0 — Filter sweep
        _lfoSlot({
          breakpoints: _BP_NEURO_REESE_FILTER,
          presetName: 'custom',
          bars: 2, mult: 2, target: 'cutoff',
          depth: 0.85, offset: 0, mode: 'normal', enabled: true,
          modMin: 0.08, modMax: 0.72,
        }),
        // SLOT 1 — Drive modulation
        _lfoSlot({
          breakpoints: _BP_NEURO_REESE_DRIVE,
          presetName: 'custom',
          bars: 2, mult: 2, target: 'drive',
          depth: 0.6, offset: 0.125, mode: 'normal', enabled: true,
          modMin: 0.25, modMax: 0.85,
        }),
        // SLOT 2 — Mix wobble
        _lfoSlot({
          breakpoints: [{x:0,y:0.3,hard:false},{x:0.5,y:0.7,hard:false},{x:1,y:0.3,hard:false}],
          presetName: 'custom',
          bars: 2, mult: 4, target: 'distMix',
          depth: 0.45, offset: 0, mode: 'normal', enabled: true,
          modMin: 0.4, modMax: 0.9,
        }),
        // SLOT 3 — unused
        _lfoSlot({}),
        // SLOT 4 — unused
        _lfoSlot({}),
      ],
    },
    // Voice 1 & 2 — minimal
    { volume: 0.7, pan: 0, osc1Active: true, osc2Active: false, subActive: false, osc1ModTarget: 'none', osc1ModDepth: 0.5, osc2ModTarget: 'none', osc2ModDepth: 0.5, osc1LfoPitch: false, osc: { waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.8, unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5 }, osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.5, unison: 1, unisonDetune: 10 }, sub: { waveform: 'sine', oct: -2, cents: 0, volume: 0.6, unison: 1 }, adsr: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 }, filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 1200, mix: 1, bypassed: false }, dist: { form: 'soft', drive: 0, tone: 18000, mix: 0, volume: 1, bypassed: false }, comp: { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false }, eq: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 6000, bypassed: false }, fx: { reverbMix: 0, reverbDecay: 2, delayMix: 0, delayTime: 0.375, delayFB: 0.4, bypassed: false }, noise: { volume: 0, type: 'white', filterMix: 1 }, lfos: Array.from({length:5}, () => _lfoSlot({})) },
    { volume: 0.7, pan: 0, osc1Active: true, osc2Active: false, subActive: false, osc1ModTarget: 'none', osc1ModDepth: 0.5, osc2ModTarget: 'none', osc2ModDepth: 0.5, osc1LfoPitch: false, osc: { waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.8, unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5 }, osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.5, unison: 1, unisonDetune: 10 }, sub: { waveform: 'sine', oct: -2, cents: 0, volume: 0.6, unison: 1 }, adsr: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 }, filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 1200, mix: 1, bypassed: false }, dist: { form: 'soft', drive: 0, tone: 18000, mix: 0, volume: 1, bypassed: false }, comp: { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false }, eq: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 6000, bypassed: false }, fx: { reverbMix: 0, reverbDecay: 2, delayMix: 0, delayTime: 0.375, delayFB: 0.4, bypassed: false }, noise: { volume: 0, type: 'white', filterMix: 1 }, lfos: Array.from({length:5}, () => _lfoSlot({})) },
  ],
};

// ── JUMP UP WOBBLE ────────────────────────────────────────
//  174 BPM · 1 bar · ×1 (mult=1) fast triplet feel
//  Fuzz distortion → resonant filter → comp

const _BP_JUMP_WOBBLE = [
  { x:0.00, y:0.20, hard:true,  tension: 0 },
  { x:0.08, y:0.90, hard:true,  tension: 0 },
  { x:0.25, y:0.15, hard:true,  tension: 0 },
  { x:0.33, y:0.85, hard:true,  tension: 0 },
  { x:0.50, y:0.10, hard:true,  tension: 0 },
  { x:0.58, y:0.80, hard:true,  tension: 0 },
  { x:0.75, y:0.15, hard:true,  tension: 0 },
  { x:0.83, y:0.75, hard:true,  tension: 0 },
  { x:1.00, y:0.20, hard:true,  tension: 0 },
];

const _jumpUpWobble = {
  version: 3,
  name: 'Jump Up Wobble — 174 BPM, 1 Bar, ×1',
  createdAt: new Date().toISOString(),
  voicesEnabled: [true, false, false],
  master: { bpm: 174, masterGain: 0.92, delayTime: 0.172, delayFB: 0.4, delayWet: 0.08 },
  seqVoices: [
    { enabled: false, steps: Array.from({length:16}, (_,i) => ({ note:36, active: [0,2,4,6,8,10,12,14].includes(i), accent: [0,4,8,12].includes(i) })) },
    { enabled: false, steps: Array.from({length:16}, () => ({ note:36, active:false, accent:false })) },
    { enabled: false, steps: Array.from({length:16}, () => ({ note:36, active:false, accent:false })) },
  ],
  voices: [
    {
      volume: 0.92, pan: 0,
      osc1Active: true, osc2Active: false, subActive: true,
      osc1ModTarget: 'none', osc1ModDepth: 0.5,
      osc2ModTarget: 'none', osc2ModDepth: 0.5,
      osc1LfoPitch: false,
      osc: {
        waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.9,
        unison: 2, unisonDetune: 25, spread: 0.8, unisonBlend: 0.85, pw: 0.5,
      },
      osc2: { waveform: 'sawtooth', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0, unison: 1, unisonDetune: 10 },
      sub:  { waveform: 'square', oct: -1, cents: 0, volume: 0.6, unison: 1 },
      adsr: { attack: 0.002, decay: 0.15, sustain: 0.65, release: 0.2 },
      filter: { type: 'lowpass', cutoff: 450, resonance: 8.5, envAmount: 400, mix: 1, bypassed: false },
      dist:  { form: 'fuzz', drive: 0.55, tone: 6000, mix: 0.8, volume: 1, bypassed: false },
      comp:  { threshold:-22, knee:4, ratio:8, attack:0.001, release:0.06, bypassed:false },
      eq:    { lowGain: 4, midGain: -1, highGain: -2, lowFreq: 140, midFreq: 800, highFreq: 5000, bypassed: false },
      fx:    { reverbMix: 0.02, reverbDecay: 0.6, delayMix: 0.08, delayTime: 0.172, delayFB: 0.35, bypassed: false },
      noise: { volume: 0.05, type: 'white', filterMix: 0.8 },
      lfos: [
        // SLOT 0 — Fast filter wobble (1 bar, steppy)
        _lfoSlot({
          breakpoints: _BP_JUMP_WOBBLE,
          presetName: 'custom',
          bars: 1, mult: 1, target: 'cutoff',
          depth: 0.9, offset: 0, mode: 'normal', enabled: true,
          modMin: 0.15, modMax: 0.88,
        }),
        // SLOT 1 — Resonance follow
        _lfoSlot({
          breakpoints: [{x:0,y:0.3,hard:true},{x:0.5,y:0.8,hard:true},{x:1,y:0.3,hard:true}],
          presetName: 'custom',
          bars: 1, mult: 1, target: 'resonance',
          depth: 0.5, offset: 0, mode: 'normal', enabled: true,
          modMin: 0.2, modMax: 0.7,
        }),
        // SLOT 2 — Drive accent
        _lfoSlot({
          breakpoints: [{x:0,y:0.5,hard:true},{x:0.25,y:0.7,hard:true},{x:0.5,y:0.5,hard:true},{x:0.75,y:0.8,hard:true},{x:1,y:0.5,hard:true}],
          presetName: 'custom',
          bars: 1, mult: 2, target: 'drive',
          depth: 0.35, offset: 0, mode: 'normal', enabled: true,
          modMin: 0.4, modMax: 0.9,
        }),
        // SLOT 3 — unused
        _lfoSlot({}),
        // SLOT 4 — unused
        _lfoSlot({}),
      ],
    },
    // Voice 1 & 2 — minimal
    { volume: 0.7, pan: 0, osc1Active: true, osc2Active: false, subActive: false, osc1ModTarget: 'none', osc1ModDepth: 0.5, osc2ModTarget: 'none', osc2ModDepth: 0.5, osc1LfoPitch: false, osc: { waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.8, unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5 }, osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.5, unison: 1, unisonDetune: 10 }, sub: { waveform: 'sine', oct: -2, cents: 0, volume: 0.6, unison: 1 }, adsr: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 }, filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 1200, mix: 1, bypassed: false }, dist: { form: 'soft', drive: 0, tone: 18000, mix: 0, volume: 1, bypassed: false }, comp: { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false }, eq: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 6000, bypassed: false }, fx: { reverbMix: 0, reverbDecay: 2, delayMix: 0, delayTime: 0.375, delayFB: 0.4, bypassed: false }, noise: { volume: 0, type: 'white', filterMix: 1 }, lfos: Array.from({length:5}, () => _lfoSlot({})) },
    { volume: 0.7, pan: 0, osc1Active: true, osc2Active: false, subActive: false, osc1ModTarget: 'none', osc1ModDepth: 0.5, osc2ModTarget: 'none', osc2ModDepth: 0.5, osc1LfoPitch: false, osc: { waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.8, unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5 }, osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.5, unison: 1, unisonDetune: 10 }, sub: { waveform: 'sine', oct: -2, cents: 0, volume: 0.6, unison: 1 }, adsr: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 }, filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 1200, mix: 1, bypassed: false }, dist: { form: 'soft', drive: 0, tone: 18000, mix: 0, volume: 1, bypassed: false }, comp: { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false }, eq: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 6000, bypassed: false }, fx: { reverbMix: 0, reverbDecay: 2, delayMix: 0, delayTime: 0.375, delayFB: 0.4, bypassed: false }, noise: { volume: 0, type: 'white', filterMix: 1 }, lfos: Array.from({length:5}, () => _lfoSlot({})) },
  ],
};

// ── ACID BASS ────────────────────────────────────────────
//  132 BPM · 2 bars · ×2D (mult=1.333) classic TB-303 vibe
//  Asymmetric distortion → resonant bandpass → comp

const _BP_ACID_SLIDE = [
  { x:0.00, y:0.00, hard:true,  tension: 0 },
  { x:0.20, y:0.00, hard:true,  tension: 0 },
  { x:0.30, y:0.70, hard:false, tension: 1 },
  { x:0.55, y:0.85, hard:false, tension:-1 },
  { x:0.80, y:0.30, hard:false, tension:-1 },
  { x:1.00, y:0.00, hard:true,  tension: 0 },
];

const _acidBass = {
  version: 3,
  name: 'Acid Bass — 132 BPM, 2 Bar, ×2D',
  createdAt: new Date().toISOString(),
  voicesEnabled: [true, false, false],
  master: { bpm: 132, masterGain: 0.88, delayTime: 0.227, delayFB: 0.25, delayWet: 0.04 },
  seqVoices: [
    { enabled: false, steps: Array.from({length:16}, (_,i) => ({ note:36, active: [0,4,8,12].includes(i), accent: [0,6,10].includes(i) })) },
    { enabled: false, steps: Array.from({length:16}, () => ({ note:36, active:false, accent:false })) },
    { enabled: false, steps: Array.from({length:16}, () => ({ note:36, active:false, accent:false })) },
  ],
  voices: [
    {
      volume: 0.88, pan: 0,
      osc1Active: true, osc2Active: false, subActive: false,
      osc1ModTarget: 'none', osc1ModDepth: 0.5,
      osc2ModTarget: 'none', osc2ModDepth: 0.5,
      osc1LfoPitch: false,
      osc: {
        waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.95,
        unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5,
      },
      osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0, unison: 1, unisonDetune: 10 },
      sub:  { waveform: 'sine', oct: -1, cents: 0, volume: 0, unison: 1 },
      adsr: { attack: 0.001, decay: 0.35, sustain: 0.25, release: 0.4 },
      filter: { type: 'bandpass', cutoff: 680, resonance: 12, envAmount: 2800, mix: 1, bypassed: false },
      dist:  { form: 'asym', drive: 0.42, tone: 9500, mix: 0.65, volume: 1, bypassed: false },
      comp:  { threshold:-26, knee:6, ratio:5, attack:0.002, release:0.12, bypassed:false },
      eq:    { lowGain: -1, midGain: 3, highGain: 2, lowFreq: 200, midFreq: 1400, highFreq: 6500, bypassed: false },
      fx:    { reverbMix: 0.08, reverbDecay: 1.8, delayMix: 0.03, delayTime: 0.227, delayFB: 0.2, bypassed: false },
      noise: { volume: 0, type: 'white', filterMix: 1 },
      lfos: [
        // SLOT 0 — Acid slide (cutoff)
        _lfoSlot({
          breakpoints: _BP_ACID_SLIDE,
          presetName: 'custom',
          bars: 2, mult: 1.333, target: 'cutoff',
          depth: 0.75, offset: 0, mode: 'normal', enabled: true,
          modMin: 0.12, modMax: 0.85,
        }),
        // SLOT 1 — Resonance pump
        _lfoSlot({
          breakpoints: [{x:0,y:0.4,hard:false},{x:0.3,y:0.9,hard:false},{x:0.7,y:0.3,hard:false},{x:1,y:0.4,hard:false}],
          presetName: 'custom',
          bars: 2, mult: 1.333, target: 'resonance',
          depth: 0.6, offset: 0.1, mode: 'normal', enabled: true,
          modMin: 0.15, modMax: 0.8,
        }),
        // SLOT 2 — unused
        _lfoSlot({}),
        // SLOT 3 — unused
        _lfoSlot({}),
        // SLOT 4 — unused
        _lfoSlot({}),
      ],
    },
    // Voice 1 & 2 — minimal
    { volume: 0.7, pan: 0, osc1Active: true, osc2Active: false, subActive: false, osc1ModTarget: 'none', osc1ModDepth: 0.5, osc2ModTarget: 'none', osc2ModDepth: 0.5, osc1LfoPitch: false, osc: { waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.8, unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5 }, osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.5, unison: 1, unisonDetune: 10 }, sub: { waveform: 'sine', oct: -2, cents: 0, volume: 0.6, unison: 1 }, adsr: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 }, filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 1200, mix: 1, bypassed: false }, dist: { form: 'soft', drive: 0, tone: 18000, mix: 0, volume: 1, bypassed: false }, comp: { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false }, eq: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 6000, bypassed: false }, fx: { reverbMix: 0, reverbDecay: 2, delayMix: 0, delayTime: 0.375, delayFB: 0.4, bypassed: false }, noise: { volume: 0, type: 'white', filterMix: 1 }, lfos: Array.from({length:5}, () => _lfoSlot({})) },
    { volume: 0.7, pan: 0, osc1Active: true, osc2Active: false, subActive: false, osc1ModTarget: 'none', osc1ModDepth: 0.5, osc2ModTarget: 'none', osc2ModDepth: 0.5, osc1LfoPitch: false, osc: { waveform: 'sawtooth', pitch: 0, cent: 0, volume: 0.8, unison: 1, unisonDetune: 20, spread: 0.5, unisonBlend: 1, pw: 0.5 }, osc2: { waveform: 'sine', oct: 0, semi: 0, detune: 7, cents: 0, volume: 0.5, unison: 1, unisonDetune: 10 }, sub: { waveform: 'sine', oct: -2, cents: 0, volume: 0.6, unison: 1 }, adsr: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.15 }, filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 1200, mix: 1, bypassed: false }, dist: { form: 'soft', drive: 0, tone: 18000, mix: 0, volume: 1, bypassed: false }, comp: { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false }, eq: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 200, midFreq: 1000, highFreq: 6000, bypassed: false }, fx: { reverbMix: 0, reverbDecay: 2, delayMix: 0, delayTime: 0.375, delayFB: 0.4, bypassed: false }, noise: { volume: 0, type: 'white', filterMix: 1 }, lfos: Array.from({length:5}, () => _lfoSlot({})) },
  ],
};

// ── FACTORY PRESET REGISTRY ───────────────────────────────
const FACTORY_PRESETS = [
  { label: 'Call & Response — 174 BPM, 4 Bar, ×1D', patch: _dnbCallResponse },
  { label: 'Neurofunk Reese — 174 BPM, 2 Bar, ×2', patch: _neurofunkReese },
  { label: 'Jump Up Wobble — 174 BPM, 1 Bar, ×1', patch: _jumpUpWobble },
  { label: 'Acid Bass — 132 BPM, 2 Bar, ×2D', patch: _acidBass },
];
