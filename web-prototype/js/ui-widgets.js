function drawWaveform(canvas, type, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth  || 200;
  const H = canvas.offsetHeight || 82;
  if (!W || !H) return;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);

  c.fillStyle = '#030308'; c.fillRect(0, 0, W, H);

  // Grid — horizontal + vertical
  c.lineWidth = 0.5;
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  [0.25, 0.5, 0.75].forEach(x => { c.beginPath(); c.moveTo(x*W,0); c.lineTo(x*W,H); c.stroke(); });
  [0.25, 0.75].forEach(y => { c.beginPath(); c.moveTo(0,y*H); c.lineTo(W,y*H); c.stroke(); });
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();

  function sample(t) {
    const p = (t * 2) % 1;
    switch (type) {
      case 'sine':     return Math.sin(p * Math.PI * 2);
      case 'sawtooth': return 1 - 2*p;
      case 'square':   return p < 0.5 ? 1 : -1;
      case 'triangle': return p < 0.5 ? 4*p-1 : 3-4*p;
      case 'pulse':    return p < 0.25 ? 1 : -1; // 25% duty cycle preview
      case 'supersaw': { // sum of 3 detuned saws for preview
        const d = [0, 0.012, -0.009];
        return d.reduce((s, dt) => {
          const pp = ((t * 2) + dt) % 1;
          return s + (1 - 2*pp) * (dt === 0 ? 0.5 : 0.25);
        }, 0);
      }
      default:         return 0;
    }
  }

  const pad = 7, pts = W * 2;

  // Depth layers back→front using globalAlpha
  const layers = [
    { dy: 10, alpha: 0.12, blur: 0,  width: 1.5 },
    { dy:  6, alpha: 0.28, blur: 0,  width: 1.5 },
    { dy:  2, alpha: 0.55, blur: 3,  width: 2 },
    { dy:  0, alpha: 1.0,  blur: 10, width: 2 }
  ];

  layers.forEach(layer => {
    c.save();
    c.globalAlpha  = layer.alpha;
    c.strokeStyle  = color;
    c.shadowColor  = color;
    c.shadowBlur   = layer.blur;
    c.lineWidth    = layer.width;
    c.lineJoin     = 'round'; c.lineCap = 'round';
    const mid = H/2 + layer.dy;
    const amp = H/2 - pad - layer.dy * 0.4;
    c.beginPath();
    for (let i = 0; i <= pts; i++) {
      const t = i / pts, x = t * W;
      const y = mid - sample(t) * amp;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
    c.restore();
  });
}

// Live waveform drawing from analyser buffer
function drawLiveWaveform(canvas, buf, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 82;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#030308'; c.fillRect(0, 0, W, H);
  c.lineWidth = 0.5;
  c.strokeStyle = 'rgba(255,255,255,0.06)';
  [0.25, 0.5, 0.75].forEach(x => { c.beginPath(); c.moveTo(x*W,0); c.lineTo(x*W,H); c.stroke(); });
  [0.25, 0.75].forEach(y => { c.beginPath(); c.moveTo(0,y*H); c.lineTo(W,y*H); c.stroke(); });
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.beginPath(); c.moveTo(0,H/2); c.lineTo(W,H/2); c.stroke();
  const sl = W / buf.length;
  c.save(); c.globalAlpha = 0.35; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 10; c.lineWidth = 4;
  c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < buf.length; i++) {
    const y = H/2 - (buf[i]/128-1) * (H/2-6);
    i === 0 ? c.moveTo(0,y) : c.lineTo(i*sl,y);
  }
  c.stroke(); c.restore();
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 6;
  c.lineWidth = 1.5; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
  for (let i = 0; i < buf.length; i++) {
    const y = H/2 - (buf[i]/128-1) * (H/2-6);
    i === 0 ? c.moveTo(0,y) : c.lineTo(i*sl,y);
  }
  c.stroke();
}

