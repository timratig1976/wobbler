# Testing Guide

Comprehensive testing strategy for Wobbler VST3 synthesizer.

---

## Testing Levels

Wobbler uses a **3-tier testing approach**:

1. **Web Prototype** - Instant browser testing (no build required)
2. **C++ Unit Tests** - DSP module verification
3. **DAW Integration** - Real-world plugin testing

---

## Level 1: Web Prototype Testing (Fastest - 30 seconds)

**Purpose:** Verify synthesis logic and parameter behavior instantly.

### Quick Start

```bash
cd web-prototype
python3 -m http.server 8000
# Open http://localhost:8000
```

### Test Checklist

- [ ] **Oscillator works** - Notes produce sound
- [ ] **Filter responds** - Cutoff changes brightness
- [ ] **LFO modulates** - Wobble effect audible
- [ ] **Distortion works** - Adds harmonic content
- [ ] **Envelope shapes** - Attack/release timing correct
- [ ] **AI pattern generation** - Parameters animate smoothly

**When to use:** Quick parameter tweaks, algorithm verification, UI mockups.

---

## Level 2: C++ Build Verification (2-3 minutes)

**Purpose:** Ensure plugin compiles and basic functionality works.

### Build Test

```bash
cd build
cmake --build . --config Release

# Check build succeeded
test -f Wobbler_artefacts/Release/VST3/Wobbler.vst3 && \
  echo "✅ Build successful" || \
  echo "❌ Build failed"
```

### Compilation Checks

- [ ] **No compiler errors**
- [ ] **No warnings** (or acceptable warnings documented)
- [ ] **VST3 file created**
- [ ] **File size reasonable** (~1-5 MB)

---

## Level 3: DAW Integration Testing (5-10 minutes)

**Purpose:** Verify plugin works in real production environment.

### Installation Test

```bash
# macOS
cp -r build/Wobbler_artefacts/Release/VST3/Wobbler.vst3 \
  ~/Library/Audio/Plug-Ins/VST3/

# Verify installation
ls -lh ~/Library/Audio/Plug-Ins/VST3/Wobbler.vst3
```

### DAW Test Checklist

**In Ableton Live / FL Studio / Logic Pro:**

- [ ] **Plugin loads** - Appears in instrument list
- [ ] **GUI displays** - All controls visible
- [ ] **MIDI input works** - Notes trigger sound
- [ ] **Parameters respond** - Knobs affect sound
- [ ] **No audio glitches** - Clean playback
- [ ] **CPU usage acceptable** - <5% on modern CPU
- [ ] **Automation works** - DAW can automate parameters
- [ ] **Preset save/load** - State persists (when implemented)

---

## DSP Module Testing

### Oscillator Tests

```bash
# Test frequency accuracy
# Expected: 440 Hz input → 440 Hz output

# Test wavetable interpolation
# Expected: Smooth waveform, no clicks

# Test phase continuity
# Expected: No phase jumps on frequency change
```

**Manual verification:**
- [ ] Plays correct pitch
- [ ] No clicks or pops
- [ ] Smooth frequency changes

### Filter Tests

```bash
# Test cutoff range
# Expected: 20 Hz - 20 kHz functional

# Test resonance
# Expected: Self-oscillation at Q > 20

# Test modulation
# Expected: Smooth cutoff changes
```

**Manual verification:**
- [ ] Filter sweeps smoothly
- [ ] Resonance adds emphasis
- [ ] No instability or NaN values

### Envelope Tests

```bash
# Test attack timing
# Expected: 10ms attack = 10ms fade-in

# Test release timing
# Expected: 200ms release = 200ms fade-out

# Test note-off during attack
# Expected: Smooth transition to release
```

**Manual verification:**
- [ ] Attack time accurate
- [ ] Release time accurate
- [ ] No clicks on note-off

---

## Python AI Testing

### Model Training Test

```bash
cd python
source venv/bin/activate

# Quick training test (10 epochs)
python training/train_pattern_model.py \
  --model lstm \
  --epochs 10 \
  --batch_size 32

# Expected: Loss decreases, no errors
```

**Success criteria:**
- [ ] Training completes without errors
- [ ] Loss decreases over epochs
- [ ] ONNX export succeeds

### Feature Extraction Test

```bash
# Test with sample audio
python preprocessing/feature_extraction.py \
  test_audio.wav \
  output.npz

# Expected: NPZ file created with features
```

**Manual verification:**
- [ ] Features extracted successfully
- [ ] Output file contains expected arrays
- [ ] No NaN or infinite values

---

## Performance Testing

