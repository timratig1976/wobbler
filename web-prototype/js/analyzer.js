// ─────────────────────────────────────────────────────────
//  analyzer.js — Spectrogram + Oscilloscope
//  Ported from Voice Module reference implementation
// ─────────────────────────────────────────────────────────

class Analyzer {
  constructor(analyserNode, canvas) {
    this.analyser = analyserNode;
    this.canvas   = canvas;
    this.mode     = 'oscilloscope'; // 'oscilloscope' | 'spectrogram'
    this.running  = false;
    this._rafId   = null;
    this._spectroBuffer = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  setMode(mode) {
    this.mode = mode;
    // Clear buffer on mode switch
    this._spectroBuffer = null;
  }

  _loop() {
    if (!this.running) return;
    this.mode === 'spectrogram' ? this._drawSpectrogram() : this._drawOscilloscope();
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _drawOscilloscope() {
    const cv = this.canvas;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width  = cv.offsetWidth  * dpr;
    const H = cv.height = cv.offsetHeight * dpr;
    const c = cv.getContext('2d');
    c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
    if (!this.analyser) return;

    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);

    // Zero-crossing sync for stable image
    let start = 0;
    for (let i = 1; i < buf.length / 2; i++) {
      if (buf[i - 1] < 128 && buf[i] >= 128) { start = i; break; }
    }

    c.beginPath(); c.strokeStyle = '#00e09a'; c.lineWidth = 1.5 * dpr;
    const slice = W / (buf.length / 2);
    for (let i = 0; i < buf.length / 2; i++) {
      const x = i * slice;
      const y = ((buf[start + i] || 128) / 255) * H;
      i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
  }

  _drawSpectrogram() {
    const cv = this.canvas;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width  = cv.offsetWidth  * dpr;
    const H = cv.height = cv.offsetHeight * dpr;
    if (!this.analyser) return;

    // Init off-screen buffer
    if (!this._spectroBuffer || this._spectroBuffer.width !== W || this._spectroBuffer.height !== H) {
      this._spectroBuffer = document.createElement('canvas');
      this._spectroBuffer.width  = W;
      this._spectroBuffer.height = H;
    }

    const sb = this._spectroBuffer;
    const sc = sb.getContext('2d');

    // Shift left by 2px
    sc.drawImage(sb, -2, 0);

    // New column on the right
    const fftSize = this.analyser.frequencyBinCount;
    const freqData = new Uint8Array(fftSize);
    this.analyser.getByteFrequencyData(freqData);

    for (let i = 0; i < H; i++) {
      // Log frequency mapping
      const freq_norm = Math.pow(i / H, 2);
      const binIdx = Math.floor(freq_norm * fftSize);
      const val = freqData[fftSize - 1 - binIdx] / 255;
      // Color: dark → green → yellow → red
      const r = val > 0.5 ? Math.floor((val - 0.5) * 2 * 255) : 0;
      const g = Math.floor(val < 0.5 ? val * 2 * 200 : (1 - (val - 0.5) * 2) * 200);
      const b = 0;
      sc.fillStyle = `rgba(${r},${g},${b},${0.3 + val * 0.7})`;
      sc.fillRect(W - 2, H - i - 1, 2, 1);
    }

    // Draw buffer to main canvas
    const c = cv.getContext('2d');
    c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
    c.drawImage(sb, 0, 0);
  }
}
