#!/bin/bash
# Wobbler Quick Test Script
# Run this before every commit

set -e  # Exit on error

echo "🧪 Wobbler Test Suite"
echo "===================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Level 1: Web Prototype
echo "📱 Level 1: Web Prototype"
echo "-------------------------"

run_test "Web prototype files exist" \
    "test -f web-prototype/index.html && test -f web-prototype/synth.js"

run_test "Web prototype HTML valid" \
    "grep -q 'Wobbler' web-prototype/index.html"

run_test "Web prototype JS valid" \
    "grep -q 'WobblerSynth' web-prototype/synth.js"

echo ""

# Level 2: C++ Source
echo "🔧 Level 2: C++ Source Code"
echo "---------------------------"

run_test "CMakeLists.txt exists" \
    "test -f CMakeLists.txt"

run_test "Plugin processor exists" \
    "test -f src/plugin/PluginProcessor.h && test -f src/plugin/PluginProcessor.cpp"

run_test "DSP modules exist" \
    "test -f src/dsp/Oscillator.h && test -f src/dsp/Filter.h && test -f src/dsp/Distortion.h"

run_test "Modulation system exists" \
    "test -f src/modulation/ModulationMatrix.h && test -f src/modulation/AIModulationSource.h"

run_test "AI engine exists" \
    "test -f src/ai/ONNXInference.h && test -f src/ai/PatternGenerator.h"

echo ""

# Level 3: Python AI
echo "🤖 Level 3: Python AI Training"
echo "-------------------------------"

run_test "Python requirements exist" \
    "test -f python/requirements.txt"

run_test "Model architecture exists" \
    "test -f python/training/model.py"

run_test "Training script exists" \
    "test -f python/training/train_pattern_model.py"

run_test "Feature extraction exists" \
    "test -f python/preprocessing/feature_extraction.py"

echo ""

# Documentation
echo "📚 Documentation"
echo "----------------"

run_test "Architecture documented" \
    "test -f docs/architecture.md && grep -q 'JUCE' docs/architecture.md"

run_test "Getting started guide exists" \
    "test -f docs/getting-started.md"

run_test "Testing guide exists" \
    "test -f docs/instructions/testing-guide.md"

run_test "MVP plan exists" \
    "test -f docs/kanban/in-progress/mvp-synth-engine-plan.md"

echo ""

# Optional: Build test (only if JUCE installed)
if [ -d "JUCE" ]; then
    echo "🏗️  Level 4: Build Test (Optional)"
    echo "----------------------------------"
    
    if [ -d "build" ]; then
        run_test "Build directory exists" "test -d build"
        
        if [ -f "build/CMakeCache.txt" ]; then
            echo -e "${YELLOW}ℹ Build configured. Run 'cd build && cmake --build . --config Release' to build.${NC}"
        else
            echo -e "${YELLOW}ℹ Build not configured. Run 'mkdir build && cd build && cmake .. -G Xcode' first.${NC}"
        fi
    else
        echo -e "${YELLOW}ℹ No build directory. Create with 'mkdir build && cd build && cmake .. -G Xcode'${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}ℹ JUCE not installed. Skipping build tests.${NC}"
    echo -e "${YELLOW}  Install with: git clone https://github.com/juce-framework/JUCE.git${NC}"
    echo ""
fi

# Summary
echo "===================="
echo "📊 Test Summary"
echo "===================="
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Ready to commit.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Fix issues before committing.${NC}"
    exit 1
fi
