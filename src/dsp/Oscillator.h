#pragma once

#include <JuceHeader.h>

class Oscillator
{
public:
    Oscillator();
    ~Oscillator();
    
    void prepare(double sampleRate);
    void setFrequency(float frequency);
    void setWavetablePosition(float position);
    
    float processSample();
    
private:
    double sampleRate = 44100.0;
    float frequency = 440.0f;
    float phase = 0.0f;
    float phaseIncrement = 0.0f;
    float wavetablePosition = 0.0f;
    
    static constexpr int wavetableSize = 2048;
    std::array<float, wavetableSize> sawWavetable;
    std::array<float, wavetableSize> squareWavetable;
    std::array<float, wavetableSize> sineWavetable;
    
    void updatePhaseIncrement();
    void generateWavetables();
    float getWavetableSample(const std::array<float, wavetableSize>& table, float phase);
};