### CPU Usage Test

**In DAW:**
1. Load plugin on track
2. Play sustained note
3. Check CPU meter

**Expected:**
- Idle: <1% CPU
- Playing: <5% CPU
- With LFO: <7% CPU

### Latency Test

**Expected values:**
- Plugin latency: 0 samples (no lookahead)
- Processing time: <1ms per buffer (512 samples @ 44.1kHz)

### Memory Test

```bash
# Check plugin memory usage
# Expected: <100 MB

# Check for memory leaks
# Play notes for 5 minutes, check memory stable
```

---

## Regression Testing

### After Code Changes

**Quick regression check:**
```bash
# 1. Web prototype still works
cd web-prototype && python3 -m http.server 8000

# 2. C++ builds without errors
cd build && cmake --build . --config Release

# 3. Plugin loads in DAW
# Manual: Load in Ableton/FL Studio
```

### Critical Paths

- [ ] **MIDI → Sound** - Notes produce audio
- [ ] **Parameter → DSP** - Knobs affect sound
- [ ] **LFO → Filter** - Wobble effect works
- [ ] **Envelope → Amplitude** - Note on/off works

---

## Pre-Commit Checklist

Before committing code:

- [ ] **Web prototype tested** - Still works
- [ ] **C++ compiles** - No errors or new warnings
- [ ] **Plugin loads** - Tested in at least one DAW
- [ ] **No audio glitches** - Clean playback
- [ ] **Documentation updated** - If behavior changed
- [ ] **MVP plan updated** - Phase status current

---

## Pre-Release Checklist

Before releasing a version:

- [ ] **All 3 test levels pass**
- [ ] **Tested in 3+ DAWs** (Ableton, FL Studio, Logic)
- [ ] **CPU usage acceptable** (<10% typical use)
- [ ] **No memory leaks** (5+ minute test)
- [ ] **AI model works** (if integrated)
- [ ] **Presets load/save** (when implemented)
- [ ] **Documentation complete**
- [ ] **Known issues documented**

---

## Troubleshooting

### Web Prototype Issues

**No sound:**
```bash
# Check browser console for errors
# Ensure audio context resumed (click page first)
```

**Parameters don't respond:**
```bash
# Check JavaScript console
# Verify slider event listeners attached
```

### C++ Build Issues

**JUCE not found:**
```bash
# Verify JUCE directory exists
ls JUCE/modules

# Re-clone if missing
git clone https://github.com/juce-framework/JUCE.git
```

**Linker errors:**
```bash
# Clean build
rm -rf build
mkdir build && cd build
cmake .. -G "Xcode"
cmake --build . --config Release
```

### DAW Integration Issues

**Plugin doesn't appear:**
```bash
# Verify installation path
ls ~/Library/Audio/Plug-Ins/VST3/Wobbler.vst3

# Rescan plugins in DAW
# Check DAW plugin blacklist
```

**Audio glitches:**
```bash
# Increase buffer size in DAW (512 or 1024 samples)
# Check for allocations in audio thread (use profiler)
# Verify lock-free queue implementation
```

---

## Testing Workflow

### Daily Development

```bash
# 1. Make code changes
# 2. Test in web prototype (30 sec)
cd web-prototype && python3 -m http.server 8000

# 3. If web works, rebuild C++ (2 min)
cd build && cmake --build . --config Release

# 4. Test in DAW (5 min)
# Load plugin, play notes, verify changes
```

### Before Commit

```bash
# 1. Web prototype works
# 2. C++ builds clean
# 3. Plugin loads in DAW
# 4. No regressions
# 5. Docs updated
```

### Before Phase Completion

```bash
# 1. All phase tasks complete
# 2. All 3 test levels pass
# 3. Performance acceptable
# 4. Documentation updated
# 5. Move plan to completed
```

---

## Success Criteria

### Minimum for Commit
- ✅ Web prototype works
- ✅ C++ compiles without errors
- ✅ Plugin loads in at least one DAW

### Minimum for Phase Completion
- ✅ All of the above
- ✅ All phase tasks complete
- ✅ Performance targets met
- ✅ Documentation updated
- ✅ No known critical bugs

### Minimum for Release
- ✅ All phases complete
- ✅ Tested in 3+ DAWs
- ✅ CPU usage <10%
- ✅ No memory leaks
- ✅ User documentation complete

---

## Quick Reference

**Fastest test:** Web prototype (30 sec)  
**Standard test:** Build + DAW load (5 min)  
**Full test:** All 3 levels + performance (15 min)

**Test before every commit. Ship with confidence.**
