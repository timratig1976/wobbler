function buildSequencer(seq) {
  // Build sequencer for each voice in its own column
  seq.voices.forEach((vSeq, vIdx) => {
    const container = document.getElementById(`seq-${vIdx}`);
    if (!container) return;

    // Wire the play button already in the section header
    const playBtn = container.querySelector('.voice-seq-play-btn');
    if (playBtn) {
      const updateBtn = () => {
        playBtn.classList.toggle('active', vSeq.enabled);
        playBtn.textContent = vSeq.enabled ? '⏹' : '▶';
      };
      updateBtn();
      playBtn.addEventListener('click', () => {
        vSeq.enabled = !vSeq.enabled;
        updateBtn();
        if (vSeq.enabled) {
          // Start global clock if not already running
          if (!seq.playing) {
            seq.play();
            const mainPlayBtn = document.getElementById('play-btn');
            if (mainPlayBtn) { mainPlayBtn.classList.add('playing'); mainPlayBtn.textContent = 'STOP'; }
          }
        } else {
          // Stop hanging notes on this voice
          seq.synth.voices[vIdx].noteOff();
        }
      });
    }

    const grid = document.createElement('div'); 
    grid.className = 'seq-grid'; 
    container.appendChild(grid);
    
    const cells = [];
    vSeq.steps.forEach((s, i) => {
      const cell = document.createElement('div'); 
      cell.className = 'seq-cell';
      const stepBtn = document.createElement('button'); 
      stepBtn.className = 'seq-btn' + (s.active ? ' active' : ''); 
      stepBtn.textContent = i + 1;
      const noteSel = document.createElement('select'); 
      noteSel.className = 'seq-note';
      SEQ_NOTES.forEach(n => { 
        const o = document.createElement('option'); 
        o.value = n.midi; 
        o.textContent = n.name; 
        if (n.midi === s.note) o.selected = true; 
        noteSel.appendChild(o); 
      });
      const accBtn = document.createElement('button'); 
      accBtn.className = 'seq-acc' + (s.accent ? ' active' : ''); 
      accBtn.textContent = '!';
      stepBtn.addEventListener('click', () => { 
        s.active = !s.active; 
        stepBtn.classList.toggle('active', s.active); 
      });
      noteSel.addEventListener('change', () => { 
        s.note = parseInt(noteSel.value); 
      });
      accBtn.addEventListener('click', () => { 
        s.accent = !s.accent; 
        accBtn.classList.toggle('active', s.accent); 
      });
      cell.append(stepBtn, noteSel, accBtn); 
      grid.appendChild(cell); 
      cells.push({cell, stepBtn});
    });
    
    // Store cells for this voice
    if (!seq._voiceCells) seq._voiceCells = [];
    seq._voiceCells[vIdx] = cells;
  });
  
  // Update onStep to highlight current step across all 3 voice sequencers
  seq.onStep = idx => {
    if (seq._voiceCells) {
      seq._voiceCells.forEach(cells => {
        cells.forEach(({stepBtn}, i) => stepBtn.classList.toggle('playing', i === idx));
      });
    }
  };
}

