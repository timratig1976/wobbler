function handleMIDI(e, synth) {
  if (!e.data || e.data.length < 2) return;
  const [s0, d1, d2=0] = e.data;
  const type = s0 & 0xF0;
  if (type === 0x90 && d2 > 0) {                           // note on
    _heldNotes.set(d1, d2 / 127);
    synth._currentMidiNote = d1;
    synth.resume().then(() => synth.noteOn(midiToFreq(d1), d2 / 127));
  } else if (type === 0x80 || (type === 0x90 && d2 === 0)) { // note off
    _heldNotes.delete(d1);
    if (synth.polyMode !== 'mono') {
      synth.noteOff(d1); // poly/chord: release only the voice/slot playing this note
    } else if (d1 === synth._currentMidiNote) {
      if (_heldNotes.size > 0) {
        // Fall back to most recently held note (last-note priority)
        const notes = [..._heldNotes.keys()];
        const fallback = notes[notes.length - 1];
        synth._currentMidiNote = fallback;
        synth.noteOn(midiToFreq(fallback), _heldNotes.get(fallback));
      } else {
        synth.noteOff(); // no more held notes → release
      }
    }
    // If released note isn't the current one → ignore (don't cut playing note)
  } else if (type === 0xB0) {                               // CC
    const fn = MIDI_CC[d1]; if (fn) fn(d2, synth);
  } else if (type === 0xE0) {                               // pitch bend ±200 cents
    const raw = (d2 << 7) | d1;
    synth.bend(((raw - 8192) / 8192) * 200);
  }
}

function setupMIDI(synth) {
  const el = document.getElementById('midi-status');
  if (!navigator.requestMIDIAccess) {
    if (el) el.textContent = 'NO MIDI'; return;
  }
  navigator.requestMIDIAccess({ sysex: false }).then(access => {
    function connect(acc) {
      acc.inputs.forEach(port => { port.onmidimessage = e => handleMIDI(e, synth); });
      const n = acc.inputs.size;
      if (el) { el.textContent = `MIDI: ${n} PORT${n!==1?'S':''}`; el.classList.toggle('active', n > 0); }
    }
    connect(access);
    access.onstatechange = () => connect(access);
  }).catch(() => { if (el) el.textContent = 'MIDI DENIED'; });
}

// ─────────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────────
