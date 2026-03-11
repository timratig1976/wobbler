#pragma once

#include <JuceHeader.h>

// Sample-accurate 16-step sequencer — mirrors JS Sequencer class
class Sequencer
{
public:
    static constexpr int NUM_STEPS = 16;

    struct Step
    {
        bool  active   = false;
        int   midiNote = 36;   // C2 default
        bool  accent   = false;
    };

    Sequencer();

    void prepare(double sampleRate);
    void setBpm(float bpm);
    void start();
    void stop();
    void reset();

    bool isPlaying()     const { return playing; }
    int  getCurrentStep()const { return currentStep; }

    Step&       getStep(int i)       { return steps[i]; }
    const Step& getStep(int i) const { return steps[i]; }

    // Call once per sample.
    // Returns {midiNote, velocity} when a step triggers, otherwise {-1, 0}
    std::pair<int, float> advanceSample();

private:
    double sampleRate      = 44100.0;
    float  bpm             = 120.0f;
    bool   playing         = false;
    int    currentStep     = 0;
    double samplesPerStep  = 0.0;
    double sampleCounter   = 0.0;

    Step steps[NUM_STEPS];

    void updateSamplesPerStep();
};
