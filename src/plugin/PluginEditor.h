#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

class WobblerAudioProcessorEditor : public juce::AudioProcessorEditor
{
public:
    WobblerAudioProcessorEditor(WobblerAudioProcessor&);
    ~WobblerAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    WobblerAudioProcessor& audioProcessor;
    
    juce::Slider cutoffSlider;
    juce::Slider resonanceSlider;
    juce::Slider distortionSlider;
    juce::Slider attackSlider;
    juce::Slider decaySlider;
    juce::Slider sustainSlider;
    juce::Slider releaseSlider;
    juce::Slider lfoRateSlider;
    juce::Slider lfoDepthSlider;
    
    juce::Label cutoffLabel;
    juce::Label resonanceLabel;
    juce::Label distortionLabel;
    juce::Label attackLabel;
    juce::Label decayLabel;
    juce::Label sustainLabel;
    juce::Label releaseLabel;
    juce::Label lfoRateLabel;
    juce::Label lfoDepthLabel;
    
    juce::TextButton generateButton;
    
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> cutoffAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> resonanceAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> distortionAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> attackAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> decayAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> sustainAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> releaseAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> lfoRateAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> lfoDepthAttachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WobblerAudioProcessorEditor)
};
