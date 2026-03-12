function drawTwePreview(canvas, tweP, color, elapsedSec, selectedLane, bpm) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 200, H = canvas.offsetHeight || 70;
  if (!W || !H) return;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const c = canvas.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);
  const isLive = elapsedSec !== undefined;

  const _bpm      = bpm || 120;
  const barSec    = (60 / _bpm) * 4;                   // seconds per bar
  const barsTotal = Math.max(1, tweP.barsTotal || 4);
  const DURATION  = barsTotal * barSec;                // total canvas window in seconds
  const NOTE_OFF  = 0.5;                               // note-off at 50% of window
  const cx = H / 2;
  const pts = W * 2;

  // Bar grid lines
  c.fillStyle = '#0a0a18'; c.fillRect(0, 0, W, H);
  for (let bar = 0; bar <= barsTotal; bar++) {
    const xBar = (bar / barsTotal) * W;
    const isBeat1 = (bar % 4 === 0);
    c.strokeStyle = isBeat1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
    c.lineWidth = isBeat1 ? 1 : 0.5;
    c.beginPath(); c.moveTo(xBar, 0); c.lineTo(xBar, H); c.stroke();
    if (bar > 0 && bar < barsTotal) {
      c.fillStyle = 'rgba(255,255,255,0.2)'; c.font = `${5 / dpr}px Courier New`;
      c.fillText(bar + 1, xBar + 2, 8);
    }
  }
  // Centre line
  c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(0, cx); c.lineTo(W, cx); c.stroke();

  // note-on / note-off markers
  const xOff = NOTE_OFF * W;
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
  c.setLineDash([3,3]);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, H); c.stroke();
  c.beginPath(); c.moveTo(xOff, 0); c.lineTo(xOff, H); c.stroke();
  c.setLineDash([]);

  // Labels
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.font = `${6 / dpr}px Courier New`;
  c.fillText('ON', 3, H - 3); c.fillText('OFF', xOff + 3, H - 3);
  c.fillText('1', 3, 8); // bar 1 label

  function waveY(t, shape, rate, customSamples) {
    if (shape === 'custom' && customSamples && customSamples.length) {
      const phase = ((t * rate % 1) + 1) % 1;
      const N = customSamples.length;
      const fi = phase * N;
      const i0 = Math.floor(fi) % N, i1 = (i0 + 1) % N, fr = fi - Math.floor(fi);
      return customSamples[i0] * (1 - fr) + customSamples[i1] * fr;
    }
    const p = t * rate * 2 * Math.PI;
    switch (shape) {
      case 'sawtooth': return (((t * rate) % 1) * 2 - 1);
      case 'square':   return Math.sin(p) >= 0 ? 1 : -1;
      case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(p));
      default:         return Math.sin(p);
    }
  }

  const ms = tweP.main || {};
  const allSlots = [ms, ms.strike||{}, ms.body||{}, ms.tail||{}, ...(tweP.aux||[])];
  const maxDepth = Math.max(...allSlots.map(s => (s ? (s.depth||0) : 0)), 1); // include disabled for stable scale

  function drawSlot(slotP, tStart, slotColor, baseAlpha, slotId) {
    if (!slotP || slotP.depth <= 0) return;
    const disabled = slotP._enabled === false;
    const isSel = slotId === selectedLane;
    const normDepth = slotP.depth / maxDepth;
    const alpha = disabled ? Math.min(baseAlpha * 0.25, 0.18) : (isSel ? Math.min(baseAlpha * 1.4, 1) : baseAlpha);
    c.save(); c.globalAlpha = alpha; c.strokeStyle = slotColor;
    c.shadowColor = slotColor; c.shadowBlur = isSel ? 10 : 4;
    c.lineWidth = isSel ? 2.5 : (disabled ? 1 : 1.5); c.lineJoin = 'round';
    if (isSel) { c.setLineDash([]); } else if (disabled) { c.setLineDash([3,3]); }
    c.beginPath();
    let started = false;
    for (let i = 0; i < pts; i++) {
      const t = (i / pts) * DURATION;
      if (t < tStart) continue;
      const tRel = t - tStart;
      const env = (slotP.decay||0) > 0 ? Math.exp(-tRel * 4 / Math.max(0.05, slotP.decay)) : 1;
      const y = waveY(tRel, slotP.shape, slotP.rate, slotP.customShape) * normDepth * env;
      const px = (t / DURATION) * W;
      const py = cx - y * (cx - 4);
      if (!started) { c.moveTo(px, py); started = true; } else { c.lineTo(px, py); }
    }
    c.stroke(); c.setLineDash([]); c.restore();
  }

  const mainColor   = '#ffffff';
  const strikeColor = '#ff8844';
  const bodyColor   = color;
  const tailColor   = '#44aaff';
  const auxColors   = ['#cc44ff','#ffcc00','#44ffcc','#ff4488'];

  // Draw non-selected lanes first (underneath), selected on top
  // startBar converts bar position → seconds using barSec
  const slots = [
    { sp: ms,            tS: 0,                                         col: mainColor,   a: isLive?0.4:0.6,  id: 'main'   },
    { sp: ms.strike||{}, tS: (ms.strike?.startBar||0) * barSec,         col: strikeColor, a: isLive?0.5:0.75, id: 'strike' },
    { sp: ms.body||{},   tS: (ms.body?.startBar||0)   * barSec,         col: bodyColor,   a: isLive?0.6:0.9,  id: 'body'   },
    { sp: ms.tail||{},   tS: NOTE_OFF * DURATION + (ms.tail?.startBar||0) * barSec, col: tailColor, a: isLive?0.5:0.75, id: 'tail' },
    ...(tweP.aux||[]).map((als,i)=>({ sp:als, tS:(als.startBar||0)*barSec, col:auxColors[i%auxColors.length], a:isLive?0.55:0.8, id:`aux.${i}` })),
  ];
  slots.filter(s=>s.id !== selectedLane).forEach(s=>drawSlot(s.sp, s.tS, s.col, s.a, s.id));
  const sel = slots.find(s=>s.id === selectedLane);
  if (sel) drawSlot(sel.sp, sel.tS, sel.col, sel.a, sel.id);

  // Live mode: playhead + dots
  if (isLive) {
    const elapsed = Math.min(elapsedSec, DURATION);
    const xPlay = (elapsed / DURATION) * W;
    c.save(); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.shadowColor = '#ffffff'; c.shadowBlur = 6;
    c.beginPath(); c.moveTo(xPlay, 0); c.lineTo(xPlay, H); c.stroke(); c.restore();

    slots.forEach(({ sp, tS, col, id }) => {
      if (!sp || sp.depth <= 0 || sp._enabled === false || elapsed < tS) return;
      const tRel = elapsed - tS;
      const env  = (sp.decay||0) > 0 ? Math.exp(-tRel * 4 / Math.max(0.05, sp.decay)) : 1;
      const y    = waveY(tRel, sp.shape, sp.rate, sp.customShape) * (sp.depth / maxDepth) * env;
      const py   = cx - y * (cx - 4);
      const isSel = id === selectedLane;
      c.save(); c.fillStyle=col; c.shadowColor=col; c.shadowBlur=isSel?14:8; c.globalAlpha=0.95;
      c.beginPath(); c.arc(xPlay, py, isSel?5:3.5, 0, Math.PI*2); c.fill(); c.restore();
    });
  }

  // Legend
  const legendItems = [
    ['M',mainColor,'main'],['S',strikeColor,'strike'],['B',bodyColor,'body'],['T',tailColor,'tail'],
    ...(tweP.aux||[]).map((_,i)=>[`A${i+1}`,auxColors[i%auxColors.length],`aux.${i}`])
  ];
  legendItems.forEach(([lbl, col, id], i) => {
    const isSel = id === selectedLane;
    const isOff = allSlots[i]?._enabled === false;
    c.fillStyle=col; c.font= isSel ? 'bold 7px Courier New' : '6px Courier New';
    c.globalAlpha = isOff ? 0.3 : (isSel ? 1.0 : 0.7);
    c.fillText(isSel ? `[${lbl}]` : lbl, W - (isSel?18:14), 8+i*12);
  });
}

