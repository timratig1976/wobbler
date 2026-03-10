#include "LFO.h"

LFO::LFO()
{
}

LFO::~LFO()
{
}

void LFO::prepare(double sr)
{
    sampleRate = sr;
    updatePhaseIncrement();
}

void LFO::setFrequency(float frequencyHz)
{
    frequency = juce::jlimit(0.01f, 100.0f, frequencyHz);
    updatePhaseIncrement();
}

void LFO::setShape(float shapeValue)
{
    shape = juce::jlimit(0.0f, 1.0f, shapeValue);
}

void LFO::updatePhaseIncrement()
{
    phaseIncrement = frequency / static_cast<float>(sampleRate);
}

void LFO::reset()
{
    phase = 0.0f;
}

float LFO::processSample()
{
    float sine = std::sin(2.0f * juce::MathConstants<float>::pi * phase);
    
    float triangle = (phase < 0.5f) 
        ? (4.0f * phase - 1.0f) 
        : (3.0f - 4.0f * phase);
    
    float output = sine * (1.0f - shape) + triangle * shape;
    
    phase += phaseIncrement;
    if (phase >= 1.0f)
        phase -= 1.0f;
    
    return output;
}
