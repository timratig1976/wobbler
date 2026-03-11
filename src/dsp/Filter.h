#pragma once

#include <JuceHeader.h>

// TPT State-Variable Filter — LP/HP/BP/Notch, all from the same topology
class Filter
{
public:
    enum class Type { Lowpass, Highpass, Bandpass, Notch };

    Filter();
    ~Filter();

    void  prepare(double sampleRate);
    void  setType(Type t);
    void  setCutoff(float cutoffHz);
    void  setResonance(float q);   // Q factor: 0.5 (Butterworth) to ~30 (screaming)
    float processSample(float input);
    void  reset();

private:
    double sampleRate = 44100.0;
    Type   type       = Type::Lowpass;
    float  cutoff     = 800.0f;
    float  resonance  = 0.707f;

    // TPT SVF state
    float s1 = 0.0f, s2 = 0.0f;
    float g  = 0.0f, k  = 0.0f;

    void updateCoefficients();
};