// ─────────────────────────────────────────────────────────
//  Knob — canvas rotary, drag up/down, dblclick to type
// ─────────────────────────────────────────────────────────
function makeKnob({ parent, min, max, value, label, unit='', decimals=1, step=0, color='#00ffb2', onChange, defaultValue }) {
  const dpr = window.devicePixelRatio || 1, S = 44;
  const wrap = document.createElement('div'); wrap.className = 'knob-wrap';
  const canvas = document.createElement('canvas');
  canvas.width = S*dpr; canvas.height = S*dpr;
  canvas.style.cssText = `width:${S}px;height:${S}px;display:block;margin:0 auto`;
  canvas.title = 'Drag: adjust | Dblclick: type value | Ctrl+Click: reset to default';
  const valEl = document.createElement('div'); valEl.className = 'knob-val';
  const lblEl = document.createElement('div'); lblEl.className = 'knob-lbl'; lblEl.textContent = label;
  wrap.append(canvas, valEl, lblEl); parent.appendChild(wrap);

  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  let val = value;
  const defVal = defaultValue !== undefined ? defaultValue : value;

  function fmt(v) {
    const s = step ? Math.round(v/step)*step : v;
    return parseFloat(s.toFixed(decimals)) + unit;
  }
  let modNorm = null; // null = no modulation display
  function draw() {
    const n = (val-min)/(max-min), CX=S/2, CY=S/2, R=16;
    const a0 = 0.75*Math.PI, sweep = 1.5*Math.PI, a1 = a0 + n*sweep;
    c.clearRect(0,0,S,S);
    c.lineCap = 'round'; c.lineWidth = 3;
    c.beginPath(); c.arc(CX,CY,R,a0,a0+sweep); c.strokeStyle='#1c1c3a'; c.stroke();
    if (n > 0.005) { c.beginPath(); c.arc(CX,CY,R,a0,a1); c.strokeStyle=color; c.stroke(); }
    c.beginPath(); c.arc(CX,CY,4,0,Math.PI*2); c.fillStyle='#12122a'; c.fill();
    const ix=CX+(R-6)*Math.cos(a1), iy=CY+(R-6)*Math.sin(a1);
    c.beginPath(); c.arc(ix,iy,2.5,0,Math.PI*2); c.fillStyle='#fff'; c.fill();
    // Modulation ring — outer dot showing live modulated position
    if (modNorm !== null) {
      const Rm = R + 5, nm = Math.max(0, Math.min(1, modNorm));
      const am = a0 + nm * sweep;
      const mx = CX + Rm * Math.cos(am), my = CY + Rm * Math.sin(am);
      c.save();
      c.beginPath(); c.arc(CX,CY,Rm,a0,a0+sweep);
      c.strokeStyle='rgba(255,255,255,0.08)'; c.lineWidth=1.5; c.stroke();
      c.shadowColor = color; c.shadowBlur = 6;
      c.beginPath(); c.arc(mx,my,2.5,0,Math.PI*2);
      c.fillStyle = color; c.globalAlpha = 0.9; c.fill();
      c.restore();
    }
    valEl.textContent = fmt(val);
  }

  let sy, sv;
  canvas.style.cursor = 'ns-resize';
  canvas.addEventListener('pointerdown', e => {
    // Ctrl+Click (Cmd+Click on Mac) to reset to default
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      val = defVal;
      draw();
      onChange?.(val);
      return;
    }
    e.preventDefault(); sy=e.clientY; sv=val; canvas.setPointerCapture(e.pointerId);
    const onMove = e => {
      val = Math.max(min, Math.min(max, sv + (sy-e.clientY)*(max-min)/200));
      draw(); onChange?.(step ? Math.round(val/step)*step : val);
    };
    const onUp = () => { canvas.removeEventListener('pointermove',onMove); canvas.removeEventListener('pointerup',onUp); };
    canvas.addEventListener('pointermove',onMove); canvas.addEventListener('pointerup',onUp);
  });
  canvas.addEventListener('dblclick', () => {
    const s = prompt(`${label} [${min}–${max}]`, fmt(val));
    if (s===null) return;
    const parsed = parseFloat(s);
    if (!isNaN(parsed)) { val=Math.max(min,Math.min(max,parsed)); draw(); onChange?.(val); }
  });
  draw();
  return {
    setValue(v)       { val=Math.max(min,Math.min(max,v)); draw(); },
    setModValue(v)    { modNorm = v === null ? null : (Math.max(min,Math.min(max,v))-min)/(max-min); draw(); },
    clearModValue()   { modNorm = null; draw(); },
  };
}

