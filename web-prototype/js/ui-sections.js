// Internal: draw dist curve on already-sized canvas ctx (no resize)
function _drawDistCurveOnCtx(canvas, form, drive, color, W, H, dpr) {
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);
  _drawDistCurveBody(c, form, drive, color, W, H, dpr);
}

// Public: resize canvas then draw (used externally if needed)
function drawDistCurve(canvas, form, drive, color) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || parseFloat(canvas.style.width) || 120;
  const H = parseFloat(canvas.style.height) || canvas.offsetHeight || 90;
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
    if (drive < 0.001) return x;
    const k = 1 + drive * 40;
    switch (form) {
      case 'tube': { const bias = 0.1*drive; const v = x+bias; return Math.tanh(v*k*0.7)/Math.tanh(k*0.7)-bias*0.5; }
      case 'soft': return Math.tanh(x * k) / Math.tanh(k);
      case 'hard': return Math.max(-1, Math.min(1, x * k));
      case 'fold': { let v = x*(1+drive*8); let i=0; while((v>1||v<-1)&&i++<20){v=v>1?2-v:-2-v;} return v; }
      case 'asym': return x >= 0 ? Math.tanh(x*k)/Math.tanh(k) : Math.tanh(x*k*0.4)/Math.tanh(k*0.4)*0.7;
      case 'fuzz': { const v = x*(1+drive*200); return Math.sign(v)*Math.min(1,Math.abs(v)**0.15); }
      case 'rect': { const v = Math.max(0,x)*k; return Math.max(-1,Math.min(1,v))*2-0.5*drive; }
      case 'downsample': { const step = Math.pow(2, Math.round(drive*6)); return Math.round(x*step)/step; }
      case 'bitcrush':   { const bits = Math.max(1, Math.round(8*(1-drive))); const s = Math.pow(2,bits-1); return Math.round(x*s)/s; }
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

// Shared drawing body used by both functions above
function _drawDistCurveBody(c, form, drive, color, W, H, dpr) {
  function distSample(x) {
    if (drive < 0.001) return x;
    const k = 1 + drive * 40;
    switch (form) {
      case 'tube': { const bias = 0.1*drive; const v = x+bias; return Math.tanh(v*k*0.7)/Math.tanh(k*0.7)-bias*0.5; }
      case 'soft': return Math.tanh(x * k) / Math.tanh(k);
      case 'hard': return Math.max(-1, Math.min(1, x * k));
      case 'fold': { let v = x*(1+drive*8); let i=0; while((v>1||v<-1)&&i++<20){v=v>1?2-v:-2-v;} return v; }
      case 'asym': return x >= 0 ? Math.tanh(x*k)/Math.tanh(k) : Math.tanh(x*k*0.4)/Math.tanh(k*0.4)*0.7;
      case 'fuzz': { const v = x*(1+drive*200); return Math.sign(v)*Math.min(1,Math.abs(v)**0.15); }
      case 'rect': { const v = Math.max(0,x)*k; return Math.max(-1,Math.min(1,v))*2-0.5*drive; }
      case 'downsample': { const step = Math.pow(2, Math.round(drive*6)); return Math.round(x*step)/step; }
      case 'bitcrush':   { const bits = Math.max(1, Math.round(8*(1-drive))); const s = Math.pow(2,bits-1); return Math.round(x*s)/s; }
      default: return x;
    }
  }
  // Grid
  c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(W/2, 0); c.lineTo(W/2, H); c.stroke();
  c.beginPath(); c.moveTo(0, H/2); c.lineTo(W, H/2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 0.8; c.setLineDash([3,3]);
  c.beginPath(); c.moveTo(0, H); c.lineTo(W, 0); c.stroke();
  c.setLineDash([]);
  // Glow
  c.save(); c.globalAlpha = 0.35; c.strokeStyle = color;
  c.shadowColor = color; c.shadowBlur = 8; c.lineWidth = 3; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= W * 2; i++) {
    const x = (i / (W * 2)) * 2 - 1, y = distSample(x);
    const px = (x + 1) / 2 * W, py = (1 - (y + 1) / 2) * H;
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke(); c.restore();
  // Main curve
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 4;
  c.lineWidth = 1.5; c.lineJoin = 'round';
  c.beginPath();
  for (let i = 0; i <= W * 2; i++) {
    const x = (i / (W * 2)) * 2 - 1, y = distSample(x);
    const px = (x + 1) / 2 * W, py = (1 - (y + 1) / 2) * H;
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke();
  // Labels
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.font = `${6 / dpr}px Courier New`;
  c.fillText('IN', W - 12, H/2 - 3); c.fillText('OUT', 3, 8);
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
  const FORMS       = ['tube','soft','hard','asym','fold','fuzz','rect','dnsmp','bits'];
  const FORM_LABELS = { tube:'TUBE', soft:'SOFT', hard:'HARD', asym:'ASYM', fold:'FOLD', fuzz:'FUZZ', rect:'RECT', dnsmp:'DNSMP', bits:'BITS' };
  const FORM_DSP    = { tube:'tube', soft:'soft', hard:'hard', asym:'asym', fold:'fold', fuzz:'fuzz', rect:'rect', dnsmp:'downsample', bits:'bitcrush' };
  const FORM_TIPS   = {
    tube:  'Tube saturation — asymmetric tanh, warm 2nd/3rd harmonics',
    soft:  'Soft clip — smooth tanh saturation',
    hard:  'Hard clip — transistor crunch, square harmonics',
    asym:  'Asymmetric — positive/negative clip at different ratios, 2nd harmonic',
    fold:  'Wavefolder — metallic Buchla-style, reflects at ±1',
    fuzz:  'Fuzz — extreme near-square saturation',
    rect:  'Rectifier — half-wave, adds octave-up character',
    dnsmp: 'Downsample — reduce sample rate, lo-fi aliasing sparkle',
    bits:  'Bitcrush — reduce bit depth, digital grit',
  };

  // Ensure dp has defaults for new fields
  if (!dp.form || !FORMS.includes(dp.form)) dp.form = 'soft';
  if (dp.tone === undefined) dp.tone = 18000;
  if (dp.tonePost === undefined) dp.tonePost = false;

  // ── Row 1: mode buttons + PRE/POST toggle ──
  const formRow = document.createElement('div');
  formRow.style.cssText = 'display:flex;gap:3px;margin-bottom:5px;justify-content:flex-start;align-items:center;flex-wrap:wrap';
  container.appendChild(formRow);

  const formBtns = [];
  FORMS.forEach(f => {
    const b = document.createElement('button');
    b.className = 'ftype-btn';
    b.textContent = FORM_LABELS[f]; b.title = FORM_TIPS[f];
    const isActive = (FORM_DSP[f] === dp.form || f === dp.form);
    b.style.cssText = `padding:3px 7px;font-size:10px;letter-spacing:1px;background:transparent;border-color:${isActive?color:'#2a2a44'};color:${isActive?color:'#555'}`;
    b.addEventListener('click', () => {
      formBtns.forEach(x => { x.style.borderColor='#2a2a44'; x.style.color='#555'; });
      b.style.borderColor = color; b.style.color = color;
      const dspForm = FORM_DSP[f];
      voice.set('dist', 'form', dspForm);
      redrawDist();
    });
    formBtns.push(b);
    formRow.appendChild(b);
  });

  // PRE/POST tone filter toggle
  const _postActive = () => voice.p.dist.tonePost === true;
  const ppBtn = document.createElement('button');
  ppBtn.style.cssText = `margin-left:auto;padding:3px 7px;font-size:9px;letter-spacing:1px;border:1px solid #2a2a44;background:transparent;color:#555;border-radius:3px;font-family:monospace;cursor:pointer;white-space:nowrap`;
  const _updatePP = () => {
    ppBtn.textContent = _postActive() ? 'POST' : 'PRE';
    ppBtn.title = _postActive() ? 'Tone filter is POST-distortion — click for PRE' : 'Tone filter is PRE-distortion — click for POST';
    ppBtn.style.borderColor = _postActive() ? color : '#2a2a44';
    ppBtn.style.color       = _postActive() ? color : '#555';
  };
  _updatePP();
  ppBtn.addEventListener('click', () => {
    const next = !_postActive();
    voice.p.dist.tonePost = next;
    voice._distSetTonePost(next);
    _updatePP();
  });
  formRow.appendChild(ppBtn);

  // ── Row 2: knobs (left, flex:1) + curve canvas (right, 50%) ──
  const inner = document.createElement('div');
  inner.style.cssText = 'display:flex;gap:6px;align-items:stretch';
  container.appendChild(inner);

  const left = document.createElement('div');
  left.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center';
  inner.appendChild(left);

  const kr = document.createElement('div');
  kr.style.cssText = 'display:flex;gap:2px;align-items:flex-end';
  left.appendChild(kr);

  [
    { key:'drive',  label:'DRIVE', min:0,   max:1,     value:dp.drive,  decimals:2 },
    { key:'tone',   label:'TONE',  min:200, max:18000, value:dp.tone ?? 18000, decimals:0, log:true },
    { key:'mix',    label:'MIX',   min:0,   max:1,     value:dp.mix,    decimals:2 },
    { key:'volume', label:'VOL',   min:0,   max:2,     value:dp.volume, decimals:2 },
  ].forEach(cfg => {
    const k = makeKnob({ parent:kr, color, size:46, ...cfg, onChange: v => {
      voice.set('dist', cfg.key, v);
      if (cfg.key === 'drive' || cfg.key === 'mix') redrawDist();
    }});
    if (cfg.key === 'drive') voice._driveKnob   = k;
    if (cfg.key === 'mix')   voice._distMixKnob = k;
  });

  // RIGHT: canvas fixed 50%
  const right = document.createElement('div');
  right.style.cssText = 'flex:0 0 50%;max-width:50%;display:flex;flex-direction:column;gap:0';
  inner.appendChild(right);

  const distCvs = document.createElement('canvas');
  distCvs.style.cssText = 'display:block;width:100%;height:90px;background:#06060f;border-radius:4px;border:1px solid #1a1a30;cursor:default';
  right.appendChild(distCvs);

  const _draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const W = distCvs.offsetWidth || 120;
    const H = 90;
    distCvs.width  = W * dpr;
    distCvs.height = H * dpr;
    const _dist = voice.p.dist;
    const _PREVIEW = { tube:0.10, soft:0.12, hard:0.06, fold:0.30, asym:0.08, fuzz:0.004, rect:0.10, downsample:0.5, bitcrush:0.5 };
    const _previewDrive = Math.max(_dist.drive, _PREVIEW[_dist.form] ?? 0.12);
    _drawDistCurveOnCtx(distCvs, _dist.form, _previewDrive, color, W, H, dpr);
    if (voice.preAnalyser && voice.analyser) {
      _overlayDistWaveform(distCvs, voice.preAnalyser, voice.analyser, _dist.mix, color, W, H, dpr);
    }
  };

  const redrawDist = () => requestAnimationFrame(_draw);

  let _animId = null;
  const _startAnim = () => { if (_animId) return; const loop = () => { _draw(); _animId = requestAnimationFrame(loop); }; _animId = requestAnimationFrame(loop); };
  const _stopAnim  = () => { if (_animId) { cancelAnimationFrame(_animId); _animId = null; } redrawDist(); };

  const _origNoteOn  = voice.noteOn.bind(voice);
  const _origNoteOff = voice.noteOff.bind(voice);
  voice.noteOn  = (...a) => { _origNoteOn(...a);  _startAnim(); };
  voice.noteOff = (...a) => { _origNoteOff(...a); setTimeout(_stopAnim, 400); };

  setTimeout(redrawDist, 150);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => redrawDist()).observe(distCvs);
  }

  addSectionToggle(container,
    () => { voice.p.dist.bypassed = true;
            voice._distWet.gain.setTargetAtTime(0,       voice.ctx.currentTime, 0.01);
            voice._distDry.gain.setTargetAtTime(1,       voice.ctx.currentTime, 0.01); },
    () => { voice.p.dist.bypassed = false;
            voice._distWet.gain.setTargetAtTime(dp.mix,   voice.ctx.currentTime, 0.01);
            voice._distDry.gain.setTargetAtTime(1-dp.mix, voice.ctx.currentTime, 0.01); },
    !voice.p.dist.bypassed
  );
}

