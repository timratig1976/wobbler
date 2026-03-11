#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

// ─── Parameter layout ────────────────────────────────────────────────────────
juce::AudioProcessorValueTreeState::ParameterLayout
WobblerAudioProcessor::createParameterLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    // Global
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        "master_vol", "Master Volume", 0.0f, 1.0f, 0.75f));
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        "bpm", "BPM", 40.0f, 240.0f, 120.0f));

    // Per-voice (v0, v1, v2)
    for (int v = 0; v < NUM_VOICES; ++v)
    {
        auto id = [v](const char* n) { return juce::String("v") + v + "_" + n; };
        auto nm = [v](const char* n) { return juce::String("V") + (v+1) + " " + n; };

        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("osc_pitch"),  nm("OSC Pitch"),  -24.0f, 24.0f, 0.0f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("osc_cent"),   nm("OSC Cent"),  -100.0f,100.0f, 0.0f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("osc_vol"),    nm("OSC Vol"),    0.0f,  1.0f,   0.8f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("noise_vol"),  nm("Noise Vol"),  0.0f,  1.0f,   0.0f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("flt_cutoff"), nm("Cutoff"),    20.0f,18000.0f,800.0f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("flt_res"),    nm("Resonance"),  0.1f,  30.0f,  5.0f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("flt_env"),    nm("Filter Env"),  0.0f,8000.0f,2000.0f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("atk"),        nm("Attack"),  0.001f,   2.0f, 0.005f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("dec"),        nm("Decay"),   0.01f,    2.0f,  0.25f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("sus"),        nm("Sustain"),  0.0f,    1.0f,   0.4f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("rel"),        nm("Release"), 0.01f,    4.0f,  0.12f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("vol"),        nm("Volume"),   0.0f,    1.0f,   0.8f));
        params.push_back(std::make_unique<juce::AudioParameterFloat>(
            id("pan"),        nm("Pan"),     -1.0f,    1.0f,   0.0f));

        // 5 LFOs per voice
        for (int l = 0; l < WobblerVoice::NUM_LFOS; ++l)
        {
            auto lid = [v, l](const char* n)
            { return juce::String("v") + v + "_lfo" + l + "_" + n; };
            auto lnm = [v, l](const char* n)
            { return juce::String("V") + (v+1) + " LFO" + (l+1) + " " + n; };

            params.push_back(std::make_unique<juce::AudioParameterFloat>(
                lid("rate"),  lnm("Rate"),   0.01f, 20.0f, 4.0f));
            params.push_back(std::make_unique<juce::AudioParameterFloat>(
                lid("depth"), lnm("Depth"),  0.0f, 8000.0f, 0.0f));
            params.push_back(std::make_unique<juce::AudioParameterFloat>(
                lid("phase"), lnm("Phase"),  0.0f,  360.0f, 0.0f));
        }
    }
    return { params.begin(), params.end() };
}

// ─── Constructor ─────────────────────────────────────────────────────────────
WobblerAudioProcessor::WobblerAudioProcessor()
    : AudioProcessor(BusesProperties()
                     .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "WobblerState", createParameterLayout())
{
}

WobblerAudioProcessor::~WobblerAudioProcessor() {}

// ─── Plugin boilerplate ───────────────────────────────────────────────────────
const juce::String WobblerAudioProcessor::getName() const { return JucePlugin_Name; }
bool WobblerAudioProcessor::acceptsMidi()  const { return true;  }
bool WobblerAudioProcessor::producesMidi() const { return false; }
bool WobblerAudioProcessor::isMidiEffect() const { return false; }
double WobblerAudioProcessor::getTailLengthSeconds() const { return 1.0; }
int  WobblerAudioProcessor::getNumPrograms()                     { return 1; }
int  WobblerAudioProcessor::getCurrentProgram()                  { return 0; }
void WobblerAudioProcessor::setCurrentProgram(int)               {}
const juce::String WobblerAudioProcessor::getProgramName(int)    { return {}; }
void WobblerAudioProcessor::changeProgramName(int, const juce::String&) {}
bool WobblerAudioProcessor::hasEditor() const                    { return true; }
juce::AudioProcessorEditor* WobblerAudioProcessor::createEditor()
{
    return new WobblerAudioProcessorEditor(*this);
}

bool WobblerAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo()
        || layouts.getMainOutputChannelSet() == juce::AudioChannelSet::mono();
}

// ─── Prepare ─────────────────────────────────────────────────────────────────
void WobblerAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    for (auto& v : voices)
        v.prepare(sampleRate, samplesPerBlock);
    sequencer.prepare(sampleRate);
    syncParamsFromApvts();
}

void WobblerAudioProcessor::releaseResources() {}

// ─── Helpers ─────────────────────────────────────────────────────────────────
float WobblerAudioProcessor::midiToFreq(int note)
{
    return 440.0f * std::pow(2.0f, (note - 69) / 12.0f);
}

