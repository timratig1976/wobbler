#include "Sequencer.h"

Sequencer::Sequencer()
{
    // Default pattern: beats 1,2,3,4 (steps 0,4,8,12)
    for (int i = 0; i < NUM_STEPS; ++i)
    {
        steps[i].active   = (i % 4 == 0);
        steps[i].midiNote = 36;
        steps[i].accent   = false;
    }
}

void Sequencer::prepare(double sr)
{
    sampleRate = sr;
    updateSamplesPerStep();
}

void Sequencer::setBpm(float b)
{
    bpm = juce::jlimit(40.0f, 240.0f, b);
    updateSamplesPerStep();
}

void Sequencer::updateSamplesPerStep()
{
    // 16th note = quarter-beat = (60/bpm) / 4 seconds
    samplesPerStep = (60.0 / static_cast<double>(bpm)) * sampleRate / 4.0;
}

void Sequencer::start()
{
    playing       = true;
    currentStep   = 0;
    sampleCounter = 0.0;
}

void Sequencer::stop()
{
    playing       = false;
    currentStep   = 0;
    sampleCounter = 0.0;
}

void Sequencer::reset()
{
    currentStep   = 0;
    sampleCounter = 0.0;
}

std::pair<int, float> Sequencer::advanceSample()
{
    if (!playing)
        return { -1, 0.0f };

    std::pair<int, float> trigger = { -1, 0.0f };

    if (sampleCounter <= 0.0)
    {
        const auto& step = steps[currentStep];
        if (step.active)
            trigger = { step.midiNote, step.accent ? 1.0f : 0.65f };

        sampleCounter += samplesPerStep;
        currentStep    = (currentStep + 1) % NUM_STEPS;
    }

    sampleCounter -= 1.0;
    return trigger;
}