// Draw live waveform overlay — pre (grey) + post-dist (color) — on already-drawn curve canvas
// W/H/dpr are passed in from _draw() so we never read stale canvas dimensions
function _overlayDistWaveform(canvas, preAnalyser, postAnalyser, mix, color, W, H, dpr) {
  // Use frequencyBinCount (= fftSize/2) capped at canvas pixel width for clean 1:1 mapping
  const N = Math.min(preAnalyser.frequencyBinCount, Math.floor(W));
  const preBuf  = new Float32Array(preAnalyser.fftSize);
  const postBuf = new Float32Array(postAnalyser.fftSize);
  preAnalyser.getFloatTimeDomainData(preBuf);
  postAnalyser.getFloatTimeDomainData(postBuf);

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Draw a centred waveform strip in the lower half of the canvas
  const yBase = H * 0.5;  // vertical center
  const amp   = H * 0.4;  // max amplitude in px

  // Pre (input) — dim white
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const x = (i / N) * W;
    const y = yBase - preBuf[i] * amp;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Post (output) — colored glow
  ctx.globalAlpha = Math.max(0.4, Math.min(0.9, mix + 0.3));
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const x = (i / N) * W;
    const y = yBase - postBuf[i] * amp;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.restore();
}

// Interactive ADSR canvas (Serum-style: canvas top, readouts, knobs below)
function buildADSRSection(container, adsrP, voice, color) {
  const SUSTAIN_W = 0.3;

  // Ensure hold exists
  if (adsrP.hold === undefined) adsrP.hold = 0;

  // ── ADSR layout: knobs left (flex:1) + canvas right (50%) ──
  const aInner = document.createElement('div');
  aInner.style.cssText = 'display:flex;gap:6px;align-items:stretch';
  container.appendChild(aInner);

  // LEFT: knob row only
  const aLeft = document.createElement('div');
  aLeft.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;justify-content:flex-start';
  aInner.appendChild(aLeft);

  // Single horizontal knob row
  const knobRow = document.createElement('div');
  knobRow.style.cssText = 'display:flex;gap:2px;align-items:flex-end';
  aLeft.appendChild(knobRow);

  // RIGHT: canvas + readout strip below — fixed 50% width
  const aRight = document.createElement('div');
  aRight.style.cssText = 'flex:0 0 50%;max-width:50%;display:flex;flex-direction:column;gap:0';
  aInner.appendChild(aRight);

  // ── Canvas ─────────────────────────────────────────────
  const cvs = document.createElement('canvas');
  cvs.style.cssText = 'display:block;width:100%;height:80px;background:#030308;border-radius:4px 4px 0 0;border:1px solid #1a1a30;border-bottom:none;cursor:crosshair;touch-action:none';
  aRight.appendChild(cvs);

  // Readout strip — directly below canvas
  const readoutRow = document.createElement('div');
  readoutRow.style.cssText = 'display:flex;background:#080814;border:1px solid #1a1a30;border-top:none;border-radius:0 0 4px 4px;overflow:hidden;margin-bottom:0';
  aRight.appendChild(readoutRow);

  const readouts = {};
  function fmtTime(v) { return v < 1 ? (v*1000).toFixed(0)+'ms' : v.toFixed(2)+'s'; }
  function fmtSus(v)  { return (v * 100).toFixed(0)+'%'; }
  [['atk','ATK'],['dec','DEC'],['sus','SUS'],['rel','REL']].forEach(([k,lbl]) => {
    const cell = document.createElement('div');
    cell.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;padding:2px 0;border-right:1px solid #111128';
    const v = document.createElement('div');
    v.style.cssText = `font-size:9px;color:${color};font-family:monospace;letter-spacing:0.5px`;
    const l = document.createElement('div');
    l.style.cssText = 'font-size:8px;color:#444;letter-spacing:1px';
    l.textContent = lbl;
    cell.append(v, l);
    readoutRow.appendChild(cell);
    readouts[k] = { el: v, fmt: k==='sus' ? fmtSus : fmtTime };
  });
  readoutRow.lastChild.style.borderRight = 'none';

  function updateReadouts() {
    readouts.atk.el.textContent = fmtTime(adsrP.attack);
    readouts.dec.el.textContent = fmtTime(adsrP.decay);
    readouts.sus.el.textContent = fmtSus(adsrP.sustain);
    readouts.rel.el.textContent = fmtTime(adsrP.release);
  }

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
  knobRefs.atk = makeKnob({ parent:knobRow, min:0.001, max:2,  value:adsrP.attack,  label:'ATK', unit:'s', decimals:3, color, size:46, onChange: v => { adsrP.attack  = v; voice.set('adsr','attack',  v); redrawAll(); } });
  knobRefs.dec = makeKnob({ parent:knobRow, min:0.01,  max:2,  value:adsrP.decay,   label:'DEC', unit:'s', decimals:2, color, size:46, onChange: v => { adsrP.decay   = v; voice.set('adsr','decay',   v); redrawAll(); } });
  knobRefs.sus = makeKnob({ parent:knobRow, min:0,     max:1,  value:adsrP.sustain, label:'SUS',           decimals:2, color, size:46, onChange: v => { adsrP.sustain = v; voice.set('adsr','sustain', v); redrawAll(); } });
  knobRefs.rel = makeKnob({ parent:knobRow, min:0.01,  max:4,  value:adsrP.release, label:'REL', unit:'s', decimals:2, color, size:46, onChange: v => { adsrP.release = v; voice.set('adsr','release', v); redrawAll(); } });

  function redrawAll() { redraw(); updateReadouts(); }

  // ── Live playhead animation ─────────────────────────────
  // _envTracker only transitions on noteOn/noteOff calls — it stays in 'attack'
  // phase indefinitely. We compute the real phase from elapsed time ourselves.
  function getPlayheadXY(W, H) {
    const et = voice._envTracker;
    if (!et || et._phase === 'idle') return null;
    const now = voice.ctx.currentTime;
    const dt  = Math.max(0, now - et._t0);
    const L   = getLayout(W, H);
    const a = adsrP.attack, d = adsrP.decay;

    let x, y, phaseName;

    if (et._phase === 'release') {
      // Release: follow bezier from note-off position → zero
      const t = Math.min(1, dt / Math.max(0.001, adsrP.release));
      x = (1-t)*(1-t)*L.xs + 2*(1-t)*t*L.relCp.x + t*t*L.xr;
      y = (1-t)*(1-t)*L.yd + 2*(1-t)*t*L.relCp.y + t*t*L.yr;
      phaseName = 'REL';
      if (t >= 1) return null; // done
    } else {
      // attack phase from tracker = note is held; compute A/D/S sub-phase from dt
      if (dt < a) {
        // Attack
        const t = dt / Math.max(0.001, a);
        x = (1-t)*(1-t)*L.x0 + 2*(1-t)*t*L.atkCp.x + t*t*L.xa;
        y = (1-t)*(1-t)*L.y0 + 2*(1-t)*t*L.atkCp.y + t*t*L.ya;
        phaseName = 'ATK';
      } else if (dt < a + d) {
        // Decay
        const t = (dt - a) / Math.max(0.001, d);
        x = (1-t)*(1-t)*L.xa + 2*(1-t)*t*L.decCp.x + t*t*L.xd;
        y = (1-t)*(1-t)*L.ya + 2*(1-t)*t*L.decCp.y + t*t*L.yd;
        phaseName = 'DEC';
      } else {
        // Sustain — dot bounces back and forth along the sustain line
        const susDt = dt - a - d;
        const susW = L.xs - L.xd;
        const period = 2; // seconds per sweep
        const pingpong = (susDt % period) / period;
        const tx = pingpong < 0.5 ? pingpong * 2 : (1 - pingpong) * 2;
        x = L.xd + tx * susW;
        y = L.yd;
        phaseName = 'SUS';
      }
    }
    return { x, y, phaseName };
  }

  let _lastPlayheadPhase = null;
  function drawPlayhead() {
    requestAnimationFrame(drawPlayhead);
    const et = voice._envTracker;
    const isActive = et && et._phase !== 'idle';

    // Redraw static curve when transitioning idle↔active
    if (!isActive) {
      if (_lastPlayheadPhase !== null) { redraw(); _lastPlayheadPhase = null; }
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const W = cvs.offsetWidth || 200, H = cvs.offsetHeight || 100;
    if (!W || !H) return;

    // Full curve redraw each frame while active (needed to clear previous dot)
    redraw();

    const pt = getPlayheadXY(W, H);
    if (!pt) return;
    _lastPlayheadPhase = pt.phaseName;

    const c = cvs.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Vertical scan line
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1; c.setLineDash([2,4]);
    c.beginPath(); c.moveTo(pt.x, 0); c.lineTo(pt.x, H);
    c.stroke(); c.setLineDash([]); c.restore();

    // Glow halo
    c.save();
    c.beginPath(); c.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
    c.fillStyle = color; c.globalAlpha = 0.18;
    c.shadowColor = color; c.shadowBlur = 16;
    c.fill(); c.restore();

    // White core dot
    c.save();
    c.beginPath(); c.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.shadowColor = color; c.shadowBlur = 12;
    c.globalAlpha = 1;
    c.fill(); c.restore();

    // Colored ring
    c.save();
    c.beginPath(); c.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    c.strokeStyle = color; c.lineWidth = 1.5;
    c.shadowColor = color; c.shadowBlur = 6;
    c.globalAlpha = 0.8;
    c.stroke(); c.restore();

    // Phase label
    c.save();
    c.fillStyle = color; c.font = 'bold 8px monospace'; c.globalAlpha = 0.9;
    const lx = pt.x + 10 < W - 28 ? pt.x + 10 : pt.x - 32;
    c.fillText(pt.phaseName, lx, pt.y - 7);
    c.restore();
  }
  drawPlayhead();

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
//  buildOneLFOColumn — one LFO column for the 2-up layout
//  container : DOM node to append into
//  initSlot  : initial slot index (0–4)
//  engine    : LFOEngine instance
//  color     : voice accent color
//  voice     : WobblerVoice
// ─────────────────────────────────────────────────────────
function buildOneLFOColumn(container, initSlot, engine, color, voice) {
  let activeSlot = initSlot;
  function getSlot() { return engine?.slots[activeSlot]; }

  const col = document.createElement('div');
  col.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:6px;border:1px solid #1a1a30;background:#05050e';
  container.appendChild(col);

  // ── Slot tabs row (compact 1–5) ──────────────────────
  const tabRow = document.createElement('div');
  tabRow.style.cssText = 'display:flex;gap:2px;align-items:center';
  col.appendChild(tabRow);

  const slotLbl = document.createElement('span');
  slotLbl.style.cssText = 'font-size:9px;color:#444;letter-spacing:1px;margin-right:2px;flex-shrink:0';
  slotLbl.textContent = 'SLOT';
  tabRow.appendChild(slotLbl);

  const slotBtns = [];
  for (let i = 0; i < 5; i++) {
    const b = document.createElement('button');
    b.textContent = i + 1;
    const active = i === activeSlot;
    b.style.cssText = `padding:2px 6px;font-size:10px;font-family:monospace;border-radius:3px;cursor:pointer;border:1px solid ${active ? color : '#2a2a44'};background:${active ? color+'22' : 'transparent'};color:${active ? color : '#555'};transition:all 0.1s`;
    b.addEventListener('click', () => {
      activeSlot = i;
      slotBtns.forEach((x, j) => {
        x.style.borderColor = j === i ? color : '#2a2a44';
        x.style.background  = j === i ? color + '22' : 'transparent';
        x.style.color       = j === i ? color : '#555';
      });
      refreshUI();
    });
    slotBtns.push(b);
    tabRow.appendChild(b);
  }

  // Active slot label (e.g. "LFO 1 — CUTOFF")
  const slotStatusLbl = document.createElement('span');
  slotStatusLbl.style.cssText = 'margin-left:auto;font-size:9px;letter-spacing:1px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px';
  tabRow.appendChild(slotStatusLbl);

  // ── Canvas area ───────────────────────────────────────
  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:relative;flex-shrink:0';
  col.appendChild(canvasWrap);

  const bpCvs = document.createElement('canvas');
  bpCvs.style.cssText = 'display:block;width:100%;height:110px;border-radius:4px;background:#050510;border:1px solid #1e1e3a;cursor:crosshair;touch-action:none';
  canvasWrap.appendChild(bpCvs);

  // Axis labels
  const axTop = document.createElement('div'); axTop.style.cssText = 'position:absolute;top:3px;left:4px;font-size:9px;color:#333;pointer-events:none'; axTop.textContent = '1.0';
  const axBot = document.createElement('div'); axBot.style.cssText = 'position:absolute;bottom:3px;left:4px;font-size:9px;color:#333;pointer-events:none'; axBot.textContent = '0.0';
  canvasWrap.append(axTop, axBot);

  // Playhead canvas
  const phCvs = document.createElement('canvas');
  phCvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:4px';
  canvasWrap.appendChild(phCvs);

  // ── Draw curve ─────────────────────────────────────────
  function drawCurve() {
    const slot = getSlot(); if (!slot) return;
    const dpr = window.devicePixelRatio || 1;
    const W = bpCvs.offsetWidth || 200, H = bpCvs.offsetHeight || 110;
    bpCvs.width = W * dpr; bpCvs.height = H * dpr;
    const c = bpCvs.getContext('2d'); c.scale(dpr, dpr);
    c.fillStyle = '#050510'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 0.5;
    [0.25,0.5,0.75].forEach(v => {
      c.beginPath(); c.moveTo(0, v*H); c.lineTo(W, v*H); c.stroke();
      c.beginPath(); c.moveTo(v*W, 0); c.lineTo(v*W, H); c.stroke();
    });
    const pts = slot.points; if (!pts || !pts.length) return;
    const N = pts.length;
    c.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i / (N-1)) * W, y = (1 - pts[i]) * H;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.save(); c.globalAlpha = 0.15; c.strokeStyle = color; c.lineWidth = 6; c.stroke(); c.restore();
    c.strokeStyle = color; c.lineWidth = 2; c.stroke();
    slot.breakpoints.forEach(bp => {
      const x = bp.x * W, y = (1 - bp.y) * H;
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI*2);
      c.fillStyle = bp.hard ? '#ff6644' : color; c.fill();
      c.strokeStyle = '#0a0a1a'; c.lineWidth = 1.5; c.stroke();
    });
  }

  // ── Playhead animation ─────────────────────────────────
  (function animPh() {
    requestAnimationFrame(animPh);
    const slot = getSlot(); if (!slot) return;
    const dpr = window.devicePixelRatio || 1;
    const W = phCvs.offsetWidth || 200, H = phCvs.offsetHeight || 110;
    if (phCvs.width !== W*dpr || phCvs.height !== H*dpr) { phCvs.width = W*dpr; phCvs.height = H*dpr; }
    const c = phCvs.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (!slot.enabled || slot.target === 'none') return;
    const scaledPhase = (slot.phase * slot.mult) % 1;
    const px = scaledPhase * W;
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.setLineDash([3,3]);
    c.beginPath(); c.moveTo(px, 0); c.lineTo(px, H); c.stroke(); c.setLineDash([]);
    if (slot.points && slot.points.length) {
      const idx = Math.min(slot.points.length-1, Math.max(0, Math.floor(scaledPhase * slot.points.length)));
      const val = slot.points[idx];
      const dy = (1 - val) * H;
      c.shadowColor = color; c.shadowBlur = 8;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px, dy, 3, 0, Math.PI*2); c.fill();
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.font = 'bold 8px monospace';
      c.fillText(val.toFixed(2), Math.min(W-24, Math.max(2, px+4)), Math.max(9, dy-4));
    }
    c.restore();
  })();

  // ── Breakpoint interaction ─────────────────────────────
  let dragIdx = -1;
  const BP_HIT = 10;
  function bpXY(e) {
    const r = bpCvs.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - r.left) / r.width, y: 1 - (cy - r.top) / r.height };
  }
  function bpHit(px, py) {
    const s = getSlot(); if (!s) return -1;
    const W = bpCvs.offsetWidth || 200, H = bpCvs.offsetHeight || 110;
    for (let i = 0; i < s.breakpoints.length; i++) {
      const bp = s.breakpoints[i];
      if (Math.hypot((bp.x - px)*W, (bp.y - py)*H) < BP_HIT) return i;
    }
    return -1;
  }
  bpCvs.addEventListener('pointerdown', e => {
    e.preventDefault();
    const { x, y } = bpXY(e);
    const idx = bpHit(x, y);
    if (idx >= 0) { dragIdx = idx; bpCvs.setPointerCapture(e.pointerId); return; }
    const s = getSlot(); if (!s) return;
    s.breakpoints.push({ x: Math.max(0,Math.min(1,x)), y: Math.max(0,Math.min(1,y)), hard: false, tension: 0 });
    s.breakpoints.sort((a,b) => a.x - b.x);
    engine.setSlotBreakpoints(activeSlot, s.breakpoints);
    drawCurve();
  });
  bpCvs.addEventListener('pointermove', e => {
    if (dragIdx < 0) return; e.preventDefault();
    const { x, y } = bpXY(e);
    const s = getSlot(); if (!s) return;
    const bp = s.breakpoints[dragIdx];
    bp.y = Math.max(0, Math.min(1, y));
    if (dragIdx > 0 && dragIdx < s.breakpoints.length-1) bp.x = Math.max(0.01, Math.min(0.99, x));
    engine.setSlotBreakpoints(activeSlot, s.breakpoints);
    drawCurve();
  });
  bpCvs.addEventListener('pointerup', () => { dragIdx = -1; });
  bpCvs.addEventListener('dblclick', e => {
    const { x, y } = bpXY(e);
    const idx = bpHit(x, y);
    const s = getSlot(); if (!s) return;
    if (idx > 0 && idx < s.breakpoints.length-1) {
      s.breakpoints.splice(idx, 1);
    } else if (idx >= 0) {
      s.breakpoints[idx].hard = !s.breakpoints[idx].hard;
    }
    engine.setSlotBreakpoints(activeSlot, s.breakpoints);
    drawCurve();
  });

  // ── Target groups ──────────────────────────────────────
  const TARGET_GROUPS = [
    { label:'FILTER', color:'#a78bfa', targets:[['cutoff','CUT'],['resonance','RES']] },
    { label:'OSC',    color:'#34d399', targets:[['pitch','PCH'],['semi','SEM'],['fine','FIN']] },
    { label:'AMP',    color:'#fb923c', targets:[['amp','TREM'],['drive','DRV'],['distMix','MIX']] },
    { label:'NOISE',  color:'#22d3ee', targets:[['noiseAmt','LVL']] },
  ];

  const tgtWrap = document.createElement('div');
  tgtWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px';
  col.appendChild(tgtWrap);

  const tgtTopRow = document.createElement('div');
  tgtTopRow.style.cssText = 'display:flex;align-items:center;gap:4px';
  tgtWrap.appendChild(tgtTopRow);

  const tgtLbl = document.createElement('span');
  tgtLbl.style.cssText = 'font-size:9px;color:#444;letter-spacing:1px;flex-shrink:0';
  tgtLbl.textContent = 'TARGET';
  tgtTopRow.appendChild(tgtLbl);

  const offBtn = document.createElement('button');
  offBtn.style.cssText = 'padding:2px 7px;font-size:9px;font-family:monospace;border:1px solid #ff4466;color:#ff4466;background:transparent;border-radius:2px;cursor:pointer';
  offBtn.textContent = 'OFF'; offBtn.dataset.tgt = 'none';
  tgtTopRow.appendChild(offBtn);

  const tgtBtnRow = document.createElement('div');
  tgtBtnRow.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap';
  tgtWrap.appendChild(tgtBtnRow);

  const tgtBtns = [offBtn];
  TARGET_GROUPS.forEach(({ label: gl, color: gc, targets }) => {
    const grp = document.createElement('div');
    grp.style.cssText = `display:flex;flex-direction:column;gap:2px;padding:3px 4px;border-radius:4px;border:1px solid ${gc}22;background:${gc}08`;
    const glbl = document.createElement('div');
    glbl.style.cssText = `font-size:8px;letter-spacing:1px;color:${gc};opacity:0.7;text-align:center`;
    glbl.textContent = gl;
    grp.appendChild(glbl);
    const brow = document.createElement('div'); brow.style.cssText = 'display:flex;gap:2px';
    targets.forEach(([val, lbl]) => {
      const b = document.createElement('button');
      b.style.cssText = `padding:2px 5px;font-size:9px;font-family:monospace;border:1px solid ${gc}66;color:${gc}aa;background:transparent;border-radius:2px;cursor:pointer`;
      b.textContent = lbl; b.dataset.tgt = val; b.dataset.gc = gc;
      brow.appendChild(b); tgtBtns.push(b);
    });
    grp.appendChild(brow); tgtBtnRow.appendChild(grp);
  });

  function _syncTgtBtns(target) {
    tgtBtns.forEach(b => {
      const gc = b.dataset.gc;
      const on = b.dataset.tgt === target;
      b.style.color       = on ? (gc || '#ff4466') : (gc ? `${gc}aa` : '#ff4466');
      b.style.borderColor = on ? (gc || '#ff4466') : (gc ? `${gc}66` : '#ff446688');
      b.style.background  = on ? (gc ? `${gc}22` : '#ff446622') : 'transparent';
    });
    slotStatusLbl.textContent = target === 'none' ? '—' : target.toUpperCase();
  }

  tgtBtns.forEach(b => {
    b.addEventListener('click', () => {
      const val = b.dataset.tgt;
      const s = getSlot(); if (!s) return;
      const prev = s.target;
      s.target = val; s.enabled = (val !== 'none');
      _syncTgtBtns(val);
      if (val === 'none') {
        const t = voice.ctx.currentTime;
        if (prev === 'cutoff')    { voice._lfoOwnsFilterCutoff = false; voice._filterSetCutoff(voice.p.filter.cutoff, t, 0.02); }
        if (prev === 'resonance') voice._filterSetResonance(voice.p.filter.resonance, t, 0.02);
        if (['pitch','amp','tremolo','semi','fine'].includes(prev)) {
          voice._tremoloGain?.gain.setTargetAtTime(1, t, 0.02);
          (voice._activeOscs||[]).forEach(o => { try { o.detune.setTargetAtTime(0, t, 0.02); } catch(_) {} });
        }
        if (prev === 'drive')    voice.set('dist','drive', voice.p.dist.drive);
        if (prev === 'distMix')  voice.set('dist','mix', voice.p.dist.mix);
        if (prev === 'noiseAmt') voice._noiseG?.gain.setTargetAtTime(voice.p.noise.volume, t, 0.02);
      }
      if (s.enabled && engine && !engine.playing) engine.start();
    });
  });

  // ── Bars + Mult in one compact block ──────────────────
  const timingWrap = document.createElement('div');
  timingWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px';
  col.appendChild(timingWrap);

  const barsBtns = [];
  (() => {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:2px;align-items:center';
    const lbl = document.createElement('span'); lbl.style.cssText = 'font-size:9px;color:#444;letter-spacing:1px;min-width:28px;flex-shrink:0'; lbl.textContent = 'BARS';
    row.appendChild(lbl);
    [1,2,4,8,16].forEach(n => {
      const b = document.createElement('button');
      b.style.cssText = 'padding:2px 6px;font-size:9px;font-family:monospace;border:1px solid #2a2a44;color:#555;background:transparent;border-radius:2px;cursor:pointer';
      b.textContent = n; b.dataset.bars = n;
      b.addEventListener('click', () => { const s=getSlot();if(s){s.bars=n;barsBtns.forEach(x=>{x.style.borderColor='#2a2a44';x.style.color='#555';x.style.background='transparent';});b.style.borderColor=color;b.style.color=color;b.style.background=color+'22';} });
      barsBtns.push(b); row.appendChild(b);
    });
    timingWrap.appendChild(row);
  })();

  const allMultBtns = [];
  const MULT_ROWS = [
    { label:'ST',  lc:'#aaa',    values:[[1,'×1'],[2,'×2'],[4,'×4'],[8,'×8'],[16,'×16']] },
    { label:'3T',  lc:'#a855f7', values:[[1.5,'×1T'],[3,'×2T'],[6,'×4T'],[12,'×8T']] },
    { label:'DOT', lc:'#22d3ee', values:[[0.667,'×1D'],[1.333,'×2D'],[2.667,'×4D']] },
  ];
  MULT_ROWS.forEach(({ label, lc, values }) => {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:2px;align-items:center';
    const lbl = document.createElement('span'); lbl.style.cssText = `font-size:9px;color:${lc};min-width:28px;flex-shrink:0`; lbl.textContent = label;
    row.appendChild(lbl);
    values.forEach(([val, disp]) => {
      const b = document.createElement('button');
      b.style.cssText = `padding:2px 5px;font-size:9px;font-family:monospace;border:1px solid ${lc}55;color:${lc}88;background:transparent;border-radius:2px;cursor:pointer`;
      b.textContent = disp; b.dataset.mult = val;
      b.addEventListener('click', () => {
        const s=getSlot();if(!s)return; s.mult=val;
        allMultBtns.forEach(x=>{x.style.borderColor=x.dataset.lc+'55';x.style.color=x.dataset.lc+'88';x.style.background='transparent';});
        b.style.borderColor=lc; b.style.color=lc; b.style.background=lc+'22';
      });
      b.dataset.lc = lc;
      allMultBtns.push(b); row.appendChild(b);
    });
    timingWrap.appendChild(row);
  });

  // ── Depth knob + CLR ──────────────────────────────────
  const depthRow = document.createElement('div');
  depthRow.style.cssText = 'display:flex;gap:6px;align-items:flex-end';
  col.appendChild(depthRow);

  const depthWrap = document.createElement('div'); depthWrap.className = 'lfo-knob-wrap';
  const depthKnob = makeKnob({ parent: depthWrap, min:0, max:1, value: engine?.slots[activeSlot]?.depth ?? 0.6, label:'DEPTH', decimals:2, color,
    onChange: v => { const s = getSlot(); if (s) s.depth = v; }
  });
  depthRow.appendChild(depthWrap);

  const clrBtn = document.createElement('button');
  clrBtn.style.cssText = 'padding:3px 8px;font-size:9px;font-family:monospace;border:1px solid #ff4466;color:#ff4466;background:transparent;border-radius:2px;cursor:pointer;align-self:center';
  clrBtn.textContent = 'CLR';
  clrBtn.addEventListener('click', () => {
    const s = getSlot(); if (!s) return;
    s.breakpoints = [{x:0,y:0.5,hard:false},{x:1,y:0.5,hard:false}];
    engine.setSlotBreakpoints(activeSlot, s.breakpoints);
    drawCurve();
  });
  depthRow.appendChild(clrBtn);

  // ── Presets — collapsed by default, toggle button ─────
  const presetToggleBtn = document.createElement('button');
  presetToggleBtn.style.cssText = `padding:2px 6px;font-size:9px;font-family:monospace;border:1px solid #2a2a44;color:#555;background:transparent;border-radius:2px;cursor:pointer;width:100%;text-align:left`;
  presetToggleBtn.textContent = '▶ PRESETS';
  col.appendChild(presetToggleBtn);

  const presetWrap = document.createElement('div');
  presetWrap.style.cssText = 'display:none;flex-direction:column;gap:2px';
  col.appendChild(presetWrap);

  presetToggleBtn.addEventListener('click', () => {
    const open = presetWrap.style.display !== 'none';
    presetWrap.style.display = open ? 'none' : 'flex';
    presetToggleBtn.textContent = (open ? '▶' : '▼') + ' PRESETS';
  });

  function makePresetRowCol(label, lc, presets) {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap;align-items:center';
    const lbl = document.createElement('span'); lbl.style.cssText = `font-size:8px;color:${lc};letter-spacing:1px;min-width:36px;flex-shrink:0`; lbl.textContent = label;
    row.appendChild(lbl);
    presets.forEach(([name, display]) => {
      const b = document.createElement('button');
      b.style.cssText = `padding:2px 5px;font-size:9px;font-family:monospace;border:1px solid ${lc}55;color:${lc}aa;background:transparent;border-radius:2px;cursor:pointer`;
      b.textContent = display;
      b.addEventListener('click', () => {
        if (typeof loadLFOPreset === 'function' && loadLFOPreset(activeSlot, name, engine)) {
          engine.slots[activeSlot].presetName = name;
          drawCurve();
          refreshUI();
        }
      });
      row.appendChild(b);
    });
    return row;
  }

  [
    ['SHAPE','#aaa',   [['sawup','SAW↗'],['sawdn','SAW↘'],['sine','SIN'],['square','SQ'],['triangle','TRI'],['bounce','BNC'],['shark','SHRK'],['expup','EXP↑'],['expdown','EXP↓']]],
    ['STEPS','#666',   [['step4','4ST'],['step8','8ST'],['stair4','4↑'],['stair4dn','4↓'],['stairirr','IRR']]],
    ['DnB',  '#00ffb2',[['dnbsaw','SAW'],['dnbpump','PMP'],['wubwub','WUB'],['acid','ACD'],['fastsaw','FST'],['triplet','TRP'],['rubber','RBR']]],
    ['NEURO','#a855f7',[['neurozap','ZAP'],['neuroglitch','GLT'],['neuro','NEU'],['neurostep','STP']]],
    ['LIQ',  '#22d3ee',[['liquid','LIQ'],['breathe','BRE'],['flow','FLW'],['halftime','HLF'],['swell','SWL'],['vowel','VOW'],['wah','WAH']]],
    ['AGGRO','#ff4444',[['hardsaw','HSW'],['spike','SPK'],['crusher','CRS'],['razorsaw','RZR'],['glitchstep','GLT'],['sawblast','BLS']]],
    ['BUILD','#fbbf24',[['rise4','RIS'],['riseexp4','EXP'],['risesaw4','SAW'],['buildpump','PMP'],['risedrop','DRP'],['swell4','SWL'],['stab4','STB']]],
  ].forEach(([lbl, lc, presets]) => presetWrap.appendChild(makePresetRowCol(lbl, lc, presets)));

  // ── MY CURVES — user-saved breakpoint library ─────────
  const MY_CURVES_KEY = 'wobbler_lfo_curves';

  function _loadCurveLib() {
    try { return JSON.parse(localStorage.getItem(MY_CURVES_KEY) || '{}'); } catch(_) { return {}; }
  }
  function _saveCurveLib(lib) {
    try { localStorage.setItem(MY_CURVES_KEY, JSON.stringify(lib)); } catch(_) {}
  }

  // Divider
  const myCurvesDivider = document.createElement('div');
  myCurvesDivider.style.cssText = 'border-top:1px solid #1a1a30;margin:4px 0 2px';
  presetWrap.appendChild(myCurvesDivider);

  // Header row: "MY CURVES" label
  const myCurvesHdr = document.createElement('div');
  myCurvesHdr.style.cssText = 'font-size:8px;letter-spacing:1px;color:#6366f1;margin-bottom:3px';
  myCurvesHdr.textContent = 'MY CURVES';
  presetWrap.appendChild(myCurvesHdr);

  // Save row: text input + SAVE button
  const saveRow = document.createElement('div');
  saveRow.style.cssText = 'display:flex;gap:3px;align-items:center';
  presetWrap.appendChild(saveRow);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'curve name…';
  nameInput.style.cssText = 'flex:1;min-width:0;padding:2px 4px;font-size:9px;font-family:monospace;background:#0a0a18;border:1px solid #2a2a44;color:#aaa;border-radius:2px;outline:none';
  saveRow.appendChild(nameInput);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'SAVE';
  saveBtn.style.cssText = 'padding:2px 6px;font-size:9px;font-family:monospace;border:1px solid #6366f1;color:#6366f1;background:transparent;border-radius:2px;cursor:pointer;flex-shrink:0';
  saveRow.appendChild(saveBtn);

  // List container for saved curves
  const curveList = document.createElement('div');
  curveList.style.cssText = 'display:flex;flex-direction:column;gap:2px;max-height:80px;overflow-y:auto';
  presetWrap.appendChild(curveList);

  function renderCurveList() {
    curveList.innerHTML = '';
    const lib = _loadCurveLib();
    const names = Object.keys(lib);
    if (!names.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:8px;color:#333;font-family:monospace;padding:2px';
      empty.textContent = 'no saved curves yet';
      curveList.appendChild(empty);
      return;
    }
    names.forEach(name => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:2px;align-items:center';

      const loadBtn = document.createElement('button');
      loadBtn.textContent = name;
      loadBtn.title = 'Load "' + name + '"';
      loadBtn.style.cssText = 'flex:1;min-width:0;text-align:left;padding:2px 5px;font-size:9px;font-family:monospace;border:1px solid #6366f155;color:#6366f1aa;background:transparent;border-radius:2px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      loadBtn.addEventListener('click', () => {
        const lib2 = _loadCurveLib();
        const bps = lib2[name];
        if (!bps) return;
        const s = getSlot(); if (!s) return;
        s.breakpoints = JSON.parse(JSON.stringify(bps));
        s.presetName = 'custom';
        engine.setSlotBreakpoints(activeSlot, s.breakpoints);
        drawCurve();
      });
      row.appendChild(loadBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.title = 'Delete "' + name + '"';
      delBtn.style.cssText = 'padding:2px 5px;font-size:9px;font-family:monospace;border:1px solid #ff446655;color:#ff4466aa;background:transparent;border-radius:2px;cursor:pointer;flex-shrink:0';
      delBtn.addEventListener('click', () => {
        const lib2 = _loadCurveLib();
        delete lib2[name];
        _saveCurveLib(lib2);
        renderCurveList();
      });
      row.appendChild(delBtn);

      curveList.appendChild(row);
    });
  }

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    const s = getSlot(); if (!s) return;
    const lib = _loadCurveLib();
    lib[name] = JSON.parse(JSON.stringify(s.breakpoints));
    _saveCurveLib(lib);
    nameInput.value = '';
    renderCurveList();
  });

  // Save on Enter key in input
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  renderCurveList();

  // ── refreshUI — sync all controls to activeSlot ───────
  function refreshUI() {
    const s = getSlot(); if (!s) return;
    _syncTgtBtns(s.target);
    barsBtns.forEach(b => {
      const on = parseInt(b.dataset.bars) === s.bars;
      b.style.borderColor = on ? color : '#2a2a44';
      b.style.color       = on ? color : '#555';
      b.style.background  = on ? color+'22' : 'transparent';
    });
    allMultBtns.forEach(b => {
      const on = parseFloat(b.dataset.mult) === s.mult;
      const lc = b.dataset.lc;
      b.style.borderColor = on ? lc : lc+'55';
      b.style.color       = on ? lc : lc+'88';
      b.style.background  = on ? lc+'22' : 'transparent';
    });
    depthKnob.setValue(s.depth);
    slotStatusLbl.textContent = s.target === 'none' ? '—' : s.target.toUpperCase();
    drawCurve();
  }

  setTimeout(() => refreshUI(), 60);
  return { refreshUI, drawCurve };
}

// ─────────────────────────────────────────────────────────
//  Voice panel builder (using modular components)
// ─────────────────────────────────────────────────────────