// ─────────────────────────────────────────────────────────
//  Master section
// ─────────────────────────────────────────────────────────
function buildMaster(container, synth) {
  // Per-voice mix strip
  const mixRow=document.createElement('div'); mixRow.className='mix-row'; container.appendChild(mixRow);
  synth.voices.forEach((v,i)=>{
    const col=document.createElement('div'); col.className='mix-col'; mixRow.appendChild(col);
    col.innerHTML=`<div class="mix-lbl" style="color:${VOICE_COLORS[i]}">${VOICE_LABELS[i]}</div>`;
    const kr=document.createElement('div'); kr.className='knob-row'; col.appendChild(kr);
    makeKnob({parent:kr,min:0,max:1, value:v.p.volume,label:'VOL',decimals:2,color:VOICE_COLORS[i],onChange:val=>{
      v.p.volume = val;
      if (v._enabled) v.outputGain.gain.setTargetAtTime(val, v.ctx.currentTime, 0.01);
    }});
    makeKnob({parent:kr,min:-1,max:1,value:v.p.pan,label:'PAN',decimals:2,color:VOICE_COLORS[i],onChange:val=>{
      v.p.pan = val;
      v.panner.pan.setTargetAtTime(val, v.ctx.currentTime, 0.01);
    }});
    const btnRow=document.createElement('div'); btnRow.className='mix-btn-row'; col.appendChild(btnRow);
    const muteBtn=document.createElement('button'); muteBtn.className='mix-mute-btn'; muteBtn.textContent='M';
    muteBtn.addEventListener('click',()=>{
      v._enabled = !v._enabled;
      muteBtn.classList.toggle('active', !v._enabled);
      const voiceCol = document.getElementById(`voice-${i+1}`);
      const toggle = voiceCol?.querySelector(`#voice-toggle-${i}`);
      if (toggle) toggle.checked = v._enabled;
      if (voiceCol) voiceCol.classList.toggle('voice-off', !v._enabled);
      const t = v.ctx.currentTime;
      v.outputGain.gain.setTargetAtTime(v._enabled ? v.p.volume : 0, t, 0.02);
      if (!v._enabled) v._killSrcs();
    });
    const soloBtn=document.createElement('button'); soloBtn.className='mix-solo-btn'; soloBtn.textContent='S';
    soloBtn.addEventListener('click',()=>{
      const isSolo=soloBtn.classList.contains('active');
      mixRow.querySelectorAll('.mix-solo-btn').forEach(b=>b.classList.remove('active'));
      if (!isSolo) {
        soloBtn.classList.add('active');
        synth.voices.forEach((voice, idx) => {
          const enable = idx === i;
          voice._enabled = enable;
          const vCol = document.getElementById(`voice-${idx+1}`);
          const vToggle = vCol?.querySelector(`#voice-toggle-${idx}`);
          if (vToggle) vToggle.checked = enable;
          if (vCol) vCol.classList.toggle('voice-off', !enable);
          voice.outputGain.gain.setTargetAtTime(enable ? voice.p.volume : 0, voice.ctx.currentTime, 0.02);
          if (!enable) voice._killSrcs();
        });
      } else {
        synth.voices.forEach((voice, idx) => {
          voice._enabled = true;
          const vCol = document.getElementById(`voice-${idx+1}`);
          const vToggle = vCol?.querySelector(`#voice-toggle-${idx}`);
          if (vToggle) vToggle.checked = true;
          if (vCol) vCol.classList.remove('voice-off');
          voice.outputGain.gain.setTargetAtTime(voice.p.volume, voice.ctx.currentTime, 0.02);
        });
      }
    });
    btnRow.append(muteBtn,soloBtn);
  });

  // FX row
  const fxRow=document.createElement('div'); fxRow.className='knob-row fx-row'; container.appendChild(fxRow);
  const s=synth;
  makeKnob({parent:fxRow,min:0,max:1,   value:s.masterGain.gain.value,label:'MASTER',     decimals:2,color:'#ddd',onChange:v=>s.masterGain.gain.setTargetAtTime(v,s.ctx.currentTime,0.01)});
  makeKnob({parent:fxRow,min:0.01,max:1,value:s.delay.delayTime.value,label:'DLY-T',unit:'s',decimals:2,color:'#888',onChange:v=>s.delay.delayTime.setTargetAtTime(v,s.ctx.currentTime,0.01)});
  makeKnob({parent:fxRow,min:0,max:0.9, value:s.delayFB.gain.value,   label:'DLY-FB',     decimals:2,color:'#888',onChange:v=>s.delayFB.gain.setTargetAtTime(v,s.ctx.currentTime,0.01)});
  makeKnob({parent:fxRow,min:0,max:1,   value:s.delayWet.gain.value,  label:'DLY-MX',     decimals:2,color:'#888',onChange:v=>s.delayWet.gain.setTargetAtTime(v,s.ctx.currentTime,0.01)});

  // Master bus filter — type toggle + cutoff + resonance
  const mfWrap = document.createElement('div');
  mfWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;margin-left:8px;border-left:1px solid #1a1a30;padding-left:8px;';
  const mfLbl = document.createElement('div');
  mfLbl.textContent = 'M.FILTER';
  mfLbl.style.cssText = 'font-size:8px;letter-spacing:1px;color:rgba(255,255,255,0.25);margin-bottom:1px;';
  mfWrap.appendChild(mfLbl);
  // Type buttons row
  const mfTypeRow = document.createElement('div');
  mfTypeRow.style.cssText = 'display:flex;gap:2px;';
  const MF_TYPES = ['lowpass','highpass','bandpass','notch'];
  const MF_LABELS = { lowpass:'LP', highpass:'HP', bandpass:'BP', notch:'NO' };
  const mfBtns = [];
  MF_TYPES.forEach(t => {
    const b = document.createElement('button');
    b.textContent = MF_LABELS[t];
    b.title = t;
    const active = s.masterFilter.type === t;
    b.style.cssText = `padding:2px 5px;font-size:9px;letter-spacing:0.5px;background:transparent;border:1px solid ${active?'#aaa':'#2a2a44'};color:${active?'#fff':'#555'};border-radius:2px;cursor:pointer;font-family:monospace;`;
    b.addEventListener('click', () => {
      mfBtns.forEach(x => { x.style.borderColor='#2a2a44'; x.style.color='#555'; });
      b.style.borderColor = '#aaa'; b.style.color = '#fff';
      try { s.masterFilter.type = t; } catch(_) {}
    });
    mfBtns.push(b); mfTypeRow.appendChild(b);
  });
  mfWrap.appendChild(mfTypeRow);
  // Knobs row
  const mfKnobRow = document.createElement('div');
  mfKnobRow.style.cssText = 'display:flex;gap:2px;';
  mfWrap.appendChild(mfKnobRow);
  makeKnob({parent:mfKnobRow,min:20,max:20000,value:s.masterFilter.frequency.value,label:'CUT',decimals:0,log:true,size:40,color:'#aaa',
    onChange:v=>{ try { s.masterFilter.frequency.setTargetAtTime(Math.max(20,Math.min(20000,v)),s.ctx.currentTime,0.02); } catch(_){} }});
  makeKnob({parent:mfKnobRow,min:0.01,max:18,value:s.masterFilter.Q.value,label:'RES',decimals:1,size:40,color:'#aaa',
    onChange:v=>{ try { s.masterFilter.Q.setTargetAtTime(Math.max(0.01,v),s.ctx.currentTime,0.02); } catch(_){} }});
  fxRow.appendChild(mfWrap);

  // POLY / MONO toggle
  const polyWrap = document.createElement('div');
  polyWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;margin-left:8px;';
  const polyBtn = document.createElement('button');
  polyBtn.className = 'poly-mode-btn';
  polyBtn.style.cssText = 'font-size:9px;letter-spacing:2px;padding:4px 10px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:#12122a;color:rgba(255,255,255,0.4);cursor:pointer;transition:all 0.15s;';
  polyBtn.textContent = 'MONO';
  polyBtn.title = 'MONO: all voices layer on the same note\nPOLY: one voice lane per note (3-note max)\nCHORD: each chord note → a unison slot within one lane';
  const polyLbl = document.createElement('div');
  polyLbl.style.cssText = 'font-size:8px;letter-spacing:1px;color:rgba(255,255,255,0.25);';
  polyLbl.textContent = 'MODE';
  const MODE_CYCLE = ['mono', 'poly', 'chord'];
  const MODE_COLOR = { mono: 'rgba(255,255,255,0.4)', poly: '#00ffb2', chord: '#a855f7' };
  const MODE_BORDER = { mono: 'rgba(255,255,255,0.15)', poly: '#00ffb2', chord: '#a855f7' };
  function syncPolyBtn() {
    const m = synth.polyMode;
    polyBtn.textContent = m.toUpperCase();
    polyBtn.style.color = MODE_COLOR[m];
    polyBtn.style.borderColor = MODE_BORDER[m];
  }
  polyBtn.addEventListener('_syncLabel', syncPolyBtn);
  polyBtn.addEventListener('click', () => {
    const idx = MODE_CYCLE.indexOf(synth.polyMode);
    synth.polyMode = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
    synth.voices.forEach(v => { v.noteOff(); v._heldSlots = new Set(); });
    synth._voiceNoteMap.clear();
    synth._chordSlotMap.clear();
    syncPolyBtn();
  });
  polyWrap.append(polyBtn, polyLbl);
  fxRow.appendChild(polyWrap);
}

