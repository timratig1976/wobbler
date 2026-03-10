# MVP Synth Engine - Implementation Plan

**Status:** Planning  
**Created:** 2026-03-10  
**Completed:** (when done)

---

## Overview

### Goals
- Build a minimal viable VST3 synthesizer capable of generating wobble bass sounds
- Integrate AI-generated modulation patterns to control synth parameters
- Prove the core concept: AI → modulation → real-time synthesis
- Create foundation for future audio analysis features

### Success Criteria
- [ ] VST3 plugin loads in DAW (Ableton Live, FL Studio)
- [ ] Produces bass sounds via MIDI input
- [ ] AI generates modulation patterns on button press
- [ ] Modulation patterns control filter cutoff, pitch, distortion
- [ ] Real-time audio processing is glitch-free
- [ ] GUI displays basic controls and modulation visualization

---

## Technical Approach

### Architecture
**Three-layer system:**
1. **DSP Engine** - Real-time audio synthesis (oscillator → filter → distortion → amp)
2. **Modulation Engine** - LFO, envelope, AI modulation source
3. **AI Engine** - ONNX model running on background thread

**Data flow:**
```
User clicks "Generate" 
  → AI thread generates pattern via ONNX
  → Lock-free queue → Modulation engine
  → DSP parameters updated
  → Audio output changes
```

### Key Components
- **Wavetable Oscillator** - Playback with pitch modulation
- **Low-pass Filter** - Cutoff modulation creates wobble effect
- **Distortion** - Adds harmonic content
- **ADSR Envelope** - Amplitude shaping
- **LFO** - Periodic modulation
- **AI Modulation Source** - Pattern-based modulation from ONNX model

### Threading Model
- **GUI Thread** - User interaction, parameter updates
- **Audio Thread** - Real-time DSP (lock-free, no allocations)
- **AI Worker Thread** - ONNX inference (can allocate)
- **Communication** - Lock-free SPSC queue between AI and audio threads

---

## Implementation Phases

### Phase 1: Project Setup & Build System
**Status:** ⏳ Pending

**Tasks:**
- [ ] Install JUCE framework
- [ ] Create CMake build configuration
- [ ] Set up JUCE VST3 project structure
- [ ] Configure build for macOS (initial target)
- [ ] Verify plugin loads in DAW

**Files to create:**
- `CMakeLists.txt`
- `src/plugin/PluginProcessor.h`
- `src/plugin/PluginProcessor.cpp`
- `src/plugin/PluginEditor.h`
- `src/plugin/PluginEditor.cpp`

**Estimated time:** 4-6 hours

### Phase 2: DSP Engine - Oscillator & Filter
**Status:** ⏳ Pending

**Tasks:**
- [ ] Implement wavetable oscillator
- [ ] Create basic wavetables (saw, square, sine)
- [ ] Implement low-pass filter (Moog-style ladder filter)
- [ ] Add MIDI note handling
- [ ] Test audio output

**Files to create:**
- `src/dsp/Oscillator.h`
- `src/dsp/Oscillator.cpp`
- `src/dsp/Filter.h`
- `src/dsp/Filter.cpp`
- `src/utils/Wavetables.h`
- `src/utils/Wavetables.cpp`

**Estimated time:** 8-10 hours

### Phase 3: DSP Engine - Distortion & Envelope
**Status:** ⏳ Pending

**Tasks:**
- [ ] Implement distortion module (soft clip, hard clip, wavefold)
- [ ] Implement ADSR envelope
- [ ] Connect signal chain: oscillator → filter → distortion → envelope
- [ ] Test complete signal path

**Files to create:**
- `src/dsp/Distortion.h`
- `src/dsp/Distortion.cpp`
- `src/dsp/Envelope.h`
- `src/dsp/Envelope.cpp`

**Estimated time:** 6-8 hours

### Phase 4: Modulation System
**Status:** ⏳ Pending

**Tasks:**
- [ ] Implement LFO module
- [ ] Create modulation matrix/routing system
- [ ] Connect LFO to filter cutoff
- [ ] Add manual modulation controls
- [ ] Test wobble effect manually

**Files to create:**
- `src/dsp/LFO.h`
- `src/dsp/LFO.cpp`
- `src/modulation/ModulationMatrix.h`
- `src/modulation/ModulationMatrix.cpp`
- `src/modulation/ModulationSource.h`

**Estimated time:** 6-8 hours

### Phase 5: AI Integration - ONNX Setup
**Status:** ⏳ Pending

**Tasks:**
- [ ] Integrate ONNX Runtime into build
- [ ] Create ONNX inference wrapper
- [ ] Implement lock-free queue for thread communication
- [ ] Create AI worker thread
- [ ] Test ONNX model loading (use dummy model initially)

**Files to create:**
- `src/ai/ONNXInference.h`
- `src/ai/ONNXInference.cpp`
- `src/ai/LockFreeQueue.h`
- `src/ai/PatternGenerator.h`
- `src/ai/PatternGenerator.cpp`

**Estimated time:** 8-10 hours

### Phase 6: AI Pattern Generation
**Status:** ⏳ Pending

**Tasks:**
- [ ] Create simple PyTorch model (LSTM or small Transformer)
- [ ] Train on synthetic wobble patterns
- [ ] Export model to ONNX format
- [ ] Integrate ONNX model into plugin
- [ ] Map AI output to modulation parameters
- [ ] Test AI-generated patterns

