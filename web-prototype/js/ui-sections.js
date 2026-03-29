function drawDistCurve(canvas, form, drive, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 120, H = canvas.offsetHeight || 80;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);

  // Grid lines
  c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(W/2, 0); c.lineTo(W/2, H); c.stroke();
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();
  // Identity reference line (linear)
  c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 0.8; c.setLineDash([3,3]);
  c.beginPath(); c.moveTo(0, H); c.lineTo(W, 0); c.stroke();
  c.setLineDash([]);

  // Compute transfer function
  function distSample(x) {
    if (drive < 0.001 && form !== 'soft') return x;
    const k = 1 + drive * 40;
    switch (form) {
      case 'soft': return drive < 0.001 ? x : Math.tanh(x * k) / Math.tanh(k);
      case 'hard': return Math.max(-1, Math.min(1, x * k));
      case 'fold': {
        let v = x * (1 + drive * 8);
        while (v > 1 || v < -1) v = v > 1 ? 2 - v : -2 - v;
        return v;
      }
      case 'asym': return x >= 0
        ? Math.tanh(x * k) / Math.tanh(k)
        : Math.tanh(x * k * 0.4) / Math.tanh(k * 0.4) * 0.7;
      case 'fuzz': {
        const v = x * (1 + drive * 200);
        return Math.sign(v) * Math.min(1, Math.abs(v) ** 0.2);
      }
      default: return x;
    }
  }

  // Glow pass
  c.save(); c.globalAlpha = 0.35; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 8; c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= W * 2; i++) {
    const x = (i / (W * 2)) * 2 - 1;           // -1 to +1
    const y = distSample(x);                     // -1 to +1 out
    const px = (x + 1) / 2 * W;
    const py = (1 - (y + 1) / 2) * H;
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke(); c.restore();

  // Main line
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 4;
  c.lineWidth = 1.5; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= W * 2; i++) {
    const x = (i / (W * 2)) * 2 - 1;
    const y = distSample(x);
    const px = (x + 1) / 2 * W;
    const py = (1 - (y + 1) / 2) * H;
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke();

  // Axis labels
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.font = `${6 / dpr}px Courier New`;
  c.fillText('IN', W - 12, H/2 - 3);
  c.fillText('OUT', 3, 8);
}

// ── EQ Section (3-band per voice) ─────────────────────────
function buildEQSection(container, eq, voice, color) {
  // Single horizontal row: all 6 knobs (LOW gain/freq, MID gain/freq, HIGH gain/freq)
  const knobRow = document.createElement('div'); knobRow.className = 'knob-row';
  container.appendChild(knobRow);
  [
    { key:'lowGain',  label:'LOW',   min:-18, max:18,    value:eq.lowGain,  decimals:1, unit:'dB' },
    { key:'lowFreq',  label:'L.FRQ', min:40,  max:800,   value:eq.lowFreq,  decimals:0, unit:'Hz' },
    { key:'midGain',  label:'MID',   min:-18, max:18,    value:eq.midGain,  decimals:1, unit:'dB' },
    { key:'midFreq',  label:'M.FRQ', min:200, max:8000,  value:eq.midFreq,  decimals:0, unit:'Hz' },
    { key:'highGain', label:'HIGH',  min:-18, max:18,    value:eq.highGain, decimals:1, unit:'dB' },
    { key:'highFreq', label:'H.FRQ', min:2000,max:16000, value:eq.highFreq, decimals:0, unit:'Hz' },
  ].forEach(cfg => makeKnob({ parent:knobRow, color, ...cfg, onChange: v => voice.set('eq', cfg.key, v) }));

  addSectionToggle(container,
    () => { voice.p.eq.bypassed = true;  const t = voice.ctx.currentTime;
            voice._eqLow.gain.setTargetAtTime(0, t, 0.01);
            voice._eqMid.gain.setTargetAtTime(0, t, 0.01);
            voice._eqHigh.gain.setTargetAtTime(0, t, 0.01); },
    () => { voice.p.eq.bypassed = false; const t = voice.ctx.currentTime;
            voice._eqLow.gain.setTargetAtTime(eq.lowGain,  t, 0.01);
            voice._eqMid.gain.setTargetAtTime(eq.midGain,  t, 0.01);
            voice._eqHigh.gain.setTargetAtTime(eq.highGain, t, 0.01); },
    !voice.p.eq.bypassed
  );
}