// ─────────────────────────────────────────────────────────
//  TWE Preset Patterns (Shaperbox-style)
// ─────────────────────────────────────────────────────────
const WOBBLE_PRESETS = {
  'Basic': { main: {
    rate:2, depth:200, target:'cutoff', shape:'sine', bpmSync:true, syncDiv:4, triplet:false, dotted:false,
    strike: { rate:8,  depth:0,   decay:0.3, target:'noiseAmt', shape:'sine', bpmSync:true, syncDiv:8,  triplet:false, dotted:false },
    body:   { rate:4,  depth:400, decay:0,   target:'cutoff',   shape:'sine', bpmSync:true, syncDiv:4,  triplet:false, dotted:false },
    tail:   { rate:2,  depth:0,   decay:0.5, target:'pitch',    shape:'sine', bpmSync:true, syncDiv:2,  triplet:false, dotted:false },
  }},
  'Stutter': { main: {
    rate:4, depth:300, target:'cutoff', shape:'square', bpmSync:true, syncDiv:8, triplet:false, dotted:false,
    strike: { rate:16, depth:300, decay:0.15, target:'cutoff',    shape:'square', bpmSync:true, syncDiv:16, triplet:false, dotted:false },
    body:   { rate:8,  depth:500, decay:0,   target:'cutoff',    shape:'square', bpmSync:true, syncDiv:8,  triplet:false, dotted:false },
    tail:   { rate:4,  depth:150, decay:0.3, target:'resonance', shape:'square', bpmSync:true, syncDiv:4,  triplet:false, dotted:false },
  }},
  'Scratch': { main: {
    rate:8, depth:400, target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:16, triplet:false, dotted:false,
    strike: { rate:32, depth:200, decay:0.1, target:'pitch',  shape:'sawtooth', bpmSync:true, syncDiv:32, triplet:false, dotted:false },
    body:   { rate:16, depth:600, decay:0,   target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:16, triplet:false, dotted:false },
    tail:   { rate:8,  depth:100, decay:0.2, target:'pitch',  shape:'sawtooth', bpmSync:true, syncDiv:8,  triplet:false, dotted:false },
  }},
  'Tape': { main: {
    rate:1, depth:250, target:'cutoff', shape:'triangle', bpmSync:true, syncDiv:2, triplet:false, dotted:false,
    strike: { rate:4, depth:100, decay:0.4, target:'pitch',  shape:'sine',     bpmSync:true, syncDiv:4, triplet:false, dotted:false },
    body:   { rate:2, depth:300, decay:0,   target:'cutoff', shape:'triangle', bpmSync:true, syncDiv:2, triplet:false, dotted:false },
    tail:   { rate:1, depth:200, decay:0.8, target:'pitch',  shape:'sine',     bpmSync:true, syncDiv:1, triplet:false, dotted:false },
  }},
  'Pitch': { main: {
    rate:2, depth:200, target:'pitch', shape:'sine', bpmSync:true, syncDiv:4, triplet:false, dotted:false,
    strike: { rate:8, depth:250, decay:0.2, target:'pitch', shape:'triangle', bpmSync:true, syncDiv:8, triplet:false, dotted:false },
    body:   { rate:4, depth:200, decay:0,   target:'pitch', shape:'sine',     bpmSync:true, syncDiv:4, triplet:false, dotted:false },
    tail:   { rate:2, depth:300, decay:0.6, target:'pitch', shape:'sine',     bpmSync:true, syncDiv:2, triplet:false, dotted:false },
  }},
  'Reverse': { main: {
    rate:4, depth:300, target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:8, triplet:false, dotted:false,
    strike: { rate:16, depth:0,   decay:0.2, target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:16, triplet:false, dotted:false },
    body:   { rate:8,  depth:450, decay:0,   target:'cutoff', shape:'sawtooth', bpmSync:true, syncDiv:8,  triplet:false, dotted:false },
    tail:   { rate:4,  depth:250, decay:0.5, target:'cutoff', shape:'triangle', bpmSync:true, syncDiv:4,  triplet:false, dotted:false },
  }},
  'Triplet': { main: {
    rate:2, depth:200, target:'cutoff', shape:'sine', bpmSync:true, syncDiv:4, triplet:true, dotted:false,
    strike: { rate:8, depth:200, decay:0.25, target:'noiseAmt',  shape:'sine', bpmSync:true, syncDiv:8, triplet:true, dotted:false },
    body:   { rate:4, depth:350, decay:0,    target:'cutoff',    shape:'sine', bpmSync:true, syncDiv:4, triplet:true, dotted:false },
    tail:   { rate:2, depth:150, decay:0.4,  target:'resonance', shape:'sine', bpmSync:true, syncDiv:2, triplet:true, dotted:false },
  }},
  'Dotted': { main: {
    rate:2, depth:300, target:'cutoff', shape:'square', bpmSync:true, syncDiv:4, triplet:false, dotted:true,
    strike: { rate:8, depth:180, decay:0.3, target:'cutoff', shape:'square', bpmSync:true, syncDiv:8, triplet:false, dotted:true },
    body:   { rate:4, depth:400, decay:0,   target:'cutoff', shape:'square', bpmSync:true, syncDiv:4, triplet:false, dotted:true },
    tail:   { rate:2, depth:120, decay:0.5, target:'pan',    shape:'square', bpmSync:true, syncDiv:2, triplet:false, dotted:true },
  }},
};

