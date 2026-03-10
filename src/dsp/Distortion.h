#pragma once

#include <JuceHeader.h>

class Distortion
{
public:
    Distortion();
    ~Distortion();
    
    void prepare(double sampleRate);
    void setDrive(float drive);
    
    float processSample(float input);
    
private:
    double sampleRate = 44100.0;
    float drive = 0.5f;
    
    float softClip(float input);
    float wavefold(float input);
};