// ── FX Section (Reverb + Delay per voice) ─────────────────
function buildFXSection(container, fx, voice, color) {
  const cols = document.createElement('div');
  cols.style.cssText = 'display:flex;gap:12px;';
  container.appendChild(cols);

  // REVERB block
  const rvbBlock = document.createElement('div');
  rvbBlock.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;';
  cols.appendChild(rvbBlock);
  const rvbLbl = document.createElement('div');
  rvbLbl.style.cssText = 'font-size:9px;letter-spacing:2px;color:rgba(255,255,255,0.35);padding-bottom:2px;';
  rvbLbl.textContent = 'REVERB';
  rvbBlock.appendChild(rvbLbl);
  const rvbRow = document.createElement('div'); rvbRow.className = 'knob-row';
  rvbBlock.appendChild(rvbRow);
  [
    { key:'reverbMix',   label:'MIX',   min:0,   max:1,   value:fx.reverbMix,   decimals:2 },
    { key:'reverbDecay', label:'DECAY', min:0.1, max:8,   value:fx.reverbDecay, decimals:1, unit:'s' },
  ].forEach(cfg => makeKnob({ parent:rvbRow, color, ...cfg,
    onChange: v => voice.set('fx', cfg.key, v) }));

  // Divider
  const div = document.createElement('div');
  div.style.cssText = 'width:1px;background:#252545;margin:4px 0;';
  cols.appendChild(div);

  // DELAY block
  const dlyBlock = document.createElement('div');
  dlyBlock.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;';
  cols.appendChild(dlyBlock);
  const dlyLbl = document.createElement('div');
  dlyLbl.style.cssText = 'font-size:9px;letter-spacing:2px;color:rgba(255,255,255,0.35);padding-bottom:2px;';
  dlyLbl.textContent = 'DELAY';
  dlyBlock.appendChild(dlyLbl);
  const dlyRow = document.createElement('div'); dlyRow.className = 'knob-row';
  dlyBlock.appendChild(dlyRow);
  [
    { key:'delayMix',  label:'MIX',  min:0,    max:1,    value:fx.delayMix,  decimals:2 },
    { key:'delayTime', label:'TIME', min:0.01, max:2,    value:fx.delayTime, decimals:2, unit:'s' },
    { key:'delayFB',   label:'FB',   min:0,    max:0.95, value:fx.delayFB,   decimals:2 },
  ].forEach(cfg => makeKnob({ parent:dlyRow, color, ...cfg,
    onChange: v => voice.set('fx', cfg.key, v) }));

  addSectionToggle(container,
    () => { voice.p.fx.bypassed = true;  const t = voice.ctx.currentTime;
            voice._rvbWet.gain.setTargetAtTime(0, t, 0.02);
            voice._dlyWet.gain.setTargetAtTime(0, t, 0.02); },
    () => { voice.p.fx.bypassed = false; const t = voice.ctx.currentTime;
            voice._rvbWet.gain.setTargetAtTime(fx.reverbMix, t, 0.02);
            voice._dlyWet.gain.setTargetAtTime(fx.delayMix,  t, 0.02); },
    !voice.p.fx.bypassed
  );
}