function randomizeWobble() {
  const targets = ['cutoff','resonance','pitch','noiseAmt','pan','volume'];
  const shapes = ['sine','sawtooth','square','triangle'];
  const divs = [1,2,4,8,16,32];
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randFloat = (min, max) => Math.random() * (max - min) + min;
  const lane = (rMin, rMax, dMin, dMax, hasDecay) => ({
    rate: randFloat(rMin, rMax), depth: randInt(dMin, dMax), decay: hasDecay ? randFloat(0.1, 0.8) : 0,
    target: rand(targets), shape: rand(shapes),
    bpmSync: Math.random() > 0.3, syncDiv: rand(divs), triplet: false, dotted: false,
    _enabled: true
  });
  return { main: Object.assign(lane(1, 8, 100, 500, false), {
    strike: lane(4, 20, 0, 400, true),
    body:   lane(2, 12, 200, 700, false),
    tail:   lane(1, 8, 0, 350, true),
  }) };
}

function aiGenerateWobble() {
  // AI-inspired: weighted archetypes (bass wobble, dubstep, glitch, ambient)
  const archetypes = [
    { name: 'bass', weight: 0.4 },
    { name: 'dubstep', weight: 0.3 },
    { name: 'glitch', weight: 0.2 },
    { name: 'ambient', weight: 0.1 }
  ];
  const r = Math.random();
  let acc = 0, archetype = 'bass';
  for (const a of archetypes) {
    acc += a.weight;
    if (r <= acc) { archetype = a.name; break; }
  }

  const targets = ['cutoff','resonance','pitch','noiseAmt','pan','volume'];
  const shapes = ['sine','sawtooth','square','triangle'];
  const divs = [1,2,4,8,16,32];
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randFloat = (min, max) => Math.random() * (max - min) + min;

  if (archetype === 'bass') {
    return { main: {
      rate:2, depth:randInt(300,500), target:'cutoff', shape:rand(['sine','triangle']), bpmSync:true, syncDiv:4, triplet:false, dotted:false, _enabled:true,
      strike: { rate:8,  depth:randInt(100,250), decay:0.2, target:'noiseAmt',  shape:'sine',               bpmSync:true, syncDiv:8,  triplet:false, dotted:false, _enabled:true },
      body:   { rate:4,  depth:randInt(400,600), decay:0,   target:'cutoff',    shape:rand(['sine','triangle']), bpmSync:true, syncDiv:4,  triplet:false, dotted:false, _enabled:true },
      tail:   { rate:2,  depth:randInt(50,150),  decay:0.5, target:'resonance', shape:'sine',               bpmSync:true, syncDiv:2,  triplet:false, dotted:false, _enabled:true },
    }};
  } else if (archetype === 'dubstep') {
    return { main: {
      rate:4, depth:randInt(600,900), target:'cutoff', shape:rand(['square','sawtooth']), bpmSync:true, syncDiv:8, triplet:false, dotted:false, _enabled:true,
      strike: { rate:16, depth:randInt(200,400), decay:0.15, target:'cutoff',    shape:'square',                     bpmSync:true, syncDiv:16, triplet:false,             dotted:false, _enabled:true },
      body:   { rate:8,  depth:randInt(500,800), decay:0,    target:'cutoff',    shape:rand(['square','sawtooth']),   bpmSync:true, syncDiv:8,  triplet:Math.random()>0.7, dotted:false, _enabled:true },
      tail:   { rate:4,  depth:randInt(100,250), decay:0.3,  target:'resonance', shape:'square',                     bpmSync:true, syncDiv:4,  triplet:false,             dotted:false, _enabled:true },
    }};
  } else if (archetype === 'glitch') {
    return { main: {
      rate:8, depth:randInt(400,700), target:rand(['cutoff','pitch']), shape:rand(shapes), bpmSync:true, syncDiv:16, triplet:false, dotted:false, _enabled:true,
      strike: { rate:32, depth:randInt(150,300), decay:0.1, target:rand(['pitch','noiseAmt']), shape:rand(shapes), bpmSync:true, syncDiv:32, triplet:false, dotted:false, _enabled:true },
      body:   { rate:16, depth:randInt(300,600), decay:0,   target:rand(['cutoff','pitch']),   shape:rand(shapes), bpmSync:true, syncDiv:16, triplet:false, dotted:false, _enabled:true },
      tail:   { rate:8,  depth:randInt(80,200),  decay:0.2, target:rand(['pan','pitch']),      shape:rand(shapes), bpmSync:true, syncDiv:8,  triplet:false, dotted:false, _enabled:true },
    }};
  } else { // ambient
    return { main: {
      rate:1, depth:randInt(200,400), target:'cutoff', shape:rand(['sine','triangle']), bpmSync:true, syncDiv:2, triplet:false, dotted:false, _enabled:true,
      strike: { rate:2, depth:randInt(50,150),  decay:0.6, target:'cutoff',    shape:'sine',     bpmSync:true, syncDiv:2, triplet:false, dotted:false, _enabled:true },
      body:   { rate:1, depth:randInt(200,400), decay:0,   target:'cutoff',    shape:'triangle', bpmSync:true, syncDiv:1, triplet:false, dotted:false, _enabled:true },
      tail:   { rate:1, depth:randInt(100,250), decay:1.0, target:'resonance', shape:'sine',     bpmSync:true, syncDiv:1, triplet:false, dotted:false, _enabled:true },
    }};
  }
}

// ─────────────────────────────────────────────────────────
//  TWE Pattern Library
// ─────────────────────────────────────────────────────────
const WOBBLE_PAT_KEY = 'wobbler-wobble-patterns';

