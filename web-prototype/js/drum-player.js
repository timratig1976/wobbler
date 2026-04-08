// ─────────────────────────────────────────────────────────
//  drum-player.js — Reference drum loop player
//  Loops WAV files, syncs transport to sequencer BPM,
//  allows pitch-shift to match any target BPM.
// ─────────────────────────────────────────────────────────

const DRUM_LOOPS = [
  { file: 'audio/MOL_ERD_Drum_Loop_01.wav',           label: 'ERD 01',   bpm: 174 },
  { file: 'audio/MOL_ERD_Drum_Loop_14.wav',           label: 'ERD 14',   bpm: 174 },
  { file: 'audio/TSP_ENEI_172_drum_bigbro_full.wav',  label: 'BIGBRO',   bpm: 172 },
  { file: 'audio/TSP_ENEI_172_drum_lilbro_full.wav',  label: 'LILBRO',   bpm: 172 },
];

function buildDrumPlayer(container, bpmGet) {
  // ── Shared AudioContext (reuse synth's if available, else own) ──
  let _actx = null;
  function getCtx() {
    if (_actx) return _actx;
    if (window._wobblerSynth?.ctx) { _actx = window._wobblerSynth.ctx; return _actx; }
    _actx = new AudioContext();
    return _actx;
  }

  // ── State per loop ──
  const state = DRUM_LOOPS.map(loop => ({
    ...loop,
    buffer:   null,   // decoded AudioBuffer
    source:   null,   // current BufferSourceNode
    gainNode: null,   // GainNode
    playing:  false,
    volume:   0.75,
    loading:  false,
    loaded:   false,
  }));

  // ── Build wrapper bar ──
  const bar = document.createElement('div');
  bar.id = 'drum-player';
  bar.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:10px',
    'padding:5px 14px',
    'background:#06060f',
    'border-bottom:1px solid #1a1a30',
    'flex-shrink:0',
    'flex-wrap:wrap',
  ].join(';');

  // Label
  const lbl = document.createElement('span');
  lbl.style.cssText = 'font-size:9px;letter-spacing:2px;color:#444;white-space:nowrap;flex-shrink:0';
  lbl.textContent = 'DRUMS';
  bar.appendChild(lbl);

  // ── Per-loop slot ──
  const slots = state.map((s, idx) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:5px;background:#0d0d22;border:1px solid #1e1e38;border-radius:4px;padding:3px 8px;flex-shrink:0';

    // BPM badge
    const bpmBadge = document.createElement('span');
    bpmBadge.style.cssText = 'font-size:8px;color:#444;letter-spacing:1px;margin-right:2px;white-space:nowrap';
    bpmBadge.textContent = s.bpm + ' BPM';

    // Label
    const nameLbl = document.createElement('span');
    nameLbl.style.cssText = 'font-size:10px;letter-spacing:1px;color:#666;white-space:nowrap;min-width:42px';
    nameLbl.textContent = s.label;

    // Play button
    const playBtn = document.createElement('button');
    playBtn.style.cssText = 'padding:2px 8px;font-size:10px;letter-spacing:1px;border:1px solid #2a2a44;background:transparent;color:#555;border-radius:3px;font-family:monospace;white-space:nowrap;min-width:52px;transition:.12s';
    playBtn.textContent = '▶ PLAY';

    // Volume knob (simple range input)
    const volWrap = document.createElement('label');
    volWrap.style.cssText = 'display:flex;align-items:center;gap:3px;cursor:pointer';
    const volLbl = document.createElement('span');
    volLbl.style.cssText = 'font-size:8px;color:#444;letter-spacing:1px';
    volLbl.textContent = 'VOL';
    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.min = '0'; volSlider.max = '1'; volSlider.step = '0.01';
    volSlider.value = String(s.volume);
    volSlider.style.cssText = 'width:56px;accent-color:#00ffb2;cursor:pointer';
    volWrap.append(volLbl, volSlider);

    // Sync indicator (shows playback rate when BPM-synced)
    const syncLbl = document.createElement('span');
    syncLbl.style.cssText = 'font-size:8px;color:#333;letter-spacing:1px;min-width:36px;text-align:right';

    wrap.append(bpmBadge, nameLbl, playBtn, volWrap, syncLbl);
    bar.appendChild(wrap);

    // ── Load audio buffer ──
    async function loadBuffer() {
      if (s.loaded || s.loading) return;
      s.loading = true;
      playBtn.textContent = '...';
      try {
        const ctx = getCtx();
        const resp = await fetch(s.file);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const ab = await resp.arrayBuffer();
        s.buffer = await ctx.decodeAudioData(ab);
        s.loaded = true;
        playBtn.textContent = s.playing ? '■ STOP' : '▶ PLAY';
      } catch(e) {
        console.warn('[DrumPlayer] Failed to load', s.file, e);
        playBtn.textContent = 'ERR';
        playBtn.style.color = '#ff4444';
        s.loading = false;
      }
    }

    // ── Start playback ──
    function startPlay() {
      const ctx = getCtx();
      if (ctx.state === 'suspended') ctx.resume();
      if (!s.buffer) return;

      stopPlay();

      s.gainNode = ctx.createGain();
      s.gainNode.gain.value = s.volume;
      s.gainNode.connect(ctx.destination);

      s.source = ctx.createBufferSource();
      s.source.buffer = s.buffer;
      s.source.loop = true;

      // Pitch-shift to match current sequencer BPM
      const targetBpm = bpmGet ? bpmGet() : 120;
      s.source.playbackRate.value = targetBpm / s.bpm;
      syncLbl.textContent = 'x' + (targetBpm / s.bpm).toFixed(2);
      syncLbl.style.color = Math.abs(targetBpm - s.bpm) < 2 ? '#00ffb2' : '#fb923c';

      s.source.connect(s.gainNode);
      s.source.start(0);
      s.playing = true;

      playBtn.textContent = '■ STOP';
      playBtn.style.borderColor = '#00ffb2';
      playBtn.style.color = '#00ffb2';
      nameLbl.style.color = '#00ffb2';
    }

    // ── Stop playback ──
    function stopPlay() {
      if (s.source) {
        try { s.source.stop(); } catch(_) {}
        try { s.source.disconnect(); } catch(_) {}
        s.source = null;
      }
      if (s.gainNode) {
        try { s.gainNode.disconnect(); } catch(_) {}
        s.gainNode = null;
      }
      s.playing = false;
      playBtn.textContent = '▶ PLAY';
      playBtn.style.borderColor = '#2a2a44';
      playBtn.style.color = '#555';
      nameLbl.style.color = '#666';
      syncLbl.textContent = '';
    }

    // ── Volume ──
    volSlider.addEventListener('input', () => {
      s.volume = parseFloat(volSlider.value);
      if (s.gainNode) s.gainNode.gain.setTargetAtTime(s.volume, getCtx().currentTime, 0.02);
    });

    // ── Play button ──
    playBtn.addEventListener('click', async () => {
      if (!s.loaded && !s.loading) await loadBuffer();
      if (!s.loaded) return;
      if (s.playing) stopPlay();
      else startPlay();
    });

    // Preload on hover for snappy response
    wrap.addEventListener('mouseenter', () => { if (!s.loaded && !s.loading) loadBuffer(); }, { once: true });

    return { startPlay, stopPlay, updateRate: () => {
      if (s.playing && s.source) {
        const targetBpm = bpmGet ? bpmGet() : 120;
        s.source.playbackRate.setTargetAtTime(targetBpm / s.bpm, getCtx().currentTime, 0.05);
        syncLbl.textContent = 'x' + (targetBpm / s.bpm).toFixed(2);
        syncLbl.style.color = Math.abs(targetBpm - s.bpm) < 2 ? '#00ffb2' : '#fb923c';
      }
    }};
  });

  // ── STOP ALL button ──
  const stopAllBtn = document.createElement('button');
  stopAllBtn.style.cssText = 'padding:3px 10px;font-size:9px;letter-spacing:1px;border:1px solid #442222;background:transparent;color:#a55;border-radius:3px;font-family:monospace;white-space:nowrap;flex-shrink:0;margin-left:auto';
  stopAllBtn.textContent = '■ ALL';
  stopAllBtn.title = 'Stop all loops';
  stopAllBtn.addEventListener('click', () => slots.forEach(s => s.stopPlay()));
  bar.appendChild(stopAllBtn);

  container.appendChild(bar);

  // Return API to allow BPM sync from outside
  return {
    updateBpm() { slots.forEach(s => s.updateRate()); }
  };
}
