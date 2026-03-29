function buildVoicePanel(col, voice, color, bpmGet, oscMode, centerCol) {
  if (!centerCol) centerCol = col;
  const p = voice.p;

  // Create voice header with toggle
  const hdr = document.createElement('div');
  hdr.className = 'voice-header';
  hdr.textContent = `VOICE ${voice.id + 1}`;
  
  const toggleId = `voice-toggle-${voice.id}`;
  const wrap = document.createElement('label');
  wrap.className = 'voice-toggle'; wrap.htmlFor = toggleId;
  const cb  = document.createElement('input');
  cb.type = 'checkbox'; cb.id = toggleId; cb.checked = voice._enabled;
  const track = document.createElement('span'); track.className = 'voice-toggle-track';
  const lbl   = document.createElement('span'); lbl.className = 'voice-toggle-lbl'; lbl.textContent = voice._enabled ? 'ON' : 'OFF';
  wrap.append(cb, track, lbl);
  hdr.appendChild(wrap);
  col.appendChild(hdr);
  
  cb.addEventListener('change', () => {
    const on = cb.checked;
    lbl.textContent = on ? 'ON' : 'OFF';
    col.classList.toggle('voice-off', !on);
    voice._enabled = on;
    
    // Sync master M button
    const masterSection = document.getElementById('master-section');
    const muteBtn = masterSection?.querySelectorAll('.mix-mute-btn')[voice.id];
    if (muteBtn) muteBtn.classList.toggle('active', !on);
    
    const t = voice.ctx.currentTime;
    if (voice.ctx.state === 'running') {
      voice.outputGain.gain.setTargetAtTime(on ? p.volume : 0, t, 0.02);
    } else {
      voice.outputGain.gain.value = on ? p.volume : 0;
    }
    if (!on) voice._killSrcs();
  });

  // ── Live oscilloscope ─────────────────────────────────────
  (function buildScope() {
    const scopeWrap = document.createElement('div');
    scopeWrap.style.cssText = 'position:relative;margin-bottom:6px';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'display:block;width:100%;height:52px;background:#030308;border-radius:4px;border:1px solid #1a1a30';
    cv.height = 52;
    scopeWrap.appendChild(cv);
    const lbl = document.createElement('div');
    lbl.style.cssText = 'position:absolute;top:3px;right:6px;font-size:9px;color:#333;letter-spacing:1px;pointer-events:none';
    lbl.textContent = 'OUT';
    scopeWrap.appendChild(lbl);
    col.appendChild(scopeWrap);

    const buf = new Float32Array(voice.analyser.fftSize);
    let rafId = null;

    function drawScope() {
      rafId = requestAnimationFrame(drawScope);
      const dpr = window.devicePixelRatio || 1;
      const W = cv.offsetWidth || 200, H = cv.offsetHeight || 52;
      if (!W || !H) return;
      if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      const c = cv.getContext('2d'); c.scale(dpr, dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      c.fillStyle = '#030308'; c.fillRect(0, 0, W, H);
      // zero line
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();

      voice.analyser.getFloatTimeDomainData(buf);
      const step = Math.floor(buf.length / W);

      // glow pass
      c.save();
      c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 6;
      c.globalAlpha = 0.3; c.lineWidth = 3; c.lineJoin = 'round';
      c.beginPath();
      for (let i = 0; i < W; i++) {
        const s = buf[i * step] || 0;
        const y = (0.5 - s * 0.45) * H;
        i === 0 ? c.moveTo(i, y) : c.lineTo(i, y);
      }
      c.stroke(); c.restore();

      // main line
      c.save();
      c.strokeStyle = color; c.lineWidth = 1.5; c.lineJoin = 'round';
      c.shadowColor = color; c.shadowBlur = 2;
      c.beginPath();
      for (let i = 0; i < W; i++) {
        const s = buf[i * step] || 0;
        const y = (0.5 - s * 0.45) * H;
        i === 0 ? c.moveTo(i, y) : c.lineTo(i, y);
      }
      c.stroke(); c.restore();
    }
    drawScope();
  })();

  function sec(title) {
    const d=document.createElement('div'); d.className='v-sec';
    d.innerHTML=`<div class="sec-hdr">${title}</div>`; col.appendChild(d); return d;
  }
  function cSec(title) {
    const d=document.createElement('div'); d.className='v-sec';
    d.innerHTML=`<div class="sec-hdr">${title}</div>`; centerCol.appendChild(d); return d;
  }
  function kRow(parent) { const d=document.createElement('div'); d.className='knob-row'; parent.appendChild(d); return d; }
  function bRow(parent) { const d=document.createElement('div'); d.className='btn-row'; parent.appendChild(d); return d; }

  // ── OSC SECTION ───────────────────────────────────────────
  const oscS = sec('OSC');

  // SVG waveform icon paths
  const WAVE_SVG = {
    sawtooth: '<svg viewBox="0 0 32 18" style="width:28px;height:18px"><path d="M2 14L16 3L16 14L30 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    square:   '<svg viewBox="0 0 32 18" style="width:28px;height:18px"><path d="M2 14L2 4L13 4L13 14L19 14L19 4L30 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    triangle: '<svg viewBox="0 0 32 18" style="width:28px;height:18px"><path d="M2 14L9 3L16 14L23 3L30 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    sine:     '<svg viewBox="0 0 32 18" style="width:28px;height:18px"><path d="M2 9Q8 1 16 9Q24 17 30 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    pulse:    '<svg viewBox="0 0 32 18" style="width:28px;height:18px"><path d="M2 14L2 4L10 4L10 14L16 14L16 4L22 4L22 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    supersaw: '<svg viewBox="0 0 32 18" style="width:28px;height:18px"><path d="M2 14L8 4L8 14L14 4L14 14L20 4L20 14L26 4L26 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };

  // Helper: build SVG waveform button row
  function makeWaveRow(parent, waves, currentWave, onChange) {
    const row = document.createElement('div'); row.className = 'btn-row osc-wave-row'; parent.appendChild(row);
    const btns = [];
    waves.forEach(w => {
      const b = document.createElement('button');
      b.className = 'wave-btn osc-wave-btn' + (currentWave === w ? ' active' : '');
      b.innerHTML = WAVE_SVG[w] || w; b.dataset.waveform = w; b.title = w;
      row.appendChild(b); btns.push(b);
      b.addEventListener('click', () => { btns.forEach(x => x.classList.remove('active')); b.classList.add('active'); onChange(w); });
    });
    return { btns, activate: w => { btns.forEach(x => x.classList.remove('active')); const f = btns.find(b=>b.dataset.waveform===w); if(f) f.classList.add('active'); } };
  }

  // Helper: OCT segment row (-2/-1/0/+1/+2)
  function makeOctRow(parent, vals, currentVal, onChange) {
    const wrap = document.createElement('div'); wrap.style.cssText = 'margin-bottom:6px';
    const lbl = document.createElement('div'); lbl.className = 'knob-lbl'; lbl.style.cssText = 'margin-bottom:3px;letter-spacing:1px'; lbl.textContent = 'OCT';
    wrap.appendChild(lbl);
    const row = document.createElement('div'); row.className = 'btn-row'; wrap.appendChild(row);
    const btns = [];
    vals.forEach(v => {
      const b = document.createElement('button');
      b.className = 'wave-btn' + (v === currentVal ? ' active' : '');
      b.textContent = v >= 0 ? (v === 0 ? '0' : `+${v}`) : `${v}`; b.dataset.oct = v;
      b.addEventListener('click', () => { btns.forEach(x => x.classList.remove('active')); b.classList.add('active'); onChange(v); });
      btns.push(b); row.appendChild(b);
    });
    parent.appendChild(wrap);
    return btns;
  }

  // Helper: drawable wavetable canvas (click+drag to draw custom waveform)
  function makeWavetableCanvas(parent, accentColor, currentWave, onCustomWave) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid #1c1c3a';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'display:block;width:100%;height:52px;background:#050510;border-radius:3px;border:1px solid #1c1c3a;cursor:crosshair;touch-action:none;margin-bottom:2px';
    const N = 64;
    let samples = new Float32Array(N);

    function initFromWave(w) {
      for (let i = 0; i < N; i++) {
        const phase = (i / N) * Math.PI * 2;
        switch(w) {
          case 'sawtooth': samples[i] = 1 - (i / N) * 2; break;
          case 'square':   samples[i] = i < N/2 ? 1 : -1; break;
          case 'triangle': samples[i] = i < N/2 ? -1 + (i/(N/2))*2 : 1 - ((i-N/2)/(N/2))*2; break;
          default:         samples[i] = Math.sin(phase); break;
        }
      }
    }
    initFromWave(currentWave);

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.offsetWidth || 200, H = cv.offsetHeight || 52;
      cv.width = W * dpr; cv.height = H * dpr;
      const c = cv.getContext('2d'); c.scale(dpr, dpr);
      c.fillStyle = '#050510'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#1a1a3a'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();
      c.beginPath(); c.strokeStyle = accentColor; c.lineWidth = 1.5;
      for (let i = 0; i < N; i++) {
        const x = (i / N) * W, y = (0.5 - samples[i] * 0.45) * H;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
    }

    let painting = false;
    function paintAt(e) {
      const r = cv.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      const idx = Math.max(0, Math.min(N-1, Math.round((cx / r.width) * N)));
      samples[idx] = Math.max(-1, Math.min(1, (0.5 - cy / r.height) / 0.45));
      draw(); onCustomWave(samples);
    }
    cv.addEventListener('pointerdown', e => { painting = true; cv.setPointerCapture(e.pointerId); paintAt(e); });
    cv.addEventListener('pointermove', e => { if (painting) paintAt(e); });
    cv.addEventListener('pointerup',   () => { painting = false; });

    wrap.appendChild(cv);
    const hint = document.createElement('div'); hint.style.cssText = 'font-size:10px;color:#444;text-align:center;margin-bottom:3px'; hint.textContent = 'draw waveform';
    wrap.appendChild(hint);
    parent.appendChild(wrap);
    setTimeout(draw, 50);
    return { redraw: initFromWave, samples };
  }

  // ── OSC block (Serum-inspired) ────────────────────────────
  const oscModeLabel = oscMode === 'osc2' ? 'OSC 2' : oscMode === 'sub' ? 'SUB' : 'OSC 1';
  const isOsc1 = oscMode !== 'osc2' && oscMode !== 'sub';
  const isOsc2 = oscMode === 'osc2';
  const isSub  = oscMode === 'sub';

  // Param objects per mode
  if (isSub  && !p.sub)  p.sub  = { waveform:'sine',     oct:-2, cents:0,  volume:0.6, unison:1, unisonDetune:10 };
  if (isOsc2 && !p.osc2) p.osc2 = { waveform:'sawtooth', oct:0,  semi:0,   detune:7, cents:0, volume:0.5, unison:1, unisonDetune:10, spread:80 };

  const pp = isOsc2 ? p.osc2 : isSub ? p.sub : p.osc; // shorthand

  const _oscActive = isOsc2 ? p.osc2Active : isSub ? p.subActive : p.osc1Active !== false;

  // ── OSC header row: [ON] [OSC 1 ▼ SAWTOOTH] ──────────────
  const oscHdr = document.createElement('div');
  oscHdr.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';

  const osc1OnBtn = document.createElement('button');
  osc1OnBtn.className = 'osc-on-btn' + (_oscActive ? ' active' : '');
  osc1OnBtn.textContent = oscModeLabel;
  osc1OnBtn.style.cssText = `padding:3px 8px;font-size:11px;letter-spacing:1px;border-color:${_oscActive ? color : '#333'};color:${_oscActive ? color : '#555'}`;

  const waveSelect = document.createElement('select');
  waveSelect.style.cssText = `flex:1;background:#0e0e24;border:1px solid #2a2a44;color:${color};padding:3px 6px;font-family:monospace;font-size:11px;border-radius:3px;cursor:pointer;letter-spacing:1px`;
  const waveOptions = isOsc1 ? ['sawtooth','square','triangle','sine','pulse','supersaw'] : isSub ? ['sine','sawtooth','square','triangle'] : ['sawtooth','square','triangle','sine'];
  waveOptions.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w; opt.textContent = w.toUpperCase();
    if (w === (pp.waveform || 'sawtooth')) opt.selected = true;
    waveSelect.appendChild(opt);
  });

  oscHdr.appendChild(osc1OnBtn);
  oscHdr.appendChild(waveSelect);
  oscS.appendChild(oscHdr);

  const osc1Body = document.createElement('div');
  osc1Body.style.cssText = `opacity:${_oscActive ? 1 : 0.4}`;
  oscS.appendChild(osc1Body);

  osc1OnBtn.addEventListener('click', () => {
    if (isOsc2)      { p.osc2Active = !p.osc2Active; const on=p.osc2Active; osc1OnBtn.style.borderColor=on?color:'#333'; osc1OnBtn.style.color=on?color:'#555'; osc1Body.style.opacity=on?'1':'0.4'; }
    else if (isSub)  { p.subActive  = !p.subActive;  const on=p.subActive;  osc1OnBtn.style.borderColor=on?color:'#333'; osc1OnBtn.style.color=on?color:'#555'; osc1Body.style.opacity=on?'1':'0.4'; }
    else             { p.osc1Active = !p.osc1Active; const on=p.osc1Active; osc1OnBtn.style.borderColor=on?color:'#333'; osc1OnBtn.style.color=on?color:'#555'; osc1Body.style.opacity=on?'1':'0.4'; }
  });

  // ── Large drawable wavetable canvas ───────────────────────
  const wtWrap = document.createElement('div');
  wtWrap.style.cssText = 'position:relative;margin-bottom:6px';
  const wtCv = document.createElement('canvas');
  wtCv.style.cssText = 'display:block;width:100%;height:90px;background:#050510;border-radius:4px;border:1px solid #1e1e3a;cursor:crosshair;touch-action:none';
  const N = 128;
  let wtSamples = new Float32Array(N);

  function wtInitFromWave(w) {
    for (let i = 0; i < N; i++) {
      const phase = (i / N) * Math.PI * 2;
      if      (w === 'sawtooth') wtSamples[i] = 1 - (i / N) * 2;
      else if (w === 'square')   wtSamples[i] = i < N/2 ? 1 : -1;
      else if (w === 'triangle') wtSamples[i] = i < N/2 ? -1 + (i/(N/2))*2 : 1 - ((i-N/2)/(N/2))*2;
      else if (w === 'pulse')    wtSamples[i] = i < N*0.3 ? 1 : -1;
      else if (w === 'supersaw') wtSamples[i] = (1 - (i/N)*2) * 0.7 + Math.sin(phase*3)*0.3;
      else                       wtSamples[i] = Math.sin(phase);
    }
  }
  // Restore custom drawn samples if saved, otherwise init from wave
  if (pp._customSamples && pp._customSamples.length === N) {
    wtSamples = new Float32Array(pp._customSamples);
  } else {
    wtInitFromWave(pp.waveform || 'sawtooth');
  }

  function wtDraw() {
    const dpr = window.devicePixelRatio || 1;
    const W = wtCv.offsetWidth || 260, H = wtCv.offsetHeight || 90;
    wtCv.width = W * dpr; wtCv.height = H * dpr;
    const c = wtCv.getContext('2d'); c.scale(dpr, dpr);
    c.fillStyle = '#050510'; c.fillRect(0, 0, W, H);
    // grid
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 0.5;
    [0.25,0.5,0.75].forEach(y => { c.beginPath(); c.moveTo(0,y*H); c.lineTo(W,y*H); c.stroke(); });
    // zero line
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0,H/2); c.lineTo(W,H/2); c.stroke();
    // fill
    c.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i/N)*W, y = (0.5 - wtSamples[i]*0.45)*H;
      i===0 ? c.moveTo(x,y) : c.lineTo(x,y);
    }
    c.save(); c.globalAlpha=0.12; c.strokeStyle=color; c.lineWidth=8; c.stroke(); c.restore();
    c.strokeStyle=color; c.lineWidth=2; c.stroke();
  }

  let wtPainting = false;
  function wtPaintAt(e) {
    const r = wtCv.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    const idx = Math.max(0, Math.min(N-1, Math.round((cx/r.width)*N)));
    wtSamples[idx] = Math.max(-1, Math.min(1, (0.5 - cy/r.height)/0.45));
    wtDraw();
    const saved = Array.from(wtSamples); // plain array for JSON serialization
    if (isOsc1) {
      p.osc._customSamples = saved;
      const pw = voice._makePeriodicWave ? voice._makePeriodicWave(wtSamples) : null;
      if (pw) (voice._activeOscs||[]).forEach(o => { try { o.setPeriodicWave(pw); } catch(_){} });
    } else if (isOsc2) { p.osc2._customSamples = saved; }
    else { p.sub._customSamples = saved; }
  }
  wtCv.addEventListener('pointerdown', e => { wtPainting=true; wtCv.setPointerCapture(e.pointerId); wtPaintAt(e); });
  wtCv.addEventListener('pointermove', e => { if(wtPainting) wtPaintAt(e); });
  wtCv.addEventListener('pointerup',   () => { wtPainting=false; });

  // hint
  const wtHint = document.createElement('div');
  wtHint.style.cssText = 'position:absolute;bottom:4px;right:6px;font-size:9px;color:#333;pointer-events:none;letter-spacing:1px';
  wtHint.textContent = 'DRAW';
  wtWrap.appendChild(wtCv); wtWrap.appendChild(wtHint);
  osc1Body.appendChild(wtWrap);
  setTimeout(wtDraw, 50);

  waveSelect.addEventListener('change', () => {
    const w = waveSelect.value;
    if (isOsc1) voice.set('osc','waveform',w);
    else if (isOsc2) { p.osc2.waveform = w; }
    else { p.sub.waveform = w; }
    // Clear custom samples so dropdown resets to standard wave
    pp._customSamples = null;
    wtInitFromWave(w); wtDraw();
  });

  // ── Compact drag-param row: OCT / SEM / FIN / DET / LEVEL ─
  function makeDragParam({ parent, label, value, min, max, decimals=0, unit='', step=1, onChange }) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;cursor:ns-resize;user-select:none';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;color:#555;letter-spacing:1px;margin-bottom:1px';
    lbl.textContent = label;
    const val = document.createElement('div');
    val.style.cssText = `font-size:12px;color:${color};font-family:monospace;letter-spacing:1px`;
    val.textContent = (decimals>0 ? value.toFixed(decimals) : Math.round(value)) + unit;
    let current = value, startY = 0, startV = 0;
    wrap.addEventListener('pointerdown', e => {
      wrap.setPointerCapture(e.pointerId); startY=e.clientY; startV=current;
    });
    wrap.addEventListener('pointermove', e => {
      if (e.buttons===0) return;
      const delta = (startY - e.clientY) * step * 0.5;
      current = Math.max(min, Math.min(max, startV + delta));
      const disp = decimals>0 ? current.toFixed(decimals) : Math.round(current);
      val.textContent = disp + unit;
      onChange(decimals>0 ? current : Math.round(current));
    });
    wrap.append(lbl, val);
    parent.appendChild(wrap);
    return { setValue: v => { current=v; val.textContent=(decimals>0?v.toFixed(decimals):Math.round(v))+unit; } };
  }

  const paramRow = document.createElement('div');
  paramRow.style.cssText = 'display:flex;gap:2px;background:#0a0a1e;border:1px solid #1a1a30;border-radius:4px;padding:5px 4px;margin-bottom:6px';
  osc1Body.appendChild(paramRow);

  if (isOsc1) {
    makeDragParam({ parent:paramRow, label:'OCT', value:Math.round((p.osc.pitch??0)/12), min:-4, max:4, unit:'', step:1, onChange: v => voice.set('osc','pitch', v*12) });
    makeDragParam({ parent:paramRow, label:'SEM', value:Math.round((p.osc.pitch??0)%12), min:-12, max:12, unit:'', step:1, onChange: v => voice.set('osc','pitch', Math.round((p.osc.pitch??0)/12)*12 + v) });
    makeDragParam({ parent:paramRow, label:'FIN', value:p.osc.cent??0, min:-100, max:100, unit:'¢', step:1, onChange: v => voice.set('osc','cent',v) });
    const pwWrap = document.createElement('div'); pwWrap.style.cssText='flex:1;display:'+(p.osc.waveform==='pulse'?'flex':'none');
    makeDragParam({ parent:pwWrap, label:'PW', value:p.osc.pw??0.5, min:0.1, max:0.9, decimals:2, step:0.01, onChange: v => voice.set('osc','pw',v) });
    paramRow.appendChild(pwWrap);
    makeDragParam({ parent:paramRow, label:'LEVEL', value:p.osc.volume??0.8, min:0, max:1, decimals:2, step:0.01, onChange: v => voice.set('osc','volume',v) });
    waveSelect.addEventListener('change', () => { pwWrap.style.display = waveSelect.value==='pulse' ? 'flex':'none'; });
  } else if (isOsc2) {
    makeDragParam({ parent:paramRow, label:'OCT',  value:p.osc2.oct??0,    min:-4,   max:4,   unit:'',  step:1,    onChange: v => { p.osc2.oct=v; } });
    makeDragParam({ parent:paramRow, label:'SEM',  value:p.osc2.semi??0,   min:-12,  max:12,  unit:'',  step:1,    onChange: v => { p.osc2.semi=v; } });
    makeDragParam({ parent:paramRow, label:'FIN',  value:p.osc2.cents??0,  min:-100, max:100, unit:'¢', step:1,    onChange: v => { p.osc2.cents=v; } });
    makeDragParam({ parent:paramRow, label:'DET',  value:p.osc2.detune??7, min:-100, max:100, unit:'¢', step:1,    onChange: v => { p.osc2.detune=v; } });
    makeDragParam({ parent:paramRow, label:'LEVEL',value:p.osc2.volume??0.5,min:0,   max:1,   decimals:2, step:0.01, onChange: v => { p.osc2.volume=v; } });
  } else {
    makeDragParam({ parent:paramRow, label:'OCT',  value:p.sub.oct??-2,     min:-4,   max:0,   unit:'',  step:1,    onChange: v => { p.sub.oct=v; } });
    makeDragParam({ parent:paramRow, label:'FIN',  value:p.sub.cents??0,    min:-100, max:100, unit:'¢', step:1,    onChange: v => { p.sub.cents=v; } });
    makeDragParam({ parent:paramRow, label:'LEVEL',value:p.sub.volume??0.6, min:0,    max:1,   decimals:2,step:0.01, onChange: v => { p.sub.volume=v; } });
  }

  // ── Bottom knob row: UNISON stepper + DETUNE + BLEND ──────
  const botRow = document.createElement('div');
  botRow.style.cssText = 'display:flex;gap:6px;align-items:flex-end;margin-bottom:4px';
  osc1Body.appendChild(botRow);

  // UNISON stepper
  const uniWrap = document.createElement('div');
  uniWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px';
  const uniLbl = document.createElement('div'); uniLbl.style.cssText='font-size:9px;color:#555;letter-spacing:1px'; uniLbl.textContent='UNISON';
  const uniCtrl = document.createElement('div'); uniCtrl.style.cssText='display:flex;align-items:center;gap:2px';
  const uniDn = document.createElement('button'); uniDn.textContent='−'; uniDn.style.cssText='width:16px;height:20px;padding:0;font-size:13px;border:1px solid #2a2a44;background:#0e0e24;color:#aaa;border-radius:2px;';
  const uniVal = document.createElement('div'); uniVal.style.cssText=`min-width:22px;text-align:center;font-size:13px;color:${color};font-family:monospace`;
  const currentUnison = isOsc2 ? (p.osc2.unison??1) : isSub ? (p.sub?.unison??1) : (p.osc.unison??1);
  uniVal.textContent = currentUnison;
  const uniUp = document.createElement('button'); uniUp.textContent='+'; uniUp.style.cssText='width:16px;height:20px;padding:0;font-size:13px;border:1px solid #2a2a44;background:#0e0e24;color:#aaa;border-radius:2px;';
  uniCtrl.append(uniDn, uniVal, uniUp);
  uniWrap.append(uniLbl, uniCtrl);
  botRow.appendChild(uniWrap);

  // DETUNE + BLEND + WIDTH — only visible when unison > 1
  const uniParamsWrap = document.createElement('div');
  uniParamsWrap.style.cssText = 'display:flex;gap:6px;align-items:flex-end;flex:1';
  botRow.appendChild(uniParamsWrap);

  if (isOsc1) {
    makeKnob({ parent:uniParamsWrap, min:0, max:100, value:p.osc.unisonDetune??20, label:'DETUNE', unit:'¢', decimals:0, step:1, color, onChange: v => voice.set('osc','unisonDetune',v) });
    makeKnob({ parent:uniParamsWrap, min:0, max:1,   value:p.osc.unisonBlend??1,   label:'BLEND',  decimals:2, color, onChange: v => voice.set('osc','unisonBlend',v) });
    makeKnob({ parent:uniParamsWrap, min:0, max:100, value:(p.osc.spread??0.5)*100, label:'WIDTH', unit:'%', decimals:0, color, onChange: v => voice.set('osc','spread',v/100) });
  } else if (isOsc2) {
    makeKnob({ parent:uniParamsWrap, min:0, max:100, value:p.osc2.unisonDetune??10, label:'DETUNE', unit:'¢', decimals:0, step:1, color, onChange: v => { p.osc2.unisonDetune=v; } });
    makeKnob({ parent:uniParamsWrap, min:0, max:100, value:p.osc2.spread??80,       label:'WIDTH',  unit:'%', decimals:0, color, onChange: v => { p.osc2.spread=v; } });
  } else {
    makeKnob({ parent:uniParamsWrap, min:0, max:100, value:p.sub?.unisonDetune??10, label:'DETUNE', unit:'¢', decimals:0, step:1, color, onChange: v => { if(p.sub) p.sub.unisonDetune=v; } });
  }

  let unisonVal = currentUnison;
  function setUnison(n) {
    unisonVal = Math.max(1, Math.min(16, n));
    uniVal.textContent = unisonVal;
    uniParamsWrap.style.display = unisonVal > 1 ? 'flex' : 'none';
    if (isOsc1) voice.set('osc','unison', unisonVal);
    else if (isOsc2) p.osc2.unison = unisonVal;
    else if (p.sub) p.sub.unison = unisonVal;
  }
  uniDn.addEventListener('click', () => setUnison(unisonVal-1));
  uniUp.addEventListener('click', () => setUnison(unisonVal+1));
  // Set initial visibility
  uniParamsWrap.style.display = currentUnison > 1 ? 'flex' : 'none';

  // Noise panel only on OSC1
  if (isOsc1) {
    const noisePanel = createNoisePanel({ voice, color });
    noisePanel.element.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid #1c1c3a';
    osc1Body.appendChild(noisePanel.element);
  }

  // Filter — stacked: canvas top, type row, knobs below
  const fS = sec('FILTER');

  // ── Large live curve canvas ────────────────────────────
  const curveCvs = document.createElement('canvas');
  curveCvs.style.cssText = 'display:block;width:100%;height:130px;background:#06060f;border-radius:4px 4px 0 0;border:1px solid #1a1a30;border-bottom:none;cursor:crosshair';
  curveCvs.height = 130;
  fS.appendChild(curveCvs);

  // Freq labels bar
  const freqLbls = document.createElement('div');
  freqLbls.style.cssText = 'display:flex;justify-content:space-between;background:#06060f;border:1px solid #1a1a30;border-top:none;border-radius:0 0 4px 4px;padding:1px 6px;margin-bottom:7px';
  freqLbls.innerHTML = '<span style="font-size:9px;color:#333">20</span><span style="font-size:9px;color:#333">100</span><span style="font-size:9px;color:#333">1k</span><span style="font-size:9px;color:#333">10k</span><span style="font-size:9px;color:#333">20k</span>';
  fS.appendChild(freqLbls);

  // ── Type buttons + cutoff readout row ─────────────────
  const fTypeRow = document.createElement('div');
  fTypeRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:6px';
  fS.appendChild(fTypeRow);

  // Filter type buttons
  const ftBtnWrap = document.createElement('div');
  ftBtnWrap.style.cssText = 'display:flex;gap:3px;flex:1';
  fTypeRow.appendChild(ftBtnWrap);
  const ftBtns = [];
  FILTER_TYPES.forEach((ft, idx) => {
    const b = document.createElement('button');
    b.className = 'ftype-btn' + (p.filter.type === ft ? ' active' : '');
    b.textContent = FILTER_LABELS[idx];
    b.style.cssText = `flex:1;padding:3px 0;font-size:10px;letter-spacing:1px;border-color:${p.filter.type===ft?color:'#2a2a44'};color:${p.filter.type===ft?color:'#555'}`;
    b.addEventListener('click', () => {
      ftBtns.forEach(x => { x.style.borderColor='#2a2a44'; x.style.color='#555'; });
      b.style.borderColor = color; b.style.color = color;
      voice.set('filter', 'type', ft);
      if (typeof redrawFilterCurve === 'function') redrawFilterCurve();
    });
    ftBtns.push(b); ftBtnWrap.appendChild(b);
  });

  // Cutoff live readout
  const cutReadout = document.createElement('div');
  cutReadout.style.cssText = `font-size:11px;color:${color};font-family:monospace;letter-spacing:1px;min-width:64px;text-align:right`;
  cutReadout.textContent = p.filter.cutoff >= 1000 ? (p.filter.cutoff/1000).toFixed(1)+'k' : Math.round(p.filter.cutoff)+'Hz';
  fTypeRow.appendChild(cutReadout);

  // Q readout
  const resReadout = document.createElement('div');
  resReadout.style.cssText = 'font-size:11px;color:#888;font-family:monospace;letter-spacing:1px;min-width:40px;text-align:right';
  resReadout.textContent = 'Q'+p.filter.resonance.toFixed(1);
  fTypeRow.appendChild(resReadout);

  function updateFilterReadouts() {
    const hz = p.filter.cutoff;
    cutReadout.textContent = hz >= 1000 ? (hz/1000).toFixed(1)+'k' : Math.round(hz)+'Hz';
    resReadout.textContent = 'Q'+p.filter.resonance.toFixed(1);
  }

  // ── Knob row ───────────────────────────────────────────
  const filterKnobRow = createKnobRow({
    parent: fS, color,
    knobs: [
      { min: 20,    max: 18000, value: p.filter.cutoff,    label: 'CUT',   decimals: 0, log: true, onChange: v => { voice.set('filter','cutoff',v);    updateFilterReadouts(); redrawFilterCurve(); } },
      { min: 0,     max: 30,   value: p.filter.resonance, label: 'RES',   decimals: 1, onChange: v => { voice.set('filter','resonance',v); updateFilterReadouts(); redrawFilterCurve(); } },
      { min: 0,     max: 12000,value: p.filter.envAmount, label: 'ENV',   decimals: 0, onChange: v => { voice.set('filter','envAmount',v); redrawFilterCurve(); } },
      { min: 0,     max: 1,    value: p.filter.mix,       label: 'MIX',   decimals: 2, onChange: v => voice.set('filter','mix',v) },
      { min: -1,    max: 1,    value: p.pan,              label: 'PAN',   decimals: 2, onChange: v => voice.set('filter','pan',v) }
    ]
  });
  const cutKnob = filterKnobRow.knobs[0];

  // Ensure filter node matches p params before drawing (getFrequencyResponse needs .value in sync)
  voice.filter.type = p.filter.type;
  voice.filter.frequency.value = p.filter.cutoff;
  voice.filter.Q.value = p.filter.resonance;
  function redrawFilterCurve() {
    curveCvs.width = curveCvs.offsetWidth || curveCvs.parentElement?.offsetWidth || 260;
    drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount, null, voice.analyser, voice.preAnalyser, null);
  }
  setTimeout(redrawFilterCurve, 60);

  // ── Live modulation visualizer ─────────────────────────
  // Estimate modulated cutoff from active TWE + LFO sources and animate
  // the filter curve ghost + CUT knob ring at ~30fps while a note is held.
  function waveY(shape, phase) {
    switch (shape) {
      case 'sawtooth': return 2 * (phase % 1) - 1;
      case 'square':   return (phase % 1) < 0.5 ? 1 : -1;
      case 'triangle': return 2 * Math.abs(2 * (phase % 1) - 1) - 1;
      default:         return Math.sin(2 * Math.PI * phase); // sine
    }
  }

  function estimateModCutoff() {
    if (!voice._playing || !voice._noteOnTime) return null;
    const elapsed = voice.ctx.currentTime - voice._noteOnTime;
    const tw = p.twe;
    let mod = 0;
    // TWE MAIN
    if (!tw._bypassed && tw.main && tw.main._enabled !== false && tw.main.depth > 0
        && (tw.main.target === 'cutoff' || tw.main.target === undefined)
        && voice.tweMain.connected === 'cutoff') {
      mod += waveY(tw.main.shape, elapsed * voice._tweCalcRate(tw.main)) * tw.main.depth;
    }
    // TWE BODY (nested under main)
    const _twBody = tw.main?.body;
    if (!tw._bypassed && _twBody && _twBody._enabled !== false && _twBody.depth > 0
        && _twBody.target === 'cutoff' && voice.tweBody.connected === 'cutoff') {
      mod += waveY(_twBody.shape, elapsed * voice._tweCalcRate(_twBody)) * _twBody.depth;
    }
    // LFOs targeting cutoff
    p.lfos.forEach((lp, i) => {
      if (lp.target !== 'cutoff' || lp.depth <= 0) return;
      const node = voice.lfoNodes[i];
      if (!node || !node.connected) return;
      const phase = elapsed * lp.rate;
      mod += waveY(lp.waveform, phase) * lp.depth;
    });
    return mod !== 0 ? Math.max(20, Math.min(20000, p.filter.cutoff + mod)) : null;
  }

  // Estimate total modulation on noiseAmt target (same waveY helper)
  function estimateModNoiseAmt() {
    if (!voice._playing || !voice._noteOnTime) return null;
    const elapsed = voice.ctx.currentTime - voice._noteOnTime;
    const tw = p.twe;
    let mod = 0;
    if (tw._bypassed) return null;
    const scaledD = (sp) => (sp.target === 'volume' || sp.target === 'noiseAmt')
      ? Math.min(sp.depth / 15000, 1.0) : sp.depth;
    // TWE MAIN
    if (tw.main && tw.main._enabled !== false && tw.main.depth > 0
        && tw.main.target === 'noiseAmt' && voice.tweMain.connected === 'noiseAmt') {
      mod += waveY(tw.main.shape, elapsed * voice._tweCalcRate(tw.main)) * scaledD(tw.main);
    }
    // TWE BODY
    const _twBody = tw.main?.body;
    if (_twBody && _twBody._enabled !== false && _twBody.depth > 0
        && _twBody.target === 'noiseAmt' && voice.tweBody.connected === 'noiseAmt') {
      mod += waveY(_twBody.shape, elapsed * voice._tweCalcRate(_twBody)) * scaledD(_twBody);
    }
    // AUX lanes
    (tw.aux || []).forEach((als, i) => {
      const a = voice._tweAuxOscs[i];
      if (!a || !a.connected) return;
      if (als._enabled !== false && als.depth > 0 && als.target === 'noiseAmt') {
        mod += waveY(als.shape, elapsed * voice._tweCalcRate(als)) * scaledD(als);
      }
    });
    // LFOs targeting noiseAmt
    p.lfos.forEach((lp, i) => {
      if (lp.target !== 'noiseAmt' || lp.depth <= 0) return;
      const node = voice.lfoNodes[i];
      if (!node || !node.connected) return;
      mod += waveY(lp.waveform, elapsed * lp.rate) * lp.depth;
    });
    if (mod === 0) return null;
    return Math.max(0, Math.min(1, p.noise.volume + mod));
  }

  let _modRafId = null;
  let _lastModCutoff = null, _lastModNoise = null;
  let _lastModDrawTime = 0;
  function modAnimLoop(ts) {
    if (ts - _lastModDrawTime >= 50) { // ~20fps cap
      _lastModDrawTime = ts;
      const mc = estimateModCutoff();
      // Always sync filter node to current params then redraw
      voice.filter.frequency.value = p.filter.cutoff;
      voice.filter.Q.value = p.filter.resonance;
      if (!curveCvs.width || curveCvs.width < 10) curveCvs.width = curveCvs.offsetWidth || curveCvs.parentElement?.offsetWidth || 260;
      // Build lfoState from LFO engine slot 0 if targeting cutoff
      const _lfoSlot = voice.lfoEngine?.slots?.find(s => s.target === 'cutoff' && s._enabled !== false && s.depth > 0);
      const _lfoState = _lfoSlot ? {
        active: true,
        phase:  _lfoSlot.phase || 0,
        mult:   _lfoSlot.mult  || 1,
        points: _lfoSlot.points || [],
        depth:  Math.min(1, (_lfoSlot.depth || 0) / (p.filter.cutoff || 800))
      } : null;
      drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount, mc, voice.analyser, voice.preAnalyser, _lfoState);
      // Update modulation ring on CUT knob only when mod value changes
      const changed = mc === null
        ? _lastModCutoff !== null
        : (_lastModCutoff === null || Math.abs(mc - _lastModCutoff) > 5);
      if (changed) {
        _lastModCutoff = mc;
        cutKnob.setModValue(mc !== null ? mc : null);
      }
      // Noise knob ring
      const mn = estimateModNoiseAmt();
      const nChanged = mn !== _lastModNoise && (mn === null || _lastModNoise === null || Math.abs(mn - _lastModNoise) > 0.005);
      if (nChanged) {
        _lastModNoise = mn;
        voice._noiseKnob?.setModValue(mn);
      }
    }
    _modRafId = requestAnimationFrame(modAnimLoop);
  }
  // Always-running filter curve animation loop — starts on build, never stops
  _modRafId = requestAnimationFrame(modAnimLoop);
  // Intercept _playing writes — just clear mod overlay on note-off
  voice.__playing = voice._playing || false;
  Object.defineProperty(voice, '_playing', {
    get() { return this.__playing; },
    set(v) {
      this.__playing = v;
      if (!v) {
        setTimeout(() => {
          if (!voice._playing) {
            _lastModCutoff = null; _lastModNoise = null;
            cutKnob.clearModValue();
            voice._noiseKnob?.clearModValue();
          }
        }, 600);
      }
    },
    configurable: true
  });

  // Filter bypass toggle
  const FILTER_MOD_TARGETS = ['cutoff', 'resonance'];
  addSectionToggle(fS,
    () => { // Disable: allpass + disconnect all modulation from filter params
      voice.p.filter.bypassed = true;
      voice.filter.type = 'allpass';
      voice._filterBypassed = true;
      // Disconnect TWE MAIN/BODY if connected to cutoff or resonance
      if (FILTER_MOD_TARGETS.includes(voice.tweMain.connected)) {
        try { voice.tweMain.gain.disconnect(); } catch(_) {}
        voice.tweMain.connected = null;
      }
      if (FILTER_MOD_TARGETS.includes(voice.tweBody.connected)) {
        try { voice.tweBody.gain.disconnect(); } catch(_) {}
        voice.tweBody.connected = null;
      }
      // Disconnect LFOs targeting cutoff or resonance
      voice.lfoNodes.forEach((node, i) => {
        const tgt = p.lfos[i].target;
        if (FILTER_MOD_TARGETS.includes(tgt) && node.connected) {
          try { node.gain.disconnect(); } catch(_) {}
          node.connected = null;
        }
      });
    },
    () => { // Enable: restore type, reconnect modulations
      voice.p.filter.bypassed = false;
      voice._filterBypassed = false;
      voice.filter.type = p.filter.type;
      // Reconnect LFOs targeting cutoff or resonance
      voice.lfoNodes.forEach((_, i) => {
        if (FILTER_MOD_TARGETS.includes(p.lfos[i].target)) voice._connectLFO(i);
      });
      // TWE MAIN/BODY will reconnect naturally on next noteOn
    },
    !voice.p.filter.bypassed
  );

  // ADSR — interactive canvas
  const aS = sec('ADSR');
  buildADSRSection(aS, p.adsr, voice, color);

  // ── DISTORTION ────────────────────────────────────────────
  const distS = sec('DISTORTION');
  buildDistSection(distS, p.dist, voice, color);

  // ── TWE — Temporal Wobble Engine ──────────────────────────
  const tweS = cSec('WOBBLE ENGINE'); tweS.classList.add('twe-sec');

  const TWE_SHAPES   = ['sine','sawtooth','square','triangle'];
  const TWE_SHAPE_ABBR = {sine:'SIN',sawtooth:'SAW',square:'SQR',triangle:'TRI'};
  const TWE_TARGETS  = ['cutoff','resonance','pitch','noiseAmt','pan','volume','chorus'];
  const TWE_DIVS     = [1,2,4,8,16,32];

  // ─ Preset bar ─
  const presetBar = document.createElement('div'); presetBar.className = 'twe-preset-bar';
  tweS.appendChild(presetBar);

  // ─ applyWobblePattern ─
  function applyWobblePattern(pattern) {
    if (pattern.main) {
      const src = pattern.main, ms = p.twe.main;
      ['rate','depth','target','shape','bpmSync','syncDiv','triplet','dotted'].forEach(k => { if (src[k] !== undefined) ms[k] = src[k]; });
      if (src.strike) Object.assign(ms.strike, src.strike);
      if (src.body)   Object.assign(ms.body,   src.body);
      if (src.tail)   Object.assign(ms.tail,   src.tail);
    }
    voice.set('twe', 'main.shape',      p.twe.main.shape);
    voice.set('twe', 'main.rate',       p.twe.main.rate);
    voice.set('twe', 'main.body.shape', p.twe.main.body.shape);
    voice.set('twe', 'main.body.rate',  p.twe.main.body.rate);
    rebuildTweUI();
  }

  // ─ Preset bar buttons ─
  Object.keys(WOBBLE_PRESETS).forEach(name => {
    const btn = document.createElement('button'); btn.className = 'twe-preset-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => { applyWobblePattern(WOBBLE_PRESETS[name]); showToast(`Pattern: ${name}`); });
    presetBar.appendChild(btn);
  });
  const _sep = document.createElement('div'); _sep.className = 'twe-preset-sep'; presetBar.appendChild(_sep);
  const randBtn = document.createElement('button'); randBtn.className = 'twe-preset-btn twe-preset-random'; randBtn.textContent = '🎲 RANDOM';
  randBtn.addEventListener('click', () => { applyWobblePattern(randomizeWobble()); showToast('Randomized wobble'); });
  presetBar.appendChild(randBtn);
  const aiBtn = document.createElement('button'); aiBtn.className = 'twe-preset-btn twe-preset-ai'; aiBtn.textContent = '✨ AI';
  aiBtn.addEventListener('click', () => { applyWobblePattern(aiGenerateWobble()); showToast('AI-generated wobble'); });
  presetBar.appendChild(aiBtn);

  // ─ Timeline canvas + redrawTwe ─
  const tweCvs = document.createElement('canvas'); tweCvs.className = 'twe-preview';
  tweS.appendChild(tweCvs);
  let _tweRafId = null;
  let _tweSelectedLane = 'main'; // 'main'|'strike'|'body'|'tail'|'aux.0'..
  const redrawTwe = () => {
    if (_tweRafId) { cancelAnimationFrame(_tweRafId); _tweRafId = null; }
    const tick = () => {
      const bpm = voice._bpm || 120;
      if (voice._playing && voice._noteOnTime != null) {
        drawTwePreview(tweCvs, p.twe, color, voice.ctx.currentTime - voice._noteOnTime, _tweSelectedLane, bpm);
        _tweRafId = requestAnimationFrame(tick);
      } else {
        drawTwePreview(tweCvs, p.twe, color, undefined, _tweSelectedLane, bpm);
        _tweRafId = null;
      }
    };
    requestAnimationFrame(tick);
  };
  (function poll() { if (!_tweRafId) redrawTwe(); setTimeout(poll, 200); })();

  // ─ Chaos / Ratemod row ─
  const tweHeader = document.createElement('div'); tweHeader.className = 'twe-header';
  tweS.appendChild(tweHeader);
  const chaosWrap = document.createElement('div'); chaosWrap.className = 'knob-row'; tweHeader.appendChild(chaosWrap);
  makeKnob({ parent:chaosWrap, min:0, max:1, value:p.twe.chaos, label:'CHAOS', decimals:2, color, onChange: v => { voice.set('twe','chaos',v); redrawTwe(); } });
  makeKnob({ parent:chaosWrap, min:0, max:1, value:p.twe.tweAmt??1, label:'AMT', decimals:2, color:'#ffdd88', onChange: v => { voice.set('twe','tweAmt',v); } });
  makeKnob({ parent:chaosWrap, min:1, max:16, value:p.twe.barsTotal??4, label:'BARS', decimals:0, step:1, color:'#aaaaff', onChange: v => { p.twe.barsTotal=Math.round(v); voice.set('twe','barsTotal',Math.round(v)); redrawTwe(); } });
  const rateModBtn = document.createElement('button'); rateModBtn.className = 'twe-ratemod-btn'; rateModBtn.textContent = 'RATE-MOD'; rateModBtn.title = 'STRIKE drives BODY rate';
  rateModBtn.classList.toggle('active', p.twe.ratemod);
  rateModBtn.addEventListener('click', () => { const v = !p.twe.ratemod; rateModBtn.classList.toggle('active',v); voice.set('twe','ratemod',v); });
  tweHeader.appendChild(rateModBtn);

  // ─ Pattern save/load bar ─
  const patBar = document.createElement('div'); patBar.className = 'twe-pat-bar'; tweS.appendChild(patBar);
  const patNameIn = document.createElement('input'); patNameIn.className = 'patch-name-input'; patNameIn.placeholder = 'wobble pattern…'; patNameIn.maxLength = 32; patBar.appendChild(patNameIn);
  const patSaveBtn = document.createElement('button'); patSaveBtn.className = 'patch-btn patch-save'; patSaveBtn.textContent = 'SAVE'; patBar.appendChild(patSaveBtn);
  const patSel = document.createElement('select'); patSel.className = 'patch-select twe-pat-sel'; patBar.appendChild(patSel);
  const refreshPatSel = () => {
    const pats = _getAllWobblePatterns(); patSel.innerHTML = '<option value="">── patterns ──</option>';
    Object.keys(pats).sort().forEach(k => { const o = document.createElement('option'); o.value=k; o.textContent=k; patSel.appendChild(o); });
  };
  refreshPatSel();
  const patLoadBtn = document.createElement('button'); patLoadBtn.className = 'patch-btn patch-load'; patLoadBtn.textContent = 'LOAD'; patBar.appendChild(patLoadBtn);
  const patDelBtn  = document.createElement('button'); patDelBtn.className  = 'patch-btn patch-del';  patDelBtn.textContent  = 'DEL';  patBar.appendChild(patDelBtn);
  patSaveBtn.addEventListener('click', () => { if (!patNameIn.value.trim()) { patNameIn.focus(); return; } if (saveWobblePattern(patNameIn.value, p.twe)) { refreshPatSel(); showToast(`Wobble saved: ${patNameIn.value}`); } });
  patLoadBtn.addEventListener('click', () => {
    const name = patSel.value; if (!name) return;
    const pat = _getAllWobblePatterns()[name]; if (!pat) return;
    Object.assign(p.twe, JSON.parse(JSON.stringify(pat.twe)));
    voice.set('twe','chaos',p.twe.chaos); voice.set('twe','ratemod',p.twe.ratemod);
    patNameIn.value = name; showToast(`Wobble loaded: ${name}`);
    rebuildTweUI();
  });
  patDelBtn.addEventListener('click', () => { const n=patSel.value; if(!n) return; if(!confirm(`Delete "${n}"?`)) return; deleteWobblePattern(n); refreshPatSel(); showToast(`Deleted: ${n}`); });

  // ─ Lanes container ─
  const lanesContainer = document.createElement('div'); lanesContainer.className = 'twe-lanes'; tweS.appendChild(lanesContainer);

  // ─ Draw curve helpers ─
  let _drawContainer = null, _isDrawing = false;
  const _genSamples = (shape, N) => {
    const s = new Float32Array(N);
    for (let i=0;i<N;i++) { const t=(i/N)*2*Math.PI; switch(shape) { case 'sine':s[i]=Math.sin(t);break; case 'sawtooth':s[i]=2*(i/N)-1;break; case 'square':s[i]=i<N/2?1:-1;break; case 'triangle':s[i]=1-Math.abs(4*i/N-2);break; default:s[i]=Math.sin(t); } }
    return s;
  };
  // Extended curve generator — all shapes return Float32Array of N samples in [-1, 1]
  const _genCurve = (name, N) => {
    const s = new Float32Array(N);
    const t = i => i / (N - 1); // 0..1
    switch (name) {
      case 'sine':      for(let i=0;i<N;i++) s[i]=Math.sin((i/N)*2*Math.PI); break;
      case 'sawtooth':  for(let i=0;i<N;i++) s[i]=2*(i/N)-1; break;
      case 'square':    for(let i=0;i<N;i++) s[i]=i<N/2?1:-1; break;
      case 'triangle':  for(let i=0;i<N;i++) s[i]=1-Math.abs(4*i/N-2); break;
      case 'rampup':    for(let i=0;i<N;i++) s[i]=t(i)*2-1; break;            // -1 → +1
      case 'rampdown':  for(let i=0;i<N;i++) s[i]=1-t(i)*2; break;            // +1 → -1
      case 'easein':    for(let i=0;i<N;i++) s[i]=t(i)*t(i)*t(i)*2-1; break; // cubic ease-in
      case 'easeout':   for(let i=0;i<N;i++){const v=1-t(i);s[i]=1-v*v*v*2;}break; // cubic ease-out
      case 'easeinout': for(let i=0;i<N;i++){const x=t(i);s[i]=(x<0.5?4*x*x*x:(1-(-2*x+2)**3/2))*2-1;}break;
      case 'expup':     for(let i=0;i<N;i++) s[i]=(Math.exp(t(i)*3)-1)/(Math.exp(3)-1)*2-1; break;
      case 'expdown':   for(let i=0;i<N;i++) s[i]=1-(Math.exp(t(i)*3)-1)/(Math.exp(3)-1)*2; break;
      case 'halfsine':  for(let i=0;i<N;i++) s[i]=Math.sin((i/N)*Math.PI); break; // 0→1→0, positive only
      case 'bounce': {
        for(let i=0;i<N;i++){
          const x=t(i), a=1-x;
          s[i]=a<0.36364?1-7.5625*a*a:a<0.72727?1-(7.5625*(a-0.54545)*(a-0.54545)+0.75):a<0.9091?1-(7.5625*(a-0.81818)*(a-0.81818)+0.9375):1-(7.5625*(a-0.95455)*(a-0.95455)+0.984375);
        }} break;
      case 'pulse':     for(let i=0;i<N;i++) s[i]=i<N*0.12?1:i<N*0.2?-0.4:0; break; // sharp hit + dip
      case 'stutter':   for(let i=0;i<N;i++) s[i]=Math.floor(i/(N/8))%2===0?1:-1; break; // 8 steps
      case 'random':    for(let i=0;i<N;i++) s[i]=Math.random()*2-1; break;
      default:          for(let i=0;i<N;i++) s[i]=Math.sin((i/N)*2*Math.PI);
    }
    return s;
  };
  // AI text→curve: parse natural language description
  const _aiGenCurve = (text, N) => {
    const q = text.toLowerCase().replace(/[^a-z0-9 ]/g,'');
    const has = (...words) => words.some(w => q.includes(w));
    if (has('bounce','spring','elastic')) return _genCurve('bounce', N);
    if (has('pulse','hit','click','snap','attack')) return _genCurve('pulse', N);
    if (has('stutter','step','gate','chop')) return _genCurve('stutter', N);
    if (has('random','noise','chaos','glitch')) return _genCurve('random', N);
    if (has('half sine','half sin','positive sine','rectif')) return _genCurve('halfsine', N);
    if (has('ease in out','smooth','s curve','scurve','sigmoid')) return _genCurve('easeinout', N);
    if (has('ease out','slow down','slowing','decelerat','brake')) return _genCurve('easeout', N);
    if (has('ease in','slow start','accelerat','build up','buildup')) return _genCurve('easein', N);
    if (has('exp','exponential','log','logarithm')) return has('down','fall','decay','drop') ? _genCurve('expdown', N) : _genCurve('expup', N);
    if (has('ramp down','fall','descend','drop','decay','fade out')) return _genCurve('rampdown', N);
    if (has('ramp up','rise','ascend','climb','fade in','grow')) return _genCurve('rampup', N);
    if (has('saw')) return _genCurve('sawtooth', N);
    if (has('square','rect')) return _genCurve('square', N);
    if (has('tri','triangle')) return _genCurve('triangle', N);
    if (has('sine','sin','smooth wave')) return _genCurve('sine', N);
    // fallback: sine
    return _genCurve('sine', N);
  };

  const openDrawCanvas = (sp, keyPrefix, shapeRow) => {
    if (_drawContainer) { _drawContainer.remove(); _drawContainer = null; }
    const wrap = document.createElement('div'); wrap.className = 'twe-draw-wrap'; _drawContainer = wrap;
    const cvs = document.createElement('canvas'); cvs.width=512; cvs.height=120; cvs.className='twe-draw-canvas';
    const N = 64;
    const ds = new Float32Array(sp.customShape ? sp.customShape.slice(0,N) : _genCurve(sp.shape==='custom'?'sine':sp.shape, N));
    const drawIt = () => {
      const g=cvs.getContext('2d'); const W=cvs.width,H=cvs.height;
      g.fillStyle='#04040e'; g.fillRect(0,0,W,H);
      g.strokeStyle='#1a1a38'; g.lineWidth=1;
      g.beginPath(); g.moveTo(0,H/2); g.lineTo(W,H/2); g.stroke();
      for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*W/4,0);g.lineTo(i*W/4,H);g.stroke();}
      g.strokeStyle=color; g.lineWidth=2; g.beginPath();
      for(let i=0;i<N;i++){const x=(i/N)*W,y=H/2-ds[i]*(H/2-6);i===0?g.moveTo(x,y):g.lineTo(x,y);}
      g.stroke();
    };
    const setSamp = (e) => {
      const r=cvs.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;
      const xi=Math.min(N-1,Math.floor(Math.max(0,Math.min(1,(cx-r.left)/r.width))*N));
      ds[xi]=-(Math.max(0,Math.min(1,(cy-r.top)/r.height))*2-1); drawIt();
    };
    cvs.addEventListener('mousedown', e=>{_isDrawing=true;setSamp(e);}); cvs.addEventListener('mousemove', e=>{if(_isDrawing)setSamp(e);}); cvs.addEventListener('mouseup',()=>_isDrawing=false); cvs.addEventListener('mouseleave',()=>_isDrawing=false);
    drawIt();

    // ── Preset row 1: standard + extended shapes ──
    const presetsRow = document.createElement('div'); presetsRow.className='twe-draw-presets';
    const CURVE_PRESETS = [
      { key:'sine',     lbl:'SIN' }, { key:'sawtooth', lbl:'SAW' }, { key:'square',   lbl:'SQR' }, { key:'triangle', lbl:'TRI' },
      { key:'rampup',   lbl:'↑'   }, { key:'rampdown', lbl:'↓'   }, { key:'easein',   lbl:'EI'  }, { key:'easeout',  lbl:'EO'  },
      { key:'easeinout',lbl:'S~'  }, { key:'expup',    lbl:'EXP↑'}, { key:'expdown',  lbl:'EXP↓'}, { key:'halfsine', lbl:'½SIN'},
      { key:'pulse',    lbl:'PLS' }, { key:'bounce',   lbl:'BNC' }, { key:'stutter',  lbl:'STP' }, { key:'random',   lbl:'RND' },
    ];
    CURVE_PRESETS.forEach(({key, lbl}) => {
      const pb=document.createElement('button'); pb.textContent=lbl; pb.className='twe-draw-preset-btn';
      pb.title=key; pb.addEventListener('click',()=>{ ds.set(_genCurve(key,N)); drawIt(); });
      presetsRow.appendChild(pb);
    });

    // ── AI row ──
    const aiRow = document.createElement('div'); aiRow.className='twe-draw-ai-row';
    const aiIn = document.createElement('input'); aiIn.type='text'; aiIn.placeholder='Describe curve… e.g. "ramp up", "slow down", "bounce"'; aiIn.className='twe-draw-ai-input';
    const aiBtn = document.createElement('button'); aiBtn.textContent='✨ Generate'; aiBtn.className='twe-draw-ai-btn';
    aiBtn.addEventListener('click', () => {
      const result = _aiGenCurve(aiIn.value || '', N);
      ds.set(result); drawIt();
    });
    aiIn.addEventListener('keydown', e => { if(e.key==='Enter') aiBtn.click(); });
    aiRow.append(aiIn, aiBtn);

    // ── Action row: Apply | Reset | Close ──
    const actRow = document.createElement('div'); actRow.className='twe-draw-btns';
    const applyBtn = document.createElement('button'); applyBtn.className='twe-draw-apply'; applyBtn.textContent='Apply';
    applyBtn.addEventListener('click', ()=>{
      sp.customShape=Array.from(ds); sp.shape='custom';
      voice.set('twe',`${keyPrefix}.shape`,'custom');
      shapeRow.querySelectorAll('.wave-btn').forEach(b=>b.classList.remove('active'));
      shapeRow.querySelector('.twe-draw-btn')?.classList.add('active');
      wrap.remove(); _drawContainer=null; redrawTwe();
    });
    const resetBtn = document.createElement('button'); resetBtn.className='twe-draw-reset'; resetBtn.textContent='Delete Custom';
    resetBtn.title='Clear custom shape and revert to Sine';
    resetBtn.addEventListener('click', ()=>{
      sp.customShape = null; sp.shape = 'sine';
      voice.set('twe', `${keyPrefix}.shape`, 'sine');
      shapeRow.querySelectorAll('.wave-btn').forEach(b=>b.classList.toggle('active', b.dataset.shape==='sine'));
      shapeRow.querySelector('.twe-draw-btn')?.classList.remove('active');
      wrap.remove(); _drawContainer=null; redrawTwe();
    });
    const closeBtn = document.createElement('button'); closeBtn.className='twe-draw-close'; closeBtn.textContent='✕';
    closeBtn.addEventListener('click',()=>{wrap.remove();_drawContainer=null;});
    actRow.append(applyBtn, resetBtn, closeBtn);

    wrap.append(cvs, presetsRow, aiRow, actRow);
    shapeRow.insertAdjacentElement('afterend', wrap);
  };

  // ─ UI helper: shape row ─
  const buildShapeRow = (parent, sp, keyPrefix) => {
    const row = document.createElement('div'); row.className='twe-shape-row';
    TWE_SHAPES.forEach(sh => {
      const b = document.createElement('button'); b.className='wave-btn'+(sh===sp.shape?' active':''); b.textContent=TWE_SHAPE_ABBR[sh]; b.dataset.shape=sh;
      b.addEventListener('click', e => {
        const s=e.target.closest('[data-shape]').dataset.shape;
        row.querySelectorAll('.wave-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
        sp.shape=s; voice.set('twe',`${keyPrefix}.shape`,s); redrawTwe();
      });
      row.appendChild(b);
    });
    const drwBtn = document.createElement('button'); drwBtn.className='wave-btn twe-draw-btn'+(sp.shape==='custom'?' active':''); drwBtn.textContent='DRW'; drwBtn.title='Draw custom waveform';
    drwBtn.addEventListener('click', ()=>openDrawCanvas(sp, keyPrefix, row));
    row.appendChild(drwBtn);
    parent.appendChild(row);
    return row;
  };

  // ─ UI helper: target selector ─
  const buildTargetSel = (parent, sp, keyPrefix) => {
    const sel = document.createElement('select'); sel.className='twe-target-sel';
    TWE_TARGETS.forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t.toUpperCase();if(t===sp.target)o.selected=true;sel.appendChild(o);});
    sel.addEventListener('change', ()=>{ sp.target=sel.value; voice.set('twe',`${keyPrefix}.target`,sel.value); redrawTwe(); });
    parent.appendChild(sel); return sel;
  };

  // ─ UI helper: BPM sync row ─
  const buildBpmRow = (parent, sp, keyPrefix) => {
    const row = document.createElement('div'); row.className='twe-sync-row';
    const bpmBtn = document.createElement('button'); bpmBtn.className='twe-mod-btn'+(sp.bpmSync?' active':''); bpmBtn.textContent='BPM';
    const divSel = document.createElement('select'); divSel.className='twe-div-sel'; divSel.disabled=!sp.bpmSync;
    TWE_DIVS.forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=`1/${d}`;if(d===sp.syncDiv)o.selected=true;divSel.appendChild(o);});
    divSel.addEventListener('change',()=>{ sp.syncDiv=parseInt(divSel.value); voice.set('twe',`${keyPrefix}.syncDiv`,sp.syncDiv); redrawTwe(); });
    bpmBtn.addEventListener('click',()=>{ sp.bpmSync=!sp.bpmSync; voice.set('twe',`${keyPrefix}.bpmSync`,sp.bpmSync); bpmBtn.classList.toggle('active',sp.bpmSync); divSel.disabled=!sp.bpmSync; redrawTwe(); });
    const tripBtn = document.createElement('button'); tripBtn.className='twe-mod-btn'+(sp.triplet?' active':''); tripBtn.textContent='T';
    const dotBtn  = document.createElement('button'); dotBtn.className ='twe-mod-btn'+(sp.dotted ?' active':''); dotBtn.textContent ='D';
    tripBtn.addEventListener('click',()=>{ sp.triplet=!sp.triplet; if(sp.triplet){sp.dotted=false;dotBtn.classList.remove('active');} voice.set('twe',`${keyPrefix}.triplet`,sp.triplet); voice.set('twe',`${keyPrefix}.dotted`,sp.dotted); tripBtn.classList.toggle('active',sp.triplet); redrawTwe(); });
    dotBtn.addEventListener ('click',()=>{ sp.dotted =!sp.dotted;  if(sp.dotted ){sp.triplet=false;tripBtn.classList.remove('active');} voice.set('twe',`${keyPrefix}.dotted`,sp.dotted);   voice.set('twe',`${keyPrefix}.triplet`,sp.triplet); dotBtn.classList.toggle('active',sp.dotted); redrawTwe(); });
    row.append(bpmBtn, divSel, tripBtn, dotBtn); parent.appendChild(row);
  };

  // ─ UI helper: full lane controls ─
  const buildLaneControls = (parent, sp, keyPrefix, _unused, compact) => {
    buildShapeRow(parent, sp, keyPrefix);
    const ctrlRow = document.createElement('div'); ctrlRow.className='twe-ctrl-row';
    buildTargetSel(ctrlRow, sp, keyPrefix);
    makeKnob({ parent:ctrlRow, min:0.01, max:20,   value:sp.rate,         label:'RATE',   decimals:2, color, onChange:v=>{ sp.rate=v;  voice.set('twe',`${keyPrefix}.rate`,v);  redrawTwe(); }});
    makeKnob({ parent:ctrlRow, min:0,    max:15000, value:sp.depth,        label:'DEPTH',  decimals:0, color, onChange:v=>{ sp.depth=v; voice.set('twe',`${keyPrefix}.depth`,v); redrawTwe(); }});
    makeKnob({ parent:ctrlRow, min:0,    max:4,     value:sp.attack??0,    label:'ATK',    unit:'s', decimals:2, color:'#88ddff', onChange:v=>{ sp.attack=v; voice.set('twe',`${keyPrefix}.attack`,v); redrawTwe(); }});
    makeKnob({ parent:ctrlRow, min:0,    max:4,     value:sp.decay??0,     label:'DCY',    unit:'s', decimals:2, color:'#ffaa66', onChange:v=>{ sp.decay=v;  voice.set('twe',`${keyPrefix}.decay`,v);  redrawTwe(); }});
    if ('startBar' in sp) makeKnob({ parent:ctrlRow, min:0, max:(voice.p.twe.barsTotal||4)-1, value:sp.startBar??0, label:'BAR', decimals:0, step:1, color:'#aaaaff', onChange:v=>{ sp.startBar=Math.round(v); voice.set('twe',`${keyPrefix}.startBar`,Math.round(v)); redrawTwe(); }});
    parent.appendChild(ctrlRow);
    if (!compact) buildBpmRow(parent, sp, keyPrefix);
  };

  // Helper: mark a lane block as selected
  const selectLane = (id, block) => {
    _tweSelectedLane = id;
    lanesContainer.querySelectorAll('.twe-main-block,.twe-sub-block,.twe-aux-block').forEach(b=>b.classList.remove('twe-selected'));
    block.classList.add('twe-selected');
    redrawTwe();
  };

  // ─ Build main wobble section ─
  const buildMainSection = () => {
    const ms = p.twe.main;
    const mainBlock = document.createElement('div'); mainBlock.className='twe-main-block'+((_tweSelectedLane==='main')?' twe-selected':'');
    const hdr = document.createElement('div'); hdr.className='twe-block-hdr'; hdr.style.cursor='pointer';
    const enBtn = document.createElement('button'); enBtn.className='twe-lane-toggle'+(ms._enabled!==false?' active':''); enBtn.textContent=ms._enabled!==false?'ON':'OFF';
    const coreDiv = document.createElement('div'); coreDiv.className='twe-core-controls';
    const updateMain = () => { const on=ms._enabled!==false; enBtn.classList.toggle('active',on); enBtn.textContent=on?'ON':'OFF'; coreDiv.style.opacity=on?'':'0.4'; if(!on){try{voice.tweMain.gain.disconnect();}catch(_){}voice.tweMain.connected=null;} };
    enBtn.addEventListener('click', e=>{ e.stopPropagation(); ms._enabled=ms._enabled===false?true:false; updateMain(); redrawTwe(); });
    hdr.addEventListener('click', e=>{ if(e.target===enBtn) return; selectLane('main', mainBlock); });
    const lbl = document.createElement('span'); lbl.className='twe-block-lbl'; lbl.textContent='MAIN WOBBLE'; lbl.style.color=color;
    const expandBtn = document.createElement('button'); expandBtn.className='twe-expand-btn'; expandBtn.textContent='▼ STRIKE · BODY · TAIL';
    expandBtn.addEventListener('click', e=>{ e.stopPropagation(); const c=subDiv.style.display==='none'; subDiv.style.display=c?'':'none'; expandBtn.textContent=c?'▼ STRIKE · BODY · TAIL':'▶ STRIKE · BODY · TAIL'; });
    hdr.append(lbl, expandBtn, enBtn); mainBlock.appendChild(hdr);
    buildLaneControls(coreDiv, ms, 'main', false, false); mainBlock.appendChild(coreDiv);

    const subDiv = document.createElement('div'); subDiv.className='twe-sub-components';
    [{key:'strike',label:'⚡ STRIKE'},{key:'body',label:'▬ BODY'},{key:'tail',label:'∿ TAIL'}].forEach(({key,label})=>{
      const sub=ms[key];
      const subBlock=document.createElement('div'); subBlock.className='twe-sub-block'+((_tweSelectedLane===key)?' twe-selected':'');
      const subHdr=document.createElement('div'); subHdr.className='twe-sub-hdr'; subHdr.style.cursor='pointer';
      const subEn=document.createElement('button'); subEn.className='twe-lane-toggle'+(sub._enabled!==false?' active':''); subEn.textContent=sub._enabled!==false?'ON':'OFF';
      const subControls=document.createElement('div'); subControls.className='twe-sub-controls';
      const updateSub=()=>{ const on=sub._enabled!==false; subEn.classList.toggle('active',on); subEn.textContent=on?'ON':'OFF'; subControls.style.opacity=on?'':'0.4'; if(key==='body'&&!on){try{voice.tweBody.gain.disconnect();}catch(_){}voice.tweBody.connected=null;} };
      subEn.addEventListener('click', e=>{ e.stopPropagation(); sub._enabled=sub._enabled===false?true:false; updateSub(); redrawTwe(); });
      subHdr.addEventListener('click', e=>{ if(e.target===subEn) return; selectLane(key, subBlock); });
      const subLbl=document.createElement('span'); subLbl.className='twe-sub-lbl'; subLbl.textContent=label;
      subHdr.append(subLbl, subEn); subBlock.appendChild(subHdr);
      buildLaneControls(subControls, sub, `main.${key}`, true, false); subBlock.appendChild(subControls);
      updateSub(); subDiv.appendChild(subBlock);
    });
    mainBlock.appendChild(subDiv); updateMain(); lanesContainer.appendChild(mainBlock);
  };

  // ─ Build aux lane ─
  const buildAuxLane = (i) => {
    const als = p.twe.aux[i]; if(!als) return;
    const auxId = `aux.${i}`;
    const auxBlock=document.createElement('div'); auxBlock.className='twe-aux-block'+(_tweSelectedLane===auxId?' twe-selected':''); auxBlock.dataset.auxIndex=i;
    const hdr=document.createElement('div'); hdr.className='twe-block-hdr'; hdr.style.cursor='pointer';
    const enBtn=document.createElement('button'); enBtn.className='twe-lane-toggle'+(als._enabled!==false?' active':''); enBtn.textContent=als._enabled!==false?'ON':'OFF';
    const auxControls=document.createElement('div'); auxControls.className='twe-aux-controls';
    const updateAux=()=>{ const on=als._enabled!==false; enBtn.classList.toggle('active',on); enBtn.textContent=on?'ON':'OFF'; auxControls.style.opacity=on?'':'0.4'; if(!on){const a=voice._tweAuxOscs[i];if(a){try{a.gain.disconnect();}catch(_){}a.connected=null;}} };
    enBtn.addEventListener('click', e=>{ e.stopPropagation(); als._enabled=als._enabled===false?true:false; updateAux(); redrawTwe(); });
    hdr.addEventListener('click', e=>{ if(e.target===enBtn||e.target===removeBtn) return; selectLane(auxId, auxBlock); });
    const lbl=document.createElement('span'); lbl.className='twe-block-lbl'; lbl.textContent=`AUX ${i+1}`;
    const removeBtn=document.createElement('button'); removeBtn.className='twe-remove-btn'; removeBtn.textContent='✕';
    removeBtn.addEventListener('click', e=>{ e.stopPropagation();
      voice.set('twe',`aux.remove.${i}`,null); auxBlock.remove();
      lanesContainer.querySelectorAll('.twe-aux-block').forEach(b=>b.remove());
      p.twe.aux.forEach((_,j)=>buildAuxLane(j)); redrawTwe();
    });
    hdr.append(lbl, removeBtn, enBtn); auxBlock.appendChild(hdr);
    buildLaneControls(auxControls, als, `aux.${i}`, true, false); auxBlock.appendChild(auxControls);
    updateAux();
    const addBtn=lanesContainer.querySelector('.twe-add-aux-btn');
    if(addBtn) lanesContainer.insertBefore(auxBlock,addBtn); else lanesContainer.appendChild(auxBlock);
  };

  // ─ Rebuild entire lanes UI ─
  const rebuildTweUI = () => {
    lanesContainer.innerHTML='';
    buildMainSection();
    const addAuxBtn=document.createElement('button'); addAuxBtn.className='twe-add-aux-btn'; addAuxBtn.textContent='＋ ADD AUX LANE';
    addAuxBtn.addEventListener('click',()=>{ voice.set('twe','aux.add',null); buildAuxLane(p.twe.aux.length-1); redrawTwe(); });
    lanesContainer.appendChild(addAuxBtn);
    p.twe.aux.forEach((_,i)=>buildAuxLane(i));
    redrawTwe();
  };
  rebuildTweUI();

  // TWE bypass toggle
  addSectionToggle(tweS,
    () => {
      p.twe._bypassed = true; voice.p.twe._bypassed = true;
      const t = voice.ctx.currentTime;
      voice.tweMain.gain.gain.setTargetAtTime(0,t,0.005); try{voice.tweMain.gain.disconnect();}catch(_){} voice.tweMain.connected=null;
      voice.tweBody.gain.gain.setTargetAtTime(0,t,0.005); try{voice.tweBody.gain.disconnect();}catch(_){} voice.tweBody.connected=null;
      if(voice._tweStrikeGain){voice._tweStrikeGain.gain.setTargetAtTime(0,t,0.005);try{voice._tweStrikeGain.disconnect();}catch(_){}}
      if(voice._tweStrikeOsc){try{voice._tweStrikeOsc.stop(t+0.05);}catch(_){}}
      if(voice._tweTailOsc){try{voice._tweTailOsc.stop(t+0.05);}catch(_){}}
      voice._tweAuxOscs.forEach(a=>{a.gain.gain.setTargetAtTime(0,t,0.005);try{a.gain.disconnect();}catch(_){}a.connected=null;});
    },
    () => { p.twe._bypassed = false; voice.p.twe._bypassed = false; },
    !p.twe._bypassed
  );

  // Initial draw
  setTimeout(() => redrawTwe(), 50);

  // ── WOBBLE ENGINE (LFO drawable breakpoint canvas) ────────
  const lS = cSec('LFO ENGINE'); lS.classList.add('lfo-sec');

  // Slot selector (LFO 1–5 tabs)
  const slotTabRow = document.createElement('div'); slotTabRow.className = 'btn-row'; slotTabRow.style.cssText = 'margin-bottom:8px;gap:3px';
  let activeSlot = 0;
  const slotTabs = [];

  // We'll build one canvas area and swap on slot change
  const canvasWrap = document.createElement('div'); canvasWrap.style.cssText = 'position:relative;margin-bottom:6px';
  const bpCanvas = document.createElement('canvas');
  bpCanvas.style.cssText = 'display:block;width:100%;height:130px;border-radius:4px;background:#050510;border:1px solid #1e1e3a;cursor:crosshair;touch-action:none';
  canvasWrap.appendChild(bpCanvas);
  const axisTop = document.createElement('div'); axisTop.style.cssText = 'position:absolute;top:3px;left:4px;font-size:10px;color:#444;pointer-events:none'; axisTop.textContent = '1.0';
  const axisBot = document.createElement('div'); axisBot.style.cssText = 'position:absolute;bottom:3px;left:4px;font-size:10px;color:#444;pointer-events:none'; axisBot.textContent = '0.0';
  canvasWrap.append(axisTop, axisBot);

  function getEngine() { return voice.lfoEngine; }
  function getSlot()   { return getEngine()?.slots[activeSlot]; }

  // ── Draw breakpoint curve ──────────────────────────────
  function drawBpCanvas() {
    const eng = getEngine(); if (!eng) return;
    const slot = eng.slots[activeSlot];
    const dpr = window.devicePixelRatio || 1;
    const W = bpCanvas.offsetWidth || 280, H = bpCanvas.offsetHeight || 130;
    bpCanvas.width = W * dpr; bpCanvas.height = H * dpr;
    const c = bpCanvas.getContext('2d'); c.scale(dpr, dpr);
    c.fillStyle = '#050510'; c.fillRect(0, 0, W, H);
    // Grid
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 0.5;
    [0.25, 0.5, 0.75].forEach(y => { c.beginPath(); c.moveTo(0, y*H); c.lineTo(W, y*H); c.stroke(); });
    [0.25, 0.5, 0.75].forEach(x => { c.beginPath(); c.moveTo(x*W, 0); c.lineTo(x*W, H); c.stroke(); });
    // Curve from baked points
    const pts = slot.points; if (!pts || !pts.length) return;
    const N = pts.length;
    c.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * W;
      const y = (1 - pts[i]) * H;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.save(); c.globalAlpha = 0.15; c.strokeStyle = color; c.lineWidth = 6; c.stroke(); c.restore();
    c.strokeStyle = color; c.lineWidth = 2; c.stroke();
    // Breakpoint handles
    slot.breakpoints.forEach(bp => {
      const x = bp.x * W, y = (1 - bp.y) * H;
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI*2);
      c.fillStyle = bp.hard ? '#ff6644' : color; c.fill();
      c.strokeStyle = '#0a0a1a'; c.lineWidth = 1.5; c.stroke();
    });
  }

  // ── Breakpoint drag/click interaction ─────────────────
  let bpDragIdx = -1;
  const BP_HIT = 10;
  function bpXY(e) {
    const r = bpCanvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) / r.width, y: 1 - (cy - r.top) / r.height };
  }
  function bpHit(px, py) {
    const slot = getSlot(); if (!slot) return -1;
    const W = bpCanvas.offsetWidth || 280, H = bpCanvas.offsetHeight || 130;
    for (let i = 0; i < slot.breakpoints.length; i++) {
      const bp = slot.breakpoints[i];
      const dx = (bp.x - px) * W, dy = (bp.y - py) * H;
      if (Math.hypot(dx, dy) < BP_HIT) return i;
    }
    return -1;
  }
  bpCanvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const { x, y } = bpXY(e);
    const idx = bpHit(x, y);
    if (idx >= 0) { bpDragIdx = idx; bpCanvas.setPointerCapture(e.pointerId); return; }
    // Add new point
    const slot = getSlot(); if (!slot) return;
    slot.breakpoints.push({ x: Math.max(0,Math.min(1,x)), y: Math.max(0,Math.min(1,y)), hard: false, tension: 0 });
    slot.breakpoints.sort((a,b) => a.x - b.x);
    getEngine().setSlotBreakpoints(activeSlot, slot.breakpoints);
    drawBpCanvas();
  });
  bpCanvas.addEventListener('pointermove', e => {
    if (bpDragIdx < 0) return;
    e.preventDefault();
    const { x, y } = bpXY(e);
    const slot = getSlot(); if (!slot) return;
    const bp = slot.breakpoints[bpDragIdx];
    bp.y = Math.max(0, Math.min(1, y));
    // Don't move first/last x
    if (bpDragIdx > 0 && bpDragIdx < slot.breakpoints.length - 1)
      bp.x = Math.max(0.01, Math.min(0.99, x));
    getEngine().setSlotBreakpoints(activeSlot, slot.breakpoints);
    drawBpCanvas();
  });
  bpCanvas.addEventListener('pointerup', () => { bpDragIdx = -1; });
  bpCanvas.addEventListener('dblclick', e => {
    const { x, y } = bpXY(e);
    const idx = bpHit(x, y);
    const slot = getSlot(); if (!slot) return;
    if (idx > 0 && idx < slot.breakpoints.length - 1) {
      slot.breakpoints.splice(idx, 1);
      getEngine().setSlotBreakpoints(activeSlot, slot.breakpoints);
      drawBpCanvas();
    } else if (idx >= 0) {
      slot.breakpoints[idx].hard = !slot.breakpoints[idx].hard;
      getEngine().setSlotBreakpoints(activeSlot, slot.breakpoints);
      drawBpCanvas();
    }
  });

  // ── Load preset helper ─────────────────────────────────
  function applyPreset(name) {
    const eng = getEngine(); if (!eng) return;
    if (loadLFOPreset(activeSlot, name, eng)) {
      eng.slots[activeSlot].presetName = name;
      drawBpCanvas();
      refreshSlotUI();
    }
  }

  // ── Preset button rows ─────────────────────────────────
  function makePresetRow(label, labelColor, presets) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap;align-items:center;margin-bottom:4px';
    const lbl = document.createElement('span');
    lbl.style.cssText = `font-size:11px;color:${labelColor};letter-spacing:1px;min-width:44px;flex-shrink:0`;
    lbl.textContent = label;
    row.appendChild(lbl);
    presets.forEach(([name, display]) => {
      const b = document.createElement('button');
      b.className = 'wave-btn'; b.textContent = display;
      b.style.cssText = `border-color:${labelColor};color:${labelColor};padding:3px 7px;font-size:11px`;
      b.addEventListener('click', () => applyPreset(name));
      row.appendChild(b);
    });
    return row;
  }

  const presetSection = document.createElement('div');
  presetSection.append(
    makePresetRow('SHAPE', '#aaa', [['sawup','SAW↗'],['sawdn','SAW↘'],['sine','SINE'],['square','SQ'],['triangle','TRI'],['bounce','BOUNCE'],['shark','SHARK'],['expup','EXP↑'],['expdown','EXP↓']]),
    makePresetRow('STEPS', '#666', [['step4','4-STEP'],['step8','8-STEP'],['stair4','4↑'],['stair4dn','4↓'],['stairirr','IRR']]),
    makePresetRow('DnB',   '#00ffb2', [['dnbsaw','SAW'],['dnbpump','PUMP'],['wubwub','WUBWUB'],['acid','ACID'],['fastsaw','FAST'],['triplet','TRIPLET'],['rubber','RUBBER']]),
    makePresetRow('NEURO', '#a855f7', [['neurozap','ZAP'],['neuroglitch','GLITCH'],['neuro','NEURO'],['neurostep','STEP']]),
    makePresetRow('LIQ',   '#22d3ee', [['liquid','LIQUID'],['breathe','BREATHE'],['flow','FLOW'],['halftime','HALF'],['swell','SWELL'],['vowel','VOWEL'],['wah','WAH']])
  );

  // ── Target buttons ─────────────────────────────────────
  const TARGETS = [['none','OFF'],['cutoff','CUTOFF'],['pitch','PITCH'],['amp','TREMOLO'],['resonance','RESO'],['drive','DRIVE'],['noiseAmt','NOISE']];
  const tgtRow = document.createElement('div'); tgtRow.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px;align-items:center';
  const tgtLbl = document.createElement('span'); tgtLbl.style.cssText = 'font-size:11px;color:#666;letter-spacing:1px;min-width:44px;flex-shrink:0'; tgtLbl.textContent = 'TARGET';
  tgtRow.appendChild(tgtLbl);
  const tgtBtns = [];
  TARGETS.forEach(([val, lbl]) => {
    const b = document.createElement('button'); b.className = 'wave-btn'; b.textContent = lbl; b.dataset.tgt = val;
    b.style.cssText = 'padding:3px 8px;font-size:11px';
    b.addEventListener('click', () => {
      const slot = getSlot(); if (!slot) return;
      const prev = slot.target;
      slot.target = val;
      tgtBtns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      // Restore modulated params when disabling a target
      if (val === 'none') {
        const t = voice.ctx.currentTime;
        if (prev === 'cutoff')    voice.filter.frequency.setTargetAtTime(Math.max(20, voice.p.filter.cutoff), t, 0.02);
        if (prev === 'resonance') voice.filter.Q.setTargetAtTime(voice.p.filter.resonance, t, 0.02);
        if (prev === 'pitch' || prev === 'amp' || prev === 'tremolo') {
          voice._tremoloGain?.gain.setTargetAtTime(1, t, 0.02);
          (voice._activeOscs || []).forEach(o => { try { o.detune.setTargetAtTime(0, t, 0.02); } catch(_) {} });
        }
        if (prev === 'drive') voice._distPre?.gain.setTargetAtTime(1, t, 0.02);
        if (prev === 'noiseAmt') voice._noiseG?.gain.setTargetAtTime(voice.p.noise.volume, t, 0.02);
      }
    });
    tgtBtns.push(b); tgtRow.appendChild(b);
  });

  // ── BARS row ───────────────────────────────────────────
  const barsRow = document.createElement('div'); barsRow.style.cssText = 'display:flex;gap:3px;align-items:center;margin-bottom:4px';
  const barsLbl = document.createElement('span'); barsLbl.style.cssText = 'font-size:11px;color:#666;letter-spacing:1px;min-width:44px;flex-shrink:0'; barsLbl.textContent = 'BARS';
  barsRow.appendChild(barsLbl);
  const barsBtns = [];
  [1,2,4,8,16].forEach(n => {
    const b = document.createElement('button'); b.className = 'wave-btn'; b.textContent = n; b.dataset.bars = n;
    b.style.cssText = 'padding:3px 10px;font-size:12px';
    b.addEventListener('click', () => { const s=getSlot();if(s){s.bars=n;barsBtns.forEach(x=>x.classList.remove('active'));b.classList.add('active');} });
    barsBtns.push(b); barsRow.appendChild(b);
  });

  // ── ×REPEAT rows (Straight / Triplet / Dotted) ────────
  const multWrap = document.createElement('div'); multWrap.style.cssText = 'margin-bottom:6px';
  const MULT_ROWS = [
    { label:'ST',  color:'#aaa',    values:[[1,'×1'],[2,'×2'],[4,'×4'],[8,'×8'],[16,'×16'],[32,'×32']] },
    { label:'3T',  color:'#a855f7', values:[[1.5,'×1T'],[3,'×2T'],[6,'×4T'],[12,'×8T'],[24,'×16T']] },
    { label:'DOT', color:'#22d3ee', values:[[0.667,'×1D'],[1.333,'×2D'],[2.667,'×4D'],[5.333,'×8D']] },
  ];
  const allMultBtns = [];
  MULT_ROWS.forEach(({ label, color: lc, values }) => {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:2px;align-items:center;margin-bottom:3px';
    const lbl = document.createElement('span'); lbl.style.cssText = `font-size:11px;color:${lc};min-width:44px;flex-shrink:0`; lbl.textContent = label;
    row.appendChild(lbl);
    values.forEach(([val, disp]) => {
      const b = document.createElement('button'); b.className = 'wave-btn'; b.textContent = disp;
      b.style.cssText = `border-color:${lc};color:${lc};padding:3px 7px;font-size:11px`;
      b.dataset.mult = val;
      b.addEventListener('click', () => { const s=getSlot();if(s){s.mult=val;allMultBtns.forEach(x=>x.classList.remove('active'));b.classList.add('active');} });
      allMultBtns.push(b); row.appendChild(b);
    });
    multWrap.appendChild(row);
  });

  // ── Depth knob + CLR button ────────────────────────────
  const bottomRow = document.createElement('div'); bottomRow.style.cssText = 'display:flex;gap:8px;align-items:flex-end;margin-bottom:4px';
  const depthWrap = document.createElement('div'); depthWrap.className = 'lfo-knob-wrap';
  const depthKnob = makeKnob({ parent: depthWrap, min: 0, max: 1, value: getEngine()?.slots[0]?.depth ?? 0.6, label: 'DEPTH', decimals: 2, color,
    onChange: v => { const s = getSlot(); if (s) s.depth = v; }
  });
  bottomRow.appendChild(depthWrap);

  const clrBtn = document.createElement('button'); clrBtn.className = 'wave-btn'; clrBtn.textContent = 'CLR';
  clrBtn.style.cssText = 'border-color:#ff4466;color:#ff4466;padding:4px 10px;font-size:12px;align-self:center';
  clrBtn.addEventListener('click', () => {
    const slot = getSlot(); if (!slot) return;
    slot.breakpoints = [{ x:0, y:0.5, hard:false }, { x:1, y:0.5, hard:false }];
    getEngine().setSlotBreakpoints(activeSlot, slot.breakpoints);
    drawBpCanvas();
  });
  bottomRow.appendChild(clrBtn);

  // ── Slot tabs (LFO 1–5) ────────────────────────────────
  function refreshSlotUI() {
    const eng = getEngine(); if (!eng) return;
    const slot = eng.slots[activeSlot];
    // Target
    tgtBtns.forEach(b => b.classList.toggle('active', b.dataset.tgt === slot.target));
    // Bars
    barsBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.bars) === slot.bars));
    // Mult
    allMultBtns.forEach(b => b.classList.toggle('active', parseFloat(b.dataset.mult) === slot.mult));
    // Depth
    depthKnob.setValue(slot.depth);
    drawBpCanvas();
  }

  for (let i = 0; i < 5; i++) {
    const b = document.createElement('button');
    b.className = 'wave-btn' + (i === 0 ? ' active' : '');
    b.textContent = `LFO ${i + 1}`;
    b.style.cssText = 'padding:4px 10px;font-size:12px';
    b.addEventListener('click', () => {
      activeSlot = i;
      slotTabs.forEach(x => x.classList.remove('active')); b.classList.add('active');
      refreshSlotUI();
    });
    slotTabs.push(b); slotTabRow.appendChild(b);
  }

  // ── Master ON/OFF toggle for LFO Engine ──────────────
  let lfoEngineEnabled = true;
  addSectionToggle(lS,
    () => { // Disable — stop engine + restore all targets
      lfoEngineEnabled = false;
      voice.lfoEngine?.stop();
      const t = voice.ctx.currentTime;
      voice.filter.frequency.setTargetAtTime(Math.max(20, voice.p.filter.cutoff), t, 0.02);
      voice.filter.Q.setTargetAtTime(voice.p.filter.resonance, t, 0.02);
      voice._tremoloGain?.gain.setTargetAtTime(1, t, 0.02);
      (voice._activeOscs || []).forEach(o => { try { o.detune.setTargetAtTime(0, t, 0.02); } catch(_) {} });
      voice._distPre?.gain.setTargetAtTime(1, t, 0.02);
      voice._noiseG?.gain.setTargetAtTime(voice.p.noise.volume, t, 0.02);
    },
    () => { // Enable — restart engine
      lfoEngineEnabled = true;
      if (voice.lfoEngine && !voice.lfoEngine.playing) voice.lfoEngine.start();
    },
    true
  );

  // ── Assemble ───────────────────────────────────────────
  lS.append(slotTabRow, canvasWrap, tgtRow, barsRow, multWrap, presetSection, bottomRow);

  // Initial draw
  setTimeout(() => { refreshSlotUI(); drawBpCanvas(); }, 50);

  // Sequencer section — header with inline play button top-right
  const seqS = document.createElement('div');
  seqS.className = 'v-sec voice-seq-section';
  seqS.id = `seq-${voice.id}`;
  const seqHdr = document.createElement('div');
  seqHdr.className = 'sec-hdr';
  seqHdr.innerHTML = '<span>SEQUENCER</span>';
  const seqPlayBtn = document.createElement('button');
  seqPlayBtn.className = 'voice-seq-play-btn';
  seqPlayBtn.textContent = '▶';
  seqPlayBtn.dataset.voiceId = voice.id;
  seqHdr.appendChild(seqPlayBtn);
  seqS.appendChild(seqHdr);
  centerCol.appendChild(seqS);

  // ── EQ ────────────────────────────────────────────────────
  const eqS = cSec('EQ');
  buildEQSection(eqS, p.eq, voice, color);

  // ── FX (Reverb + Delay) ───────────────────────────────────
  const fxS = cSec('FX');
  buildFXSection(fxS, p.fx, voice, color);
}

// ─────────────────────────────────────────────────────────
//  Sequencer UI (builds individual sequencer in each voice column)
// ─────────────────────────────────────────────────────────