// ─────────────────────────────────────────────────────────
//  Filter frequency response curve
// ─────────────────────────────────────────────────────────
function drawFilterCurve(canvas, filterNode, color, envAmount = 0, modCutoff = null) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 100, H = canvas.offsetHeight || 90;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);

  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 0.5;
  [100, 500, 1000, 5000, 10000].forEach(f => {
    const x = Math.log10(f / 20) / Math.log10(1000) * W;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
  });
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();

  const pts = W * 2;
  const freqs = new Float32Array(pts);
  const mags  = new Float32Array(pts);
  const phase = new Float32Array(pts);
  for (let i = 0; i < pts; i++) freqs[i] = 20 * Math.pow(1000, i / pts);
  filterNode.getFrequencyResponse(freqs, mags, phase);

  const dBRange = 30;
  const toY = m => H/2 - (20 * Math.log10(Math.max(1e-5, m)) / dBRange) * (H/2);

  // ENV ghost curve: show peak cutoff position using a temp filter
  if (envAmount > 0) {
    const tmp = filterNode.context.createBiquadFilter();
    tmp.type = filterNode.type;
    tmp.frequency.value = Math.min(20000, filterNode.frequency.value + envAmount);
    tmp.Q.value = filterNode.Q.value;
    const magsEnv = new Float32Array(pts);
    tmp.getFrequencyResponse(freqs, magsEnv, new Float32Array(pts));
    c.save(); c.globalAlpha = 0.25; c.strokeStyle = color;
    c.setLineDash([3, 3]); c.lineWidth = 1; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, toY(magsEnv[0]));
    for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(magsEnv[i]))));
    c.stroke(); c.setLineDash([]); c.restore();
  }

  // Fill
  c.save(); c.globalAlpha = 0.12; c.fillStyle = color;
  c.beginPath(); c.moveTo(0, toY(mags[0]));
  for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(mags[i]))));
  c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill(); c.restore();

  // Glow
  c.save(); c.globalAlpha = 0.4; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 8; c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(0, toY(mags[0]));
  for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(mags[i]))));
  c.stroke(); c.restore();

  // Main line
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 4;
  c.lineWidth = 1.5; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(0, toY(mags[0]));
  for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(mags[i]))));
  c.stroke();

  // Live modulation overlay: ghost curve at modulated cutoff + vertical cursor
  if (modCutoff !== null) {
    const tmp = filterNode.context.createBiquadFilter();
    tmp.type = filterNode.type;
    tmp.frequency.value = Math.max(20, Math.min(20000, modCutoff));
    tmp.Q.value = filterNode.Q.value;
    const magsMod = new Float32Array(pts);
    tmp.getFrequencyResponse(freqs, magsMod, new Float32Array(pts));

    // Ghost fill
    c.save(); c.globalAlpha = 0.18; c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(0, toY(magsMod[0]));
    for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(magsMod[i]))));
    c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill(); c.restore();

    // Ghost line
    c.save(); c.globalAlpha = 0.7; c.strokeStyle = '#ffffff';
    c.shadowColor = '#ffffff'; c.shadowBlur = 6; c.lineWidth = 1; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, toY(magsMod[0]));
    for (let i = 1; i < pts; i++) c.lineTo((i/pts)*W, Math.max(0, Math.min(H, toY(magsMod[i]))));
    c.stroke(); c.restore();

    // Vertical cursor at modulated frequency
    const xMod = Math.log10(Math.max(20, modCutoff) / 20) / Math.log10(1000) * W;
    c.save(); c.globalAlpha = 0.6; c.strokeStyle = '#ffffff';
    c.shadowColor = '#ffffff'; c.shadowBlur = 4; c.lineWidth = 1;
    c.setLineDash([2, 3]);
    c.beginPath(); c.moveTo(xMod, 0); c.lineTo(xMod, H); c.stroke();
    c.setLineDash([]); c.restore();
  }
}

