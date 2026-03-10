# Installation Instructions

Step-by-step guide to install JUCE and build Wobbler.

---

## Step 1: Install JUCE Framework

### Option A: Clone from GitHub (Recommended)

```bash
cd /Users/timratig/CascadeProjects/wobbler

# Clone JUCE into project directory
git clone https://github.com/juce-framework/JUCE.git

# Checkout stable version
cd JUCE
git checkout 7.0.9
cd ..
```

### Option B: Download from JUCE Website

1. Visit [https://juce.com/get-juce](https://juce.com/get-juce)
2. Download JUCE 7.x
3. Extract to `/Users/timratig/CascadeProjects/wobbler/JUCE`

---

## Step 2: Verify Prerequisites

### macOS

```bash
# Check Xcode is installed
xcodebuild -version
# Should show: Xcode 13.0 or later

# Check CMake is installed
cmake --version
# Should show: cmake version 3.20 or later

# If CMake not installed:
brew install cmake
```

### Windows

- Visual Studio 2019 or later with C++ tools
- CMake 3.20+ (download from cmake.org)

### Linux

```bash
# Install build tools
sudo apt-get update
sudo apt-get install build-essential cmake

# Install JUCE dependencies
sudo apt-get install libasound2-dev libjack-jackd2-dev \
  ladspa-sdk libcurl4-openssl-dev libfreetype6-dev \
  libx11-dev libxcomposite-dev libxcursor-dev libxcursor-dev \
  libxext-dev libxinerama-dev libxrandr-dev libxrender-dev \
  libwebkit2gtk-4.0-dev libglu1-mesa-dev mesa-common-dev
```

---

## Step 3: Build Wobbler

```bash
cd /Users/timratig/CascadeProjects/wobbler

# Create build directory
mkdir build
cd build

# Configure (macOS)
cmake .. -G "Xcode"

# Configure (Windows)
cmake .. -G "Visual Studio 17 2022"

# Configure (Linux)
cmake ..

# Build
cmake --build . --config Release

# This will take 5-10 minutes on first build
```

---

## Step 4: Install Plugin

### macOS

```bash
# Copy to system VST3 folder
cp -r build/Wobbler_artefacts/Release/VST3/Wobbler.vst3 \
  ~/Library/Audio/Plug-Ins/VST3/

# Copy to AU folder (if built)
cp -r build/Wobbler_artefacts/Release/AU/Wobbler.component \
  ~/Library/Audio/Plug-Ins/Components/
```

### Windows

```bash
# Copy to system VST3 folder
copy build\Wobbler_artefacts\Release\VST3\Wobbler.vst3 \
  "C:\Program Files\Common Files\VST3\"
```

### Linux

```bash
# Copy to user VST3 folder
mkdir -p ~/.vst3
cp -r build/Wobbler_artefacts/VST3/Wobbler.vst3 ~/.vst3/
```

---

## Step 5: Test in DAW

1. **Restart your DAW** (or rescan plugins)
2. **Create MIDI track**
3. **Load Wobbler** from instruments
4. **Play notes** - you should hear sound!

---

## Troubleshooting

### "JUCE not found" error

```bash
# Verify JUCE directory exists
ls JUCE/modules
# Should show: juce_audio_basics, juce_audio_devices, etc.

# If missing, clone JUCE:
git clone https://github.com/juce-framework/JUCE.git
```

### Build fails on macOS

```bash
# Install Xcode command line tools
xcode-select --install

# Accept Xcode license
sudo xcodebuild -license accept
```

### Plugin doesn't appear in DAW

- Check plugin was copied to correct folder
- Rescan plugins in DAW preferences
- Check DAW plugin blacklist/blocklist
- macOS: Check System Preferences → Security for blocked plugins

---

## Next Steps

- See [Getting Started](docs/getting-started.md) for usage
- See [MVP Plan](docs/kanban/in-progress/mvp-synth-engine-plan.md) for development phases
