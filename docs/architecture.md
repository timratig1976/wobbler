# Architecture

AI-Driven Wobble Bass VST3 Synthesizer - System design and technical architecture.

---

## Overview

Wobbler is a cross-platform VST3 audio plugin that generates Drum & Bass / Dubstep style wobble bass sounds using AI-generated modulation patterns. The system combines real-time DSP synthesis with machine learning pattern generation to create dynamic bass sounds.

**Core concept:** AI learns modulation patterns from bass sounds → generates new patterns → drives a wavetable synthesizer in real-time.

---

## Technology Stack

### Plugin Framework
- **JUCE 7.x** (C++) - Cross-platform audio plugin framework
  - VST3 plugin format
  - Audio processing engine
  - Parameter system
  - GUI framework
  - MIDI handling

### DSP Engine (Real-time Audio)
- **Language:** C++17
- **Audio processing:** Lock-free, real-time safe
- **Sample rate:** 44.1kHz - 192kHz support
- **Buffer sizes:** 32 - 2048 samples

### AI Training Environment (Offline)
- **Python 3.10+**
- **PyTorch** - Neural network training
- **Librosa** - Audio feature extraction
- **NumPy** - Numerical operations
- **Demucs / Spleeter** - Source separation (future)

### AI Inference (Real-time)
- **ONNX Runtime** (C++) - Run trained models in plugin
- **Execution:** Background thread (never in audio callback)
- **Model format:** ONNX

### Build System
- **CMake 3.20+** - Cross-platform build
- **Compiler:** Clang/GCC (macOS/Linux), MSVC (Windows)

### Development Tools
- **Git** - Version control
- **Xcode** (macOS) / Visual Studio (Windows) - IDE

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                  VST3 Plugin Host                   │
│              (Ableton, FL Studio, etc.)             │
└────────────────────┬────────────────────────────────┘
                     │ MIDI + Audio Buffer
                     ▼
┌─────────────────────────────────────────────────────┐
│                 Wobbler VST3 Plugin                 │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │     GUI      │  │  Parameter   │  │   MIDI   │ │
│  │   (JUCE)     │  │   Manager    │  │  Input   │ │
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ │
│         │                 │                │       │
│         └─────────────────┼────────────────┘       │
│                           ▼                        │
│         ┌─────────────────────────────────┐        │
│         │      Modulation Engine          │        │
│         │  ┌─────┐ ┌─────┐ ┌──────────┐  │        │
│         │  │ LFO │ │ ENV │ │ AI Mod   │  │        │
│         │  └─────┘ └─────┘ └──────────┘  │        │
│         └────────────┬────────────────────┘        │
│                      │ Modulation Values           │
│                      ▼                             │
│         ┌─────────────────────────────────┐        │
│         │        DSP Engine               │        │
│         │  ┌──────────┐  ┌──────────┐    │        │
│         │  │Oscillator│→ │  Filter  │ →  │        │
│         │  └──────────┘  └──────────┘    │        │
│         │       ↓             ↓          │        │
│         │  ┌──────────┐  ┌──────────┐    │        │
│         │  │Wavetable │  │Distortion│ →  │        │
│         │  └──────────┘  └──────────┘    │        │
│         └────────────┬────────────────────┘        │
│                      │ Audio Output                │
└──────────────────────┼─────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────┐    ┌──────────────────────┐
│  AI Engine       │    │  Audio Callback      │
│  (Background     │    │  (Real-time Thread)  │
│   Thread)        │    │                      │
│                  │    │  - Lock-free         │
│  ┌────────────┐  │    │  - No allocations    │
│  │ ONNX Model │  │    │  - Deterministic     │
│  └────────────┘  │    └──────────────────────┘
└──────────────────┘
```

### Data Flow

**Pattern Generation Flow:**
```
User clicks "Generate" 
  → AI Engine (background thread)
  → ONNX model inference
  → Generate modulation curves
  → Lock-free queue → Modulation Engine
  → Applied to DSP parameters
