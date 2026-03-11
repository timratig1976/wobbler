// ─────────────────────────────────────────────────────────
//  On-screen Piano Keyboard
//  2 octaves (C3–B4, MIDI 48–71)
//  Multi-pointer: each finger/mouse button plays independently
//  Computer keyboard: a-j / w,e,t,y,u = lower oct  k-; / o,p = upper oct
// ─────────────────────────────────────────────────────────

function buildPianoKeyboard(container, synth) {
  const START_MIDI = 48; // C3
  const NUM_OCTAVES = 2;
  const W = 36, BW = 22, WH = 90, BH = 55; // white/black key dimensions

  // Which semitones within an octave are white/black
  const WHITE_SEMI = [0, 2, 4, 5, 7, 9, 11];
  const BLACK_MAP  = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }; // semitone → gap after white key index

  // Build note list: { midi, isBlack, leftPx }
  const notes = [];
  let whiteCount = 0;
  for (let oct = 0; oct < NUM_OCTAVES; oct++) {
    for (let semi = 0; semi < 12; semi++) {
      const midi = START_MIDI + oct * 12 + semi;
      const isBlack = !WHITE_SEMI.includes(semi);
      if (!isBlack) {
        notes.push({ midi, isBlack: false, leftPx: whiteCount * W });
        whiteCount++;
      } else {
        // left edge = boundary between two white keys - BW/2
        const whiteIdx = WHITE_SEMI.filter(s => s < semi).length + oct * 7;
        notes.push({ midi, isBlack: true, leftPx: whiteIdx * W - BW / 2 });
      }
    }
  }

  // Computer keyboard → midi note map
  const KB_MAP = {
    'a':48,'w':49,'s':50,'e':51,'d':52,'f':53,'t':54,
    'g':55,'y':56,'h':57,'u':58,'j':59,
    'k':60,'o':61,'l':62,'p':63,';':64,"'":65,']':66,
  };

  // Toolbar
  const toolbar = document.createElement('div'); toolbar.className = 'piano-toolbar';
  const lbl = document.createElement('span'); lbl.style.cssText = 'color:#555;letter-spacing:2px;font-size:9px;'; lbl.textContent = 'KEYBOARD';
  const hint = document.createElement('span'); hint.className = 'piano-hint';
  hint.textContent = 'a–j = C3–B3  |  k–; = C4–E4  |  w e t y u o p = sharps  |  click + drag for chords';
  toolbar.append(lbl, hint);
  container.appendChild(toolbar);

  // Wrapper
  const wrap = document.createElement('div'); wrap.className = 'piano-wrap';
  // Total width = all white keys
  wrap.style.width = (whiteCount * W) + 'px';
  wrap.style.height = WH + 'px';
  container.appendChild(wrap);

  // Build DOM elements; store refs by midi note
  const keyEls = new Map(); // midi → element

  // White keys first (so black keys overlay them)
  notes.filter(n => !n.isBlack).forEach(n => {
    const el = document.createElement('div'); el.className = 'piano-white';
    el.style.position = 'absolute';
    el.style.left = n.leftPx + 'px';
    el.style.top = '0';
    // Note label for C notes
    const noteName = midiNoteName(n.midi);
    if (noteName.startsWith('C')) {
      const lbl = document.createElement('span'); lbl.className = 'piano-key-lbl';
      lbl.textContent = noteName; el.appendChild(lbl);
    }
    wrap.appendChild(el);
    keyEls.set(n.midi, el);
  });
  // Black keys on top
  notes.filter(n => n.isBlack).forEach(n => {
    const el = document.createElement('div'); el.className = 'piano-black';
    el.style.left = n.leftPx + 'px';
    el.style.top = '0';
    wrap.appendChild(el);
    keyEls.set(n.midi, el);
  });

  function midiNoteName(midi) {
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return names[midi % 12] + Math.floor(midi / 12 - 1);
  }

  // ── Playback state ──────────────────────────────────────
  const activePointers = new Map(); // pointerId → midi
  const activeKeys     = new Set(); // midi notes currently sounding

  function pressNote(midi, pointerId) {
    if (activeKeys.has(midi)) return;
    activeKeys.add(midi);
    activePointers.set(pointerId, midi);
    keyEls.get(midi)?.classList.add('active');

    // Auto-switch to POLY if >1 note held and still in mono
    if (activeKeys.size > 1 && synth.polyMode === 'mono') {
      synth.polyMode = 'poly';
      document.querySelector('.poly-mode-btn')?.dispatchEvent(new Event('_syncLabel'));
    }
    synth.ctx.resume().then(() => synth.noteOn(440 * Math.pow(2, (midi - 69) / 12), 0.75));
  }

  function releaseNote(midi) {
    if (!activeKeys.has(midi)) return;
    activeKeys.delete(midi);
    keyEls.get(midi)?.classList.remove('active');
    synth.noteOff(midi);
  }

  function releasePointer(pointerId) {
    const midi = activePointers.get(pointerId);
    if (midi !== undefined) { releaseNote(midi); activePointers.delete(pointerId); }
  }

  // Resolve which midi note is under a pointer event
  function noteFromPointer(e) {
    // Check black keys first (they are on top)
    for (const [midi, el] of keyEls) {
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        if (el.classList.contains('piano-black')) return midi;
      }
    }
    // Then white keys
    for (const [midi, el] of keyEls) {
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        return midi;
      }
    }
    return null;
  }

  wrap.addEventListener('pointerdown', e => {
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    const midi = noteFromPointer(e);
    if (midi !== null) pressNote(midi, e.pointerId);
  });

  wrap.addEventListener('pointermove', e => {
    if (!activePointers.has(e.pointerId)) return;
    const midi = noteFromPointer(e);
    const prev = activePointers.get(e.pointerId);
    if (midi !== null && midi !== prev) {
      // Glide: release old, press new
      releaseNote(prev);
      activePointers.delete(e.pointerId);
      pressNote(midi, e.pointerId);
    }
  });

  wrap.addEventListener('pointerup',     e => releasePointer(e.pointerId));
  wrap.addEventListener('pointercancel', e => releasePointer(e.pointerId));

  // ── Computer keyboard ───────────────────────────────────
  const kbHeld = new Set();
  window.addEventListener('keydown', e => {
    if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const midi = KB_MAP[e.key];
    if (midi === undefined) return;
    if (kbHeld.has(e.key)) return;
    kbHeld.add(e.key);
    pressNote(midi, 'kb_' + e.key);
  });
  window.addEventListener('keyup', e => {
    const midi = KB_MAP[e.key];
    if (midi === undefined) return;
    kbHeld.delete(e.key);
    releasePointer('kb_' + e.key);
  });

  // Sync POLY button label from outside
  const polyBtns = document.querySelectorAll('button');
  // Expose a function to sync the poly toggle button text
  synth._syncPolyBtn = () => {};
}
