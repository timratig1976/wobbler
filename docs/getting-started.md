# Getting Started

Quick start guide to build and run the Wobbler VST3 synthesizer plugin.

---

## Prerequisites

### Required Software

**For Plugin Development (C++):**
- **CMake 3.20+** - Build system
- **JUCE 7.x** - Audio plugin framework
- **C++17 compiler:**
  - macOS: Xcode 13+ (includes Clang)
  - Windows: Visual Studio 2019+ (MSVC)
  - Linux: GCC 9+ or Clang 10+
- **Git** - Version control

**For AI Training (Python):**
- **Python 3.10+**
- **pip** - Python package manager
- **Virtual environment** (recommended: venv or conda)

**For Testing:**
- **DAW** - Ableton Live, FL Studio, Logic Pro, or Bitwig

---

## Installation

### 1. Clone the Repository

```bash
git clone <wobbler-repo-url>
cd wobbler
```

### 2. Install JUCE Framework

Download JUCE from [https://juce.com/get-juce](https://juce.com/get-juce)

```bash
# Extract JUCE to the project directory
cd wobbler
git clone https://github.com/juce-framework/JUCE.git
cd JUCE
git checkout 7.0.9  # or latest stable version
```

### 3. Set Up Python Environment (for AI training)

```bash
cd python

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

## Building the Plugin

### macOS

```bash
# From project root
mkdir build
cd build

# Configure with CMake
cmake .. -G "Xcode"

# Build
cmake --build . --config Release

# Plugin will be in:
# build/Wobbler_artefacts/Release/VST3/Wobbler.vst3
```

### Windows

```bash
# From project root
mkdir build
cd build

# Configure with CMake
cmake .. -G "Visual Studio 17 2022"

# Build
cmake --build . --config Release

# Plugin will be in:
# build\Wobbler_artefacts\Release\VST3\Wobbler.vst3
```

### Linux

```bash
# From project root
mkdir build
cd build

# Configure with CMake
cmake ..

# Build
make -j4

# Plugin will be in:
# build/Wobbler_artefacts/VST3/Wobbler.vst3
```

---

## Installing the Plugin

### macOS

```bash
# Copy to system VST3 folder
cp -r build/Wobbler_artefacts/Release/VST3/Wobbler.vst3 \
  ~/Library/Audio/Plug-Ins/VST3/
```

### Windows

```bash
# Copy to system VST3 folder
copy build\Wobbler_artefacts\Release\VST3\Wobbler.vst3 \
  "C:\Program Files\Common Files\VST3\"
```

### Linux

```bash
# Copy to system VST3 folder
cp -r build/Wobbler_artefacts/VST3/Wobbler.vst3 \
  ~/.vst3/
```

---

## First Steps

### 1. Load Plugin in DAW

**Ableton Live:**
1. Open Ableton Live
2. Rescan plugins (Preferences → Plug-ins → Rescan)
3. Create MIDI track
4. Add Wobbler from Instruments

**FL Studio:**
1. Open FL Studio
2. Refresh plugin list (Options → Manage plugins → Find plugins)
3. Add Wobbler from Plugin Picker

**Logic Pro:**
1. Open Logic Pro
2. Rescan plugins (Logic Pro → Preferences → Plug-in Manager → Reset & Rescan)
3. Create Software Instrument track
4. Select Wobbler from AU Instruments

### 2. Play Your First Wobble Bass

1. **Load the plugin** in your DAW
2. **Play MIDI notes** (try C1-C3 range for bass)
3. **Adjust filter cutoff** - controls brightness
4. **Adjust LFO rate** - controls wobble speed
5. **Adjust distortion** - adds harmonic content

Example:
1. Navigate to `/dashboard`
2. Click "Create New Item"
3. Fill in the form
4. Submit

---

## Development Workflow

### Planning a Feature

```bash
# Create a feature plan
cp docs/kanban/TEMPLATE-feature-plan.md docs/kanban/backlog/my-feature-plan.md

# Edit the plan, then move to in-progress when ready
mv docs/kanban/backlog/my-feature-plan.md docs/kanban/in-progress/
```

### Making Changes

1. **Write a map** - What you're changing and why (2 min)
2. **Build simple** - Start with the simplest version
3. **Test often** - Run tests after each small change
4. **Document** - Update relevant docs when done

See [Development Rules](instructions/DEVELOPMENT_RULES.md) for details.

### Testing Your Changes

```bash
# ⚠️ CUSTOMIZE THESE COMMANDS

# Type check
npm run type-check

# Run tests
npm test

# Build
npm run build
```

---

## Common Setup Issues

### Issue: Dependencies Won't Install

**Symptom:** Package installation fails

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Or for other package managers:
rm -rf vendor && composer install
rm -rf venv && pip install -r requirements.txt
```

### Issue: Database Connection Failed

**Symptom:** Can't connect to database

**Solution:**
1. Check database is running
2. Verify credentials in `.env`
3. Ensure database exists
4. Check firewall/network settings

### Issue: Port Already in Use

**Symptom:** `EADDRINUSE` or port conflict error

**Solution:**
```bash
# Find and kill process using the port
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

---

## Next Steps

- **[User Guide](user-guide.md)** - Learn how to use features
- **[Development Rules](instructions/DEVELOPMENT_RULES.md)** - Coding standards
- **[Testing Guide](instructions/testing-guide.md)** - How to test
- **[Deployment](deployment.md)** - Deploy to production

---

## Need Help?

- **Common Issues:** [Troubleshooting](troubleshooting.md)
- **API Questions:** [API Reference](api-reference.md)
- **Architecture:** [Architecture Guide](architecture.md)

---

**You're ready to start building!**
