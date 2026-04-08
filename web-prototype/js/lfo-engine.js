// ─────────────────────────────────────────────────────────
//  lfo-engine.js — Breakpoint-LFO System
//  Replaces TWE. 5 slots, drawable breakpoint curves.
//  Requires: lfo-presets.js (LFO_PRESET_LIBRARY, bpBake)
// ─────────────────────────────────────────────────────────

const LFO_POINTS = 512; // resolution of baked curve

// ─── bpBake ───────────────────────────────────────────────────
// Interpolates breakpoints into a 512-point Float32Array.
// tension: 0=linear, 1=ease-out, -1=ease-in
function bpBake(breakpoints) {
  const pts = [...breakpoints].sort((a, b) => a.x - b.x);
  const out = new Float32Array(LFO_POINTS);
  for (let i = 0; i < LFO_POINTS; i++) {
    const nx = i / (LFO_POINTS - 1);
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
// One instance per WobblerVoice, OR one global instance for WobblerSynth.
// Pass a single voice or an array of voices to the constructor.
// Manages 5 parallel LFO slots with breakpoint curves.
class LFOEngine {
  constructor(voice) {
    // voice can be a single WobblerVoice or an array of voices (global mode)
    this.voice   = voice;
    this.voices  = Array.isArray(voice) ? voice : null; // null = single-voice mode
    this.timer   = null;
    this.playing = false;
    this.bpm     = 174;

    // 5 LFO Slots
    this.slots = Array.from({ length: 5 }, (_, i) => ({
      points:      bpBake([{ x:0, y:0.5, hard:false }, { x:1, y:0.5, hard:false }]),
      breakpoints: [{ x:0, y:0.5, hard:false }, { x:1, y:0.5, hard:false }],
      bars:    2,
      mult:    1.333,   // ×2D default
      mappings: [],      // [{target, depth, modMin, modMax}, ...]
      offset:  0,        // phase-offset (0..1) for call & response
      mode:    'normal', // normal | inverse | divide2 | divide3
      phase:   0,
      enabled: false,
      presetName: 'none',
    }));

  }

  setSlotBreakpoints(slotIdx, breakpoints) {
    const s = this.slots[slotIdx];
    if (!s) return;
    s.breakpoints = breakpoints;
    s.points = bpBake(breakpoints);
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
    // Call on noteOn for clean phase-reset (trigger mode)
    this.slots.forEach(s => { s.phase = s.offset; });
  }

  _tick() {
    if (!this.playing) return;
    // In global mode, use first enabled voice for ctx/time; skip if none playing
    const voices = this.voices
      ? this.voices.filter(v => v._enabled)
      : [this.voice];
    if (!voices.length) return;
    const ctx = voices[0].ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const barDur = 4 * 60 / this.bpm;

    this.slots.forEach(slot => {
      const activeMappings = (slot.mappings || []).filter(m => m.target && m.target !== 'none');
      if (!slot.enabled || !activeMappings.length) return;

      const cycleDur = slot.bars * barDur;
      if (!cycleDur || cycleDur < 0.001) return; // guard against zero/NaN

      const advance = 0.016 / cycleDur;
      if (!isFinite(advance)) return;

      // Phase mode
      let phase = slot.phase;
      if (slot.mode === 'inverse') phase = (phase + 0.5) % 1;

      slot.phase = (slot.phase + advance) % 1;

      const scaledPos = (phase * slot.mult) % 1;
      const idx = Math.min(LFO_POINTS - 1, Math.max(0, Math.floor(scaledPos * LFO_POINTS)));
      const val = slot.points[idx];
      if (val === undefined || !isFinite(val)) return; // guard NaN/undefined

      // Apply each mapping to all target voices
      activeMappings.forEach(m => {
        voices.forEach(v => this._applyValue(m.target, val, m.depth ?? 0.6, t, v, m.modMin ?? 0, m.modMax ?? 1));
      });
    });
  }

  _applyValue(target, val, depth, t, v, modMin = 0, modMax = 1) {
    if (!v) v = this.voice; // fallback for single-voice mode
    if (!isFinite(val) || !isFinite(depth)) return;
    // modMin/modMax define the absolute sweep range (normalized 0..1 on the param)
    // val (0..1 from curve) is remapped into [modMin, modMax]
    const ranged = modMin + val * (modMax - modMin);

    switch (target) {
      case 'cutoff': {
        // ranged maps directly to 20..20000 Hz on log scale
        const hz = Math.max(20, Math.min(20000, 20 * Math.pow(1000, ranged)));
        v._filterLFOSetCutoff(hz);
        break;
      }
      case 'resonance': {
        // ranged maps to 0.01..30 Q
        const q = Math.max(0.01, Math.min(30, 0.01 + ranged * 29.99));
        v._filterLFOSetResonance(q);
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
      case 'semi': {
        // val 0..1 → bipolar semitone offset ±depth semitones (in cents)
        const semiCents = Math.round((val - 0.5) * 2 * depth * 12) * 100;
        if (v._activeOscs) {
          v._activeOscs.forEach(o => {
            try { o.detune.setValueAtTime(semiCents, t); } catch (e) {}
          });
        }
        break;
      }
      case 'fine': {
        // val 0..1 → bipolar fine tune ±depth*100 cents
        const fineCents = (val - 0.5) * 2 * depth * 100;
        if (v._activeOscs) {
          v._activeOscs.forEach(o => {
            try { o.detune.setTargetAtTime(fineCents, t, 0.008); } catch (e) {}
          });
        }
        break;
      }
      case 'amp':
      case 'tremolo': {
        // ranged → gain 0..1 (modMin=full silence, modMax=full volume)
        if (v._tremoloGain)
          v._tremoloGain.gain.setTargetAtTime(Math.max(0, Math.min(1, ranged)), t, 0.01);
        break;
      }
      case 'drive': {
        // ranged maps to 0..1 drive
        v.set('dist', 'drive', Math.max(0, Math.min(1, ranged)));
        break;
      }
      case 'distMix': {
        // ranged maps to 0..1 mix
        v.set('dist', 'mix', Math.max(0, Math.min(1, ranged)));
        break;
      }
      case 'noiseAmt': {
        if (v._noiseLvlGain && v._playing) {
          v._noiseLvlGain.gain.setTargetAtTime(Math.max(0, Math.min(1, ranged)), t, 0.01);
        }
        break;
      }
    }
  }

  // Serialise slot state for preset save
  toJSON() {
    return this.slots.map(s => ({
      bars:        s.bars,
      mult:        s.mult,
      mappings:    s.mappings || [],
      offset:      s.offset,
      mode:        s.mode,
      enabled:     s.enabled,
      presetName:  s.presetName || 'custom',
      breakpoints: s.breakpoints,
    }));
  }

  // Restore slot state from preset
  fromJSON(slotArr) {
    if (!Array.isArray(slotArr)) return;
    slotArr.forEach((conf, i) => {
      if (i >= this.slots.length) return;
      const s = this.slots[i];
      s.bars       = conf.bars   || 2;
      s.mult       = conf.mult   || 1;
      s.offset     = conf.offset || 0;
      s.mode       = conf.mode   || 'normal';
      s.enabled    = conf.enabled !== false;
      s.presetName = conf.presetName || 'custom';

      // Migration: old format used single target/depth/modMin/modMax
      // New format uses mappings array
      if (conf.mappings && conf.mappings.length > 0) {
        // New format: use mappings array directly
        s.mappings = conf.mappings.map(m => ({
          target: m.target || 'none',
          depth: m.depth ?? 0.6,
          modMin: m.modMin ?? 0,
          modMax: m.modMax ?? 1
        }));
      } else if (conf.target && conf.target !== 'none') {
        // Old format: migrate single target to mappings array
        s.mappings = [{
          target: conf.target,
          depth: conf.depth ?? 0.6,
          modMin: conf.modMin ?? 0,
          modMax: conf.modMax ?? 1
        }];
      } else {
        s.mappings = [];
      }

      // Load breakpoints: prefer named preset, fall back to stored points
      if (conf.presetName && conf.presetName !== 'custom' && conf.presetName !== 'none'
          && typeof LFO_PRESET_LIBRARY !== 'undefined'
          && LFO_PRESET_LIBRARY[conf.presetName]) {
        s.breakpoints = LFO_PRESET_LIBRARY[conf.presetName];
      } else if (conf.breakpoints) {
        s.breakpoints = conf.breakpoints;
      }
      s.points = bpBake(s.breakpoints);
    });
  }
}
