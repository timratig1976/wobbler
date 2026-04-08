document.addEventListener('DOMContentLoaded', () => {
  const synth = new WobblerSynth();
  const seq   = new Sequencer(synth);
  const bpmGet = () => seq.bpm;

  const OSC_MODES = ['osc1', 'osc2', 'sub'];

  function buildAllVoices() {
    const centerPanel = document.getElementById('center-panel');
    if (centerPanel) centerPanel.innerHTML = '';
    // Build LFO ENGINE first so it appears above MOD MONITOR / EQ / FX
    if (centerPanel && typeof buildAllLFOEngines === 'function') {
      buildAllLFOEngines(synth.voices, VOICE_COLORS, centerPanel);
    }
    synth.voices.forEach((v,i) => {
      const col = document.getElementById(`voice-${i+1}`);
      if (!col) return;
      col.innerHTML = '';
      col.style.setProperty('--accent', VOICE_COLORS[i]);
      buildVoicePanel(col, v, VOICE_COLORS[i], bpmGet, OSC_MODES[i], centerPanel || col);
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

  // Drum loop player
  const drumMount = document.getElementById('drum-player-mount');
  const drumPlayer = drumMount ? buildDrumPlayer(drumMount, bpmGet) : null;

  // Master
  const masterEl=document.getElementById('master-section');
  buildMaster(masterEl, synth);
  buildVisualizer(masterEl, synth.analyser);

  // Patch Bar — mounted to left 50% area below header
  const patchBarMount = document.getElementById('patch-bar-mount');
  if (patchBarMount) {
    buildPatchBar(patchBarMount, synth, seq, rebuildAll);
  }

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
    drumPlayer?.updateBpm();
  }
  bpmInput?.addEventListener('input', () => updateBpm(parseInt(bpmInput.value)||120));
  document.getElementById('bpm-up')?.addEventListener('click', () => updateBpm(seq.bpm+1));
  document.getElementById('bpm-down')?.addEventListener('click', () => updateBpm(seq.bpm-1));

  // ── Audio Recorder ───────────────────────────────────────
  const recBtn = document.getElementById('rec-btn');
  let _recorder = null, _recChunks = [], _recStream = null;

  function _startRecording() {
    try {
      const ctx = synth.ctx;
      // Tap masterGain → MediaStreamDestination → MediaRecorder
      const dest = ctx.createMediaStreamDestination();
      synth.masterGain.connect(dest);
      _recStream = dest;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      _recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : {});
      _recChunks = [];
      _recorder.ondataavailable = e => { if (e.data.size > 0) _recChunks.push(e.data); };
      _recorder.onstop = () => {
        synth.masterGain.disconnect(dest);
        const blob = new Blob(_recChunks, { type: _recorder.mimeType || 'audio/webm' });
        const ext  = blob.type.includes('ogg') ? 'ogg' : 'webm';
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `wobbler-${Date.now()}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        recBtn.textContent = '⏺ REC';
        recBtn.classList.remove('recording');
        showToast('Recording saved');
      };
      _recorder.start(100); // collect chunks every 100ms
      recBtn.textContent = '⏹ STOP REC';
      recBtn.classList.add('recording');
      showToast('Recording started…');
    } catch(err) {
      showToast('Recording failed: ' + err.message);
    }
  }

  function _stopRecording() {
    if (_recorder && _recorder.state !== 'inactive') _recorder.stop();
  }

  recBtn?.addEventListener('click', () => {
    if (_recorder && _recorder.state === 'recording') {
      _stopRecording();
    } else {
      synth.resume(); // ensure AudioContext is running
      _startRecording();
    }
  });

  // Web MIDI
  setupMIDI(synth);

  // AI Bar
  if (typeof initAIBar === 'function') initAIBar(synth, seq);

  // Unlock AudioContext
  document.addEventListener('pointerdown', () => synth.resume(), {once:true});
});
