#include "Distortion.h"

Distortion::Distortion()
{
}

Distortion::~Distortion()
{
}

void Distortion::prepare(double sr)
{
    sampleRate = sr;
}

void Distortion::setDrive(float driveAmount)
{
    drive = juce::jlimit(0.0f, 1.0f, driveAmount);
}

float Distortion::softClip(float input)
{
    if (input > 1.0f)
        return 1.0f;
    else if (input < -1.0f)
        return -1.0f;
    else
        return input - (input * input * input) / 3.0f;
}

float Distortion::wavefold(float input)
{
    float output = input;
    while (output > 1.0f || output < -1.0f)
    {
        if (output > 1.0f)
            output = 2.0f - output;
        if (output < -1.0f)
            output = -2.0f - output;
    }
    return output;
}

float Distortion::processSample(float input)
{
    float driveAmount = 1.0f + (drive * 19.0f);
    float driven = input * driveAmount;
    
    float clipped = softClip(driven);
    float folded = wavefold(driven);
    
    float output = clipped * (1.0f - drive) + folded * drive;
    
    return output / driveAmount;
}
