cmake_minimum_required(VERSION 3.20)

project(Wobbler VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# JUCE setup
add_subdirectory(JUCE)

# Plugin configuration
juce_add_plugin(Wobbler
    COMPANY_NAME "WobblerAudio"
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD TRUE
    PLUGIN_MANUFACTURER_CODE Wbbl
    PLUGIN_CODE Wob1
    FORMATS VST3 Standalone
    PRODUCT_NAME "Wobbler"
)

# Source files
target_sources(Wobbler
    PRIVATE
        src/plugin/PluginProcessor.cpp
        src/plugin/PluginEditor.cpp
        src/dsp/Oscillator.cpp
        src/dsp/Filter.cpp
        src/dsp/Distortion.cpp
        src/dsp/Envelope.cpp
        src/dsp/LFO.cpp
        src/modulation/ModulationMatrix.cpp
        src/modulation/AIModulationSource.cpp
        src/ai/ONNXInference.cpp
        src/ai/PatternGenerator.cpp
        src/utils/Wavetables.cpp
)

# JUCE modules
target_compile_definitions(Wobbler
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(Wobbler
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# ONNX Runtime integration (to be added later)
# find_package(onnxruntime REQUIRED)
# target_link_libraries(Wobbler PRIVATE onnxruntime)
