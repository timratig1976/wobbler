#include "Filter.h"

Filter::Filter() {}
Filter::~Filter() {}

void Filter::prepare(double sr)
{
    sampleRate = sr;
    reset();
    updateCoefficients();
}

void Filter::setType(Type t)
{
    type = t;
}

void Filter::setCutoff(float cutoffHz)
{
    cutoff = juce::jlimit(20.0f, 20000.0f, cutoffHz);
    updateCoefficients();
}

void Filter::setResonance(float q)
{
    resonance = juce::jlimit(0.1f, 30.0f, q);
    k = 1.0f / resonance;
}

void Filter::updateCoefficients()
{
    g = std::tan(juce::MathConstants<float>::pi
                 * cutoff / static_cast<float>(sampleRate));
    k = 1.0f / resonance;
}

float Filter::processSample(float input)
{
    // Topology-preserving TPT SVF (Andy Simper / Cytomic)
    float hp = (input - k * s1 - s2) / (1.0f + g * (g + k));
    float bp = g * hp + s1;
    float lp = g * bp + s2;

    s1 = 2.0f * bp - s1;
    s2 = 2.0f * lp - s2;

    switch (type)
    {
        case Type::Lowpass:  return lp;
        case Type::Highpass: return hp;
        case Type::Bandpass: return bp;
        case Type::Notch:    return lp + hp;
        default:             return lp;
    }
}

void Filter::reset()
{
    s1 = s2 = 0.0f;
}
