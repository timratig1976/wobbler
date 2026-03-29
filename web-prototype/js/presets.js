// ─────────────────────────────────────────────────────────
//  presets.js — Save / Load / Export / Import
//  Requires: lfo-engine.js (bpBake), lfo-presets.js
// ─────────────────────────────────────────────────────────

const PRESET_STORAGE_KEY = 'wobbler_presets_v1';
const MAX_PRESET_SLOTS   = 8;

// ─── synthToJSON ──────────────────────────────────────────
function synthToJSON(synth, seq) {
  const v = synth.voices[0];
  return {
    osc1:      { ...v.p.osc },
    osc2:      { ...(v.p.osc2 || {}) },
    sub:       { ...(v.p.sub  || {}) },
    osc1Active:    v.p.osc1Active,
    osc2Active:    v.p.osc2Active,
    subActive:     v.p.subActive,
    osc1ModTarget: v.p.osc1ModTarget,
    osc1ModDepth:  v.p.osc1ModDepth,
    osc2ModTarget: v.p.osc2ModTarget,
    osc2ModDepth:  v.p.osc2ModDepth,
    filter:    { ...v.p.filter },
    adsr:      { ...v.p.adsr   },
    dist:      { ...v.p.dist   },
    eq:        { ...v.p.eq     },
    fx:        { ...v.p.fx     },
    noise:     { ...v.p.noise  },
    lfos: v.lfoEngine ? v.lfoEngine.toJSON() : [],
    sequencer: {
      patterns: (seq?.voices || []).map(vSeq =>
        (vSeq.steps || []).map(s => ({ active: s.active, note: s.note, accent: s.accent }))
      ),
    },
  };
}

// ─── applyPresetToSynth ───────────────────────────────────
function applyPresetToSynth(preset, synth, seq) {
  synth.voices.forEach(voice => {
    // OSC1
    if (preset.osc1) {
      ['waveform','pitch','cent','volume','unison','unisonDetune','spread','pw','unisonBlend'].forEach(k => {
        if (preset.osc1[k] !== undefined) voice.set('osc', k, preset.osc1[k]);
      });
    }
    // OSC2
    if (preset.osc2) voice.p.osc2 = { ...voice.p.osc2, ...preset.osc2 };
    // Sub
    if (preset.sub)  voice.p.sub  = { ...voice.p.sub,  ...preset.sub  };

    // Active flags + mod params — set directly (no voice.set handler for these yet)
    if (preset.osc1Active    !== undefined) voice.p.osc1Active    = preset.osc1Active;
    if (preset.osc2Active    !== undefined) voice.p.osc2Active    = preset.osc2Active;
    if (preset.subActive     !== undefined) voice.p.subActive     = preset.subActive;
    if (preset.osc1ModTarget !== undefined) voice.p.osc1ModTarget = preset.osc1ModTarget;
    if (preset.osc1ModDepth  !== undefined) voice.p.osc1ModDepth  = preset.osc1ModDepth;
    if (preset.osc2ModTarget !== undefined) voice.p.osc2ModTarget = preset.osc2ModTarget;
    if (preset.osc2ModDepth  !== undefined) voice.p.osc2ModDepth  = preset.osc2ModDepth;

    // Filter
    if (preset.filter) {
      if (preset.filter.type      !== undefined) voice.set('filter', 'type',      preset.filter.type);
      if (preset.filter.cutoff    !== undefined) voice.set('filter', 'cutoff',    preset.filter.cutoff);
      if (preset.filter.resonance !== undefined) voice.set('filter', 'resonance', preset.filter.resonance);
      if (preset.filter.envAmount !== undefined) voice.set('filter', 'envAmount', preset.filter.envAmount);
      if (preset.filter.mix       !== undefined) voice.set('filter', 'mix',       preset.filter.mix);
    }

    // ADSR
    if (preset.adsr) {
      ['attack','decay','sustain','release'].forEach(k => {
        if (preset.adsr[k] !== undefined) voice.set('adsr', k, preset.adsr[k]);
      });
    }

    // Dist
    if (preset.dist) {
      ['form','drive','tone','mix'].forEach(k => {
        if (preset.dist[k] !== undefined) voice.set('dist', k, preset.dist[k]);
      });
    }

    // EQ
    if (preset.eq) {
      ['lowGain','midGain','highGain','lowFreq','midFreq','highFreq'].forEach(k => {
        if (preset.eq[k] !== undefined) voice.set('eq', k, preset.eq[k]);
      });
    }

    // FX
    if (preset.fx) {
      ['reverbMix','delayMix','delayTime','delayFB','reverbDecay'].forEach(k => {
        if (preset.fx[k] !== undefined) voice.set('fx', k, preset.fx[k]);
      });
    }

    // Noise
    if (preset.noise) {
      if (preset.noise.volume    !== undefined) voice.set('noise', 'volume',    preset.noise.volume);
      if (preset.noise.type      !== undefined) voice.set('noise', 'type',      preset.noise.type);
      if (preset.noise.filterMix !== undefined) voice.set('noise', 'filterMix', preset.noise.filterMix);
    }

    // LFO engine
    if (preset.lfos && voice.lfoEngine) {
      voice.lfoEngine.fromJSON(preset.lfos);
    }
  });

  // Sequencer
  if (preset.sequencer?.patterns && seq) {
    preset.sequencer.patterns.forEach((pattern, vIdx) => {
      if (!seq.voices[vIdx]) return;
      pattern.forEach((step, sIdx) => {
        if (!seq.voices[vIdx].steps[sIdx]) return;
        seq.voices[vIdx].steps[sIdx].active = step.active || false;
        seq.voices[vIdx].steps[sIdx].note   = step.note   ?? 36;
        seq.voices[vIdx].steps[sIdx].accent = step.accent || false;
      });
    });
  }
}

// ─── savePreset ───────────────────────────────────────────
function savePreset(synth, seq, name, slotIdx) {
  const presets = loadAllPresets();
  presets[slotIdx] = {
    name:    name || `Preset ${slotIdx + 1}`,
    savedAt: Date.now(),
    data:    synthToJSON(synth, seq),
  };
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

// ─── loadPreset ───────────────────────────────────────────
function loadPreset(synth, seq, slotIdx) {
  const presets = loadAllPresets();
  const slot = presets[slotIdx];
  if (!slot) return false;
  applyPresetToSynth(slot.data, synth, seq);
  return true;
}

// ─── loadAllPresets ───────────────────────────────────────
function loadAllPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
  } catch { return {}; }
}

// ─── exportPreset ─────────────────────────────────────────
function exportPreset(synth, seq, name) {
  const data = {
    name,
    version: 2,
    savedAt: new Date().toISOString(),
    data: synthToJSON(synth, seq),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(name || 'preset').replace(/\s+/g, '_')}.wobbler.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ─── importPreset ─────────────────────────────────────────
function importPreset(file, synth, seq, onSuccess) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const data = parsed.data || parsed;
      applyPresetToSynth(data, synth, seq);
      if (onSuccess) onSuccess(parsed.name || 'Imported');
    } catch (err) {
      console.error('Preset import failed:', err);
    }
  };
  reader.readAsText(file);
}
