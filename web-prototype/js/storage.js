// ─────────────────────────────────────────────────────────
//  Patch Engine  (sound + LFO modulation + sequence)
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
    (vp.lfos || []).forEach((lp, i) => {
      if (lp._enabled === undefined) lp._enabled = false;
      // Migration: disabled LFOs with cutoff target would still connect to filter — reset to none
      if (lp._enabled === false && (!lp.target || lp.target === 'cutoff' || lp.target === 'resonance')) lp.target = 'none';
    });
    if (vp.noise.filterMix === undefined) vp.noise.filterMix = 1;
    if (!vp.eq) vp.eq = { lowGain:0, midGain:0, highGain:0, lowFreq:200, midFreq:1000, highFreq:6000 };
    if (!vp.fx) vp.fx = { reverbMix:0, reverbDecay:2.0, delayMix:0, delayTime:0.375, delayFB:0.4 };
    if (vp.filter.bypassed  === undefined) vp.filter.bypassed  = false;
    if (vp.eq.bypassed      === undefined) vp.eq.bypassed      = false;
    if (vp.fx.bypassed      === undefined) vp.fx.bypassed      = false;
    if (!vp.comp) vp.comp = { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false };
    if (vp.comp.bypassed   === undefined) vp.comp.bypassed   = false;
    if (!vp.dist) vp.dist = { form:'soft', drive:0, tone:18000, mix:0, volume:1 };
    if (vp.dist.bypassed   === undefined) vp.dist.bypassed   = false;
    if (vp.dist.tone       === undefined) vp.dist.tone       = 18000;
    if (vp.dist.tonePost   === undefined) vp.dist.tonePost   = false;
    if (vp.osc.unison       === undefined) vp.osc.unison       = 1;
    if (vp.osc.unisonDetune === undefined) vp.osc.unisonDetune = 20;
    if (vp.osc.unisonBlend  === undefined) vp.osc.unisonBlend  = 1;
    vp.lfos.forEach(lp => { if (lp.envA === undefined) lp.envA = 0; if (lp.envR === undefined) lp.envR = 0; });
    // Migration: new engine fields
    if (vp.osc1Active  === undefined) vp.osc1Active  = true;
    if (vp.osc2Active  === undefined) vp.osc2Active  = false;
    if (vp.subActive   === undefined) vp.subActive   = false;
    if (!vp.osc2) vp.osc2 = { waveform:'sine', oct:0, semi:0, detune:7, cents:0, volume:0.5, unison:1, unisonDetune:10 };
    if (!vp.sub)  vp.sub  = { waveform:'sine', oct:-2, cents:0, volume:0.6 };
    if (vp.osc1ModTarget === undefined) vp.osc1ModTarget = 'none';
    if (vp.osc1ModDepth  === undefined) vp.osc1ModDepth  = 0.5;
    if (vp.osc2ModTarget === undefined) vp.osc2ModTarget = 'none';
    if (vp.osc2ModDepth  === undefined) vp.osc2ModDepth  = 0.5;
    if (vp.osc1LfoPitch  === undefined) vp.osc1LfoPitch  = false;

    Object.assign(v.p, JSON.parse(JSON.stringify(vp)));
    // Re-wire LFO engine slots from the loaded lfos array
    if (vp.lfos && v.lfoEngine) v.lfoEngine.fromJSON(vp.lfos);
    // Always reset noise gains to 0 on restore — noteOn will set them correctly
    v._noiseLvlGain.gain.cancelScheduledValues(t);
    v._noiseLvlGain.gain.setValueAtTime(0, t);
    v._noiseLfoGain.gain.cancelScheduledValues(t);
    v._noiseLfoGain.gain.setValueAtTime(0, t);
    if (patch.voicesEnabled) {
      v._enabled = patch.voicesEnabled[i] !== false;
      v.outputGain.gain.setValueAtTime(v._enabled ? vp.volume : 0, t);
    }

    // Sync persistent audio nodes — use direct .value so getFrequencyResponse works immediately
    // Filter (respect bypass state)
    v._filterBypassed = vp.filter.bypassed === true;
    v._filterSetType(v._filterBypassed ? 'allpass' : vp.filter.type);
    v._filterSetCutoff(vp.filter.cutoff, t);
    v._filterSetResonance(vp.filter.resonance, t);
    if (vp.comp) {
      v._voiceComp.threshold.setValueAtTime(vp.comp.threshold ?? -24, t);
      v._voiceComp.knee.setValueAtTime(vp.comp.knee ?? 6, t);
      v._voiceComp.ratio.setValueAtTime(vp.comp.bypassed ? 1 : (vp.comp.ratio ?? 4), t);
      v._voiceComp.attack.setValueAtTime(vp.comp.attack ?? 0.003, t);
      v._voiceComp.release.setValueAtTime(vp.comp.release ?? 0.1, t);
    }
    if (vp.dist) {
      if (!vp.dist.form)     vp.dist.form     = 'soft';
      if (vp.dist.tone  === undefined) vp.dist.tone  = 18000;
      if (vp.dist.tonePost  === undefined) vp.dist.tonePost  = false;
      v._distNode.curve = v._distCurve(vp.dist.form, vp.dist.drive);
      try { v._distTone.frequency.setValueAtTime(Math.max(200, Math.min(18000, vp.dist.tone)), t); } catch(_) {}
      v._distSetTonePost(vp.dist.tonePost === true);
      v._distPost.gain.setValueAtTime(vp.dist.volume ?? 1, t);
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
      // EQ nodes are now GainNode passthroughs — .frequency/.gain not applicable
    }

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

  // ── Factory Presets ──────────────────────────────────────
  if (typeof FACTORY_PRESETS !== 'undefined' && FACTORY_PRESETS.length) {
    const sep3 = document.createElement('div'); sep3.className = 'patch-sep'; bar.appendChild(sep3);

    const factoryLbl = document.createElement('div');
    factoryLbl.style.cssText = 'font-size:8px;color:#444;letter-spacing:1px;white-space:nowrap;align-self:center';
    factoryLbl.textContent = 'FACTORY';
    bar.appendChild(factoryLbl);

    const factorySel = document.createElement('select'); factorySel.className = 'patch-select';
    factorySel.innerHTML = '<option value="">── preset ──</option>';
    FACTORY_PRESETS.forEach((fp, i) => {
      const o = document.createElement('option'); o.value = i; o.textContent = fp.label;
      factorySel.appendChild(o);
    });
    bar.appendChild(factorySel);

    const factoryLoadBtn = document.createElement('button'); factoryLoadBtn.className = 'patch-btn patch-load'; factoryLoadBtn.textContent = 'LOAD';
    factoryLoadBtn.addEventListener('click', () => {
      const idx = parseInt(factorySel.value);
      if (isNaN(idx) || !FACTORY_PRESETS[idx]) return;
      const fp = FACTORY_PRESETS[idx];
      applyPatchToAudio(fp.patch, synth, seq, bpm => { synth.bpm = bpm; seq.setBpm(bpm); });
      rebuildAll(fp.patch);
      nameIn.value = fp.label;
      showToast(`Loaded: ${fp.label}`);
    });
    bar.appendChild(factoryLoadBtn);
  }
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

