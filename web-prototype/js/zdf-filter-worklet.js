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
    const [ic1, ic2] = stage;
    // ZDF solve (Mystran's formulation — one-sample exact)
    const v1 = (input - ic2 - k * ic1) / (1 + g * (g + k));
    const v2 = ic1 + g * v1;
    const v3 = ic2 + g * v2;
    const lp = v3;
    const bp = v2;
    const hp = input - lp - k * bp;
    // Update integrator states
    stage[0] = 2 * v2 - ic1;
    stage[1] = 2 * v3 - ic2;
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
        const g = Math.tan(Math.PI * Math.min(fc, sr * 0.499) / sr);
        // Resonance → k: k = 1/Q.  At k=0 → self-oscillation.
        // We scale: Q knob 0.01–40 maps to k = 2–0.025 (lower k = more resonance)
        const k = Math.max(0.001, 2 / Math.max(0.01, q));

        // Pre-drive soft clip
        let x = this._clip(inp[i], drive);

        // 4-pole cascade: run 2 SVF stages
        // Stage 1
        const [lp1, bp1, hp1] = this._svfTick(x,  stages[0], g, k);
        // Stage 2 — feed LP output of stage 1 into stage 2
        const [lp2, bp2, hp2] = this._svfTick(lp1, stages[1], g, k);

        // Pick output by filterType
        let y;
        switch (filterType) {
          case 1:  y = hp2; break;       // Highpass
          case 2:  y = bp2; break;       // Bandpass
          case 3:  y = lp2 + hp2; break; // Notch
          default: y = lp2; break;       // Lowpass
        }

        // Post-clip to prevent blowup at extreme self-oscillation
        out[i] = Math.max(-2, Math.min(2, y));
      }
    }
    return true;
  }
}

registerProcessor('zdf-filter', ZDFFilterProcessor);
