#include "Filter.h"

Filter::Filter()
{
}

Filter::~Filter()
{
}

void Filter::prepare(double sr)
{
    sampleRate = sr;
    reset();
    updateCoefficients();
}

void Filter::setCutoff(float cutoffHz)
{
    cutoff = juce::jlimit(20.0f, 20000.0f, cutoffHz);
    updateCoefficients();
}

void Filter::setResonance(float res)
{
    resonance = juce::jlimit(0.0f, 1.0f, res);
    k = 4.0f * resonance;
}

void Filter::updateCoefficients()
{
    float wd = 2.0f * juce::MathConstants<float>::pi * cutoff;
    float T = 1.0f / static_cast<float>(sampleRate);
    float wa = (2.0f / T) * std::tan(wd * T / 2.0f);
    g = wa * T / 2.0f;
}

float Filter::processSample(float input)
{
    float S1 = stage1 / (1.0f + g);
    float S2 = stage2 / (1.0f + g);
    float S3 = stage3 / (1.0f + g);
    float S4 = stage4 / (1.0f + g);
    
    float G = g / (1.0f + g);
    float G2 = G * G;
    float G3 = G2 * G;
    float G4 = G3 * G;
    
    float u = (input - k * (S1 + S2 + S3 + S4)) / (1.0f + k * (G + G2 + G3 + G4));
    
    float v1 = G * u + S1;
    stage1 = 2.0f * v1 - stage1;
    
    float v2 = G * v1 + S2;
    stage2 = 2.0f * v2 - stage2;
    
    float v3 = G * v2 + S3;
    stage3 = 2.0f * v3 - stage3;
    
    float v4 = G * v3 + S4;
    stage4 = 2.0f * v4 - stage4;
    
    return v4;
}

void Filter::reset()
{
    stage1 = stage2 = stage3 = stage4 = 0.0f;
}
