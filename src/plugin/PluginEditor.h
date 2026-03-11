#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

// Minimal placeholder editor — full 3-voice UI to be built in a subsequent task
class WobblerAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    explicit WobblerAudioProcessorEditor(WobblerAudioProcessor&);
    ~WobblerAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    WobblerAudioProcessor& audioProcessor;

    // Global knobs wired to APVTS
    juce::Slider masterVolSlider;
    juce::Slider bpmSlider;
    juce::Label  masterVolLabel;
    juce::Label  bpmLabel;

    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> masterVolAtt;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> bpmAtt;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WobblerAudioProcessorEditor)
};
