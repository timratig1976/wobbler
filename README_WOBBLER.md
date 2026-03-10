# Wobbler - AI-Driven Wobble Bass VST3 Synthesizer

**An intelligent bass synthesizer that uses AI to generate Drum & Bass / Dubstep wobble patterns.**

---

## What is Wobbler?

Wobbler is a VST3 audio plugin that combines real-time wavetable synthesis with AI-generated modulation patterns. It's designed specifically for creating wobble bass sounds common in Drum & Bass and Dubstep music.

**Core Features:**
- Wavetable bass synthesizer with filter, distortion, and envelope
- AI-powered modulation pattern generator
- Real-time wobble effect via LFO and AI modulation
- Cross-platform (macOS, Windows, Linux)

---

## Quick Start

### Build the Plugin

```bash
# Install JUCE framework
git clone https://github.com/juce-framework/JUCE.git

# Build
mkdir build && cd build
cmake .. -G "Xcode"  # macOS
cmake --build . --config Release

# Install
cp -r build/Wobbler_artefacts/Release/VST3/Wobbler.vst3 \
  ~/Library/Audio/Plug-Ins/VST3/
```

### Train AI Model

```bash
cd python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python training/train_pattern_model.py --model lstm --epochs 100
```

**Full setup:** See [Getting Started](docs/getting-started.md)

---

## Project Status

**Current Phase:** MVP Development (Phase 1-8)

- ✅ Architecture documented
- ✅ C++ project structure scaffolded
- ✅ Python AI training environment set up
- ⏳ DSP engine implementation (next)
- ⏳ AI integration (Phase 5-6)
- ⏳ GUI implementation (Phase 7)

**See:** [MVP Implementation Plan](docs/kanban/backlog/mvp-synth-engine-plan.md)

---

## Documentation

- **[Getting Started](docs/getting-started.md)** - Installation and build instructions
- **[Architecture](docs/architecture.md)** - System design and technical details
- **[MVP Plan](docs/kanban/backlog/mvp-synth-engine-plan.md)** - Development roadmap
- **[User Guide](docs/user-guide.md)** - Feature documentation (coming soon)

---

## Technology Stack

**Plugin:**
- JUCE 7.x (C++) - Audio plugin framework
- CMake - Build system
- ONNX Runtime - AI model inference

**AI Training:**
- PyTorch - Neural network training
- Librosa - Audio feature extraction
- ONNX - Model export format

---

## Project Structure

```
wobbler/
├── src/                    # C++ plugin source
│   ├── plugin/            # JUCE wrapper
│   ├── dsp/               # Audio processing
│   ├── modulation/        # Modulation system
│   └── ai/                # AI inference
├── python/                # AI training
│   ├── training/          # Model training
│   └── preprocessing/     # Audio analysis
├── docs/                  # Documentation
└── CMakeLists.txt         # Build config
```

---

## Development Workflow

1. **Plan** - Create feature plan in `docs/kanban/backlog/`
2. **Build** - Implement following baseline-first approach
3. **Test** - Verify in DAW
4. **Document** - Update core docs
5. **Archive** - Move plan to `docs/archive/`

**See:** [Development Rules](docs/instructions/DEVELOPMENT_RULES.md)

---

## Contributing

This project follows strict documentation and development policies:

- **6 core docs only** - Never create new top-level docs
- **Kanban workflow** - All features tracked in `docs/kanban/`
- **Baseline-first** - Build simplest version, measure, then optimize
- **Small steps** - Max 2-3 files per change, verify after each

**See:** [Documentation Policy](.windsurf/CASCADE_DOCUMENTATION_POLICY.md)

---

## License

TBD

---

## Roadmap

### MVP (Current)
- ✅ Project setup
- ⏳ DSP engine (oscillator, filter, distortion, envelope)
- ⏳ Modulation system (LFO, AI modulation)
- ⏳ AI pattern generator (ONNX integration)
- ⏳ Basic GUI

### Post-MVP
- Audio track import and analysis
- Source separation (Demucs)
- Automatic pattern extraction from bass stems
- Advanced wavetable generation
- Resampling engine
- Preset library

---

**Built with JUCE | Powered by AI**