```

**Audio Processing Flow (Real-time):**
```
MIDI Note
  → Oscillator (wavetable playback)
  → Filter (modulated cutoff)
  → Distortion
  → Amplitude envelope
  → Audio output
```

---

## Project Structure

```
wobbler/
├── src/                          # C++ source code
│   ├── plugin/                   # JUCE plugin wrapper
│   │   ├── PluginProcessor.h/cpp # Main audio processor
│   │   ├── PluginEditor.h/cpp    # GUI
│   │   └── PluginParameters.h    # Parameter definitions
│   │
│   ├── dsp/                      # DSP modules
│   │   ├── Oscillator.h/cpp      # Wavetable oscillator
│   │   ├── Filter.h/cpp          # Low-pass filter
│   │   ├── Distortion.h/cpp      # Distortion stage
│   │   ├── Envelope.h/cpp        # ADSR envelope
│   │   └── LFO.h/cpp             # Low-frequency oscillator
│   │
│   ├── modulation/               # Modulation system
│   │   ├── ModulationMatrix.h/cpp
│   │   ├── ModulationSource.h
│   │   └── AIModulationSource.h/cpp
│   │
│   ├── ai/                       # AI inference
│   │   ├── ONNXInference.h/cpp   # ONNX runtime wrapper
│   │   ├── PatternGenerator.h/cpp
│   │   └── LockFreeQueue.h       # Thread-safe communication
│   │
│   └── utils/                    # Utilities
│       ├── Wavetables.h/cpp      # Wavetable data
│       └── DSPUtils.h            # DSP helpers
│
├── python/                       # AI training environment
│   ├── training/                 # Model training
│   │   ├── train_pattern_model.py
│   │   ├── dataset.py
│   │   └── model.py
│   │
│   ├── preprocessing/            # Audio analysis
│   │   ├── feature_extraction.py
│   │   ├── source_separation.py  # Future: Demucs
│   │   └── pattern_detection.py
│   │
│   ├── models/                   # Trained ONNX models
│   │   └── wobble_pattern_v1.onnx
│   │
│   └── requirements.txt          # Python dependencies
│
├── tests/                        # Unit tests
│   ├── dsp_tests/
│   └── ai_tests/
│
├── resources/                    # Plugin resources
│   ├── wavetables/               # Wavetable files
│   └── presets/                  # Factory presets
│
├── CMakeLists.txt                # Build configuration
├── docs/                         # Documentation
└── .windsurf/                    # Cascade workflows
```

---

## DSP Signal Chain

### Audio Processing Pipeline

```
MIDI Note In
    ↓
┌─────────────────┐
│   Oscillator    │  - Wavetable playback
│                 │  - Pitch modulation
│                 │  - Sub oscillator
└────────┬────────┘
         ↓
┌─────────────────┐
│     Filter      │  - Low-pass filter
│                 │  - Cutoff modulation (wobble)
│                 │  - Resonance control
└────────┬────────┘
         ↓
┌─────────────────┐
│   Distortion    │  - Soft/hard clipping
│                 │  - Wavefold
│                 │  - Saturation
└────────┬────────┘
         ↓
┌─────────────────┐
│   Envelope      │  - ADSR amplitude
│                 │  - Volume control
└────────┬────────┘
         ↓
    Audio Out
```

### Modulation Routing

```
┌──────────┐
│   LFO    │ ──┐
└──────────┘   │
               ├──→ Filter Cutoff
┌──────────┐   │
│ Envelope │ ──┤
└──────────┘   │
               ├──→ Wavetable Position
┌──────────┐   │
│ AI Mod   │ ──┤
└──────────┘   │
               ├──→ Oscillator Pitch
┌──────────┐   │
│  Step    │ ──┤
│  Seq     │   │
└──────────┘   └──→ Distortion Drive
```

---

## AI Pattern Generation

### Model Architecture (MVP)

**Input:** Random latent vector (128-dim)  
**Output:** Modulation curves
- Filter cutoff curve (64 steps)
- LFO rate sequence (16 steps)
- Pitch pattern (16 steps)
- Distortion curve (64 steps)

**Model type:** LSTM or Transformer (TBD during training)

### Training Pipeline (Future)

```
Audio Tracks
    ↓
