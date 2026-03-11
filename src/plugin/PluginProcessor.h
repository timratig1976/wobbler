#pragma once

#include <JuceHeader.h>
#include "WobblerVoice.h"
#include "Sequencer.h"

class WobblerAudioProcessor : public juce::AudioProcessor
{
public:
    static constexpr int NUM_VOICES = 3;

    WobblerAudioProcessor();
    ~WobblerAudioProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;
    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int           getNumPrograms() override;
    int           getCurrentProgram() override;
    void          setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void          changeProgramName(int index, const juce::String& newName) override;

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState& getApvts()        { return apvts; }
    WobblerVoice& getVoice(int i)                          { return voices[i]; }
    Sequencer&    getSequencer()                           { return sequencer; }

private:
    juce::AudioProcessorValueTreeState apvts;
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    WobblerVoice voices[NUM_VOICES];
    Sequencer    sequencer;

    float masterVolume      = 0.75f;
    float pitchBendCents    = 0.0f;
    bool  seqRunning        = false;

    void handleMidiMessage(const juce::MidiMessage& msg);
    void syncParamsFromApvts();
    static float midiToFreq(int note);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WobblerAudioProcessor)
};
