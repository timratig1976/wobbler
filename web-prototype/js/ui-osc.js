// ─────────────────────────────────────────────────────────────────────────────
//  ui-osc.js  —  OSC Section UI (Serum-inspired)
//  Extracted from ui-voice.js for modularity.
//  Exports: buildOscSection(container, { voice, p, oscMode, color })
// ─────────────────────────────────────────────────────────────────────────────

function buildOscSection(container, { voice, p, oscMode, color }) {

  // ── Mode flags ────────────────────────────────────────────
  const isOsc1 = oscMode !== 'osc2' && oscMode !== 'sub';
  const isOsc2 = oscMode === 'osc2';
  const isSub  = oscMode === 'sub';
  const oscModeLabel = isOsc2 ? 'OSC 2' : isSub ? 'SUB' : 'OSC 1';

  // Ensure param objects exist
  if (isSub  && !p.sub)  p.sub  = { waveform:'sine',     oct:-2, cents:0,  volume:0.6, unison:1, unisonDetune:10 };
  if (isOsc2 && !p.osc2) p.osc2 = { waveform:'sawtooth', oct:0,  semi:0,   detune:7, cents:0, volume:0.5, unison:1, unisonDetune:10, spread:80 };

  const pp = isOsc2 ? p.osc2 : isSub ? p.sub : p.osc;

  // ── Header: [ON label] [waveform select] [DRAW] ───────────
  const _oscActive = isOsc2 ? p.osc2Active : isSub ? p.subActive : p.osc1Active !== false;
  const oscHdr = document.createElement('div');
  oscHdr.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';

  const onBtn = document.createElement('button');
  onBtn.className = 'osc-on-btn' + (_oscActive ? ' active' : '');
  onBtn.textContent = oscModeLabel;
  onBtn.style.cssText = `padding:3px 8px;font-size:11px;letter-spacing:1px;border-color:${_oscActive ? color : '#333'};color:${_oscActive ? color : '#555'}`;

  const waveOptions = isOsc1 ? ['sawtooth','square','triangle','sine','pulse','supersaw'] :
                      isSub  ? ['sine','sawtooth','square','triangle'] :
                               ['sawtooth','square','triangle','sine'];
  const waveSelect = document.createElement('select');
  waveSelect.style.cssText = `flex:1;background:#0e0e24;border:1px solid #2a2a44;color:${color};padding:3px 6px;font-family:monospace;font-size:11px;border-radius:3px;cursor:pointer;letter-spacing:1px`;
  waveOptions.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w; opt.textContent = w.toUpperCase();
    if (w === (pp.waveform || 'sawtooth')) opt.selected = true;
    waveSelect.appendChild(opt);
  });

  const drawBtn = document.createElement('button');
  drawBtn.textContent = 'DRAW';
  drawBtn.style.cssText = `padding:3px 8px;font-size:10px;letter-spacing:1px;border:1px solid #333;background:transparent;color:#555;font-family:monospace;border-radius:3px;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:.15s`;

  oscHdr.appendChild(onBtn);
  oscHdr.appendChild(waveSelect);
  oscHdr.appendChild(drawBtn);
  container.appendChild(oscHdr);

  const body = document.createElement('div');
  body.style.cssText = `opacity:${_oscActive ? 1 : 0.4}`;
  container.appendChild(body);

  onBtn.addEventListener('click', () => {
    if (isOsc2)     { p.osc2Active = !p.osc2Active; const on=p.osc2Active; onBtn.style.borderColor=on?color:'#333'; onBtn.style.color=on?color:'#555'; body.style.opacity=on?'1':'0.4'; }
    else if (isSub) { p.subActive  = !p.subActive;  const on=p.subActive;  onBtn.style.borderColor=on?color:'#333'; onBtn.style.color=on?color:'#555'; body.style.opacity=on?'1':'0.4'; }
    else            { p.osc1Active = !p.osc1Active; const on=p.osc1Active; onBtn.style.borderColor=on?color:'#333'; onBtn.style.color=on?color:'#555'; body.style.opacity=on?'1':'0.4'; }
  });

  // ── Shared waveform sample data ───────────────────────────
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

  if (pp._customSamples && pp._customSamples.length === N) {
    wtSamples = new Float32Array(pp._customSamples);
  } else {
    wtInitFromWave(pp.waveform || 'sawtooth');
  }

  // ── Shared draw-to-canvas helper ──────────────────────────
  function drawWtOnCanvas(cv, h) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.offsetWidth || 200, H = h || cv.offsetHeight || 80;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d'); c.scale(dpr, dpr);
    c.fillStyle = '#050510'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 0.5;
    [0.25,0.5,0.75].forEach(y => { c.beginPath(); c.moveTo(0,y*H); c.lineTo(W,y*H); c.stroke(); });
    c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0,H/2); c.lineTo(W,H/2); c.stroke();
    c.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i/N)*W, y = (0.5 - wtSamples[i]*0.45)*H;
      i===0 ? c.moveTo(x,y) : c.lineTo(x,y);
    }
    c.save(); c.globalAlpha=0.12; c.strokeStyle=color; c.lineWidth=8; c.stroke(); c.restore();
    c.strokeStyle=color; c.lineWidth=2; c.stroke();
  }

  // ── Save samples & update live voice ─────────────────────
  function commitSamples() {
    const saved = Array.from(wtSamples);
    if (isOsc1) {
      p.osc._customSamples = saved;
      const pw = voice._makePeriodicWave ? voice._makePeriodicWave(wtSamples) : null;
      if (pw) (voice._activeOscs||[]).forEach(o => { try { o.setPeriodicWave(pw); } catch(_){} });
    } else if (isOsc2) { p.osc2._customSamples = saved; }
    else               { p.sub._customSamples  = saved; }
  }

  // ── Drag-param helper ─────────────────────────────────────
  function makeDragParam({ parent, label, value, min, max, decimals=0, unit='', step=1, onChange }) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;cursor:ns-resize;user-select:none;position:relative';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;color:#555;letter-spacing:1px;margin-bottom:1px';
    lbl.textContent = label;
    const val = document.createElement('div');
    val.style.cssText = `font-size:12px;color:${color};font-family:monospace;letter-spacing:1px`;
    val.textContent = (decimals>0 ? value.toFixed(decimals) : Math.round(value)) + unit;
    let current = value, startY = 0, startV = 0;
    wrap.addEventListener('pointerdown', e => {
      if (e.target === rangeBar || e.target === rangeLoHandle || e.target === rangeHiHandle) return;
      wrap.setPointerCapture(e.pointerId); startY=e.clientY; startV=current;
    });
    wrap.addEventListener('pointermove', e => {
      if (e.buttons===0) return;
      if (e.target === rangeBar || e.target === rangeLoHandle || e.target === rangeHiHandle) return;
      const delta = (startY - e.clientY) * step * 0.5;
      current = Math.max(min, Math.min(max, startV + delta));
      val.textContent = (decimals>0 ? current.toFixed(decimals) : Math.round(current)) + unit;
      onChange(decimals>0 ? current : Math.round(current));
    });
    // Mod badge — shown below value when LFO is active on this param
    const modBadge = document.createElement('div');
    modBadge.style.cssText = `font-size:8px;font-family:monospace;letter-spacing:1px;color:${color};opacity:0;transition:opacity 0.15s;text-shadow:0 0 6px ${color};margin-top:1px`;
    // Mod range bar — thin horizontal bar with lo/hi draggable handles
    const rangeBar = document.createElement('div');
    rangeBar.style.cssText = 'position:relative;width:80%;height:3px;background:#1c1c3a;border-radius:2px;margin-top:2px;display:none;cursor:default';
    const rangeFill = document.createElement('div');
    rangeFill.style.cssText = 'position:absolute;top:0;height:100%;border-radius:2px;pointer-events:none';
    const rangeLoHandle = document.createElement('div');
    rangeLoHandle.style.cssText = 'position:absolute;top:-3px;width:3px;height:9px;border-radius:1px;background:#fff;cursor:ew-resize;transform:translateX(-50%)';
    const rangeHiHandle = document.createElement('div');
    rangeHiHandle.style.cssText = 'position:absolute;top:-3px;width:3px;height:9px;border-radius:1px;cursor:ew-resize;transform:translateX(-50%)';
    rangeBar.append(rangeFill, rangeLoHandle, rangeHiHandle);

    let _modRange = null;
    function _updateRangeBar() {
      if (!_modRange) { rangeBar.style.display = 'none'; return; }
      rangeBar.style.display = 'block';
      const lo = Math.max(0, Math.min(1, _modRange.lo));
      const hi = Math.max(0, Math.min(1, _modRange.hi));
      rangeFill.style.left  = (Math.min(lo,hi)*100)+'%';
      rangeFill.style.width = (Math.abs(hi-lo)*100)+'%';
      rangeFill.style.background = _modRange.color || color;
      rangeLoHandle.style.left = (lo*100)+'%';
      rangeHiHandle.style.left = (hi*100)+'%';
      rangeHiHandle.style.background = _modRange.color || color;
    }
    function _makeHandleDrag(which) {
      rangeLoHandle.addEventListener('pointerdown', e => {
        if (which !== 'lo') return;
        e.stopPropagation(); rangeLoHandle.setPointerCapture(e.pointerId);
        const onMove = ev => {
          const rect = rangeBar.getBoundingClientRect();
          _modRange.lo = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
          _modRange.onChange?.(_modRange.lo, _modRange.hi);
          _updateRangeBar();
        };
        const onUp = () => { rangeLoHandle.removeEventListener('pointermove',onMove); rangeLoHandle.removeEventListener('pointerup',onUp); };
        rangeLoHandle.addEventListener('pointermove',onMove); rangeLoHandle.addEventListener('pointerup',onUp);
      });
      rangeHiHandle.addEventListener('pointerdown', e => {
        if (which !== 'hi') return;
        e.stopPropagation(); rangeHiHandle.setPointerCapture(e.pointerId);
        const onMove = ev => {
          const rect = rangeBar.getBoundingClientRect();
          _modRange.hi = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
          _modRange.onChange?.(_modRange.lo, _modRange.hi);
          _updateRangeBar();
        };
        const onUp = () => { rangeHiHandle.removeEventListener('pointermove',onMove); rangeHiHandle.removeEventListener('pointerup',onUp); };
        rangeHiHandle.addEventListener('pointermove',onMove); rangeHiHandle.addEventListener('pointerup',onUp);
      });
    }
    _makeHandleDrag('lo'); _makeHandleDrag('hi');

    wrap.append(lbl, val, modBadge, rangeBar);
    parent.appendChild(wrap);
    return {
      setValue:    v  => { current=v; val.textContent=(decimals>0?v.toFixed(decimals):Math.round(v))+unit; },
      setModLabel: tx => {
        if (tx === null) { modBadge.style.opacity='0'; modBadge.textContent=''; }
        else             { modBadge.textContent=tx; modBadge.style.opacity='1'; }
      },
      setModRange(lo, hi, rangeColor, onChange) {
        _modRange = { lo: Math.max(0,Math.min(1,lo)), hi: Math.max(0,Math.min(1,hi)), color: rangeColor, onChange };
        _updateRangeBar();
      },
      clearModRange() { _modRange = null; _updateRangeBar(); },
    };
  }

  // ── Middle row: [UNISON left] [Wavetable canvas right 50%] ──
  const midRow = document.createElement('div');
  midRow.style.cssText = 'display:flex;gap:5px;margin-bottom:5px;align-items:stretch';
  body.appendChild(midRow);

  // LEFT: unison stepper + horizontal knob row (flex:1)
  const uniPanel = document.createElement('div');
  uniPanel.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center';
  midRow.appendChild(uniPanel);

  // Stepper row
  const uniStepRow = document.createElement('div');
  uniStepRow.style.cssText = 'display:flex;align-items:center;gap:4px';
  const uniLbl = document.createElement('div'); uniLbl.style.cssText='font-size:8px;color:#444;letter-spacing:1px'; uniLbl.textContent='UNI';
  const uniCtrl = document.createElement('div'); uniCtrl.style.cssText='display:flex;align-items:center;gap:2px';
  const uniDn = document.createElement('button'); uniDn.textContent='−'; uniDn.style.cssText='width:16px;height:18px;padding:0;font-size:12px;border:1px solid #2a2a44;background:#0e0e24;color:#aaa;border-radius:2px;cursor:pointer';
  const currentUnison = isOsc2 ? (p.osc2.unison??1) : isSub ? (p.sub?.unison??1) : (p.osc.unison??1);
  const uniVal = document.createElement('div'); uniVal.style.cssText=`min-width:20px;text-align:center;font-size:12px;color:${color};font-family:monospace`; uniVal.textContent=currentUnison;
  const uniUp = document.createElement('button'); uniUp.textContent='+'; uniUp.style.cssText='width:16px;height:18px;padding:0;font-size:12px;border:1px solid #2a2a44;background:#0e0e24;color:#aaa;border-radius:2px;cursor:pointer';
  uniCtrl.append(uniDn, uniVal, uniUp);
  uniStepRow.append(uniLbl, uniCtrl);
  uniPanel.appendChild(uniStepRow);

  // Horizontal knob row — always visible, dimmed when uni=1
  const uniKnobRow = document.createElement('div');
  uniKnobRow.style.cssText = `display:flex;gap:2px;align-items:flex-end;opacity:${currentUnison > 1 ? 1 : 0.3};pointer-events:${currentUnison > 1 ? 'auto' : 'none'}`;
  uniPanel.appendChild(uniKnobRow);

  if (isOsc1) {
    makeKnob({ parent:uniKnobRow, min:0, max:100, value:p.osc.unisonDetune??20,  label:'DET', unit:'¢', decimals:0, step:1, color, size:40, onChange: v => voice.set('osc','unisonDetune',v) });
    makeKnob({ parent:uniKnobRow, min:0, max:1,   value:p.osc.unisonBlend??1,    label:'BLD', decimals:2,        color, size:40, onChange: v => voice.set('osc','unisonBlend',v) });
    makeKnob({ parent:uniKnobRow, min:0, max:100, value:(p.osc.spread??0.5)*100, label:'WID', unit:'%', decimals:0, color, size:40, onChange: v => voice.set('osc','spread',v/100) });
  } else if (isOsc2) {
    makeKnob({ parent:uniKnobRow, min:0, max:100, value:p.osc2.unisonDetune??10, label:'DET', unit:'¢', decimals:0, step:1, color, size:40, onChange: v => { p.osc2.unisonDetune=v; } });
    makeKnob({ parent:uniKnobRow, min:0, max:100, value:p.osc2.spread??80,       label:'WID', unit:'%', decimals:0,        color, size:40, onChange: v => { p.osc2.spread=v; } });
  } else {
    makeKnob({ parent:uniKnobRow, min:0, max:100, value:p.sub?.unisonDetune??10, label:'DET', unit:'¢', decimals:0, step:1, color, size:40, onChange: v => { if(p.sub) p.sub.unisonDetune=v; } });
  }

  let unisonVal = currentUnison;
  function setUnison(n) {
    unisonVal = Math.max(1, Math.min(16, n));
    uniVal.textContent = unisonVal;
    const active = unisonVal > 1;
    uniKnobRow.style.opacity = active ? '1' : '0.3';
    uniKnobRow.style.pointerEvents = active ? 'auto' : 'none';
    if (isOsc1) voice.set('osc','unison',unisonVal);
    else if (isOsc2) p.osc2.unison = unisonVal;
    else if (p.sub) p.sub.unison = unisonVal;
  }
  uniDn.addEventListener('click', () => setUnison(unisonVal-1));
  uniUp.addEventListener('click', () => setUnison(unisonVal+1));

  // RIGHT: Wavetable canvas — fixed 50% width
  const wtWrap = document.createElement('div');
  wtWrap.style.cssText = 'flex:0 0 50%;max-width:50%;position:relative';
  const wtCv = document.createElement('canvas');
  wtCv.style.cssText = 'display:block;width:100%;height:100px;background:#050510;border-radius:4px;border:1px solid #1e1e3a;cursor:pointer';
  wtCv.title = 'Click to open wavetable editor';
  wtWrap.appendChild(wtCv);
  midRow.appendChild(wtWrap);

  // Preview canvas just shows — click opens modal
  wtCv.addEventListener('click', openDrawModal);
  setTimeout(() => drawWtOnCanvas(wtCv), 50);

  waveSelect.addEventListener('change', () => {
    const w = waveSelect.value;
    if (isOsc1)      voice.set('osc', 'waveform', w);
    else if (isOsc2)  voice.set('osc2','waveform', w);
    else              voice.set('sub', 'waveform', w);
    pp._customSamples = null;
    wtInitFromWave(w);
    drawWtOnCanvas(wtCv);
  });

  // ── DRAW MODAL ────────────────────────────────────────────
  drawBtn.addEventListener('click', openDrawModal);

  function openDrawModal() {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';

    // Modal box
    const modal = document.createElement('div');
    modal.style.cssText = `background:#080818;border:1px solid ${color}44;border-radius:8px;padding:16px;width:min(680px,92vw);box-shadow:0 0 40px ${color}22;position:relative`;

    // Title row
    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px';
    const title = document.createElement('div');
    title.style.cssText = `font-size:12px;color:${color};font-family:monospace;letter-spacing:2px;font-weight:bold`;
    title.textContent = `WAVETABLE EDITOR — ${oscModeLabel}`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'background:transparent;border:none;color:#666;font-size:16px;cursor:pointer;padding:0 4px;line-height:1';
    closeBtn.addEventListener('click', () => document.body.removeChild(backdrop));
    titleRow.append(title, closeBtn);
    modal.appendChild(titleRow);

    // Toolbar: wave presets + Clear + Close
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;align-items:center';
    const presetWaves = isOsc1 ? ['sawtooth','square','triangle','sine','pulse','supersaw'] :
                        isSub  ? ['sine','sawtooth','square','triangle'] :
                                 ['sawtooth','square','triangle','sine'];
    presetWaves.forEach(w => {
      const b = document.createElement('button');
      b.textContent = w.toUpperCase();
      b.style.cssText = `padding:3px 7px;font-size:9px;letter-spacing:1px;font-family:monospace;background:#0e0e24;border:1px solid #2a2a44;color:#888;border-radius:3px;cursor:pointer`;
      b.addEventListener('click', () => { wtInitFromWave(w); redrawModal(); commitSamples(); drawWtOnCanvas(wtCv); });
      toolbar.appendChild(b);
    });
    // Separator
    const sep = document.createElement('div'); sep.style.cssText='flex:1';
    toolbar.appendChild(sep);
    // Smooth button
    const smoothBtn = document.createElement('button');
    smoothBtn.textContent = 'SMOOTH';
    smoothBtn.style.cssText = `padding:3px 8px;font-size:9px;letter-spacing:1px;font-family:monospace;background:#0e0e24;border:1px solid #2a2a44;color:#888;border-radius:3px;cursor:pointer`;
    smoothBtn.addEventListener('click', () => {
      const tmp = new Float32Array(N);
      for (let i=0; i<N; i++) tmp[i] = (wtSamples[(i-1+N)%N] + wtSamples[i]*2 + wtSamples[(i+1)%N]) / 4;
      wtSamples.set(tmp); redrawModal(); commitSamples(); drawWtOnCanvas(wtCv);
    });
    toolbar.appendChild(smoothBtn);
    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'CLEAR';
    clearBtn.style.cssText = `padding:3px 8px;font-size:9px;letter-spacing:1px;font-family:monospace;background:#0e0e24;border:1px solid #442222;color:#a55;border-radius:3px;cursor:pointer`;
    clearBtn.addEventListener('click', () => { wtSamples.fill(0); redrawModal(); commitSamples(); drawWtOnCanvas(wtCv); });
    toolbar.appendChild(clearBtn);
    modal.appendChild(toolbar);

    // Large drawing canvas
    const drawCv = document.createElement('canvas');
    drawCv.style.cssText = `display:block;width:100%;height:260px;background:#050510;border-radius:6px;border:1px solid ${color}33;cursor:crosshair;touch-action:none`;
    modal.appendChild(drawCv);

    // Hint
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:9px;color:#333;text-align:center;margin-top:6px;letter-spacing:1px';
    hint.textContent = 'DRAG TO DRAW · HOLD SHIFT = LINE MODE';
    modal.appendChild(hint);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) document.body.removeChild(backdrop); });

    function redrawModal() { drawWtOnCanvas(drawCv, 260); }
    setTimeout(redrawModal, 30);

    // Drawing logic on the large modal canvas
    let painting = false, _lastIdx = -1, _lastVal = 0, _shiftLine = false;
    let _lineStartIdx = -1, _lineStartVal = 0;
    let _previewSamples = null; // for shift-line preview

    function paintAt(e, canvas) {
      const r = canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      const idx = Math.max(0, Math.min(N-1, Math.round((cx / r.width) * N)));
      const val = Math.max(-1, Math.min(1, (0.5 - cy / r.height) / 0.45));

      if (_shiftLine && _lineStartIdx >= 0) {
        // Preview straight line from start to current
        _previewSamples = new Float32Array(wtSamples);
        const i0 = Math.min(_lineStartIdx, idx), i1 = Math.max(_lineStartIdx, idx);
        const v0 = _lineStartIdx <= idx ? _lineStartVal : val;
        const v1 = _lineStartIdx <= idx ? val : _lineStartVal;
        for (let i=i0; i<=i1; i++) {
          _previewSamples[i] = v0 + (v1-v0) * ((i-i0) / Math.max(1, i1-i0));
        }
        // Draw preview
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth, H = 260;
        const c = canvas.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
        drawWtOnCanvas(canvas, 260);
        c.strokeStyle = '#fff'; c.lineWidth = 1; c.globalAlpha = 0.5; c.setLineDash([4,4]);
        c.beginPath();
        c.moveTo((_lineStartIdx/N)*W, (0.5 - _lineStartVal*0.45)*H);
        c.lineTo((idx/N)*W, (0.5 - val*0.45)*H);
        c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
        return;
      }

      if (_lastIdx >= 0 && _lastIdx !== idx) {
        const i0 = Math.min(_lastIdx, idx), i1 = Math.max(_lastIdx, idx);
        const v0 = _lastIdx < idx ? _lastVal : val;
        const v1 = _lastIdx < idx ? val : _lastVal;
        for (let i=i0; i<=i1; i++) {
          wtSamples[i] = v0 + (v1-v0) * ((i-i0) / Math.max(1, i1-i0));
        }
      } else {
        wtSamples[idx] = val;
      }
      _lastIdx = idx; _lastVal = val;
      redrawModal(); commitSamples(); drawWtOnCanvas(wtCv);
    }

    function onDown(e) {
      painting = true; _lastIdx = -1;
      _shiftLine = e.shiftKey;
      if (_shiftLine) {
        const r = drawCv.getBoundingClientRect();
        const cx = e.clientX - r.left, cy = e.clientY - r.top;
        _lineStartIdx = Math.max(0, Math.min(N-1, Math.round((cx / r.width) * N)));
        _lineStartVal = Math.max(-1, Math.min(1, (0.5 - cy / r.height) / 0.45));
      }
      paintAt(e, drawCv);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }
    function onMove(e) {
      if (!painting) return;
      paintAt(e, drawCv);
    }
    function onUp(e) {
      if (_shiftLine && _previewSamples) {
        wtSamples.set(_previewSamples); _previewSamples = null;
        redrawModal(); commitSamples(); drawWtOnCanvas(wtCv);
      }
      painting = false; _lastIdx = -1; _shiftLine = false; _lineStartIdx = -1;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    drawCv.addEventListener('pointerdown', onDown);
  }

  // ── Param row below mid-row ───────────────────────────────
  const paramRow = document.createElement('div');
  paramRow.style.cssText = 'display:flex;gap:2px;background:#0a0a1e;border:1px solid #1a1a30;border-radius:4px;padding:5px 4px;margin-bottom:6px';
  body.appendChild(paramRow);

  if (isOsc1) {
    makeDragParam({ parent:paramRow, label:'OCT',   value:Math.round((p.osc.pitch??0)/12),  min:-4,  max:4,   unit:'',  step:1,    onChange: v => voice.set('osc','pitch',v*12) });
    const semParam = makeDragParam({ parent:paramRow, label:'SEM',   value:Math.round((p.osc.pitch??0)%12),  min:-12, max:12,  unit:'',  step:1,    onChange: v => voice.set('osc','pitch',Math.round((p.osc.pitch??0)/12)*12+v) });
    const finParam = makeDragParam({ parent:paramRow, label:'FIN',   value:p.osc.cent??0,  min:-100,max:100, unit:'¢', step:1,    onChange: v => voice.set('osc','cent',v) });
    voice._semParam = semParam;
    voice._finParam = finParam;
    // SEM mod badge — shows ±N semitone offset when semi LFO active
    voice._semiModUpdate = (semi) => {
      if (semi === null) { semParam.setModLabel(null); }
      else { const sign = semi >= 0 ? '+' : ''; semParam.setModLabel(`${sign}${semi}st`); }
    };
    // FIN / PITCH mod badge — shows ±Xc offset when pitch or fine LFO active
    voice._pitchModUpdate = (cents) => {
      if (cents === null) {
        finParam.setModLabel(null);
      } else {
        const sign = cents >= 0 ? '+' : '';
        finParam.setModLabel(`${sign}${Math.round(cents)}¢`);
      }
    };
    const pwWrap = document.createElement('div'); pwWrap.style.cssText='flex:1;display:'+(p.osc.waveform==='pulse'?'flex':'none');
    makeDragParam({ parent:pwWrap,   label:'PW',    value:p.osc.pw??0.5,                    min:0.1, max:0.9, decimals:2, step:0.01, onChange: v => voice.set('osc','pw',v) });
    paramRow.appendChild(pwWrap);
    const levelParam = makeDragParam({ parent:paramRow, label:'LEVEL', value:p.osc.volume??0.8, min:0, max:1, decimals:2, step:0.01, onChange: v => voice.set('osc','volume',v) });
    voice._levelParam = levelParam;
    voice._tremoloModUpdate = (gain) => {
      if (gain === null) { levelParam.setModLabel(null); }
      else { levelParam.setModLabel((gain * 100).toFixed(0) + '%'); }
    };
    waveSelect.addEventListener('change', () => { pwWrap.style.display = waveSelect.value==='pulse'?'flex':'none'; });
  } else if (isOsc2) {
    makeDragParam({ parent:paramRow, label:'OCT',   value:p.osc2.oct??0,     min:-4,  max:4,   unit:'',  step:1,    onChange: v => { p.osc2.oct=v; } });
    makeDragParam({ parent:paramRow, label:'SEM',   value:p.osc2.semi??0,    min:-12, max:12,  unit:'',  step:1,    onChange: v => { p.osc2.semi=v; } });
    makeDragParam({ parent:paramRow, label:'FIN',   value:p.osc2.cents??0,   min:-100,max:100, unit:'¢', step:1,    onChange: v => { p.osc2.cents=v; } });
    makeDragParam({ parent:paramRow, label:'DET',   value:p.osc2.detune??7,  min:-100,max:100, unit:'¢', step:1,    onChange: v => { p.osc2.detune=v; } });
    makeDragParam({ parent:paramRow, label:'LEVEL', value:p.osc2.volume??0.5,min:0,   max:1,   decimals:2, step:0.01, onChange: v => { p.osc2.volume=v; } });
  } else {
    makeDragParam({ parent:paramRow, label:'OCT',   value:p.sub.oct??-2,     min:-4,  max:0,   unit:'',  step:1,    onChange: v => { p.sub.oct=v; } });
    makeDragParam({ parent:paramRow, label:'FIN',   value:p.sub.cents??0,    min:-100,max:100, unit:'¢', step:1,    onChange: v => { p.sub.cents=v; } });
    makeDragParam({ parent:paramRow, label:'LEVEL', value:p.sub.volume??0.6, min:0,   max:1,   decimals:2, step:0.01, onChange: v => { p.sub.volume=v; } });
  }

  // ── Noise panel (all voices) ─────────────────────────────
  const noisePanel = createNoisePanel({ voice, color });
  noisePanel.element.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid #1c1c3a';
  body.appendChild(noisePanel.element);
}