// ─────────────────────────────────────────────────────────
//  Visualizer with Toggle + Metrics
// ─────────────────────────────────────────────────────────
function buildVisualizer(container, analyser) {
  const vizWrap = document.createElement('div'); vizWrap.className = 'viz-container';
  container.appendChild(vizWrap);

  // Controls row
  const controls = document.createElement('div'); controls.className = 'viz-controls';
  const waveBtn = document.createElement('button'); waveBtn.className = 'viz-toggle-btn active'; waveBtn.textContent = 'WAVE';
  const specBtn = document.createElement('button'); specBtn.className = 'viz-toggle-btn'; specBtn.textContent = 'SPEC';
  const metrics = document.createElement('div'); metrics.className = 'viz-metrics';
  metrics.innerHTML = `
    <span class="viz-metric">PEAK: <span class="viz-metric-val" id="viz-peak">0.0</span></span>
    <span class="viz-metric">RMS: <span class="viz-metric-val" id="viz-rms">0.0</span></span>
    <span class="viz-metric">FUND: <span class="viz-metric-val" id="viz-fund">—</span></span>
    <span class="viz-metric">CPU: <span class="viz-metric-val" id="viz-cpu">—</span></span>
    <span class="viz-metric">LAT: <span class="viz-metric-val" id="viz-lat">—</span></span>
  `;
  controls.append(waveBtn, specBtn, metrics);
  vizWrap.appendChild(controls);

  // Canvas
  const canvas = document.createElement('canvas'); canvas.id = 'viz';
  vizWrap.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  const c = canvas.getContext('2d');
  const timeBuf = new Uint8Array(analyser.frequencyBinCount);
  const freqBuf = new Uint8Array(analyser.frequencyBinCount);
  let mode = 'wave';

  waveBtn.addEventListener('click', () => {
    mode = 'wave'; waveBtn.classList.add('active'); specBtn.classList.remove('active');
  });
  specBtn.addEventListener('click', () => {
    mode = 'spec'; specBtn.classList.add('active'); waveBtn.classList.remove('active');
  });

  let _rafLast = performance.now(), _rafSmooth = 16.67;
  function draw(rafNow) {
    requestAnimationFrame(draw);
    _rafSmooth = _rafSmooth * 0.92 + (rafNow - _rafLast) * 0.08;
    _rafLast = rafNow;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    c.scale(dpr, dpr);
    c.fillStyle = '#06061a'; c.fillRect(0, 0, W, H);

    if (mode === 'wave') {
      analyser.getByteTimeDomainData(timeBuf);
      c.beginPath(); c.strokeStyle = '#00ffb2'; c.lineWidth = 1.5;
      const sl = W / timeBuf.length;
      let peak = 0;
      for (let i = 0; i < timeBuf.length; i++) {
        const v = timeBuf[i] / 128 - 1;
        peak = Math.max(peak, Math.abs(v));
        const y = H / 2 - v * (H / 2 - 4);
        i === 0 ? c.moveTo(0, y) : c.lineTo(i * sl, y);
      }
      c.stroke();
      // Update peak metric
      document.getElementById('viz-peak').textContent = peak.toFixed(2);
    } else {
      analyser.getByteFrequencyData(freqBuf);
      const barCount = 128;
      const barWidth = W / barCount;
      let peakIdx = 0, peakVal = 0;
      for (let i = 0; i < barCount; i++) {
        const barHeight = (freqBuf[i] / 255) * (H - 4);
        if (freqBuf[i] > peakVal) { peakVal = freqBuf[i]; peakIdx = i; }
        const hue = 180 - (freqBuf[i] / 255) * 60;
        c.fillStyle = `hsl(${hue}, 70%, 50%)`;
        c.fillRect(i * barWidth, H - barHeight, barWidth - 1, barHeight);
      }
      // Fundamental frequency detection (simple peak finding)
      const nyquist = analyser.context.sampleRate / 2;
      const fundFreq = (peakIdx / barCount) * nyquist;
      document.getElementById('viz-fund').textContent = fundFreq > 20 ? Math.round(fundFreq) + ' Hz' : '—';
    }

    // RMS calculation
    let sumSq = 0;
    for (let i = 0; i < timeBuf.length; i++) {
      const v = timeBuf[i] / 128 - 1;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / timeBuf.length);
    document.getElementById('viz-rms').textContent = rms.toFixed(2);

    // CPU (RAF frame time) + audio latency
    const cpuPct = Math.min(999, Math.max(0, Math.round((_rafSmooth / 16.67 - 1) * 100)));
    const cpuEl = document.getElementById('viz-cpu');
    if (cpuEl) {
      const ctx = analyser.context;
      const idle = ctx.state === 'suspended';
      cpuEl.textContent = idle ? 'IDLE' : cpuPct + '%';
      cpuEl.style.color = idle ? '#555' : cpuPct > 50 ? '#ff4444' : cpuPct > 20 ? '#ffaa00' : '#00ffb2';
    }
    const latEl = document.getElementById('viz-lat');
    if (latEl) {
      const ctx = analyser.context;
      const lat = Math.round(((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000);
      latEl.textContent = lat > 0 ? lat + 'ms' : '—';
      latEl.style.color = lat > 50 ? '#ff4444' : lat > 20 ? '#ffaa00' : '#00ffb2';
    }
  }
  draw(performance.now());
}

