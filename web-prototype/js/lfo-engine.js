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
// One instance per WobblerVoice.
// Manages 5 parallel LFO slots with breakpoint curves.
class LFOEngine {
  constructor(voice) {
    this.voice   = voice;
    this.timer   = null;
    this.playing = false;
    this.bpm     = 120;

    // 5 LFO Slots
    this.slots = Array.from({ length: 5 }, (_, i) => ({
      points:      bpBake([{ x:0, y:0.5, hard:false }, { x:1, y:0.5, hard:false }]),
      breakpoints: [{ x:0, y:0.5, hard:false }, { x:1, y:0.5, hard:false }],
      bars:    2,
      mult:    1.333,   // ×2D default
      target:  i === 0 ? 'cutoff' : 'none',
      depth:   i === 0 ? 0.6 : 0,
      offset:  0,       // phase-offset (0..1) for call & response
      mode:    'normal', // normal | inverse | divide2 | divide3
      phase:   0,
      enabled: i < 2,
      presetName: i === 0 ? 'dnbsaw' : 'none',
    }));

    // Load default preset for slot 0
    if (typeof LFO_PRESET_LIBRARY !== 'undefined') {
      const pts = LFO_PRESET_LIBRARY['dnbsaw'];
      if (pts) {
        this.slots[0].breakpoints = pts;
        this.slots[0].points = bpBake(pts);
      }
    }
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
    const v = this.voice;
    const ctx = v.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const barDur = 4 * 60 / this.bpm;

    this.slots.forEach(slot => {
      if (!slot.enabled || slot.target === 'none' || slot.depth < 0.01) return;

      const cycleDur = slot.bars * barDur;
      const advance  = 0.016 / cycleDur;

      // Phase mode
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

    switch (target) {
      case 'cutoff': {
        const cutoff = v.p.filter.cutoff;
        // Log-scale sweep (matches Voice Module implementation)
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
      case 'noiseAmt': {
        if (v._noiseG)
          v._noiseG.gain.setTargetAtTime(val * depth, t, 0.01);
        break;
      }
    }
  }

  // Serialise slot state for preset save
  toJSON() {
    return this.slots.map(s => ({
      bars:        s.bars,
      mult:        s.mult,
      target:      s.target,
      depth:       s.depth,
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
      s.target     = conf.target || 'none';
      s.depth      = conf.depth  ?? 0;
      s.offset     = conf.offset || 0;
      s.mode       = conf.mode   || 'normal';
      s.enabled    = conf.enabled !== false && s.target !== 'none';
      s.presetName = conf.presetName || 'custom';
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
