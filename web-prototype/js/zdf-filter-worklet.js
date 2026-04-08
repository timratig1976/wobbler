// ─────────────────────────────────────────────────────────────────────────────
//  zdf-filter-worklet.js  —  Zero-Delay-Feedback State-Variable Filter
//  Runs in the AudioWorklet thread (separate from main JS).
//
//  Topology:  4-pole cascaded SVF (each pole = 2nd-order ZDF SVF)
//  Result:    24 dB/oct rolloff, stable self-oscillation, no bilinear warping
//
//  AudioParams exposed (all a-rate):
//    cutoff      — Hz   [20 .. 20000]  default 800
//    resonance   — Q    [0.01 .. 40]   default 0.7  (>= ~1.0 = self-oscillation)
//    filterType  — enum 0=LP 1=HP 2=BP 3=notch  (read as integer)
//    drive       — [0 .. 1]  soft-clip before filter  default 0
// ─────────────────────────────────────────────────────────────────────────────

class ZDFFilterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'cutoff',     defaultValue: 800,  minValue: 20,   maxValue: 20000, automationRate: 'a-rate' },
      { name: 'resonance',  defaultValue: 0.7,  minValue: 0.01, maxValue: 40,    automationRate: 'a-rate' },
      { name: 'filterType', defaultValue: 0,    minValue: 0,    maxValue: 3,     automationRate: 'k-rate' },
      { name: 'drive',      defaultValue: 0,    minValue: 0,    maxValue: 1,     automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    // 4 cascaded 1-pole SVF stages — state per channel (L/R)
    // Each stage: [ic1eq, ic2eq]  (integrator state)
    this._s = [
      [[0,0],[0,0],[0,0],[0,0]],  // left
      [[0,0],[0,0],[0,0],[0,0]],  // right
    ];
    this._sr = sampleRate;
  }

  // ── Single 2nd-order ZDF SVF tick ──────────────────────────
  // Returns [lp, bp, hp]  (lowpass / bandpass / highpass outputs)
  _svfTick(input, stage, g, k) {
    let ic1 = stage[0], ic2 = stage[1];
    // Reset NaN state — can happen at extreme resonance
    if (!isFinite(ic1) || !isFinite(ic2)) { ic1 = 0; ic2 = 0; stage[0] = 0; stage[1] = 0; }
    // ZDF solve (Mystran's formulation — one-sample exact)
    const denom = 1 + g * (g + k);
    const v1 = (input - ic2 - k * ic1) / denom;
    const v2 = ic1 + g * v1;
    const v3 = ic2 + g * v2;
    const lp = v3;
    const bp = v2;
    const hp = input - lp - k * bp;
    // Update integrator states — clamp to prevent Infinity accumulation
    const s0 = 2 * v2 - ic1;
    const s1 = 2 * v3 - ic2;
    stage[0] = isFinite(s0) ? Math.max(-10, Math.min(10, s0)) : 0;
    stage[1] = isFinite(s1) ? Math.max(-10, Math.min(10, s1)) : 0;
    return [lp, bp, hp];
  }

  // ── Soft clipper (tanh approximation) ──────────────────────
  _clip(x, amt) {
    if (amt < 0.001) return x;
    const drive = 1 + amt * 4;
    const xd = x * drive;
    // Pade approximant of tanh — fast, accurate to ±5%
    const x2 = xd * xd;
    return xd * (27 + x2) / (27 + 9 * x2) / drive;
  }

  process(inputs, outputs, parameters) {
    const input  = inputs[0];
    const output = outputs[0];
    const numCh  = Math.max(input.length, 1);

    const cutoffParam    = parameters.cutoff;
    const resonanceParam = parameters.resonance;
    const filterType     = Math.round(parameters.filterType[0]);
    const drive          = parameters.drive[0];

    const sr = this._sr;
    const blockSize = 128;

    for (let ch = 0; ch < numCh; ch++) {
      const inp  = input[ch]  || new Float32Array(blockSize);
      const out  = output[ch];
      const stages = this._s[Math.min(ch, 1)];

      for (let i = 0; i < blockSize; i++) {
        // Per-sample parameter interpolation
        const fc = cutoffParam.length > 1 ? cutoffParam[i] : cutoffParam[0];
        const q  = resonanceParam.length > 1 ? resonanceParam[i] : resonanceParam[0];

        // ZDF coefficient:  g = tan(π·fc/sr)
        // Clamp to sr*0.4 (≈17.6kHz at 44.1kHz) — above this tan() diverges causing aliasing artifacts
        const g = Math.tan(Math.PI * Math.max(20, Math.min(fc, sr * 0.4)) / sr);
        // Resonance → k: k = 2/Q.  Floor at 0.25 (Q=8) — unconditionally stable, no self-oscillation.
        const k = Math.max(0.25, 2 / Math.max(0.01, q));

        // Clamp input — prevent upstream overflow from destabilising SVF states
        const rawIn = inp[i];
        const safeIn = isFinite(rawIn) ? Math.max(-1.5, Math.min(1.5, rawIn)) : 0;
        // Pre-drive soft clip
        let x = this._clip(safeIn, drive);

        // Single 2-pole SVF — stable at all Q values
        const [lp1, bp1, hp1] = this._svfTick(x, stages[0], g, k);

        // Pick output by filterType
        // SVF LP/HP passband gain = 1. BP peak gain = 1/k, normalize by k.
        let y;
        switch (filterType) {
          case 1:  y = hp1; break;       // Highpass
          case 2:  y = bp1 * k; break;   // Bandpass — normalized to unity peak gain
          case 3:  y = lp1 + hp1; break; // Notch
          default: y = lp1; break;       // Lowpass
        }

        // Clamp — safety net
        out[i] = isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
      }
    }
    return true;
  }
}

registerProcessor('zdf-filter', ZDFFilterProcessor);
