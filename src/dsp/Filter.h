#pragma once

#include <JuceHeader.h>

class Filter
{
public:
    Filter();
    ~Filter();
    
    void prepare(double sampleRate);
    void setCutoff(float cutoffHz);
    void setResonance(float resonance);
    
    float processSample(float input);
    void reset();
    
private:
    double sampleRate = 44100.0;
    float cutoff = 1000.0f;
    float resonance = 0.5f;
    
    float stage1 = 0.0f;
    float stage2 = 0.0f;
    float stage3 = 0.0f;
    float stage4 = 0.0f;
    
    float g = 0.0f;
    float k = 0.0f;
    
    void updateCoefficients();
};
