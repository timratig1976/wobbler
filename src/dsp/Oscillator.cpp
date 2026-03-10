#include "Oscillator.h"

Oscillator::Oscillator()
{
    generateWavetables();
}

Oscillator::~Oscillator()
{
}

void Oscillator::prepare(double sr)
{
    sampleRate = sr;
    updatePhaseIncrement();
}

void Oscillator::setFrequency(float freq)
{
    frequency = freq;
    updatePhaseIncrement();
}

void Oscillator::setWavetablePosition(float position)
{
    wavetablePosition = juce::jlimit(0.0f, 1.0f, position);
}

void Oscillator::updatePhaseIncrement()
{
    phaseIncrement = frequency / static_cast<float>(sampleRate);
}

void Oscillator::generateWavetables()
{
    for (int i = 0; i < wavetableSize; ++i)
    {
        float t = static_cast<float>(i) / static_cast<float>(wavetableSize);
        
        sineWavetable[i] = std::sin(2.0f * juce::MathConstants<float>::pi * t);
        
        sawWavetable[i] = 2.0f * t - 1.0f;
        
        squareWavetable[i] = (t < 0.5f) ? 1.0f : -1.0f;
    }
}

float Oscillator::getWavetableSample(const std::array<float, wavetableSize>& table, float ph)
{
    float index = ph * static_cast<float>(wavetableSize);
    int index0 = static_cast<int>(index) % wavetableSize;
    int index1 = (index0 + 1) % wavetableSize;
    float frac = index - std::floor(index);
    
    return table[index0] + frac * (table[index1] - table[index0]);
}

float Oscillator::processSample()
{
    float sawSample = getWavetableSample(sawWavetable, phase);
    float squareSample = getWavetableSample(squareWavetable, phase);
    
    float output = sawSample * 0.7f + squareSample * 0.3f;
    
    phase += phaseIncrement;
    if (phase >= 1.0f)
        phase -= 1.0f;
    
    return output * 0.5f;
}
