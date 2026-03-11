#include "Oscillator.h"

Oscillator::Oscillator() {}
Oscillator::~Oscillator() {}

void Oscillator::prepare(double sr)
{
    sampleRate = sr;
    updatePhaseIncrement();
}

void Oscillator::setFrequency(float freqHz)
{
    frequency = juce::jmax(1.0f, freqHz);
    updatePhaseIncrement();
}

void Oscillator::setDetuneCents(float cents)
{
    detuneCents = cents;
    updatePhaseIncrement();
}

float Oscillator::computeFrequency() const
{
    return frequency * std::pow(2.0f, detuneCents / 1200.0f);
}

void Oscillator::updatePhaseIncrement()
{
    phaseIncrement = computeFrequency() / static_cast<float>(sampleRate);
}

float Oscillator::processSample()
{
    float output = 0.0f;
    switch (waveform)
    {
        case Waveform::Sine:
            output = std::sin(2.0f * juce::MathConstants<float>::pi * phase);
            break;
        case Waveform::Sawtooth:
            output = 2.0f * phase - 1.0f;
            break;
        case Waveform::Square:
            output = (phase < 0.5f) ? 1.0f : -1.0f;
            break;
        case Waveform::Triangle:
            output = (phase < 0.5f) ? (4.0f * phase - 1.0f)
                                    : (3.0f - 4.0f * phase);
            break;
    }
    phase += phaseIncrement;
    if (phase >= 1.0f) phase -= 1.0f;
    return output * volume;
}

float Oscillator::processNoiseSample()
{
    return (rng.nextFloat() * 2.0f - 1.0f) * noiseVolume;
}
