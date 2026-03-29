// ─────────────────────────────────────────────────────────
//  osc-engine.js — OSC1 + OSC2 + Sub + TZFM
//  Ported from Voice Module reference implementation
// ─────────────────────────────────────────────────────────

const OSC_DETUNE_SPREAD_MAX = 100; // cents

// ─── buildOscChain ────────────────────────────────────────────
// Baut OSC1 + OSC2 + Sub und verbindet sie zu targetGain.
// Gibt zurück: { oscs, subOscNode, osc1Envs, osc2Envs, subEnv }
//
// WICHTIG: targetGain = WobblerVoice._distPre (Eingang der Dist-Chain)
//
function buildOscChain(ctx, freq, t, targetGain, params) {
  // params = {
  //   osc1: { wave, oct, semi, det, cents, vol, voices, spread, width,
  //           ampA, ampD, ampS, ampR, modTarget, modDepth, lfoPitch,
  //           customWave },  // PeriodicWave oder null
  //   osc2: { wave, oct, semi, det, cents, vol, voices, spread, width,
  //           ampA, ampD, ampS, ampR, modTarget, modDepth, lfoPitch,
  //           customWave },
  //   sub:  { wave, oct, cents, vol, ampA, ampD, ampS, ampR, lfoPitch },
  //   noise: { vol, type, thruFilter },
  //   osc1Active, osc2Active, subActive,
  //   lfoGain_pitch,  // AudioNode oder null — für pitch LFO connects
  //   osc1LfoPitch,   // bool
  //   osc2LfoPitch,   // bool
  //   subLfoPitch,    // bool
  // }

  const oscs = [];
  const osc1Envs = [];
  const osc2Envs = [];
  let osc2nodes_ref = null;

  // Helper: volGain → envGain → [StereoPanner] → targetGain
  const makeVoiceChain = (voiceIdx, numVoices, volValue, width) => {
    const volGain = ctx.createGain();
    volGain.gain.value = volValue;
    const envGain = ctx.createGain();
    envGain.gain.value = 1;
    volGain.connect(envGain);
    if (numVoices > 1 && width > 0) {
      const panPos = ((voiceIdx / (numVoices - 1)) - 0.5) * 2 * width;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) {
        p.pan.value = Math.max(-1, Math.min(1, panPos));
        envGain.connect(p);
        p.connect(targetGain);
      } else {
        envGain.connect(targetGain);
      }
    } else {
      envGain.connect(targetGain);
    }
    return { volGain, envGain };
  };

  // ── OSC 1 ──────────────────────────────────────────────────
  const p1 = params.osc1;
  const numV1 = params.osc1Active !== false ? Math.max(1, p1.voices || 1) : 0;
  const width1 = (p1.width || 80) / 100;
  const osc1nodes = [];

  for (let v = 0; v < numV1; v++) {
    const spreadCt = numV1 === 1 ? 0
      : ((v / (numV1 - 1)) - 0.5) * (p1.spread || 0);
    const o = ctx.createOscillator();
    if (p1.customWave) o.setPeriodicWave(p1.customWave);
    else o.type = p1.wave || 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = (p1.oct || 0) * 1200 + (p1.semi || 0) * 100
                   + (p1.det || 0) + (p1.cents || 0) + spreadCt;
    const { volGain, envGain } = makeVoiceChain(
      v, numV1, (p1.vol || 1) / Math.sqrt(numV1), width1
    );
    o.connect(volGain);
    if (params.lfoGain_pitch && params.osc1LfoPitch)
      params.lfoGain_pitch.connect(o.frequency);
    o.start(t);
    oscs.push(o);
    osc1nodes.push({ osc: o, gain: volGain, envGain });
    osc1Envs.push(envGain);
  }

  // ── OSC 2 ──────────────────────────────────────────────────
  let osc2mainNode = null, osc2mainGain = null;
  const osc2nodes = [];

  if (params.osc2Active && p1 && params.osc2 &&
      params.osc2.wave && params.osc2.wave !== 'off') {
    const p2 = params.osc2;
    const numV2 = Math.max(1, p2.voices || 1);
    const width2 = (p2.width || 80) / 100;
    osc2nodes_ref = osc2nodes;

    for (let v = 0; v < numV2; v++) {
      const spreadCt = numV2 === 1 ? 0
        : ((v / (numV2 - 1)) - 0.5) * (p2.spread || 0);
      const o2 = ctx.createOscillator();
      if (p2.customWave) o2.setPeriodicWave(p2.customWave);
      else o2.type = p2.wave || 'sine';
      o2.frequency.value = freq;
      o2.detune.value = (p2.oct || 0) * 1200 + (p2.semi || 0) * 100
                      + (p2.det || 0) + (p2.cents || 0) + spreadCt;
      const { volGain: g2, envGain: eg2 } = makeVoiceChain(
        v, numV2, (p2.vol || 0.5) / Math.sqrt(numV2), width2
      );
      o2.connect(g2);
      if (params.lfoGain_pitch && params.osc2LfoPitch)
        params.lfoGain_pitch.connect(o2.frequency);
      o2.start(t);
      oscs.push(o2);
      osc2nodes.push({ osc: o2, gain: g2, envGain: eg2, voiceIdx: v });
      osc2Envs.push(eg2);
      if (v === 0) { osc2mainNode = o2; osc2mainGain = g2; }
    }

    // TZFM Modulation
    const tzDepth = params.osc2.modDepth || 0;
    const modTarget = params.osc1?.modTarget || 'none';
    if (modTarget !== 'none' && osc1nodes.length && tzDepth > 0 && osc2mainNode) {
      const tzGain = ctx.createGain();
      tzGain.gain.value = tzDepth * freq; // pitch-invariant TZFM

      if (modTarget === 'osc2tzfm') {
        osc1nodes.forEach(({ osc }) => osc.connect(tzGain));
        tzGain.connect(osc2mainNode.frequency);
      } else if (modTarget === 'osc2am') {
        const dc = ctx.createConstantSource(); dc.offset.value = 1; dc.start();
        const amG = ctx.createGain(); amG.gain.value = tzDepth * 0.5;
        dc.connect(osc2mainGain.gain);
        osc1nodes.forEach(({ osc }) => { osc.connect(amG); amG.connect(osc2mainGain.gain); });
      }
    }

    const osc2ModTarget = params.osc2?.modTarget || 'none';
    if (osc2ModTarget === 'osc1tzfm' && (params.osc2?.modDepth || 0) > 0 && osc2mainNode) {
      const tzG2 = ctx.createGain();
      tzG2.gain.value = (params.osc2.modDepth || 0) * freq;
      osc2mainNode.connect(tzG2);
      osc1nodes.forEach(({ osc }) => tzG2.connect(osc.frequency));
    }
  }

  // ── SUB ──────────────────────────────────────────────────
  let subOscNode = null, subEnvGain = null;
  if (params.subActive && (params.sub?.vol || 0) > 0) {
    subOscNode = ctx.createOscillator();
    subOscNode.type = params.sub.wave || 'sine';
    subOscNode.frequency.value = freq;
    subOscNode.detune.value = (params.sub.oct ?? -2) * 1200 + (params.sub.cents || 0);
    const sg = ctx.createGain(); sg.gain.value = params.sub.vol || 0.6;
    subEnvGain = ctx.createGain(); subEnvGain.gain.value = 1;
    subOscNode.connect(sg); sg.connect(subEnvGain); subEnvGain.connect(targetGain);
    if (params.lfoGain_pitch && params.subLfoPitch)
      params.lfoGain_pitch.connect(subOscNode.frequency);
    subOscNode.start(t);
  }

  return { oscs, subOscNode, osc1Envs, osc2Envs, subEnv: subEnvGain };
}

