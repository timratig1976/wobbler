# Testing Quick Reference

**Simple, fast testing approach for Wobbler development.**

---

## 🚀 Quick Test (30 seconds)

```bash
./test.sh
```

This verifies all source files exist and are valid. **Run before every commit.**

---

## 🎹 Interactive Test (2 minutes)

**Test the synth in your browser:**

```bash
cd web-prototype
python3 -m http.server 8000
# Open http://localhost:8000
```

**What to test:**
- Click keys → sound plays
- Adjust cutoff → brightness changes
- Adjust LFO rate → wobble speed changes
- Click "Generate AI Pattern" → parameters animate

**This is the fastest way to verify synthesis logic works.**

---

## 🏗️ Build Test (5 minutes)

**When JUCE is installed:**

```bash
cd build
cmake --build . --config Release

# Verify build succeeded
ls -lh Wobbler_artefacts/Release/VST3/Wobbler.vst3
```

---

## 🎚️ DAW Test (10 minutes)

**After building:**

```bash
# Install plugin
cp -r build/Wobbler_artefacts/Release/VST3/Wobbler.vst3 \
  ~/Library/Audio/Plug-Ins/VST3/

# Restart DAW and load plugin
```

**Test checklist:**
- [ ] Plugin appears in instrument list
- [ ] GUI displays correctly
- [ ] MIDI notes trigger sound
- [ ] Parameters affect sound
- [ ] No audio glitches
- [ ] CPU usage <5%

---

## 📋 Pre-Commit Checklist

```bash
# 1. Run automated tests
./test.sh

# 2. Test in web prototype
cd web-prototype && python3 -m http.server 8000

# 3. If C++ changed, rebuild
cd build && cmake --build . --config Release

# 4. If build changed, test in DAW
# Load plugin, play notes, verify no regressions
```

---

## 🎯 Testing Philosophy

**3-Tier Approach:**

1. **Web Prototype** - Instant feedback, no build required
2. **Automated Tests** - File structure and validity checks
3. **DAW Integration** - Real-world verification

**Test early, test often. The web prototype makes this painless.**

---

## 📖 Full Testing Guide

See `docs/instructions/testing-guide.md` for comprehensive testing documentation including:
- DSP module testing
- Performance benchmarks
- Python AI testing
- Regression testing
- Troubleshooting

---

**Keep it simple. Run `./test.sh` before every commit.**
