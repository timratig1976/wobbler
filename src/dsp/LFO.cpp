#include "LFO.h"

LFO::LFO() {}
LFO::~LFO() {}

void LFO::prepare(double sr)
{
    sampleRate = sr;
    updatePhaseIncrement();
}

void LFO::setFrequency(float hz)
{
    frequency = juce::jlimit(0.01f, 100.0f, hz);
    updatePhaseIncrement();
}

void LFO::setBpmSync(bool sync, float bpm, float divBeats)
{
    if (sync)
        setFrequency((bpm / 60.0f) / juce::jmax(0.001f, divBeats));
}

void LFO::updatePhaseIncrement()
{
    phaseIncrement = frequency / static_cast<float>(sampleRate);
}

void LFO::reset() { phase = 0.0f; }

float LFO::computeWaveform(float p) const
{
    switch (waveform)
    {
        case Waveform::Sine:
            return std::sin(2.0f * juce::MathConstants<float>::pi * p);
        case Waveform::Sawtooth:
            return 2.0f * p - 1.0f;
        case Waveform::Square:
            return (p < 0.5f) ? 1.0f : -1.0f;
        case Waveform::Triangle:
            return (p < 0.5f) ? (4.0f * p - 1.0f) : (3.0f - 4.0f * p);
        case Waveform::Stepped:
        {
            float saw = 2.0f * p - 1.0f;
            constexpr float nSteps = 8.0f;
            float s = std::round((saw + 1.0f) * 0.5f * (nSteps - 1.0f))
                      / (nSteps - 1.0f) * 2.0f - 1.0f;
            return juce::jlimit(-1.0f, 1.0f, s);
        }
        default: return 0.0f;
    }
}

float LFO::processSample()
{
    float p = phase + phaseOffset;
    if (p >= 1.0f) p -= 1.0f;
    if (p <  0.0f) p += 1.0f;

    float output = computeWaveform(p) * depth;

    phase += phaseIncrement;
    if (phase >= 1.0f) phase -= 1.0f;

    return output;
}