// ── Distortion Section ────────────────────────────────────
function buildDistSection(container, dp, voice, color) {
  const FORMS = ['soft','hard','fold','asym','fuzz'];
  const FORM_LABELS = { soft:'SOFT', hard:'HARD', fold:'FOLD', asym:'ASYM', fuzz:'FUZZ' };
  const FORM_TIPS   = {
    soft: 'Tanh saturation — smooth tube warmth',
    hard: 'Hard clip — transistor crunch',
    fold: 'Wavefolder — metallic, Buchla-style',
    asym: 'Asymmetric clip — 2nd harmonic overdrive',
    fuzz: 'Extreme fuzz — near-square saturation',
  };

  // Two-column layout: left = controls, right = curve canvas (mirrors ADSR layout)
  const cols = document.createElement('div'); cols.className = 'dist-cols';
  container.appendChild(cols);

  const left = document.createElement('div'); left.className = 'dist-left';
  cols.appendChild(left);

  // Form selector row
  const formRow = document.createElement('div'); formRow.className = 'dist-form-row';
  left.appendChild(formRow);

  // Curve canvas (right side — fills column like adsr-canvas)
  const distRight = document.createElement('div'); distRight.className = 'dist-right';
  cols.appendChild(distRight);
  const distCvs = document.createElement('canvas'); distCvs.className = 'dist-canvas';
  distRight.appendChild(distCvs);

  const redrawDist = () => requestAnimationFrame(() =>
    drawDistCurve(distCvs, dp.form, dp.drive, color));

  FORMS.forEach(f => {
    const b = document.createElement('button');
    b.className = 'wave-btn' + (f === dp.form ? ' active' : '');
    b.textContent = FORM_LABELS[f]; b.title = FORM_TIPS[f];
    b.addEventListener('click', () => {
      formRow.querySelectorAll('.wave-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      voice.set('dist', 'form', f);
      redrawDist();
    });
    formRow.appendChild(b);
  });

  // Knob row
  const kr = document.createElement('div'); kr.className = 'knob-row';
  left.appendChild(kr);
  [
    { key:'drive',  label:'DRIVE',  min:0,   max:1,     value:dp.drive,  decimals:2 },
    { key:'tone',   label:'TONE',   min:200, max:18000, value:dp.tone,   decimals:0, unit:'Hz' },
    { key:'mix',    label:'MIX',    min:0,   max:1,     value:dp.mix,    decimals:2 },
    { key:'volume', label:'VOL',    min:0,   max:2,     value:dp.volume, decimals:2 },
  ].forEach(cfg => {
    makeKnob({ parent:kr, color, ...cfg, onChange: v => {
      voice.set('dist', cfg.key, v);
      if (cfg.key === 'drive') redrawDist();
    }});
  });

  // Initial draw
  redrawDist();

  addSectionToggle(container,
    () => { voice.p.dist.bypassed = true;  voice._distWet.gain.setTargetAtTime(0,       voice.ctx.currentTime, 0.01);
                                            voice._distDry.gain.setTargetAtTime(1,       voice.ctx.currentTime, 0.01); },
    () => { voice.p.dist.bypassed = false; voice._distWet.gain.setTargetAtTime(dp.mix,     voice.ctx.currentTime, 0.01);
                                            voice._distDry.gain.setTargetAtTime(1-dp.mix, voice.ctx.currentTime, 0.01); },
    !voice.p.dist.bypassed
  );
}

// Interactive ADSR canvas (Serum-style: canvas top, readouts, knobs below)
function buildADSRSection(container, adsrP, voice, color) {
  const SUSTAIN_W = 0.3;

  // Ensure hold exists
  if (adsrP.hold === undefined) adsrP.hold = 0;

  // ── Canvas ─────────────────────────────────────────────
  const cvs = document.createElement('canvas');
  cvs.style.cssText = 'display:block;width:100%;height:100px;background:#030308;border-radius:4px;border:1px solid #1a1a30;cursor:crosshair;touch-action:none;margin-bottom:0';
  container.appendChild(cvs);

  // ── Value readout row ──────────────────────────────────
  const readoutRow = document.createElement('div');
  readoutRow.style.cssText = 'display:flex;background:#080814;border:1px solid #1a1a30;border-top:none;border-radius:0 0 4px 4px;margin-bottom:8px;overflow:hidden';
  container.appendChild(readoutRow);

  const readouts = {};
  function fmtTime(v) { return v < 1 ? (v*1000).toFixed(0)+' ms' : v.toFixed(2)+' s'; }
  function fmtSus(v)  { return (v * 100).toFixed(0)+' %'; }
  [['atk','ATK'],['hld','HLD'],['dec','DEC'],['sus','SUS'],['rel','REL']].forEach(([k,lbl]) => {
    const cell = document.createElement('div');
    cell.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;padding:3px 0;border-right:1px solid #111128;cursor:ns-resize;user-select:none';
    const v = document.createElement('div');
    v.style.cssText = `font-size:10px;color:${color};font-family:monospace;letter-spacing:1px`;
    const l = document.createElement('div');
    l.style.cssText = 'font-size:9px;color:#444;letter-spacing:1px';
    l.textContent = lbl;
    cell.append(v, l);
    readoutRow.appendChild(cell);
    readouts[k] = { el: v, fmt: k==='sus' ? fmtSus : fmtTime };
  });
  readoutRow.lastChild.style.borderRight = 'none';

  function updateReadouts() {
    readouts.atk.el.textContent = fmtTime(adsrP.attack);
    readouts.hld.el.textContent = fmtTime(adsrP.hold || 0);
    readouts.dec.el.textContent = fmtTime(adsrP.decay);
    readouts.sus.el.textContent = fmtSus(adsrP.sustain);
    readouts.rel.el.textContent = fmtTime(adsrP.release);
  }

  // ── Knob row ───────────────────────────────────────────
  const knobRow = document.createElement('div'); knobRow.className = 'knob-row';
  knobRow.style.cssText = 'justify-content:space-between;gap:4px';
  container.appendChild(knobRow);

  let knobRefs = {};

  // ── Drawing ────────────────────────────────────────────
  function getLayout(W, H) {
    const a = adsrP.attack, d = adsrP.decay, s = adsrP.sustain, r = adsrP.release;
    const total = a + d + r;                // time for ATK+DEC+REL
    const susW  = W * SUSTAIN_W;           // fixed sustain display width
    const dynW  = W - susW;                // width shared by A+D+R
    const toX = t => (t / total) * dynW;
    const toY = v => H - 6 - v * (H - 12);

    const x0 = 0,        y0 = toY(0);
    const xa = toX(a),   ya = toY(1);
    const xd = toX(a+d), yd = toY(s);
    const xs = xd + susW;                  // sustain end x (note-off)
    const xr = xs + toX(r), yr = toY(0);

    // Bezier control points driven by curve shape
    const ac = adsrP.atkCurve ?? 0;
    const dc = adsrP.decCurve ?? 0;
    const rc = adsrP.relCurve ?? 0;

    const atkCp  = { x: xa * 0.5, y: ya + (y0 - ya) * (0.5 + ac * 0.45) };
    const decCp  = { x: (xa+xd)*0.5, y: ya + (yd - ya) * (0.5 - dc * 0.45) };
    const relCp  = { x: xs + toX(r)*0.5, y: yd + (yr - yd) * (0.5 - rc * 0.45) };

    return { x0,y0, xa,ya, xd,yd, xs,yr,xr, susW,
             atkCp, decCp, relCp,
             noteOffX: xs };
  }

  function redraw() {
    const dpr = window.devicePixelRatio || 1;
    const W = cvs.offsetWidth || 200, H = cvs.offsetHeight || 90;
    if (!W || !H) return;
    cvs.width = W * dpr; cvs.height = H * dpr;
    const c = cvs.getContext('2d'); c.scale(dpr, dpr);
    c.fillStyle = '#030308'; c.fillRect(0, 0, W, H);

    const L = getLayout(W, H);

    // Grid lines
    c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 0.5;
    [0.25, 0.5, 0.75].forEach(v => {
      const y = H - 6 - v * (H - 12);
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    });

    // Note-off marker
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 1;
    c.setLineDash([3,3]);
    c.beginPath(); c.moveTo(L.noteOffX, 0); c.lineTo(L.noteOffX, H); c.stroke();
    c.setLineDash([]);

    // Stage labels
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.font = '6px Courier New';
    c.fillText('A', 3, H - 2);
    c.fillText('D', L.xa + 3, H - 2);
    c.fillText('S', L.xd + 3, H - 2);
    c.fillText('R', L.xs + 3, H - 2);

    // Build path helper
    function buildPath() {
      c.beginPath();
      c.moveTo(L.x0, L.y0);
      c.quadraticCurveTo(L.atkCp.x, L.atkCp.y, L.xa, L.ya);
      c.quadraticCurveTo(L.decCp.x, L.decCp.y, L.xd, L.yd);
      c.lineTo(L.xs, L.yd);
      c.quadraticCurveTo(L.relCp.x, L.relCp.y, L.xr, L.yr);
    }

    // Fill
    buildPath();
    c.lineTo(W, H); c.lineTo(0, H); c.closePath();
    c.save(); c.globalAlpha = 0.14; c.fillStyle = color; c.fill(); c.restore();

    // Glow stroke
    buildPath();
    c.save(); c.globalAlpha = 0.35; c.strokeStyle = color;
    c.shadowColor = color; c.shadowBlur = 8; c.lineWidth = 3; c.lineJoin = 'round';
    c.stroke(); c.restore();

    // Main stroke
    buildPath();
    c.save(); c.strokeStyle = color; c.lineWidth = 1.5; c.lineJoin = 'round';
    c.shadowColor = color; c.shadowBlur = 3; c.stroke(); c.restore();

    // Endpoint handles
    [[L.xa,L.ya],[L.xd,L.yd],[L.xr,L.yr]].forEach(([x,y]) => {
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI*2);
      c.fillStyle = color; c.fill();
      c.strokeStyle = '#030308'; c.lineWidth = 1.5; c.stroke();
    });

    // Curve midpoint handles (small hollow circles)
    [L.atkCp, L.decCp, L.relCp].forEach(p => {
      c.beginPath(); c.arc(p.x, p.y, 3, 0, Math.PI*2);
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.5; c.stroke();
    });
  }

  // ── Interaction ────────────────────────────────────────
  let drag = null;
  const HIT = 9; // hit radius in px

  function getCanvasPos(e) {
    const r = cvs.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function hitTest(mx, my, W, H) {
    const L = getLayout(W, H);
    const pts = [
      { key:'atkEnd',   x:L.xa,       y:L.ya },
      { key:'decEnd',   x:L.xd,       y:L.yd },
      { key:'relEnd',   x:L.xr,       y:L.yr },
      { key:'atkCurve', x:L.atkCp.x,  y:L.atkCp.y },
      { key:'decCurve', x:L.decCp.x,  y:L.decCp.y },
      { key:'relCurve', x:L.relCp.x,  y:L.relCp.y },
    ];
    for (const p of pts) {
      if (Math.hypot(mx - p.x, my - p.y) <= HIT) return p;
    }
    return null;
  }

  function onDown(e) {
    e.preventDefault();
    const W = cvs.offsetWidth, H = cvs.offsetHeight;
    const {x,y} = getCanvasPos(e);
    const hit = hitTest(x, y, W, H);
    if (hit) drag = { key: hit.key, startX: x, startY: y,
      startAtk: adsrP.attack, startDec: adsrP.decay, startSus: adsrP.sustain, startRel: adsrP.release,
      startAtkC: adsrP.atkCurve, startDecC: adsrP.decCurve, startRelC: adsrP.relCurve };
  }

  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    const W = cvs.offsetWidth, H = cvs.offsetHeight;
    const {x,y} = getCanvasPos(e);
    const dx = x - drag.startX, dy = y - drag.startY;
    const a = adsrP.attack, d = adsrP.decay, r = adsrP.release;
    const total = a + d + r;
    const dynW = W * (1 - SUSTAIN_W);
    const timePerPx = total / dynW;
    const valPerPx  = 1 / (H - 12);

    if (drag.key === 'atkEnd') {
      const v = Math.max(0.001, Math.min(2, drag.startAtk + dx * timePerPx));
      adsrP.attack = v; voice.set('adsr','attack',v);
      knobRefs.atk?.setValue(v);
    } else if (drag.key === 'decEnd') {
      const vt = Math.max(0.01, Math.min(2, drag.startDec + dx * timePerPx));
      const vs = Math.max(0, Math.min(1, drag.startSus - dy * valPerPx));
      adsrP.decay = vt; adsrP.sustain = vs;
      voice.set('adsr','decay',vt); voice.set('adsr','sustain',vs);
      knobRefs.dec?.setValue(vt); knobRefs.sus?.setValue(vs);
    } else if (drag.key === 'relEnd') {
      const v = Math.max(0.01, Math.min(4, drag.startRel + dx * timePerPx));
      adsrP.release = v; voice.set('adsr','release',v);
      knobRefs.rel?.setValue(v);
    } else if (drag.key === 'atkCurve') {
      const v = Math.max(-1, Math.min(1, drag.startAtkC - dy / 40));
      adsrP.atkCurve = v;
    } else if (drag.key === 'decCurve') {
      const v = Math.max(-1, Math.min(1, drag.startDecC - dy / 40));
      adsrP.decCurve = v;
    } else if (drag.key === 'relCurve') {
      const v = Math.max(-1, Math.min(1, drag.startRelC - dy / 40));
      adsrP.relCurve = v;
    }
    redraw(); updateReadouts();
  }

  function onUp() { drag = null; }

  cvs.addEventListener('mousedown',  onDown);
  cvs.addEventListener('touchstart', onDown, { passive:false });
  window.addEventListener('mousemove',  onMove);
  window.addEventListener('touchmove',  onMove, { passive:false });
  window.addEventListener('mouseup',    onUp);
  window.addEventListener('touchend',   onUp);

  // ── Knobs ──────────────────────────────────────────────
  knobRefs.atk = makeKnob({ parent:knobRow, min:0.001, max:2,  value:adsrP.attack,     label:'ATK', unit:'s', decimals:3, color, onChange: v => { adsrP.attack  = v; voice.set('adsr','attack',  v); redrawAll(); } });
  knobRefs.hld = makeKnob({ parent:knobRow, min:0,     max:2,  value:adsrP.hold||0,    label:'HLD', unit:'s', decimals:3, color, onChange: v => { adsrP.hold    = v;                               redrawAll(); } });
  knobRefs.dec = makeKnob({ parent:knobRow, min:0.01,  max:2,  value:adsrP.decay,      label:'DEC', unit:'s', decimals:2, color, onChange: v => { adsrP.decay   = v; voice.set('adsr','decay',   v); redrawAll(); } });
  knobRefs.sus = makeKnob({ parent:knobRow, min:0,     max:1,  value:adsrP.sustain,    label:'SUS',           decimals:2, color, onChange: v => { adsrP.sustain = v; voice.set('adsr','sustain', v); redrawAll(); } });
  knobRefs.rel = makeKnob({ parent:knobRow, min:0.01,  max:4,  value:adsrP.release,    label:'REL', unit:'s', decimals:2, color, onChange: v => { adsrP.release = v; voice.set('adsr','release', v); redrawAll(); } });

  function redrawAll() { redraw(); updateReadouts(); }

  setTimeout(() => redrawAll(), 30);
  return { redraw: redrawAll };
}

