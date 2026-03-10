# Wobbler Web Prototype

**Quick browser-based test of the Wobbler synthesizer - no installation required!**

---

## How to Run

### Option 1: Simple HTTP Server (Recommended)

```bash
cd /Users/timratig/CascadeProjects/wobbler/web-prototype

# Python 3
python3 -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000

# Or Node.js (if you have http-server installed)
npx http-server -p 8000
```

Then open: **http://localhost:8000**

### Option 2: Open Directly in Browser

Just double-click `index.html` - works in most modern browsers.

---

## Features

This Web Audio API prototype implements:

✅ **Wavetable Oscillator** - Sawtooth + sub oscillator  
✅ **Low-pass Filter** - With resonance control  
✅ **Distortion** - Waveshaping  
✅ **LFO Modulation** - Wobble effect on filter cutoff  
✅ **ADSR Envelope** - Attack and release  
✅ **AI Pattern Generator** - Simulated (randomized patterns)

---

## Controls

**Filter Section:**
- **Cutoff** - Filter frequency (100-8000 Hz)
- **Resonance** - Filter emphasis (0-30)

**Modulation:**
- **LFO Rate** - Wobble speed (0.1-20 Hz)
- **LFO Depth** - Wobble intensity (0-100%)

**Tone:**
- **Distortion** - Harmonic saturation (0-100%)

**Envelope:**
- **Attack** - Note fade-in time (1-1000 ms)
- **Release** - Note fade-out time (10-2000 ms)

**Output:**
- **Volume** - Master volume (0-100%)

---

## How to Play

### Mouse/Touch
Click or tap the on-screen keyboard keys

### Computer Keyboard
- **A** = C2 (65 Hz)
- **S** = D2 (73 Hz)
- **D** = E2 (82 Hz)
- **F** = F2 (87 Hz)
- **G** = G2 (98 Hz)
- **H** = A2 (110 Hz)
- **J** = B2 (123 Hz)
- **K** = C3 (131 Hz)

---

## Generate AI Pattern

Click **"Generate AI Pattern"** to randomly generate wobble patterns.

In the full VST3 plugin, this will use a trained ONNX neural network model.

---

## Differences from VST3 Plugin

| Feature | Web Prototype | VST3 Plugin |
|---------|--------------|-------------|
| **Audio Engine** | Web Audio API | JUCE C++ DSP |
| **Filter** | Basic biquad | Moog ladder filter |
| **AI Model** | Random patterns | ONNX neural network |
| **Performance** | Browser-dependent | Optimized real-time |
| **DAW Integration** | None | Full VST3/AU support |
| **Latency** | ~10-50ms | <5ms |

---

## Browser Compatibility

Works best in:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (macOS/iOS)

Requires modern browser with Web Audio API support.

---

## Next Steps

This prototype proves the core synthesis concept. The full VST3 plugin adds:

- **ONNX AI integration** - Real neural network pattern generation
- **Advanced DSP** - Moog-style filter, better distortion
- **DAW integration** - Use in Ableton, FL Studio, Logic Pro
- **MIDI support** - Full MIDI controller integration
- **Preset system** - Save and recall sounds
- **Audio analysis** - Learn from existing tracks (post-MVP)

**See:** `docs/kanban/in-progress/mvp-synth-engine-plan.md` for VST3 development roadmap.

---

**Try it now!** Start the server and open http://localhost:8000
