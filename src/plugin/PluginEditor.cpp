#include "PluginProcessor.h"
#include "PluginEditor.h"

WobblerAudioProcessorEditor::WobblerAudioProcessorEditor(WobblerAudioProcessor& p)
    : AudioProcessorEditor(&p), audioProcessor(p)
{
    setSize(480, 200);

    auto setup = [this](juce::Slider& s, juce::Label& l, const juce::String& text)
    {
        addAndMakeVisible(s);
        s.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
        s.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 80, 20);
        addAndMakeVisible(l);
        l.setText(text, juce::dontSendNotification);
        l.setJustificationType(juce::Justification::centred);
    };

    setup(masterVolSlider, masterVolLabel, "Master Vol");
    setup(bpmSlider,       bpmLabel,       "BPM");

    masterVolAtt = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getApvts(), "master_vol", masterVolSlider);
    bpmAtt = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        audioProcessor.getApvts(), "bpm", bpmSlider);
}

WobblerAudioProcessorEditor::~WobblerAudioProcessorEditor() {}

void WobblerAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff050510));
    g.setColour(juce::Colour(0xff00ffb2));
    g.setFont(juce::Font(20.0f, juce::Font::bold));
    g.drawFittedText("WOBBLER BASS",
                     getLocalBounds().removeFromTop(50),
                     juce::Justification::centred, 1);
    g.setColour(juce::Colours::grey);
    g.setFont(11.0f);
    g.drawFittedText("Full UI coming soon — use MIDI or built-in sequencer",
                     getLocalBounds().removeFromBottom(30),
                     juce::Justification::centred, 1);
}

void WobblerAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced(20);
    area.removeFromTop(50);
    masterVolSlider.setBounds(area.removeFromLeft(120).withHeight(120));
    masterVolLabel .setBounds(masterVolSlider.getBounds().removeFromBottom(20));
    area.removeFromLeft(20);
    bpmSlider.setBounds(area.removeFromLeft(120).withHeight(120));
    bpmLabel .setBounds(bpmSlider.getBounds().removeFromBottom(20));
}