// ─────────────────────────────────────────────────────────
//  Noise preview canvas drawing
// ─────────────────────────────────────────────────────────
function drawNoisePreview(canvas, type, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 64, H = canvas.offsetHeight || 60;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,0.07)';
  c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();

  // Generate representative noise samples pseudo-randomly per type
  const pts = W * 2;
  const seed = NOISE_TYPES.indexOf(type) * 12345 + 6789;
  function rand(i) { let x = Math.sin(seed + i * 127.1) * 43758.5; return x - Math.floor(x); }

  const samples = [];
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0, last=0, prev=0, lw0=0,lw1=0;
  for (let i = 0; i < pts; i++) {
    const w = rand(i) * 2 - 1;
    let v = w;
    if (type === 'pink') {
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      v=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11*3; b6=w*0.115926;
    } else if (type === 'brown') {
      last=(last+0.02*w)/1.02; v=Math.max(-1,Math.min(1,last*3.5));
    } else if (type === 'blue') {
      v=w-prev; prev=w;
    } else if (type === 'violet') {
      const b=w-lw0; v=b-lw1; lw0=w; lw1=b;
    }
    samples.push(v);
  }
  const mx = samples.reduce((m,v)=>Math.max(m,Math.abs(v)),0.001);
  const norm = samples.map(v => v/mx);

  c.save();
  c.globalAlpha = 0.35; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 6; c.lineWidth = 3;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < pts; i++) {
    const x = (i/pts)*W, y = H/2 - norm[i]*(H/2-4);
    i===0 ? c.moveTo(x,y) : c.lineTo(x,y);
  }
  c.stroke(); c.restore();
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 4;
  c.lineWidth = 1; c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath();
  for (let i = 0; i < pts; i++) {
    const x = (i/pts)*W, y = H/2 - norm[i]*(H/2-4);
    i===0 ? c.moveTo(x,y) : c.lineTo(x,y);
  }
  c.stroke();
}

// Noise panel component (right column of OSC section)
function createNoisePanel({ voice, color }) {
  const p = voice.p;
  const wrap = document.createElement('div'); wrap.className = 'osc-noise-strip';
  wrap.style.setProperty('--accent', color);

  // Two-column layout: controls left, canvas right (mirror filter/ADSR)
  const noiseCols = document.createElement('div'); noiseCols.className = 'noise-cols';
  const noiseLeft  = document.createElement('div'); noiseLeft.className  = 'noise-left';
  const noiseRight = document.createElement('div'); noiseRight.className = 'noise-right';
  noiseCols.append(noiseLeft, noiseRight);
  wrap.appendChild(noiseCols);

  // Left: header label + type nav row
  const noiseHdrLbl = document.createElement('span'); noiseHdrLbl.className = 'noise-strip-lbl'; noiseHdrLbl.textContent = 'NOISE';
  noiseLeft.appendChild(noiseHdrLbl);

  const typeRow = document.createElement('div'); typeRow.className = 'noise-type-row';
  const prevBtn = document.createElement('button'); prevBtn.className = 'noise-nav-btn'; prevBtn.textContent = '<';
  const typeLbl = document.createElement('span'); typeLbl.className = 'noise-strip-type-lbl';
  typeLbl.textContent = NOISE_LABELS[NOISE_TYPES.indexOf(p.noise.type)] || 'White';
  const nextBtn = document.createElement('button'); nextBtn.className = 'noise-nav-btn'; nextBtn.textContent = '>';
  typeRow.append(prevBtn, typeLbl, nextBtn);
  noiseLeft.appendChild(typeRow);

  // Left: level knob + filter mix knob
  const knobRow = document.createElement('div'); knobRow.className = 'knob-row';
  const _lvlKnob = makeKnob({ parent: knobRow, min: 0, max: 1, value: p.noise.volume, label: 'LEVEL', decimals: 2, color,
    onChange: v => voice.set('noise', 'volume', v) });
  voice._noiseKnob = _lvlKnob;
  makeKnob({ parent: knobRow, min: 0, max: 1, value: p.noise.filterMix ?? 1, label: 'FILT', decimals: 2, color: '#aaaaff',
    onChange: v => voice.set('noise', 'filterMix', v) });
  noiseLeft.appendChild(knobRow);

  // Right: noise waveform preview canvas
  const canvas = document.createElement('canvas'); canvas.className = 'noise-preview';
  noiseRight.appendChild(canvas);
  requestAnimationFrame(() => drawNoisePreview(canvas, p.noise.type, color));

  const setType = (type) => {
    typeLbl.textContent = NOISE_LABELS[NOISE_TYPES.indexOf(type)];
    voice.set('noise', 'type', type); // handles p.noise.type, cache invalidation, AND live node hot-swap
    requestAnimationFrame(() => drawNoisePreview(canvas, type, color));
  };
  prevBtn.addEventListener('click', () => { const i=NOISE_TYPES.indexOf(p.noise.type); setType(NOISE_TYPES[(i-1+NOISE_TYPES.length)%NOISE_TYPES.length]); });
  nextBtn.addEventListener('click', () => { const i=NOISE_TYPES.indexOf(p.noise.type); setType(NOISE_TYPES[(i+1)%NOISE_TYPES.length]); });

  return { element: wrap };
}

