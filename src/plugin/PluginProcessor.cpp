#include "PluginProcessor.h"
#include "PluginEditor.h"

WobblerAudioProcessor::WobblerAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      parameters(*this, nullptr, "Parameters",
                 {
                     std::make_unique<juce::AudioParameterFloat>("cutoff", "Cutoff", 20.0f, 20000.0f, 1000.0f),
                     std::make_unique<juce::AudioParameterFloat>("resonance", "Resonance", 0.0f, 1.0f, 0.5f),
                     std::make_unique<juce::AudioParameterFloat>("distortion", "Distortion", 0.0f, 1.0f, 0.3f),
                     std::make_unique<juce::AudioParameterFloat>("attack", "Attack", 0.001f, 2.0f, 0.01f),
                     std::make_unique<juce::AudioParameterFloat>("decay", "Decay", 0.001f, 2.0f, 0.1f),
                     std::make_unique<juce::AudioParameterFloat>("sustain", "Sustain", 0.0f, 1.0f, 0.7f),
                     std::make_unique<juce::AudioParameterFloat>("release", "Release", 0.001f, 2.0f, 0.2f),
                     std::make_unique<juce::AudioParameterFloat>("lfoRate", "LFO Rate", 0.1f, 20.0f, 4.0f),
                     std::make_unique<juce::AudioParameterFloat>("lfoDepth", "LFO Depth", 0.0f, 1.0f, 0.5f)
                 })
{
}

WobblerAudioProcessor::~WobblerAudioProcessor()
{
}

const juce::String WobblerAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool WobblerAudioProcessor::acceptsMidi() const
{
    return true;
}

bool WobblerAudioProcessor::producesMidi() const
{
    return false;
}

bool WobblerAudioProcessor::isMidiEffect() const
{
    return false;
}

double WobblerAudioProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int WobblerAudioProcessor::getNumPrograms()
{
    return 1;
}

int WobblerAudioProcessor::getCurrentProgram()
{
    return 0;
}

void WobblerAudioProcessor::setCurrentProgram(int index)
{
    juce::ignoreUnused(index);
}

const juce::String WobblerAudioProcessor::getProgramName(int index)
{
    juce::ignoreUnused(index);
    return {};
}

void WobblerAudioProcessor::changeProgramName(int index, const juce::String& newName)
{
    juce::ignoreUnused(index, newName);
}

void WobblerAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    currentSampleRate = sampleRate;
    
    oscillator.prepare(sampleRate);
    filter.prepare(sampleRate);
    distortion.prepare(sampleRate);
    envelope.setSampleRate(sampleRate);
    lfo.prepare(sampleRate);
}

void WobblerAudioProcessor::releaseResources()
{
}

bool WobblerAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    return true;
}

void WobblerAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    for (const auto metadata : midiMessages)
    {
        auto message = metadata.getMessage();
        
        if (message.isNoteOn())
        {
            currentNote = message.getNoteNumber();
            noteIsOn = true;
            envelope.noteOn();
            oscillator.setFrequency(message.getMidiNoteInHertz(currentNote));
        }
        else if (message.isNoteOff())
        {
            if (message.getNoteNumber() == currentNote)
            {
                noteIsOn = false;
                envelope.noteOff();
            }
        }
    }

    auto* channelData = buffer.getWritePointer(0);
    
    auto cutoffParam = parameters.getRawParameterValue("cutoff");
    auto resonanceParam = parameters.getRawParameterValue("resonance");
    auto distortionParam = parameters.getRawParameterValue("distortion");
    auto lfoRateParam = parameters.getRawParameterValue("lfoRate");
    auto lfoDepthParam = parameters.getRawParameterValue("lfoDepth");
    
    lfo.setFrequency(*lfoRateParam);
    
    for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
    {
        float output = 0.0f;
        
        if (noteIsOn || envelope.isActive())
        {
            output = oscillator.processSample();
            
            float lfoValue = lfo.processSample();
            float modulatedCutoff = *cutoffParam + (lfoValue * *lfoDepthParam * 5000.0f);
            modulatedCutoff = juce::jlimit(20.0f, 20000.0f, modulatedCutoff);
            
            filter.setCutoff(modulatedCutoff);
            filter.setResonance(*resonanceParam);
            output = filter.processSample(output);
            
            distortion.setDrive(*distortionParam);
            output = distortion.processSample(output);
            
            float envValue = envelope.processSample();
            output *= envValue;
        }
        
        channelData[sample] = output;
    }

    for (int channel = 1; channel < totalNumOutputChannels; ++channel)
        buffer.copyFrom(channel, 0, buffer, 0, 0, buffer.getNumSamples());
}

bool WobblerAudioProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* WobblerAudioProcessor::createEditor()
{
    return new WobblerAudioProcessorEditor(*this);
}

void WobblerAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = parameters.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void WobblerAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState(getXmlFromBinary(data, sizeInBytes));
    
    if (xmlState.get() != nullptr)
        if (xmlState->hasTagName(parameters.state.getType()))
            parameters.replaceState(juce::ValueTree::fromXml(*xmlState));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new WobblerAudioProcessor();
}
