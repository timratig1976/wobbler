#pragma once

#include <JuceHeader.h>

class LFO
{
public:
    enum class Waveform  { Sine, Sawtooth, Square, Triangle, Stepped };
    enum class Target    { Cutoff, Resonance, Volume, Pitch, NoiseAmt };
    enum class MetaTarget{ None, Rate, Depth };

    LFO();
    ~LFO();

    void prepare(double sampleRate);

    void setWaveform(Waveform w)         { waveform = w; }
    void setFrequency(float hz);
    void setDepth(float d)               { depth = d; }
    void setPhaseOffset(float radians)   { phaseOffset = radians / (2.0f * juce::MathConstants<float>::pi); }
    void setTarget(Target t)             { target = t; }
    void setBpmSync(bool sync, float bpm, float divBeats);

    float      processSample();
    void       reset();

    Target     getTarget()    const { return target; }
    MetaTarget getMetaTarget()const { return metaTarget; }
    float      getDepth()     const { return depth; }
    float      getFrequency() const { return frequency; }

    MetaTarget metaTarget    = MetaTarget::None;
    int        metaTargetLFO = 0;

private:
    double   sampleRate     = 44100.0;
    Waveform waveform       = Waveform::Sine;
    float    frequency      = 4.0f;
    float    depth          = 0.0f;
    float    phase          = 0.0f;
    float    phaseOffset    = 0.0f;   // normalised 0..1
    float    phaseIncrement = 0.0f;
    Target   target         = Target::Cutoff;

    float computeWaveform(float p) const;
    void  updatePhaseIncrement();
};
