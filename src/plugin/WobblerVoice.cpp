#include "WobblerVoice.h"

WobblerVoice::WobblerVoice() {}

void WobblerVoice::prepare(double sr, int /*maxBlockSize*/)
{
    sampleRate = sr;
    osc.prepare(sr);
    filter.prepare(sr);
    ampEnv.setSampleRate(sr);
    filterEnv.setSampleRate(sr);
    for (auto& lfo : lfos)
        lfo.prepare(sr);
}

void WobblerVoice::noteOn(float freqHz, float velocity)
{
    if (params.mute) return;
    currentFreq     = freqHz * std::pow(2.0f, params.oscPitchSemitones / 12.0f);
    currentVelocity = velocity;
    osc.setFrequency(currentFreq);
    osc.setDetuneCents(params.oscDetuneCents);
    ampEnv.noteOn();
    filterEnv.noteOn();
}

void WobblerVoice::noteOff()
{
    ampEnv.noteOff();
    filterEnv.noteOff();
}

bool WobblerVoice::isActive() const
{
    return ampEnv.isActive();
}

void WobblerVoice::setBpm(float b)
{
    bpm = b;
    for (int i = 0; i < NUM_LFOS; ++i)
        if (lfoParams[i].bpmSync)
            lfos[i].setBpmSync(true, bpm, lfoParams[i].syncDivBeats);
}

void WobblerVoice::applyParams()
{
    osc.setWaveform(params.oscWaveform);
    osc.setDetuneCents(params.oscDetuneCents);
    osc.setVolume(params.oscVolume);
    osc.setNoiseVolume(params.noiseVolume);

    filter.setType(params.filterType);
    filter.setCutoff(params.filterCutoff);
    filter.setResonance(params.filterResonance);

    ampEnv.setAttack(params.attack);
    ampEnv.setDecay(params.decay);
    ampEnv.setSustain(params.sustain);
    ampEnv.setRelease(params.release);

    filterEnv.setAttack(params.attack);
    filterEnv.setDecay(params.decay);
    filterEnv.setSustain(params.sustain);
    filterEnv.setRelease(params.release);

    updatePan();

    for (int i = 0; i < NUM_LFOS; ++i)
    {
        auto& lp = lfoParams[i];
        lfos[i].setWaveform(lp.waveform);
        lfos[i].setDepth(lp.depth);
        lfos[i].setPhaseOffset(lp.phaseOffset);
        lfos[i].setTarget(lp.target);
        lfos[i].metaTarget    = lp.metaTarget;
        lfos[i].metaTargetLFO = lp.metaTargetLFO;
        if (lp.bpmSync)
            lfos[i].setBpmSync(true, bpm, lp.syncDivBeats);
        else
            lfos[i].setFrequency(lp.rate);
    }
}

void WobblerVoice::updatePan()
{
    float p     = juce::jlimit(-1.0f, 1.0f, params.pan);
    float angle = (p + 1.0f) * 0.5f * juce::MathConstants<float>::halfPi;
    panLeft     = std::cos(angle);
    panRight    = std::sin(angle);
}

void WobblerVoice::applyLFOModulation(float& cutoffMod, float& resMod,
                                       float& volMod,    float& pitchMod,
                                       float& noiseMod)
{
    float out[NUM_LFOS];
    for (int i = 0; i < NUM_LFOS; ++i)
        out[i] = lfos[i].processSample();

    // LFO5 meta-modulation (index 4)
    auto& lp5 = lfoParams[4];
    if (lp5.metaTarget != LFO::MetaTarget::None)
    {
        int tgt = juce::jlimit(0, 3, lp5.metaTargetLFO);
        if (lp5.metaTarget == LFO::MetaTarget::Rate)
            lfos[tgt].setFrequency(juce::jlimit(0.01f, 40.0f,
                lfoParams[tgt].rate + out[4]));
        else
            lfos[tgt].setDepth(juce::jmax(0.0f,
                lfoParams[tgt].depth + out[4]));
    }

    // Route LFOs 1-4; LFO5 routes only when not in meta mode
    int limit = (lp5.metaTarget == LFO::MetaTarget::None) ? NUM_LFOS : 4;
    for (int i = 0; i < limit; ++i)
    {
        switch (lfoParams[i].target)
        {
            case LFO::Target::Cutoff:    cutoffMod += out[i]; break;
            case LFO::Target::Resonance: resMod    += out[i]; break;
            case LFO::Target::Volume:    volMod    += out[i]; break;
            case LFO::Target::Pitch:     pitchMod  += out[i]; break;
            case LFO::Target::NoiseAmt:  noiseMod  += out[i]; break;
        }
    }
}

float WobblerVoice::computeAndStoreSample()
{
    if (!isActive()) { lastSample = 0.0f; return 0.0f; }

    float cutoffMod = 0.0f, resMod = 0.0f, volMod = 0.0f,
          pitchMod  = 0.0f, noiseMod = 0.0f;
    applyLFOModulation(cutoffMod, resMod, volMod, pitchMod, noiseMod);

    // Pitch
    if (pitchMod != 0.0f)
        osc.setFrequency(currentFreq * std::pow(2.0f, pitchMod / 1200.0f));

    // Audio generation
    float oscOut   = osc.processSample();
    float noiseAmt = juce::jlimit(0.0f, 1.0f, params.noiseVolume + noiseMod);
    float noiseOut = (noiseAmt > 0.0f)
                     ? (juce::Random::getSystemRandom().nextFloat() * 2.0f - 1.0f) * noiseAmt
                     : 0.0f;
    float mixed = oscOut + noiseOut;

    // Filter envelope
    float fEnv   = filterEnv.processSample();
    float cutoff = juce::jlimit(20.0f, 20000.0f,
                                params.filterCutoff + cutoffMod
                                + params.filterEnvAmount * fEnv * currentVelocity);
    filter.setCutoff(cutoff);
    filter.setResonance(juce::jlimit(0.1f, 30.0f, params.filterResonance + resMod));

    float filtered = filter.processSample(mixed);

    // Amplitude envelope + volume modulation
    float amp = ampEnv.processSample() * currentVelocity
                * params.volume * juce::jlimit(0.0f, 2.0f, 1.0f + volMod);

    lastSample = filtered * amp;
    return lastSample;
}

float WobblerVoice::processSampleL()
{
    return computeAndStoreSample() * panLeft;
}

float WobblerVoice::processSampleR()
{
    return lastSample * panRight;
}
