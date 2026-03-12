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
