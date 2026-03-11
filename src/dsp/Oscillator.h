#pragma once

#include <JuceHeader.h>

class Oscillator
{
public:
    enum class Waveform { Sine, Sawtooth, Square, Triangle };

    Oscillator();
    ~Oscillator();

    void  prepare(double sampleRate);
    void  setWaveform(Waveform w)    { waveform = w; }
    void  setFrequency(float freqHz);
    void  setDetuneCents(float cents);
    void  setVolume(float v)         { volume = juce::jlimit(0.0f, 2.0f, v); }
    void  setNoiseVolume(float v)    { noiseVolume = juce::jlimit(0.0f, 1.0f, v); }

    float processSample();           // oscillator output * volume
    float processNoiseSample();      // white noise * noiseVolume

private:
    double   sampleRate     = 44100.0;
    Waveform waveform       = Waveform::Sawtooth;
    float    frequency      = 440.0f;
    float    detuneCents    = 0.0f;
    float    volume         = 0.8f;
    float    noiseVolume    = 0.0f;
    float    phase          = 0.0f;
    float    phaseIncrement = 0.0f;
    juce::Random rng;

    float computeFrequency() const;
    void  updatePhaseIncrement();
};