Source Separation (Demucs)
    ↓
Bass Stem Extraction
    ↓
Feature Extraction (Librosa)
  - Spectral centroid → filter movement
  - Pitch tracking → pitch pattern
  - Amplitude envelope → volume curve
    ↓
Pattern Dataset
    ↓
Model Training (PyTorch)
    ↓
Export to ONNX
    ↓
Load in Plugin
```

---

## Performance Considerations

### Real-time Audio Constraints

**Critical rules:**
- Audio callback must complete in < buffer duration
- No memory allocation in audio thread
- No locks in audio thread
- No file I/O in audio thread
- No system calls in audio thread

**Implementation:**
- Pre-allocate all buffers at initialization
- Use lock-free queues for thread communication
- AI inference runs on separate background thread
- Results copied to audio thread via lock-free queue

### Memory Management

- **Wavetables:** Pre-loaded at plugin initialization
- **Modulation buffers:** Fixed-size, pre-allocated
- **AI output:** Ring buffer, lock-free access

### CPU Optimization

- **SIMD:** Use for filter/oscillator processing
- **Wavetable interpolation:** Linear (fast) vs cubic (quality)
- **Oversampling:** Optional for distortion stage

---

## Threading Model

### Thread Architecture

```
┌─────────────────────┐
│   GUI Thread        │  - User interaction
│                     │  - Parameter updates
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Audio Thread      │  - Real-time DSP
│   (High Priority)   │  - Lock-free
│                     │  - No allocations
└──────────┬──────────┘
           │
           │ Lock-free queue
           │
           ▼
┌─────────────────────┐
│  AI Worker Thread   │  - ONNX inference
│  (Background)       │  - Pattern generation
│                     │  - Can allocate
└─────────────────────┘
```

### Thread Safety

- **Parameter changes:** Atomic operations
- **AI → Audio:** Lock-free SPSC queue
- **GUI → Audio:** JUCE parameter system (thread-safe)

---

## Design Decisions

### Decision 1: JUCE vs Custom Framework

**Context:** Need cross-platform VST3 support with GUI

**Decision:** Use JUCE framework

**Rationale:**
- Industry standard for audio plugins
- Built-in VST3/AU/AAX support
- Cross-platform (macOS/Windows/Linux)
- Mature DSP library
- Active community

**Consequences:**
- Larger binary size
- GPL/Commercial license required for commercial use
- Learning curve for JUCE-specific patterns

### Decision 2: ONNX Runtime vs LibTorch

**Context:** Need to run ML models in C++ plugin

**Decision:** Use ONNX Runtime

**Rationale:**
- Smaller binary size (~10MB vs ~100MB)
- Faster inference for small models
- Framework-agnostic (train in PyTorch, export to ONNX)
- Better cross-platform support

**Consequences:**
- Must export models to ONNX format
- Less flexibility than native PyTorch

### Decision 3: Background Thread for AI vs Real-time

**Context:** AI inference too slow for audio callback

**Decision:** Run AI on background thread, use lock-free queue

**Rationale:**
- Audio thread must be deterministic
- ONNX inference can take 10-50ms
- Lock-free queue adds minimal latency

**Consequences:**
- Pattern changes not instant (acceptable for this use case)
- More complex threading model

### Decision 4: MVP Without Audio Analysis

**Context:** Full pipeline (audio import → analysis → AI) is complex

**Decision:** MVP uses pretrained model with random input

**Rationale:**
- Proves core concept faster
- Audio analysis can be added later
- Allows testing synth + AI integration first

**Consequences:**
- Can't learn from user's tracks in MVP
- Must ship with pretrained model

---

## Next Steps

- **[User Guide](user-guide.md)** - Feature documentation
- **[API Reference](api-reference.md)** - API endpoints
- **[Deployment](deployment.md)** - Production setup

---

**Remember:** Update this file when you make significant architectural changes.
