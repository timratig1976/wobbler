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
  buildOscSection(oscS, { voice, p, oscMode, color });

  // ADSR — interactive canvas (above Filter)
  const aS = sec('ADSR');
  buildADSRSection(aS, p.adsr, voice, color);

  // Filter — knobs LEFT, curve RIGHT
  const fS = sec('FILTER');

  // ── Filter layout: top row = type btns | bottom row = knobs left + curve right ──

  // Row 1: filter type buttons + engine toggle (full width, compact)
  const fTypeRow = document.createElement('div');
  fTypeRow.style.cssText = 'display:flex;gap:3px;margin-bottom:5px;justify-content:flex-start;align-items:center';
  fS.appendChild(fTypeRow);
  const ftBtns = [];
  FILTER_TYPES.forEach((ft, idx) => {
    const b = document.createElement('button');
    b.className = 'ftype-btn' + (p.filter.type === ft ? ' active' : '');
    b.textContent = FILTER_LABELS[idx];
    b.style.cssText = `padding:3px 8px;font-size:10px;letter-spacing:1px;border-color:${p.filter.type===ft?color:'#2a2a44'};color:${p.filter.type===ft?color:'#555'}`;
    b.addEventListener('click', () => {
      ftBtns.forEach(x => { x.style.borderColor='#2a2a44'; x.style.color='#555'; });
      b.style.borderColor = color; b.style.color = color;
      voice.set('filter', 'type', ft);
      if (typeof redrawFilterCurve === 'function') redrawFilterCurve();
    });
    ftBtns.push(b); fTypeRow.appendChild(b);
  });

  // Engine toggle: BIQUAD ↔ ZDF
  const _engCurrent = () => p.filter.engine || 'biquad';
  const engBtn = document.createElement('button');
  engBtn.style.cssText = 'margin-left:auto;padding:3px 7px;font-size:9px;letter-spacing:1px;border:1px solid #2a2a44;background:transparent;color:#555;border-radius:3px;font-family:monospace;cursor:pointer;white-space:nowrap';
  const _updateEngBtn = () => {
    const isZdf = _engCurrent() === 'zdf';
    engBtn.textContent = isZdf ? 'ZDF' : 'BIQ';
    engBtn.style.borderColor = isZdf ? color : '#2a2a44';
    engBtn.style.color = isZdf ? color : '#555';
    engBtn.title = isZdf ? 'ZDF filter (character, wobble) — click for Biquad' : 'Biquad filter (clean, alias-free) — click for ZDF';
  };
  _updateEngBtn();
  engBtn.addEventListener('click', () => {
    const next = _engCurrent() === 'zdf' ? 'biquad' : 'zdf';
    if (next === 'zdf' && !window._zdfWorkletReady) {
      engBtn.textContent = 'WAIT…'; setTimeout(_updateEngBtn, 1000); return;
    }
    voice._switchFilterEngine(next);
    _updateEngBtn();
    if (typeof redrawFilterCurve === 'function') redrawFilterCurve();
  });
  fTypeRow.appendChild(engBtn);

  // Row 2: knobs (left, flex:1) + curve canvas (right, max 50%)
  const fInner = document.createElement('div');
  fInner.style.cssText = 'display:flex;gap:6px;align-items:stretch';
  fS.appendChild(fInner);

  // LEFT: horizontal knob row
  const fLeft = document.createElement('div');
  fLeft.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center';
  fInner.appendChild(fLeft);

  // Cutoff + Q readouts
  const cutReadout = document.createElement('div');
  cutReadout.style.cssText = `font-size:10px;color:${color};font-family:monospace;letter-spacing:1px`;
  cutReadout.textContent = p.filter.cutoff >= 1000 ? (p.filter.cutoff/1000).toFixed(1)+'k' : Math.round(p.filter.cutoff)+'Hz';
  const resReadout = document.createElement('div');
  resReadout.style.cssText = 'font-size:10px;color:#555;font-family:monospace;letter-spacing:1px';
  resReadout.textContent = 'Q'+p.filter.resonance.toFixed(1);
  const readoutBar = document.createElement('div');
  readoutBar.style.cssText = 'display:flex;gap:8px;padding:0 2px';
  readoutBar.append(cutReadout, resReadout);
  fLeft.appendChild(readoutBar);

  function updateFilterReadouts() {
    const hz = p.filter.cutoff;
    cutReadout.textContent = hz >= 1000 ? (hz/1000).toFixed(1)+'k' : Math.round(hz)+'Hz';
    resReadout.textContent = 'Q'+p.filter.resonance.toFixed(1);
  }

  // Single horizontal knob row
  const fKnobRow = document.createElement('div');
  fKnobRow.style.cssText = 'display:flex;gap:2px;align-items:flex-end';
  fLeft.appendChild(fKnobRow);

  const cutKnob = makeKnob({ parent:fKnobRow, min:20,    max:18000, value:p.filter.cutoff,    label:'CUT', decimals:0, log:true, size:46, color, onChange: v => { voice.set('filter','cutoff',v);    updateFilterReadouts(); redrawFilterCurve(); } });
  const resKnob = makeKnob({ parent:fKnobRow, min:0.01,  max:30,    value:p.filter.resonance, label:'RES', decimals:1, size:46, color, onChange: v => { voice.set('filter','resonance',v); updateFilterReadouts(); redrawFilterCurve(); } });
  makeKnob({ parent:fKnobRow, min:0,     max:12000, value:p.filter.envAmount, label:'ENV', decimals:0,          size:46, color, onChange: v => { voice.set('filter','envAmount',v); redrawFilterCurve(); } });
  makeKnob({ parent:fKnobRow, min:0,     max:1,     value:p.filter.mix,       label:'MIX', decimals:2,          size:46, color, onChange: v => voice.set('filter','mix',v) });

  // RIGHT: curve canvas — max 50% of section width
  const fRight = document.createElement('div');
  fRight.style.cssText = 'flex:0 0 50%;max-width:50%;display:flex;flex-direction:column;gap:0';
  fInner.appendChild(fRight);

  const curveCvs = document.createElement('canvas');
  curveCvs.style.cssText = 'display:block;width:100%;height:90px;background:#06060f;border-radius:4px 4px 0 0;border:1px solid #1a1a30;border-bottom:none;cursor:crosshair';
  fRight.appendChild(curveCvs);

  const freqLbls = document.createElement('div');
  freqLbls.style.cssText = 'display:flex;justify-content:space-between;background:#06060f;border:1px solid #1a1a30;border-top:none;border-radius:0 0 4px 4px;padding:1px 4px';
  freqLbls.innerHTML = '<span style="font-size:8px;color:#333">20</span><span style="font-size:8px;color:#333">1k</span><span style="font-size:8px;color:#333">20k</span>';
  fRight.appendChild(freqLbls);

  // Ensure filter node matches p params before drawing
  voice._filterSetType(p.filter.type);
  voice._filterSetCutoff(p.filter.cutoff, voice.ctx.currentTime);
  voice._filterSetResonance(p.filter.resonance, voice.ctx.currentTime);
  function redrawFilterCurve() {
    curveCvs.width = curveCvs.offsetWidth || curveCvs.parentElement?.offsetWidth || 200;
    drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount, null, voice.analyser, voice.preAnalyser, null, p.filter.cutoff, p.filter.resonance, p.filter.type);
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
    let mod = 0;
    p.lfos.forEach((lp, i) => {
      if (lp.target !== 'cutoff' || lp.depth <= 0) return;
      const node = voice.lfoNodes[i];
      if (!node || !node.connected) return;
      mod += waveY(lp.waveform, elapsed * lp.rate) * lp.depth;
    });
    return mod !== 0 ? Math.max(20, Math.min(20000, p.filter.cutoff + mod)) : null;
  }

  function estimateModNoiseAmt() {
    if (!voice._playing || !voice._noteOnTime) return null;
    const elapsed = voice.ctx.currentTime - voice._noteOnTime;
    let mod = 0;
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
  let _lastDrawKey = null; // tracks last drawn state to skip redundant redraws
  let _releaseUntil = 0;   // performance.now() timestamp until release tail is over
  function _isAudible() {
    return voice._playing || performance.now() < _releaseUntil;
  }
  function modAnimLoop(ts) {
    if (ts - _lastModDrawTime >= 50) { // ~20fps cap
      _lastModDrawTime = ts;
      const mc = estimateModCutoff();
      // Build lfoState from LFO engine slot targeting cutoff
      const _lfoSlot = voice.lfoEngine?.slots?.find(s => s.target === 'cutoff' && s.enabled && s.depth > 0);
      const _lfoActive = !!(_lfoSlot && _isAudible());
      const _lfoPhase = _lfoSlot ? (_lfoSlot.phase || 0) : 0;
      const _lfoState = _lfoSlot ? {
        active: _lfoActive,
        phase:  _lfoPhase,
        mult:   _lfoSlot.mult  || 1,
        points: _lfoSlot.points || [],
        depth:  Math.min(1, (_lfoSlot.depth || 0) / (p.filter.cutoff || 800))
      } : null;
      // Build a state key — skip redraw if nothing has changed
      const hasFFT = _isAudible();
      const drawKey = [
        p.filter.cutoff, p.filter.resonance, p.filter.type, p.filter.envAmount,
        mc, _lfoActive ? Math.round(_lfoPhase * 200) : 0, hasFFT ? ts : 0
      ].join('|');
      if (drawKey === _lastDrawKey) {
        _modRafId = requestAnimationFrame(modAnimLoop); return;
      }
      _lastDrawKey = drawKey;
      if (!curveCvs.width || curveCvs.width < 10) curveCvs.width = curveCvs.offsetWidth || curveCvs.parentElement?.offsetWidth || 260;
      drawFilterCurve(curveCvs, voice.filter, color, p.filter.envAmount, mc,
        hasFFT ? voice.analyser : null,
        hasFFT ? voice.preAnalyser : null,
        _lfoState, p.filter.cutoff, p.filter.resonance, p.filter.type);
      // Update modulation ring on CUT knob only when mod value changes
      const changed = mc === null
        ? _lastModCutoff !== null
        : (_lastModCutoff === null || Math.abs(mc - _lastModCutoff) > 5);
      if (changed) {
        _lastModCutoff = mc;
        cutKnob.setModValue(mc !== null ? mc : null);
      }
      // Mod range arc on CUT knob (Serum-style)
      const _cutSlot = voice.lfoEngine?.slots?.find(s => s.enabled && s.target === 'cutoff');
      if (_cutSlot) {
        cutKnob.setModRange(
          _cutSlot.modMin ?? 0, _cutSlot.modMax ?? 1,
          color,
          (lo, hi) => { _cutSlot.modMin = lo; _cutSlot.modMax = hi; }
        );
      } else {
        cutKnob.clearModRange();
      }
      // Mod range arc on RES knob
      const _resSlot = voice.lfoEngine?.slots?.find(s => s.enabled && s.target === 'resonance');
      if (_resSlot) {
        resKnob.setModRange(
          _resSlot.modMin ?? 0, _resSlot.modMax ?? 1,
          '#a78bfa',
          (lo, hi) => { _resSlot.modMin = lo; _resSlot.modMax = hi; }
        );
      } else {
        resKnob.clearModRange();
      }
      // Noise knob ring
      const mn = estimateModNoiseAmt();
      const nChanged = mn !== _lastModNoise && (mn === null || _lastModNoise === null || Math.abs(mn - _lastModNoise) > 0.005);
      if (nChanged) {
        _lastModNoise = mn;
        voice._noiseKnob?.setModValue(mn);
      }
      // Mod rings for other LFO targets — read live slot value
      if (voice.lfoEngine) {
        const _getLiveVal = tgt => {
          const s = voice.lfoEngine.slots.find(sl => sl.enabled && sl.target === tgt && sl.depth > 0);
          if (!s || !s.points) return null;
          const idx = Math.min(s.points.length - 1, Math.max(0, Math.round(s.phase * s.points.length)));
          return s.points[idx] ?? null;
        };
        // RES knob
        const rv = _getLiveVal('resonance');
        if (rv !== null) {
          const rq = p.filter.resonance * (1 + rv * (voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='resonance')?.depth||0) * 3);
          resKnob.setModValue(Math.max(0.01, Math.min(30, rq)));
        } else { resKnob.setModValue(null); }
        // PITCH / SEMI / FINE — update glowing badge on FIN drag-param
        const pv = _getLiveVal('pitch');
        const sv = _getLiveVal('semi');
        const fv = _getLiveVal('fine');
        if (pv !== null) {
          const pSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='pitch');
          voice._pitchModUpdate?.((pv - 0.5) * 2 * (pSlot?.depth||0) * 100);
        } else if (sv !== null) {
          const sSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='semi');
          const sc = Math.round((sv - 0.5) * 2 * (sSlot?.depth||0) * 12) * 100;
          voice._pitchModUpdate?.(sc);
          voice._semiModUpdate?.(Math.round(sc / 100));
        } else if (fv !== null) {
          const fSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='fine');
          voice._pitchModUpdate?.((fv - 0.5) * 2 * (fSlot?.depth||0) * 100);
        } else { voice._pitchModUpdate?.(null); voice._semiModUpdate?.(null); }
        // SEM param range bar
        const _semiSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='semi');
        if (_semiSlot) {
          voice._semParam?.setModRange(_semiSlot.modMin??0, _semiSlot.modMax??1, '#88ccff',
            (lo,hi) => { _semiSlot.modMin=lo; _semiSlot.modMax=hi; });
        } else { voice._semParam?.clearModRange(); }
        // FIN param range bar (also covers pitch target)
        const _fineSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&(sl.target==='fine'||sl.target==='pitch'));
        if (_fineSlot) {
          voice._finParam?.setModRange(_fineSlot.modMin??0, _fineSlot.modMax??1, '#88aaff',
            (lo,hi) => { _fineSlot.modMin=lo; _fineSlot.modMax=hi; });
        } else { voice._finParam?.clearModRange(); }
        // TREMOLO — show gain % on LEVEL badge + range bar
        const tv = _getLiveVal('amp');
        const _ampSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='amp');
        if (tv !== null && _ampSlot) {
          const trem = (_ampSlot.modMin??0) + tv * ((_ampSlot.modMax??1) - (_ampSlot.modMin??0));
          voice._tremoloModUpdate?.(Math.max(0, trem));
          voice._levelParam?.setModRange(_ampSlot.modMin??0, _ampSlot.modMax??1, color,
            (lo,hi) => { _ampSlot.modMin=lo; _ampSlot.modMax=hi; });
        } else {
          voice._tremoloModUpdate?.(null);
          if (!_ampSlot) voice._levelParam?.clearModRange();
        }
        // DRIVE
        const dv = _getLiveVal('drive');
        const _driveSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='drive');
        if (dv !== null && _driveSlot) {
          const ranged = (_driveSlot.modMin??0) + dv * ((_driveSlot.modMax??1) - (_driveSlot.modMin??0));
          voice._driveKnob?.setModValue(Math.max(0, Math.min(1, ranged)));
          voice._driveKnob?.setModRange(
            _driveSlot.modMin??0, _driveSlot.modMax??1,
            '#fb923c',
            (lo, hi) => { _driveSlot.modMin = lo; _driveSlot.modMax = hi; }
          );
        } else {
          voice._driveKnob?.setModValue(null);
          if (!_driveSlot) voice._driveKnob?.clearModRange();
        }
        // DIST MIX
        const dmv = _getLiveVal('distMix');
        const _distMixSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='distMix');
        if (dmv !== null && _distMixSlot) {
          const ranged = (_distMixSlot.modMin??0) + dmv * ((_distMixSlot.modMax??1) - (_distMixSlot.modMin??0));
          voice._distMixKnob?.setModValue(Math.max(0, Math.min(1, ranged)));
          voice._distMixKnob?.setModRange(
            _distMixSlot.modMin??0, _distMixSlot.modMax??1,
            '#f472b6',
            (lo, hi) => { _distMixSlot.modMin = lo; _distMixSlot.modMax = hi; }
          );
        } else {
          voice._distMixKnob?.setModValue(null);
          if (!_distMixSlot) voice._distMixKnob?.clearModRange();
        }
        // NOISE AMT
        const nav = _getLiveVal('noiseAmt');
        const _noiseAmtSlot = voice.lfoEngine.slots.find(sl=>sl.enabled&&sl.target==='noiseAmt');
        if (nav !== null && _noiseAmtSlot) {
          const ranged = (_noiseAmtSlot.modMin??0) + nav * ((_noiseAmtSlot.modMax??1) - (_noiseAmtSlot.modMin??0));
          voice._noiseKnob?.setModValue(Math.max(0, Math.min(1, ranged)));
          voice._noiseKnob?.setModRange(
            _noiseAmtSlot.modMin??0, _noiseAmtSlot.modMax??1,
            '#34d399',
            (lo, hi) => { _noiseAmtSlot.modMin = lo; _noiseAmtSlot.modMax = hi; }
          );
        } else {
          voice._noiseKnob?.setModValue(null);
          if (!_noiseAmtSlot) voice._noiseKnob?.clearModRange();
        }
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
      _lastDrawKey = null; // force redraw on note-on and note-off
      if (!v) {
        // Keep visualization alive for the full release duration
        const relMs = Math.max(600, (p.adsr.release || 0.12) * 1000 + 200);
        _releaseUntil = performance.now() + relMs;
        setTimeout(() => {
          if (!voice._playing) {
            _releaseUntil = 0;
            _lastModCutoff = null; _lastModNoise = null;
            _lastDrawKey = null;
            cutKnob.clearModValue();
            resKnob.clearModValue();
            voice._noiseKnob?.clearModValue();
            voice._driveKnob?.clearModValue();
            voice._distMixKnob?.clearModValue();
            voice._semParam?.setModLabel?.(null);
            voice._finParam?.setModLabel?.(null);
            voice._levelParam?.setModLabel?.(null);
            voice._pitchModUpdate?.(null);
            voice._tremoloModUpdate?.(null);
          }
        }, relMs);
      }
    },
    configurable: true
  });

  // Filter bypass toggle
  const FILTER_MOD_TARGETS = ['cutoff', 'resonance'];
  addSectionToggle(fS,
    () => { // Disable: allpass + disconnect all modulation from filter params
      voice.p.filter.bypassed = true;
      voice._filterSetType('allpass');
      voice._filterBypassed = true;
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
      voice._filterSetType(p.filter.type);
      voice.lfoNodes.forEach((_, i) => {
        if (FILTER_MOD_TARGETS.includes(p.lfos[i].target)) voice._connectLFO(i);
      });
    },
    !voice.p.filter.bypassed
  );

  // ── COMPRESSOR (pre-distortion) ────────────────────────────
  const compS = sec('COMPRESSOR');
  {
    if (!p.comp) p.comp = { threshold:-24, knee:6, ratio:4, attack:0.003, release:0.1, bypassed:false };

    const inner = document.createElement('div');
    inner.style.cssText = 'display:flex;gap:6px;align-items:stretch';
    compS.appendChild(inner);

    // LEFT: knobs
    const left = document.createElement('div');
    left.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center';
    inner.appendChild(left);
    const kr = document.createElement('div');
    kr.style.cssText = 'display:flex;gap:2px;align-items:flex-end;flex-wrap:wrap';
    left.appendChild(kr);
    [
      { key:'threshold', label:'THR',  min:-60, max:0,    value:p.comp.threshold, decimals:1 },
      { key:'ratio',     label:'RATIO',min:1,   max:20,   value:p.comp.ratio,     decimals:1 },
      { key:'knee',      label:'KNEE', min:0,   max:40,   value:p.comp.knee,      decimals:1 },
      { key:'attack',    label:'ATK',  min:0,   max:0.5,  value:p.comp.attack,    decimals:3 },
      { key:'release',   label:'REL',  min:0,   max:1,    value:p.comp.release,   decimals:3 },
    ].forEach(cfg => makeKnob({ parent:kr, color, size:46, ...cfg, onChange: v => {
      voice.set('comp', cfg.key, v);
      _drawComp();
    }}));

    // RIGHT: canvas (transfer curve + GR meter)
    const right = document.createElement('div');
    right.style.cssText = 'flex:0 0 50%;max-width:50%;display:flex;flex-direction:column;gap:0';
    inner.appendChild(right);

    const compCvs = document.createElement('canvas');
    compCvs.style.cssText = 'display:block;width:100%;height:100px;background:#06060f;border-radius:4px;border:1px solid #1a1a30;cursor:default';
    right.appendChild(compCvs);

    // Draw compressor transfer curve + GR bar
    function _drawComp() {
      const dpr = window.devicePixelRatio || 1;
      const W = compCvs.offsetWidth || 120;
      const TOTAL_H = 100;
      const GR_H = 12;          // GR strip height at bottom
      const H = TOTAL_H - GR_H; // curve area height
      compCvs.width = W * dpr; compCvs.height = TOTAL_H * dpr;
      const c = compCvs.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#07070f'; c.fillRect(0, 0, W, TOTAL_H);

      const thr   = p.comp.threshold;  // dB, -60..0
      const ratio = p.comp.ratio;      // 1..20
      const knee  = p.comp.knee;       // dB

      // Zoomed view: show ±WINDOW dB around threshold so knee is always large
      const WINDOW = 24;
      const IN_LO  = thr - WINDOW;
      const IN_HI  = thr + WINDOW;
      const OUT_LO = compOut(IN_LO, thr, ratio, knee);
      const OUT_HI = compOut(IN_HI, thr, ratio, knee);
      // keep output range at least WINDOW wide so 1:1 line isn't vertical
      const OUT_SPAN = Math.max(WINDOW, OUT_HI - OUT_LO);
      // Y maps OUT_LO..OUT_LO+OUT_SPAN → bottom..top of curve area
      function toX(db) { return (db - IN_LO) / (IN_HI - IN_LO) * W; }
      function toY(db) { return (1 - (db - OUT_LO) / OUT_SPAN) * H; }

      // Transfer function: input dB → output dB
      function compOut(xDb, th, rat, kn) {
        const hk = kn / 2;
        if (xDb <= th - hk) return xDb;
        if (xDb >= th + hk || kn < 0.001) return th + (xDb - th) / rat;
        const t = (xDb - th + hk) / kn;
        const slope = 1 + (1 / rat - 1) * t;
        return xDb + (slope - 1) * (xDb - (th - hk));
      }

      // ── Curve background ─────────────────────────────────
      c.fillStyle = '#07070f'; c.fillRect(0, 0, W, H);

      // Grid — dB lines at threshold and ±WINDOW/2
      c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 0.5;
      [-WINDOW, -WINDOW/2, 0, WINDOW/2, WINDOW].forEach(off => {
        const xdb = thr + off;
        const xp = toX(xdb);
        c.beginPath(); c.moveTo(xp, 0); c.lineTo(xp, H); c.stroke();
      });
      [0.25, 0.5, 0.75].forEach(f => {
        c.beginPath(); c.moveTo(0, f*H); c.lineTo(W, f*H); c.stroke();
      });

      // Identity reference line (1:1) in zoomed coords
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 0.8;
      c.setLineDash([3,3]);
      c.beginPath();
      c.moveTo(toX(IN_LO), toY(IN_LO));
      c.lineTo(toX(IN_HI), toY(IN_HI));
      c.stroke(); c.setLineDash([]);

      // Threshold vertical line
      const thrPx = toX(thr);
      c.strokeStyle = `${color}55`; c.lineWidth = 0.8;
      c.setLineDash([2,3]);
      c.beginPath(); c.moveTo(thrPx, 0); c.lineTo(thrPx, H); c.stroke();
      c.setLineDash([]);

      // ── Transfer curve ──────────────────────────────────
      function plotCurve(alpha, lw, blur) {
        c.save(); c.globalAlpha = alpha;
        c.strokeStyle = color; c.shadowColor = color;
        c.shadowBlur = blur; c.lineWidth = lw; c.lineJoin = 'round';
        c.beginPath();
        const STEPS = W * 2;
        for (let i = 0; i <= STEPS; i++) {
          const xDb = IN_LO + (i / STEPS) * (IN_HI - IN_LO);
          const yDb = compOut(xDb, thr, ratio, knee);
          const px = toX(xDb), py = toY(yDb);
          i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
        }
        c.stroke(); c.restore();
      }
      plotCurve(0.25, 4, 10);
      plotCurve(1.0,  1.8, 3);

      // ── Axis labels ─────────────────────────────────────
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.font = '6px monospace';
      c.fillText(`${thr}dB`, thrPx + 2, H - 2);  // threshold label at bottom
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.font = '6px monospace';
      c.fillText('IN →', W - 18, H - 2);
      c.save(); c.translate(5, H * 0.55); c.rotate(-Math.PI/2);
      c.fillText('OUT', 0, 0); c.restore();

      // ── Divider between curve and GR strip ──────────────
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, H); c.lineTo(W, H); c.stroke();

      // ── GR meter strip ───────────────────────────────────
      const gr = Math.abs(voice._voiceComp?.reduction ?? 0);
      const grY = H + 2;
      const grBarH = GR_H - 4;
      // track background
      c.fillStyle = 'rgba(255,255,255,0.04)';
      c.fillRect(2, grY, W - 4, grBarH);
      if (gr > 0.1) {
        const grNorm = Math.min(1, gr / 30);
        const barW = grNorm * (W - 4);
        const r = Math.round(60 + grNorm * 195);
        const g = Math.round(220 * (1 - grNorm * 0.85));
        c.fillStyle = `rgb(${r},${g},80)`;
        c.shadowColor = `rgb(${r},${g},80)`; c.shadowBlur = 4;
        c.fillRect(2, grY, barW, grBarH);
        c.shadowBlur = 0;
        c.fillStyle = 'rgba(255,255,255,0.55)'; c.font = 'bold 7px monospace';
        c.fillText(`GR -${gr.toFixed(1)}dB`, 4, grY + grBarH - 1);
      } else {
        c.fillStyle = 'rgba(255,255,255,0.2)'; c.font = '7px monospace';
        c.fillText('GR —', 4, grY + grBarH - 1);
      }
    }

    // Animate GR meter continuously while playing
    let _grAnimId = null;
    const _startGrAnim = () => {
      if (_grAnimId) return;
      const loop = () => { _drawComp(); _grAnimId = requestAnimationFrame(loop); };
      _grAnimId = requestAnimationFrame(loop);
    };
    const _stopGrAnim = () => {
      if (_grAnimId) { cancelAnimationFrame(_grAnimId); _grAnimId = null; }
      _drawComp();
    };

    const _origNoteOnComp  = voice.noteOn.bind(voice);
    const _origNoteOffComp = voice.noteOff.bind(voice);
    voice.noteOn  = (...a) => { _origNoteOnComp(...a);  _startGrAnim(); };
    voice.noteOff = (...a) => { _origNoteOffComp(...a); setTimeout(_stopGrAnim, 600); };

    setTimeout(() => _drawComp(), 150);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => _drawComp()).observe(compCvs);
    }

    addSectionToggle(compS,
      () => { p.comp.bypassed = true;  voice._voiceComp.ratio.setTargetAtTime(1,   voice.ctx.currentTime, 0.01); },
      () => { p.comp.bypassed = false; voice._voiceComp.ratio.setTargetAtTime(p.comp.ratio, voice.ctx.currentTime, 0.01); },
      !p.comp.bypassed
    );
  }

  // ── DISTORTION ────────────────────────────────────────────
  const distS = sec('DISTORTION');
  buildDistSection(distS, p.dist, voice, color);

  // LFO ENGINE is built externally via buildAllLFOEngines() in main.js

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
  // ── MOD MONITOR ───────────────────────────────────────────
  (function buildModMonitor() {
    const modS = cSec('MOD MONITOR');
    modS.style.cssText += ';padding-bottom:8px';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:110px;background:#04040d;border-radius:4px;border:1px solid #1a1a30';
    modS.appendChild(canvas);

    const LANES = [
      { label:'LFO 1', color:'#a855f7', getValue: () => {
          const s = voice.lfoEngine?.slots?.[0]; if (!s || !s.enabled || s.target==='none') return null;
          const ph = Math.round(s.phase * (s.points?.length||512)); return s.points?.[ph % (s.points.length||512)] ?? null; } },
      { label:'LFO 2', color:'#6366f1', getValue: () => {
          const s = voice.lfoEngine?.slots?.[1]; if (!s || !s.enabled || s.target==='none') return null;
          const ph = Math.round(s.phase * (s.points?.length||512)); return s.points?.[ph % (s.points.length||512)] ?? null; } },
      { label:'LFO 3', color:'#3b82f6', getValue: () => {
          const s = voice.lfoEngine?.slots?.[2]; if (!s || !s.enabled || s.target==='none') return null;
          const ph = Math.round(s.phase * (s.points?.length||512)); return s.points?.[ph % (s.points.length||512)] ?? null; } },
      { label:'LFO 4', color:'#06b6d4', getValue: () => {
          const s = voice.lfoEngine?.slots?.[3]; if (!s || !s.enabled || s.target==='none') return null;
          const ph = Math.round(s.phase * (s.points?.length||512)); return s.points?.[ph % (s.points.length||512)] ?? null; } },
      { label:'ENV',   color:'#22c55e', getValue: () => {
          if (!voice._playing) return null;
          const env = voice._envTracker?.current ?? null; return env; } },
    ];

    const HISTORY = 200; // pixels of history
    const history = LANES.map(() => new Float32Array(HISTORY));
    let _rafId = null;

    function drawMonitor() {
      _rafId = requestAnimationFrame(drawMonitor);
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth || 400, H = canvas.offsetHeight || 110;
      if (!W || !H) return;
      if (canvas.width !== W*dpr || canvas.height !== H*dpr) { canvas.width=W*dpr; canvas.height=H*dpr; }
      const c = canvas.getContext('2d');
      c.setTransform(dpr,0,0,dpr,0,0);
      c.clearRect(0,0,W,H);
      c.fillStyle='#04040d'; c.fillRect(0,0,W,H);

      const laneH = H / LANES.length;

      LANES.forEach((lane, li) => {
        const y0 = li * laneH, yMid = y0 + laneH * 0.5;

        // shift history left, push new value
        const val = lane.getValue();
        for (let i=0; i<HISTORY-1; i++) history[li][i] = history[li][i+1];
        history[li][HISTORY-1] = val ?? -1; // -1 = inactive

        const active = val !== null;

        // lane bg
        c.fillStyle = active ? `${lane.color}11` : 'transparent';
        c.fillRect(0, y0, W, laneH);

        // divider
        c.strokeStyle = 'rgba(255,255,255,0.04)'; c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(0,y0); c.lineTo(W,y0); c.stroke();

        // label
        c.fillStyle = active ? lane.color : '#333';
        c.font = `bold 8px monospace`; c.fillText(lane.label, 5, y0 + laneH*0.45 + 3);

        // target label
        let tgtLabel = '';
        if (li < 5 && voice.lfoEngine?.slots?.[li]) tgtLabel = voice.lfoEngine.slots[li].target || '';
        else if (lane.label==='ENV') tgtLabel = 'cutoff';
        if (tgtLabel && tgtLabel !== 'none') {
          c.fillStyle = active ? `${lane.color}99` : '#222';
          c.font = '7px monospace'; c.fillText(tgtLabel.toUpperCase(), 5, y0 + laneH*0.45 + 11);
        }

        if (!active) return;

        // waveform history line
        const xOff = 42;
        const plotW = W - xOff - 4;
        c.save();
        c.strokeStyle = lane.color; c.lineWidth = 1.2; c.lineJoin='round';
        c.shadowColor = lane.color; c.shadowBlur = 3;
        c.globalAlpha = 0.85;
        c.beginPath();
        for (let i=0; i<HISTORY; i++) {
          const v = history[li][i];
          if (v < 0) continue; // inactive gap
          const x = xOff + (i / HISTORY) * plotW;
          const y = y0 + laneH*0.1 + (1-v) * laneH*0.8;
          i===0 || history[li][i-1]<0 ? c.moveTo(x,y) : c.lineTo(x,y);
        }
        c.stroke();
        c.restore();

        // current value bar (right side)
        if (val !== null) {
          const barH = val * laneH * 0.7;
          c.save();
          c.fillStyle = lane.color; c.globalAlpha = 0.8;
          c.shadowColor = lane.color; c.shadowBlur = 4;
          c.fillRect(W-8, y0 + laneH - barH - laneH*0.15, 4, barH);
          c.restore();
          // value readout
          c.fillStyle = lane.color; c.font='7px monospace';
          c.fillText(val.toFixed(2), W-34, y0 + laneH*0.45 + 3);
        }
      });

      // "ALL INACTIVE" hint
      const anyActive = LANES.some(l => l.getValue() !== null);
      if (!anyActive) {
        c.fillStyle='#222'; c.font='10px monospace'; c.textAlign='center';
        c.fillText('Enable LFO/TWE to see modulation signals', W/2, H/2);
        c.textAlign='left';
      }
    }
    drawMonitor();
  })();

  const eqS = cSec('EQ');
  buildEQSection(eqS, p.eq, voice, color);

  // ── FX (Reverb + Delay) ───────────────────────────────────
  const fxS = cSec('FX');
  buildFXSection(fxS, p.fx, voice, color);
}