void WobblerAudioProcessor::handleMidiMessage(const juce::MidiMessage& msg)
{
    if (msg.isNoteOn())
    {
        float freq = midiToFreq(msg.getNoteNumber());
        float vel  = msg.getFloatVelocity();
        for (auto& v : voices) v.noteOn(freq, vel);
    }
    else if (msg.isNoteOff())
    {
        for (auto& v : voices) v.noteOff();
    }
    else if (msg.isPitchWheel())
    {
        pitchBendCents = ((msg.getPitchWheelValue() - 8192) / 8192.0f) * 200.0f;
    }
    else if (msg.isController())
    {
        float val = msg.getControllerValue() / 127.0f;
        switch (msg.getControllerNumber())
        {
            case 7:  // volume
                masterVolume = val;
                break;
            case 74: // filter cutoff
                for (auto& v : voices)
                { v.getParams().filterCutoff = 20.0f + val * 17980.0f; v.applyParams(); }
                break;
            case 71: // resonance
                for (auto& v : voices)
                { v.getParams().filterResonance = 0.1f + val * 29.9f; v.applyParams(); }
                break;
            case 1:  // mod wheel → LFO1 depth
                for (auto& v : voices)
                { v.getLFOParams(0).depth = val * 4000.0f; v.applyParams(); }
                break;
            default: break;
        }
    }
}

void WobblerAudioProcessor::syncParamsFromApvts()
{
    masterVolume = *apvts.getRawParameterValue("master_vol");
    float bpm    = *apvts.getRawParameterValue("bpm");
    sequencer.setBpm(bpm);

    for (int v = 0; v < NUM_VOICES; ++v)
    {
        auto id = [v](const char* n) { return juce::String("v") + v + "_" + n; };
        auto& p  = voices[v].getParams();

        p.oscPitchSemitones = *apvts.getRawParameterValue(id("osc_pitch"));
        p.oscDetuneCents    = *apvts.getRawParameterValue(id("osc_cent"));
        p.oscVolume         = *apvts.getRawParameterValue(id("osc_vol"));
        p.noiseVolume       = *apvts.getRawParameterValue(id("noise_vol"));
        p.filterCutoff      = *apvts.getRawParameterValue(id("flt_cutoff"));
        p.filterResonance   = *apvts.getRawParameterValue(id("flt_res"));
        p.filterEnvAmount   = *apvts.getRawParameterValue(id("flt_env"));
        p.attack            = *apvts.getRawParameterValue(id("atk"));
        p.decay             = *apvts.getRawParameterValue(id("dec"));
        p.sustain           = *apvts.getRawParameterValue(id("sus"));
        p.release           = *apvts.getRawParameterValue(id("rel"));
        p.volume            = *apvts.getRawParameterValue(id("vol"));
        p.pan               = *apvts.getRawParameterValue(id("pan"));

        for (int l = 0; l < WobblerVoice::NUM_LFOS; ++l)
        {
            auto lid = [v, l](const char* n)
            { return juce::String("v") + v + "_lfo" + l + "_" + n; };
            auto& lp = voices[v].getLFOParams(l);
            lp.rate        = *apvts.getRawParameterValue(lid("rate"));
            lp.depth       = *apvts.getRawParameterValue(lid("depth"));
            lp.phaseOffset = *apvts.getRawParameterValue(lid("phase"))
                             * juce::MathConstants<float>::pi / 180.0f;
        }
        voices[v].setBpm(bpm);
        voices[v].applyParams();
    }
}

// ─── Process block ────────────────────────────────────────────────────────────
void WobblerAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                          juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear();

    syncParamsFromApvts();

    // Collect MIDI events with sample offsets
    auto midiIt  = midiMessages.begin();
    auto midiEnd = midiMessages.end();

    auto* outL = buffer.getWritePointer(0);
    auto* outR = buffer.getNumChannels() > 1 ? buffer.getWritePointer(1) : nullptr;

    const int numSamples = buffer.getNumSamples();

    for (int s = 0; s < numSamples; ++s)
    {
        // Dispatch MIDI messages that fall on this sample
        while (midiIt != midiEnd && (*midiIt).samplePosition <= s)
        {
            handleMidiMessage((*midiIt).getMessage());
            ++midiIt;
        }

        // Sequencer tick
        auto [seqNote, seqVel] = sequencer.advanceSample();
        if (seqNote >= 0)
            for (auto& v : voices)
                v.noteOn(midiToFreq(seqNote), seqVel);

        // Sum all voices
        float sumL = 0.0f, sumR = 0.0f;
        for (auto& v : voices)
        {
            sumL += v.processSampleL();
            sumR += v.processSampleR();
        }

        sumL *= masterVolume;
        sumR *= masterVolume;

        outL[s] = sumL;
        if (outR) outR[s] = sumR;
    }
}

// ─── State ────────────────────────────────────────────────────────────────────
void WobblerAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void WobblerAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xml(getXmlFromBinary(data, sizeInBytes));
    if (xml && xml->hasTagName(apvts.state.getType()))
        apvts.replaceState(juce::ValueTree::fromXml(*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new WobblerAudioProcessor();
}