// LFO Panel (complex 2-row layout with all controls)
function createLFOPanel({ parent, lfoIndex, lfoParams, color, voice, bpmGet }) {
  const lp = lfoParams;
  const row = document.createElement('div'); row.className = 'lfo-row';
  if (lp._enabled === false) row.classList.add('lfo-disabled');
  parent.appendChild(row);

  // HEADER: number + ON/OFF toggle
  const rowHdr = document.createElement('div'); rowHdr.className = 'lfo-row-hdr';
  row.appendChild(rowHdr);

  const num = document.createElement('div'); num.className = 'lfo-num'; num.textContent = lfoIndex + 1;
  rowHdr.appendChild(num);

  const body = document.createElement('div'); body.className = 'lfo-row-body';
  if (lp._enabled === false) body.style.display = 'none';

  const enBtn = document.createElement('button');
  enBtn.className = 'lfo-en-btn' + (lp._enabled !== false ? ' active' : '');
  enBtn.textContent = lp._enabled !== false ? 'ON' : 'OFF';
  enBtn.addEventListener('click', () => {
    const on = lp._enabled === false;
    lp._enabled = on;
    enBtn.textContent = on ? 'ON' : 'OFF';
    enBtn.classList.toggle('active', on);
    row.classList.toggle('lfo-disabled', !on);
    body.style.display = on ? '' : 'none';
    voice._connectLFO(lfoIndex);
  });
  rowHdr.appendChild(enBtn);
  row.appendChild(body);

  // TOP ROW: waveform · target · BPM sync · div
  const rowTop = document.createElement('div'); rowTop.className = 'lfo-row-top';
  body.appendChild(rowTop);

  // Waveform selector
  const waveWrap = document.createElement('div'); waveWrap.className = 'lfo-wave';
  const LFO_WAVE_ABBR = { sine: 'SIN', sawtooth: 'SAW', square: 'SQR', triangle: 'TRI', stepped: 'STP' };
  ['sine', 'sawtooth', 'square', 'triangle', 'stepped'].forEach(w => {
    const b = document.createElement('button');
    b.className = 'lfo-w-btn' + (lp.waveform === w ? ' active' : '');
    b.textContent = LFO_WAVE_ABBR[w];
    b.addEventListener('click', () => {
      waveWrap.querySelectorAll('.lfo-w-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      voice.updateLFO(lfoIndex, 'waveform', w, bpmGet());
    });
    waveWrap.appendChild(b);
  });
  rowTop.appendChild(waveWrap);

  // Target selector
  const tSel = document.createElement('select'); tSel.className = 'mini-sel';
  const LFO_TARGET_LBL = { none: '—', pitch: 'PITCH', cutoff: 'CUTOFF', resonance: 'RESONANCE', noiseAmt: 'NOISE' };
  ['none', 'pitch', 'cutoff', 'resonance', 'noiseAmt'].forEach(t => {
    const o = document.createElement('option'); o.value = t; o.textContent = LFO_TARGET_LBL[t];
    if (lp.target === t) o.selected = true;
    tSel.appendChild(o);
  });
  tSel.addEventListener('change', () => voice.updateLFO(lfoIndex, 'target', tSel.value, bpmGet()));
  rowTop.appendChild(tSel);

  // BPM sync button
  const syncBtn = document.createElement('button');
  syncBtn.className = 'lfo-sync-btn' + (lp.bpmSync ? ' active' : '');
  syncBtn.textContent = '♩';
  syncBtn.addEventListener('click', () => {
    const newSync = !lp.bpmSync;
    syncBtn.classList.toggle('active', newSync);
    voice.updateLFO(lfoIndex, 'bpmSync', newSync, bpmGet());
  });
  rowTop.appendChild(syncBtn);

  // Division selector
  const divSel = document.createElement('select'); divSel.className = 'mini-sel';
  [1, 2, 4, 8, 16].forEach(d => {
    const o = document.createElement('option'); o.value = d; o.textContent = `1/${d}`;
    if (lp.syncDiv === d) o.selected = true;
    divSel.appendChild(o);
  });
  divSel.addEventListener('change', () => voice.updateLFO(lfoIndex, 'syncDiv', parseInt(divSel.value), bpmGet()));
  rowTop.appendChild(divSel);

  // BOTTOM ROW: knobs (rate · phase · depth) + LFO5 meta
  const rowBot = document.createElement('div'); rowBot.className = 'lfo-row-bot';
  body.appendChild(rowBot);

  const rateMax = lp.bpmSync ? 10 : 20;
  const depMax = lp.target === 'pitch' ? 2400 : (lp.target === 'cutoff' ? 10000 : 1);
  const depDec = lp.target === 'pitch' || lp.target === 'cutoff' ? 0 : 2;

  ['rate', 'phase', 'depth'].forEach(key => {
    const kw = document.createElement('div'); kw.className = 'lfo-knob-wrap';
    const cfg = {
      rate: { min: 0.01, max: rateMax, value: lp.rate, label: 'RATE', unit: 'Hz', decimals: 2 },
      phase: { min: 0, max: 2 * Math.PI, value: lp.phase, label: 'PHASE', unit: '°', decimals: 0 },
      depth: { min: 0, max: depMax, value: lp.depth, label: 'DEPTH', decimals: depDec }
    }[key];
    makeKnob({ parent: kw, color, ...cfg, onChange: v => voice.updateLFO(lfoIndex, key, v, bpmGet()) });
    rowBot.appendChild(kw);
  });

  // ENV ATK / ENV REL knobs — ramp LFO depth in/out with note envelope
  [['envA', 'E.ATK'], ['envR', 'E.REL']].forEach(([key, label]) => {
    const kw = document.createElement('div'); kw.className = 'lfo-knob-wrap';
    makeKnob({ parent: kw, color, min: 0, max: 4, value: lp[key] ?? 0, label, unit:'s', decimals: 2,
      onChange: v => { lp[key] = v; } // consumed at noteOn/noteOff only
    });
    rowBot.appendChild(kw);
  });

  // LFO5 meta-modulation (right side of bottom row)
  if (lfoIndex === 4) {
    const metaWrap = document.createElement('div'); metaWrap.className = 'lfo-meta-row';
    const mLbl = document.createElement('span'); mLbl.className = 'lfo-meta-lbl'; mLbl.textContent = 'META';
    const mSel = document.createElement('select'); mSel.className = 'mini-sel'; mSel.title = 'Meta-modulate';
    [['none', '—'], ['rate', 'RATE'], ['depth', 'DEPT']].forEach(([v, l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = l;
      if ((lp.metaTarget || 'none') === v) o.selected = true;
      mSel.appendChild(o);
    });
    mSel.addEventListener('change', () => voice.updateLFO(4, 'metaTarget', mSel.value === 'none' ? null : mSel.value, bpmGet()));
    const lnSel = document.createElement('select'); lnSel.className = 'mini-sel';
    [0, 1, 2, 3].forEach(n => {
      const o = document.createElement('option'); o.value = n; o.textContent = `LFO ${n + 1}`;
      if (lp.metaTargetLFO === n) o.selected = true;
      lnSel.appendChild(o);
    });
    lnSel.addEventListener('change', () => voice.updateLFO(4, 'metaTargetLFO', parseInt(lnSel.value), bpmGet()));
    metaWrap.append(mLbl, mSel, lnSel);
    rowBot.appendChild(metaWrap);
  }

  return { element: row, body };
}

// ─────────────────────────────────────────────────────────
//  Voice panel builder (using modular components)
// ─────────────────────────────────────────────────────────