// ─────────────────────────────────────────────────────────
//  buildAllLFOEngines — one LFO ENGINE section with 3 voice
//  columns side-by-side, built once into the center panel.
//  voices      : array of WobblerVoice
//  voiceColors : array of accent color strings
//  centerPanel : DOM container
// ─────────────────────────────────────────────────────────
function buildAllLFOEngines(voices, voiceColors, centerPanel) {
  // Wrapper section
  const sec = document.createElement('div');
  sec.className = 'v-sec lfo-sec';
  sec.id = 'lfo-engine-section';

  const hdr = document.createElement('div');
  hdr.className = 'sec-hdr';
  hdr.textContent = 'LFO ENGINE';
  sec.appendChild(hdr);

  // 3-column row — one per voice
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;align-items:flex-start';
  sec.appendChild(row);

  voices.forEach((voice, i) => {
    const color = voiceColors[i] || '#00ffb2';

    // Voice sub-header column wrapper
    const voiceWrap = document.createElement('div');
    voiceWrap.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px';
    row.appendChild(voiceWrap);

    // Voice label + ON/OFF
    const voiceHdr = document.createElement('div');
    voiceHdr.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:2px 4px;background:${color}18;border-radius:3px;border:1px solid ${color}33`;
    const voiceLbl = document.createElement('span');
    voiceLbl.style.cssText = `font-size:9px;letter-spacing:1px;color:${color};font-family:monospace`;
    voiceLbl.textContent = `VOICE ${i + 1}`;
    voiceHdr.appendChild(voiceLbl);

    // Per-voice engine ON/OFF toggle
    const onOffBtn = document.createElement('button');
    onOffBtn.textContent = 'ON';
    onOffBtn.style.cssText = `padding:1px 6px;font-size:8px;font-family:monospace;border:1px solid ${color}66;color:${color};background:${color}22;border-radius:2px;cursor:pointer`;
    onOffBtn.addEventListener('click', () => {
      const active = onOffBtn.textContent === 'ON';
      if (active) {
        onOffBtn.textContent = 'OFF';
        onOffBtn.style.borderColor = '#333';
        onOffBtn.style.color = '#444';
        onOffBtn.style.background = 'transparent';
        voice.lfoEngine?.stop();
        const t = voice.ctx.currentTime;
        voice._filterSetCutoff(voice.p.filter.cutoff, t, 0.02);
        voice._filterSetResonance(voice.p.filter.resonance, t, 0.02);
        voice._tremoloGain?.gain.setTargetAtTime(1, t, 0.02);
        (voice._activeOscs || []).forEach(o => { try { o.detune.setTargetAtTime(0, t, 0.02); } catch(_) {} });
        voice._distPre?.gain.setTargetAtTime(1, t, 0.02);
        voice._noiseG?.gain.setTargetAtTime(voice.p.noise.volume, t, 0.02);
      } else {
        onOffBtn.textContent = 'ON';
        onOffBtn.style.borderColor = `${color}66`;
        onOffBtn.style.color = color;
        onOffBtn.style.background = `${color}22`;
        if (voice.lfoEngine && !voice.lfoEngine.playing) voice.lfoEngine.start();
      }
    });
    voiceHdr.appendChild(onOffBtn);
    voiceWrap.appendChild(voiceHdr);

    // Two LFO slot columns inside each voice column
    const innerRow = document.createElement('div');
    innerRow.style.cssText = 'display:flex;gap:4px;align-items:flex-start';
    voiceWrap.appendChild(innerRow);

    buildOneLFOColumn(innerRow, 0, voice.lfoEngine, color, voice);
    buildOneLFOColumn(innerRow, 1, voice.lfoEngine, color, voice);
  });

  centerPanel.appendChild(sec);
}

// ─────────────────────────────────────────────────────────
//  Sequencer UI (builds individual sequencer in each voice column)
// ─────────────────────────────────────────────────────────
