function buildVoicePanel(col, voice, color, bpmGet) {
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

  function sec(title) {
    const d=document.createElement('div'); d.className='v-sec';
    d.innerHTML=`<div class="sec-hdr">${title}</div>`; col.appendChild(d); return d;
  }
  function kRow(parent) { const d=document.createElement('div'); d.className='knob-row'; parent.appendChild(d); return d; }
  function bRow(parent) { const d=document.createElement('div'); d.className='btn-row'; parent.appendChild(d); return d; }

  // OSC — filter-style layout: left (buttons + knobs), right (wave preview + noise)
  const oscS = sec('OSC');
  const oscCols = document.createElement('div'); oscCols.className = 'osc-cols';
  oscS.appendChild(oscCols);

  // LEFT: wave type buttons (top) + knob row (below)
  const oscLeft = document.createElement('div'); oscLeft.className = 'osc-left';
  oscCols.appendChild(oscLeft);

  const WAVE_ABBR = {sine:'SIN', sawtooth:'SAW', square:'SQR', triangle:'TRI', pulse:'PUL', supersaw:'S-SW'};
  const waveBtnRow = document.createElement('div'); waveBtnRow.className = 'btn-row';
  oscLeft.appendChild(waveBtnRow);
  const allWaveBtns = [];
  WAVE_TYPES.forEach((w) => {
    const b = document.createElement('button');
    b.className = 'wave-btn' + (p.osc.waveform === w ? ' active' : '');
    b.textContent = WAVE_ABBR[w]; b.dataset.waveform = w;
    waveBtnRow.appendChild(b); allWaveBtns.push(b);
  });

  const mainKnobRow = document.createElement('div'); mainKnobRow.className = 'knob-row';
  oscLeft.appendChild(mainKnobRow);
  makeKnob({ parent: mainKnobRow, min: -24,  max: 24,  value: p.osc.pitch,  label: 'PITCH', unit: 'st', decimals: 0, step: 1, color, onChange: v => voice.set('osc','pitch',v) });
  makeKnob({ parent: mainKnobRow, min: -100, max: 100, value: p.osc.cent,   label: 'CENT',  unit: '¢',  decimals: 0, step: 1, color, onChange: v => voice.set('osc','cent',v) });
  makeKnob({ parent: mainKnobRow, min: 0,    max: 1,   value: p.osc.volume, label: 'VOL',              decimals: 2,           color, onChange: v => voice.set('osc','volume',v) });
  const pwWrap  = document.createElement('div'); pwWrap.style.display  = 'none'; mainKnobRow.appendChild(pwWrap);
  const spdWrap = document.createElement('div'); spdWrap.style.display = 'none'; mainKnobRow.appendChild(spdWrap);
  makeKnob({ parent: pwWrap,  min: 0.1, max: 0.9, value: p.osc.pw,     label: 'PW',    decimals: 2, color, onChange: v => voice.set('osc','pw',v) });
  makeKnob({ parent: spdWrap, min: 0,   max: 1,   value: p.osc.spread, label: 'SPREAD',decimals: 2, color, onChange: v => voice.set('osc','spread',v) });
  const uniWrap = document.createElement('div'); uniWrap.style.display = 'flex'; uniWrap.style.gap = '0'; mainKnobRow.appendChild(uniWrap);
  makeKnob({ parent: uniWrap, min: 1, max: 8, value: p.osc.unison ?? 1, label: 'UNI', decimals: 0, step: 1, color,
    onChange: v => { voice.set('osc','unison', Math.round(v)); mainKnobRow.dispatchEvent(new Event('_uniChanged')); } });
  const uniDetWrap = document.createElement('div'); uniDetWrap.style.display = 'none'; uniWrap.appendChild(uniDetWrap);
  makeKnob({ parent: uniDetWrap, min: 0, max: 100, value: p.osc.unisonDetune ?? 20, label: 'DETUNE', unit: '¢', decimals: 0, step: 1, color,
    onChange: v => voice.set('osc','unisonDetune', v) });
  makeKnob({ parent: uniDetWrap, min: 0, max: 1, value: p.osc.unisonBlend ?? 1, label: 'BLEND', decimals: 2, color,
    onChange: v => voice.set('osc','unisonBlend', v) });

  // RIGHT: waveform preview (top half) + noise (bottom half)
  const oscRight = document.createElement('div'); oscRight.className = 'osc-right';
  oscCols.appendChild(oscRight);

  const waveCanvas = createWaveformCanvas({ color, waveform: p.osc.waveform, analyser: voice.analyser });
  oscRight.appendChild(waveCanvas.element);

  const noisePanel = createNoisePanel({ voice, color });
  oscRight.appendChild(noisePanel.element);

  function updateCtxKnobs(waveform) {
    pwWrap.style.display   = waveform === 'pulse'    ? '' : 'none';
    spdWrap.style.display  = waveform === 'supersaw' ? '' : 'none';
    uniWrap.style.display  = waveform === 'supersaw' ? 'none' : 'flex';
    uniDetWrap.style.display = (waveform !== 'supersaw' && (p.osc.unison ?? 1) > 1) ? '' : 'none';
  }
  updateCtxKnobs(p.osc.waveform);
  mainKnobRow.addEventListener('_uniChanged', () => { uniDetWrap.style.display = (p.osc.unison ?? 1) > 1 ? '' : 'none'; });
  allWaveBtns.forEach(b => b.addEventListener('click', () => {
    const w = b.dataset.waveform;
    allWaveBtns.forEach(x => x.classList.remove('active')); b.classList.add('active');
    voice.set('osc','waveform',w); waveCanvas.redraw(w); updateCtxKnobs(w);
  }));

  // Filter — 2-column layout
  const fS = sec('FILTER');
  const fCols = document.createElement('div'); fCols.className = 'filter-cols';
  fS.appendChild(fCols);

  // LEFT: type buttons + CUT/RES/ENV/DRIVE/MIX knobs
  const fLeft = document.createElement('div'); fLeft.className = 'filter-left';
  fCols.appendChild(fLeft);

  createButtonGroup({
    parent: fLeft,
    options: FILTER_TYPES.map((ft, idx) => ({ value: ft, label: FILTER_LABELS[idx] })),
    activeValue: p.filter.type,
    className: 'ftype-btn',
    onChange: ft => { voice.set('filter', 'type', ft); requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount)); }
  });

  const filterKnobRow = createKnobRow({
    parent: fLeft, color,
    knobs: [
      { min: 20,    max: 18000, value: p.filter.cutoff,    label: 'CUT',   decimals: 0, onChange: v => { voice.set('filter','cutoff',v);    requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount)); } },
      { min: 0,     max: 30,   value: p.filter.resonance, label: 'RES',   decimals: 1, onChange: v => { voice.set('filter','resonance',v); requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount)); } },
      { min: 0,     max: 12000,value: p.filter.envAmount, label: 'ENV',   decimals: 0, onChange: v => { voice.set('filter','envAmount',v); requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount)); } },
      { min: 0,     max: 1,    value: p.filter.mix,       label: 'MIX',   decimals: 2, onChange: v => voice.set('filter','mix',v) },
      { min: -1,    max: 1,    value: p.pan,              label: 'PAN',   decimals: 2, onChange: v => voice.set('filter','pan',v) }
    ]
  });
  const cutKnob = filterKnobRow.knobs[0];

  // RIGHT: live filter curve canvas
  const fRight = document.createElement('div'); fRight.className = 'filter-right';
  fCols.appendChild(fRight);

  const curveCvs = document.createElement('canvas'); curveCvs.className = 'filter-curve';
  fRight.appendChild(curveCvs);

  const freqLbls = document.createElement('div'); freqLbls.className = 'filter-curve-labels';
  freqLbls.innerHTML = '<span>20</span><span>1k</span><span>20k</span>';
  fRight.appendChild(freqLbls);

  // Ensure filter node matches p params before drawing (getFrequencyResponse needs .value in sync)
  voice.filter.type = p.filter.type;
  voice.filter.frequency.value = p.filter.cutoff;
  voice.filter.Q.value = p.filter.resonance;
  requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount));

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
      const changed = mc === null
        ? _lastModCutoff !== null
        : (_lastModCutoff === null || Math.abs(mc - _lastModCutoff) > 5);
      if (changed) {
        _lastModCutoff = mc;
        drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount, mc);
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
  // Intercept _playing writes to start/stop animation loop
  voice.__playing = voice._playing || false;
  Object.defineProperty(voice, '_playing', {
    get() { return this.__playing; },
    set(v) {
      this.__playing = v;
      if (v && !_modRafId) _modRafId = requestAnimationFrame(modAnimLoop);
      if (!v) {
        setTimeout(() => {
          if (!voice._playing) {
            if (_modRafId) { cancelAnimationFrame(_modRafId); _modRafId = null; }
            _lastModCutoff = null; _lastModNoise = null;
            cutKnob.clearModValue();
            voice._noiseKnob?.clearModValue();
            requestAnimationFrame(() => drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount));
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
  const tweS = sec('WOBBLE ENGINE'); tweS.classList.add('twe-sec');

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

  // LFO bank (using modular components)
  const lS = sec('LFOs'); lS.classList.add('lfo-sec');
  for (let i = 0; i < 5; i++) {
    createLFOPanel({
      parent: lS,
      lfoIndex: i,
      lfoParams: p.lfos[i],
      color,
      voice,
      bpmGet
    });
  }

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
  col.appendChild(seqS);

  // ── EQ ────────────────────────────────────────────────────
  const eqS = sec('EQ');
  buildEQSection(eqS, p.eq, voice, color);

  // ── FX (Reverb + Delay) ───────────────────────────────────
  const fxS = sec('FX');
  buildFXSection(fxS, p.fx, voice, color);
}

// ─────────────────────────────────────────────────────────
//  Sequencer UI (builds individual sequencer in each voice column)
// ─────────────────────────────────────────────────────────