**Files to create:**
- `python/training/model.py`
- `python/training/train_pattern_model.py`
- `python/training/dataset.py`
- `python/models/wobble_pattern_v1.onnx`
- `src/modulation/AIModulationSource.h`
- `src/modulation/AIModulationSource.cpp`

**Estimated time:** 12-16 hours

### Phase 7: GUI Implementation
**Status:** ⏳ Pending

**Tasks:**
- [ ] Design minimal UI layout
- [ ] Implement synth parameter controls (cutoff, resonance, distortion)
- [ ] Add "Generate Pattern" button
- [ ] Add modulation curve visualization
- [ ] Connect GUI to parameters

**Files to modify:**
- `src/plugin/PluginEditor.h`
- `src/plugin/PluginEditor.cpp`

**Estimated time:** 8-10 hours

### Phase 8: Testing & Polish
**Status:** ⏳ Pending

**Tasks:**
- [ ] Test in multiple DAWs (Ableton, FL Studio, Logic)
- [ ] Verify real-time performance (no glitches)
- [ ] Test AI pattern generation latency
- [ ] Add preset system (basic)
- [ ] Fix bugs and optimize

**Estimated time:** 6-8 hours

---

## Testing Strategy

### Unit Tests
- [ ] Test oscillator frequency accuracy
- [ ] Test filter cutoff response
- [ ] Test envelope timing
- [ ] Test LFO rate accuracy
- [ ] Test lock-free queue thread safety

### Integration Tests
- [ ] Test complete signal chain
- [ ] Test MIDI note on/off
- [ ] Test AI pattern generation end-to-end
- [ ] Test parameter automation from DAW

### Manual Testing
- [ ] Load plugin in Ableton Live
- [ ] Load plugin in FL Studio
- [ ] Test MIDI input from keyboard
- [ ] Generate AI patterns and verify modulation
- [ ] Test CPU usage (should be < 5% on modern CPU)

### Performance Benchmarks
- [ ] Audio callback execution time < 1ms (at 512 sample buffer)
- [ ] AI pattern generation < 100ms
- [ ] No audio dropouts or glitches
- [ ] Memory usage < 100MB

---

## Documentation Updates

### After Completion, Update:

- [ ] **user-guide.md** - Add MVP features section
  - How to load the plugin
  - How to play notes
  - How to generate AI patterns
  - Parameter descriptions
  - Tips for creating wobble bass sounds

- [ ] **api-reference.md** - N/A (no API for MVP)

- [ ] **architecture.md** - Already updated with system design

- [ ] **troubleshooting.md** - Add common issues
  - Plugin doesn't load in DAW
  - No sound output
  - Audio glitches/dropouts
  - AI pattern generation fails

- [ ] **getting-started.md** - Add build and installation instructions

---

## Dependencies

### External Libraries
- **JUCE 7.x** - Audio plugin framework
- **ONNX Runtime 1.16+** - AI model inference
- **CMake 3.20+** - Build system

### Python Dependencies (for AI training)
- **PyTorch 2.0+** - Neural network training
- **NumPy** - Numerical operations
- **ONNX** - Model export

### Internal Dependencies
- None (this is the first feature)

---

## Risks & Considerations

### Technical Risks
- **Risk 1: ONNX Runtime integration complexity**
  - Mitigation: Start with simple dummy model, test integration early
  
- **Risk 2: Real-time audio performance**
  - Mitigation: Profile early, use lock-free patterns, pre-allocate buffers
  
- **Risk 3: AI model quality**
  - Mitigation: MVP uses simple patterns, quality can improve post-MVP
  
- **Risk 4: Cross-platform build issues**
  - Mitigation: Focus on macOS first, add Windows/Linux later

### Breaking Changes
- None (initial implementation)

### Simplification Decisions
- **No audio import** - Deferred to post-MVP
- **No source separation** - Deferred to post-MVP
- **Simple GUI** - Minimal controls, polish later
- **Basic presets** - Full preset management later

---

## Progress Log

### 2026-03-10
- Created implementation plan
- Documented architecture in architecture.md
- Ready to begin Phase 1

---

## Completion Checklist

- [ ] All phases completed
- [ ] All tests passing
- [ ] Plugin loads in at least 2 DAWs
- [ ] AI pattern generation working
- [ ] Documentation updated (user-guide, troubleshooting, getting-started)
- [ ] Code follows real-time audio best practices
- [ ] No memory leaks
- [ ] CPU usage acceptable
- [ ] Plan archived to `/docs/archive/implementation-notes/mvp-synth-engine/`

---

## Notes

### Design Philosophy
- **Baseline-first**: Build simplest version that works, measure performance, then optimize
- **Small steps**: Complete one phase before moving to next
- **Real-time safety**: Never allocate or lock in audio thread
- **AI as enhancement**: Synth must work without AI, AI adds creative patterns

### Future Enhancements (Post-MVP)
- Audio track import and analysis
- Source separation (Demucs)
- Automatic pattern extraction from bass stems
- Advanced wavetable generation
- Resampling engine
- More sophisticated AI models trained on real DnB tracks
- Preset library
- Advanced GUI with spectrum analyzer
