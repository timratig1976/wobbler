#pragma once

#include <JuceHeader.h>

class Envelope
{
public:
    Envelope();
    ~Envelope();
    
    void setSampleRate(double sampleRate);
    void setAttack(float attackSeconds);
    void setDecay(float decaySeconds);
    void setSustain(float sustainLevel);
    void setRelease(float releaseSeconds);
    
    void noteOn();
    void noteOff();
    
    float processSample();
    bool isActive() const;
    
private:
    enum class State
    {
        Idle,
        Attack,
        Decay,
        Sustain,
        Release
    };
    
    double sampleRate = 44100.0;
    State state = State::Idle;
    
    float attackTime = 0.01f;
    float decayTime = 0.1f;
    float sustainLevel = 0.7f;
    float releaseTime = 0.2f;
    
    float currentLevel = 0.0f;
    float attackIncrement = 0.0f;
    float decayIncrement = 0.0f;
    float releaseIncrement = 0.0f;
    
    void updateIncrements();
};
