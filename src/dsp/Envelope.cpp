#include "Envelope.h"

Envelope::Envelope()
{
    updateIncrements();
}

Envelope::~Envelope()
{
}

void Envelope::setSampleRate(double sr)
{
    sampleRate = sr;
    updateIncrements();
}

void Envelope::setAttack(float attackSeconds)
{
    attackTime = juce::jlimit(0.001f, 10.0f, attackSeconds);
    updateIncrements();
}

void Envelope::setDecay(float decaySeconds)
{
    decayTime = juce::jlimit(0.001f, 10.0f, decaySeconds);
    updateIncrements();
}

void Envelope::setSustain(float level)
{
    sustainLevel = juce::jlimit(0.0f, 1.0f, level);
}

void Envelope::setRelease(float releaseSeconds)
{
    releaseTime = juce::jlimit(0.001f, 10.0f, releaseSeconds);
    updateIncrements();
}

void Envelope::updateIncrements()
{
    attackIncrement = 1.0f / (attackTime * static_cast<float>(sampleRate));
    decayIncrement = (1.0f - sustainLevel) / (decayTime * static_cast<float>(sampleRate));
    releaseIncrement = sustainLevel / (releaseTime * static_cast<float>(sampleRate));
}

void Envelope::noteOn()
{
    state = State::Attack;
    currentLevel = 0.0f;
}

void Envelope::noteOff()
{
    state = State::Release;
}

bool Envelope::isActive() const
{
    return state != State::Idle;
}

float Envelope::processSample()
{
    switch (state)
    {
        case State::Idle:
            currentLevel = 0.0f;
            break;
            
        case State::Attack:
            currentLevel += attackIncrement;
            if (currentLevel >= 1.0f)
            {
                currentLevel = 1.0f;
                state = State::Decay;
            }
            break;
            
        case State::Decay:
            currentLevel -= decayIncrement;
            if (currentLevel <= sustainLevel)
            {
                currentLevel = sustainLevel;
                state = State::Sustain;
            }
            break;
            
        case State::Sustain:
            currentLevel = sustainLevel;
            break;
            
        case State::Release:
            currentLevel -= releaseIncrement;
            if (currentLevel <= 0.0f)
            {
                currentLevel = 0.0f;
                state = State::Idle;
            }
            break;
    }
    
    return currentLevel;
}