// ─── applyOscEnvs ─────────────────────────────────────────────
// Formt die per-OSC envGain Nodes mit ADSR.
// Aufruf: direkt nach buildOscChain im noteOn.
function applyOscEnvs(t, osc1Envs, osc2Envs, subEnv, params) {
  const applyEnv = (envNode, A_ms, D_ms, S_lin) => {
    if (!envNode) return;
    const tA = Math.max(0.001, A_ms / 1000);
    const tD = Math.max(0.005, D_ms / 1000);
    envNode.gain.cancelScheduledValues(t);
    envNode.gain.setValueAtTime(0, t);
    envNode.gain.linearRampToValueAtTime(1, t + tA);
    envNode.gain.setTargetAtTime(Math.max(0, S_lin), t + tA, tD * 0.4);
  };
  if (osc1Envs?.length) osc1Envs.forEach(e =>
    applyEnv(e, params.osc1.ampA || 5, params.osc1.ampD || 150, params.osc1.ampS ?? 0.8));
  if (osc2Envs?.length) osc2Envs.forEach(e =>
    applyEnv(e, params.osc2.ampA || 5, params.osc2.ampD || 150, params.osc2.ampS ?? 0.8));
  if (subEnv)
    applyEnv(subEnv, params.sub.ampA || 2, params.sub.ampD || 80, params.sub.ampS ?? 0.9);
}

// ─── releaseOscEnvs ───────────────────────────────────────────
function releaseOscEnvs(t, osc1Envs, osc2Envs, subEnv, params) {
  const relEnv = (envNode, R_ms) => {
    if (!envNode) return;
    try {
      envNode.gain.cancelScheduledValues(t);
      envNode.gain.setTargetAtTime(0, t, Math.max(0.01, R_ms / 1000) * 0.4);
    } catch (e) {}
  };
  [...(osc1Envs || [])].forEach(e => relEnv(e, params.osc1.ampR || 100));
  [...(osc2Envs || [])].forEach(e => relEnv(e, params.osc2.ampR || 100));
  if (subEnv) relEnv(subEnv, params.sub.ampR || 60);
}

// ─── stopOscs ─────────────────────────────────────────────────
// Schedules all oscillators from buildOscChain to stop.
function stopOscs(oscs, subOscNode, stopTime) {
  const t = stopTime || 0;
  (oscs || []).forEach(o => { try { o.stop(t); } catch(_) {} });
  if (subOscNode) { try { subOscNode.stop(t); } catch(_) {} }
}
