#include "PluginProcessor.h"
#include "PluginEditor.h"

WobblerAudioProcessorEditor::WobblerAudioProcessorEditor(WobblerAudioProcessor& p)
    : AudioProcessorEditor(&p), audioProcessor(p)
{
    setSize(600, 400);
    
    auto setupSlider = [this](juce::Slider& slider, juce::Label& label, const juce::String& labelText)
    {
        addAndMakeVisible(slider);
        slider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
        slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
        
        addAndMakeVisible(label);
        label.setText(labelText, juce::dontSendNotification);
        label.attachToComponent(&slider, false);
        label.setJustificationType(juce::Justification::centredTop);
    };
    
    setupSlider(cutoffSlider, cutoffLabel, "Cutoff");
    setupSlider(resonanceSlider, resonanceLabel, "Resonance");
    setupSlider(distortionSlider, distortionLabel, "Distortion");
    setupSlider(attackSlider, attackLabel, "Attack");
    setupSlider(decaySlider, decayLabel, "Decay");
    setupSlider(sustainSlider, sustainLabel, "Sustain");
    setupSlider(releaseSlider, releaseLabel, "Release");
    setupSlider(lfoRateSlider, lfoRateLabel, "LFO Rate");
    setupSlider(lfoDepthSlider, lfoDepthLabel, "LFO Depth");
    
    cutoffAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "cutoff", cutoffSlider);
    resonanceAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "resonance", resonanceSlider);
    distortionAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "distortion", distortionSlider);
    attackAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "attack", attackSlider);
    decayAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "decay", decaySlider);
    sustainAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "sustain", sustainSlider);
    releaseAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "release", releaseSlider);
    lfoRateAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "lfoRate", lfoRateSlider);
    lfoDepthAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getParameters(), "lfoDepth", lfoDepthSlider);
    
    addAndMakeVisible(generateButton);
    generateButton.setButtonText("Generate AI Pattern");
    generateButton.onClick = [this]()
    {
    };
}

WobblerAudioProcessorEditor::~WobblerAudioProcessorEditor()
{
}

void WobblerAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff1a1a1a));
    
    g.setColour(juce::Colours::white);
    g.setFont(24.0f);
    g.drawFittedText("Wobbler", getLocalBounds().removeFromTop(40), juce::Justification::centred, 1);
}

void WobblerAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    
    area.removeFromTop(40);
    
    auto filterArea = area.removeFromTop(120);
    auto row1 = filterArea.removeFromTop(100);
    cutoffSlider.setBounds(row1.removeFromLeft(100));
    resonanceSlider.setBounds(row1.removeFromLeft(100));
    distortionSlider.setBounds(row1.removeFromLeft(100));
    
    area.removeFromTop(10);
    
    auto envelopeArea = area.removeFromTop(120);
    auto row2 = envelopeArea.removeFromTop(100);
    attackSlider.setBounds(row2.removeFromLeft(100));
    decaySlider.setBounds(row2.removeFromLeft(100));
    sustainSlider.setBounds(row2.removeFromLeft(100));
    releaseSlider.setBounds(row2.removeFromLeft(100));
    
    area.removeFromTop(10);
    
    auto lfoArea = area.removeFromTop(120);
    auto row3 = lfoArea.removeFromTop(100);
    lfoRateSlider.setBounds(row3.removeFromLeft(100));
    lfoDepthSlider.setBounds(row3.removeFromLeft(100));
    
    area.removeFromTop(10);
    generateButton.setBounds(area.removeFromTop(40).withSizeKeepingCentre(200, 40));
}
