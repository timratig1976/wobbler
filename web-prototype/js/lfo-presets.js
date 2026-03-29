// ─────────────────────────────────────────────────────────
//  lfo-presets.js — Breakpoint Curve Library (60+ presets)
//  Format: { x: 0..1, y: 0..1, hard: bool, tension: -1..1 }
//  tension: 0=linear, 1=ease-out (convex), -1=ease-in (concave)
//  hard: true = immediate jump, no interpolation to next point
// ─────────────────────────────────────────────────────────

const mk = (x, y, hard = false, tension = 0) => ({ x, y, hard, tension });

const LFO_PRESET_LIBRARY = {

  // ── CLASSIC WAVEFORMS ────────────────────────────────────
  sine:       [mk(0,.5), mk(.25,1), mk(.5,.5), mk(.75,0), mk(1,.5)],
  sawup:      [mk(0,0,true), mk(.99,1,true), mk(1,0,true)],
  sawdn:      [mk(0,1,true), mk(.99,0,true), mk(1,1,true)],
  square:     [mk(0,1,true), mk(.5,1,true), mk(.5,0,true), mk(1,0,true)],
  triangle:   [mk(0,0), mk(.5,1), mk(1,0)],
  pulse25:    [mk(0,1,true), mk(.25,1,true), mk(.25,0,true), mk(1,0,true)],
  pulse75:    [mk(0,1,true), mk(.75,1,true), mk(.75,0,true), mk(1,0,true)],

  // ── DnB WOBBLE CLASSICS ──────────────────────────────────
  dnbsaw:     [mk(0,0,true), mk(.02,1,false,1), mk(.48,.05,false,1),
               mk(.5,0,true), mk(.52,1,false,1), mk(.98,.05,false,1), mk(1,0,true)],
  wubwub:     [mk(0,0,true), mk(.02,1,false,1), mk(.5,0,true),
               mk(.52,1,false,1), mk(1,.1,false,1)],
  triplet:    [mk(0,0), mk(.17,1,false,-1), mk(.33,0),
               mk(.5,1,false,-1), mk(.67,0), mk(.83,1,false,-1), mk(1,0)],
  acid:       [mk(0,0,true), mk(.01,1,false,1), mk(.3,.4,false,1),
               mk(.7,.1,false,1), mk(1,0)],
  fastsaw:    [mk(0,0,true), mk(.49,1,true), mk(.5,0,true), mk(.99,1,true), mk(1,0,true)],
  rubber:     [mk(0,1,false,1), mk(.1,0,false,-1), mk(.6,.7,false,1), mk(1,1)],
  dnbpump:    [mk(0,0,true), mk(.01,1,true), mk(.24,0,true), mk(.25,0,true),
               mk(.26,1,true), mk(.49,0,true), mk(.5,0,true), mk(.51,1,true),
               mk(.74,0,true), mk(.75,0,true), mk(.76,1,true), mk(.99,0,true), mk(1,0,true)],
  halfstep:   [mk(0,0,true), mk(.01,1,false,1), mk(.48,.05,false,1),
               mk(.5,0,true), mk(1,0,true)],
  quartersaw: [mk(0,0,true), mk(.01,1,false,1), mk(.24,.05,false,1),
               mk(.25,0,true), mk(.26,1,false,1), mk(.49,.05,false,1),
               mk(.5,0,true), mk(.51,1,false,1), mk(.74,.05,false,1),
               mk(.75,0,true), mk(.76,1,false,1), mk(.99,.05,false,1), mk(1,0,true)],

  // ── NEURO ────────────────────────────────────────────────
  neurozap:   [mk(0,0,true), mk(.01,1,true), mk(.04,.7,true), mk(.1,.2,true),
               mk(.15,.6,true), mk(.22,.1,true), mk(.5,0,true), mk(.51,1,true),
               mk(.55,.5,true), mk(.65,.1,true), mk(1,0,true)],
  neuroglitch:[mk(0,.8,true), mk(.07,.1,true), mk(.14,.95,true), mk(.2,.3,true),
               mk(.28,1,true), mk(.35,.15,true), mk(.42,.7,true), mk(.5,.05,true),
               mk(.57,.85,true), mk(.65,.2,true), mk(.72,.6,true), mk(.85,.1,true), mk(1,.4,true)],
  neuro:      [mk(0,.8,true), mk(.1,.1,true), mk(.2,.9,true), mk(.35,.2,true),
               mk(.5,1,true), mk(.65,.1,true), mk(.8,.7,true), mk(1,.3,true)],
  neurostep:  [mk(0,1,true), mk(.08,1,true), mk(.08,0,true), mk(.16,0,true),
               mk(.16,.7,true), mk(.24,.7,true), mk(.24,.3,true), mk(.33,.3,true),
               mk(.33,1,true), mk(.41,1,true), mk(.41,0,true), mk(.5,0,true),
               mk(.5,.5,true), mk(.58,.5,true), mk(.58,.9,true), mk(.67,.9,true),
               mk(.67,.1,true), mk(.75,.1,true), mk(.75,.6,true), mk(.83,.6,true),
               mk(.83,0,true), mk(.91,0,true), mk(.91,.8,true), mk(1,.8,true)],

  // ── LIQUID / ORGANIC ────────────────────────────────────
  liquid:     [mk(0,.3), mk(.25,.8,false,-1), mk(.5,1,false,1), mk(.75,.6,false,1), mk(1,.3)],
  breathe:    [mk(0,.1,false,-1), mk(.4,.05,false,-1), mk(.7,1,false,1),
               mk(.9,.85,false,1), mk(1,.1,false,1)],
  flow:       [mk(0,.5), mk(.35,1,false,1), mk(.55,.6,false,1),
               mk(.7,.3,false,-1), mk(1,.5)],
  halftime:   [mk(0,.1,false,-1), mk(.35,.05,false,-1), mk(.65,1,false,1),
               mk(.88,.75,false,1), mk(1,.1,false,1)],
  swell:      [mk(0,0,false,-1), mk(.6,.1,false,-1), mk(.8,.7,false,1), mk(1,1,false,1)],
  ebb:        [mk(0,1,false,1), mk(.3,.8,false,1), mk(.6,.3,false,-1), mk(1,0,false,-1)],

  // ── STEPS / SEQUENCER ───────────────────────────────────
  stair4:     [mk(0,.1,true), mk(.25,.1,true), mk(.25,.45,true), mk(.5,.45,true),
               mk(.5,.75,true), mk(.75,.75,true), mk(.75,1,true), mk(1,1,true)],
  stair4dn:   [mk(0,1,true), mk(.25,1,true), mk(.25,.7,true), mk(.5,.7,true),
               mk(.5,.35,true), mk(.75,.35,true), mk(.75,.05,true), mk(1,.05,true)],
  stairirr:   [mk(0,.8,true), mk(.12,.8,true), mk(.12,.2,true), mk(.25,.2,true),
               mk(.25,1,true), mk(.4,1,true), mk(.4,.45,true), mk(.6,.45,true),
               mk(.6,.9,true), mk(.75,.9,true), mk(.75,.1,true), mk(1,.1,true)],
  step4:      [mk(0,1,true), mk(.25,1,true), mk(.25,.3,true), mk(.5,.3,true),
               mk(.5,.8,true), mk(.75,.8,true), mk(.75,.1,true), mk(1,.1,true)],
  step8:      [mk(0,.8,true), mk(.125,.8,true), mk(.125,.2,true), mk(.25,.2,true),
               mk(.25,1,true), mk(.375,1,true), mk(.375,.4,true), mk(.5,.4,true),
               mk(.5,.9,true), mk(.625,.9,true), mk(.625,.1,true), mk(.75,.1,true),
               mk(.75,.6,true), mk(.875,.6,true), mk(.875,.3,true), mk(1,.3,true)],
  random4:    [mk(0,.7,true), mk(.25,.7,true), mk(.25,.2,true), mk(.5,.2,true),
               mk(.5,.9,true), mk(.75,.9,true), mk(.75,.4,true), mk(1,.4,true)],

  // ── FILTER SHAPES ───────────────────────────────────────
  pluck:      [mk(0,0,true), mk(.02,1,false,1), mk(.25,.3,false,1), mk(.6,.05), mk(1,0)],
  gate:       [mk(0,1,true), mk(.5,1,true), mk(.5,0,true), mk(.75,0,true), mk(.75,1,true), mk(1,1,true)],
  sidechain:  [mk(0,0,true), mk(0,0,false,-1), mk(.35,.7,false,-1), mk(.7,.95,false,-1), mk(1,1)],
  wah:        [mk(0,.1), mk(.3,.9,false,-1), mk(.6,.2,false,1), mk(1,.1)],
  vowel:      [mk(0,.2), mk(.2,.8,false,1), mk(.4,.3,false,-1), mk(.6,.7,false,1),
               mk(.8,.25,false,-1), mk(1,.2)],
  talkbox:    [mk(0,.3,true), mk(.1,.3,true), mk(.1,.8,true), mk(.2,.8,true),
               mk(.2,.4,true), mk(.3,.4,true), mk(.3,.9,true), mk(.45,.9,true),
               mk(.45,.2,true), mk(.6,.2,true), mk(.6,.7,true), mk(.75,.7,true),
               mk(.75,.35,true), mk(1,.35,true)],
  gate75:     [mk(0,1,true), mk(.75,1,true), mk(.75,0,true), mk(1,0,true)],
  gate50:     [mk(0,1,true), mk(.5,1,true), mk(.5,0,true), mk(1,0,true)],
  gate25:     [mk(0,1,true), mk(.25,1,true), mk(.25,0,true), mk(1,0,true)],

  // ── MISC / FX ───────────────────────────────────────────
  bounce:     [mk(0,1,false,1), mk(.15,0,false,-1), mk(.35,.55,false,1),
               mk(.5,0,false,-1), mk(.65,.28,false,1), mk(.78,0,false,-1), mk(1,0)],
  expup:      [mk(0,0,false,-1), mk(.5,.05,false,-1), mk(.8,.4,false,-1), mk(1,1,false,-1)],
  expdown:    [mk(0,1,false,1), mk(.2,.6,false,1), mk(.5,.2,false,1), mk(.8,.04,false,1), mk(1,0)],
  shark:      [mk(0,0,true), mk(.01,1,true), mk(.25,.6,false,1), mk(.6,.15,false,1), mk(1,0,false,1)],
  pingpong:   [mk(0,1,false,1), mk(.25,0,false,-1), mk(.5,1,false,1), mk(.75,0,false,-1), mk(1,1)],
  chaos1:     [mk(0,.5,true), mk(.07,.9,true), mk(.13,.2,true), mk(.2,.7,true),
               mk(.28,.1,true), mk(.35,.8,true), mk(.42,.3,true), mk(.5,.6,true),
               mk(.57,.15,true), mk(.65,.75,true), mk(.72,.4,true), mk(.8,.85,true),
               mk(.87,.25,true), mk(.94,.65,true), mk(1,.45,true)],
  rampdown2:  [mk(0,1,false,1), mk(.5,0,false,1), mk(.5,1,true), mk(1,0,false,1)],
  sinepulse:  [mk(0,.5), mk(.12,1), mk(.25,.5), mk(.37,0), mk(.5,.5),
               mk(.5,1,true), mk(.625,1,true), mk(.625,0,true), mk(.75,0,true), mk(.75,.5,true), mk(1,.5)],
};

function loadLFOPreset(slotIdx, presetName, lfoEngine) {
  const pts = LFO_PRESET_LIBRARY[presetName];
  if (!pts) return false;
  lfoEngine.setSlotBreakpoints(slotIdx, pts);
  return true;
}

// List all preset names (for UI dropdowns)
const LFO_PRESET_NAMES = Object.keys(LFO_PRESET_LIBRARY);
