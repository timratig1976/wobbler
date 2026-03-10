#pragma once

#include <JuceHeader.h>

class LFO
{
public:
    LFO();
    ~LFO();
    
    void prepare(double sampleRate);
    void setFrequency(float frequencyHz);
    void setShape(float shape);
    
    float processSample();
    void reset();
    
private:
    double sampleRate = 44100.0;
    float frequency = 1.0f;
    float phase = 0.0f;
    float phaseIncrement = 0.0f;
    float shape = 0.0f;
    
    void updatePhaseIncrement();
};