// ─────────────────────────────────────────────────────────
//  Reusable UI Components
// ─────────────────────────────────────────────────────────

// Parameter display (compact numerical, click to edit)
function createParamDisplay({ label, value, min, max, unit = '', color, onChange }) {
  const wrap = document.createElement('div'); wrap.className = 'osc-param';
  const lbl = document.createElement('span'); lbl.className = 'osc-param-lbl'; lbl.textContent = label;
  const val = document.createElement('span'); val.className = 'osc-param-val';
  val.textContent = (value >= 0 ? '+' : '') + value + unit;
  wrap.append(lbl, val);
  wrap.style.setProperty('--accent', color);
  
  wrap.addEventListener('click', () => {
    const input = prompt(`${label} [${min} to ${max}${unit}]`, value);
    if (input !== null) {
      const parsed = unit === '' ? parseInt(input) : parseFloat(input);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        onChange(clamped);
        val.textContent = (clamped >= 0 ? '+' : '') + clamped + unit;
      }
    }
  });
  
  return { element: wrap, setValue: (v) => { val.textContent = (v >= 0 ? '+' : '') + v + unit; } };
}

// Button group (waveform selector, filter type, etc.)
function createButtonGroup({ parent, options, activeValue, className = 'wave-btn', onChange }) {
  const row = document.createElement('div'); row.className = 'btn-row';
  parent.appendChild(row);
  const buttons = [];
  
  options.forEach(opt => {
    const b = document.createElement('button');
    b.className = className + (opt.value === activeValue ? ' active' : '');
    b.textContent = opt.label;
    b.addEventListener('click', () => {
      buttons.forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');
      onChange(opt.value);
    });
    row.appendChild(b);
    buttons.push(b);
  });
  
  return { element: row, buttons };
}

// Waveform canvas — static preview + live signal when playing
function createWaveformCanvas({ color, waveform, analyser }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'osc-wave-preview';
  let currentWaveform = waveform;

  if (analyser) {
    const buf = new Uint8Array(analyser.frequencyBinCount);
    function animate() {
      requestAnimationFrame(animate);
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
      if (peak > 3) {
        drawLiveWaveform(canvas, buf, color);
      } else {
        drawWaveform(canvas, currentWaveform, color);
      }
    }
    animate();
  } else {
    requestAnimationFrame(() => drawWaveform(canvas, waveform, color));
  }

  const redraw = (type) => { currentWaveform = type; if (!analyser) requestAnimationFrame(() => drawWaveform(canvas, type, color)); };
  return { element: canvas, redraw };
}

// Knob row builder
function createKnobRow({ parent, knobs, color }) {
  const row = document.createElement('div'); row.className = 'knob-row';
  parent.appendChild(row);
  
  const knobInstances = knobs.map(k => 
    makeKnob({ parent: row, color, ...k })
  );
  
  return { element: row, knobs: knobInstances };
}

// Module-scope helper used by standalone section builders
function addSectionToggle(secEl, onDisable, onEnable, startEnabled = true) {
  const hdr = secEl.querySelector('.sec-hdr');
  if (!hdr) return;
  const btn = document.createElement('button');
  btn.className = 'sec-bypass-btn' + (startEnabled ? ' active' : '');
  btn.textContent = startEnabled ? 'ON' : 'OFF';
  btn.title = 'Enable/disable this section';
  btn.addEventListener('click', () => {
    const isOn = btn.classList.toggle('active');
    btn.textContent = isOn ? 'ON' : 'OFF';
    secEl.classList.toggle('sec-bypassed', !isOn);
    isOn ? onEnable() : onDisable();
  });
  hdr.appendChild(btn);
  if (!startEnabled) secEl.classList.add('sec-bypassed');
}

// ─────────────────────────────────────────────────────────
//  Distortion transfer-function curve visualizer
// ─────────────────────────────────────────────────────────
