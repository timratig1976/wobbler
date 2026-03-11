#pragma once

#include <JuceHeader.h>
#include "../dsp/Oscillator.h"
#include "../dsp/Filter.h"
#include "../dsp/Envelope.h"
#include "../dsp/LFO.h"

class WobblerVoice
{
public:
    static constexpr int NUM_LFOS = 5;

    // ── Per-voice parameters (mirrors JS WobblerVoice.p) ──────────────────
    struct Params
    {
        Oscillator::Waveform oscWaveform    = Oscillator::Waveform::Sawtooth;
        float oscPitchSemitones             = 0.0f;
        float oscDetuneCents                = 0.0f;
        float oscVolume                     = 0.8f;

        float noiseVolume                   = 0.0f;

        Filter::Type filterType             = Filter::Type::Lowpass;
        float filterCutoff                  = 800.0f;
        float filterResonance               = 5.0f;
        float filterEnvAmount               = 2000.0f;

        float attack                        = 0.005f;
        float decay                         = 0.25f;
        float sustain                       = 0.4f;
        float release                       = 0.12f;

        float volume                        = 0.8f;
        float pan                           = 0.0f;
        bool  mute                          = false;
    };

    struct LFOParams
    {
        LFO::Waveform      waveform         = LFO::Waveform::Sine;
        float              rate             = 4.0f;
        float              depth            = 0.0f;
        float              phaseOffset      = 0.0f;  // radians
        bool               bpmSync          = false;
        float              syncDivBeats     = 1.0f;  // 0.25=1/16, 4.0=1/1
        LFO::Target        target           = LFO::Target::Cutoff;
        LFO::MetaTarget    metaTarget       = LFO::MetaTarget::None;
        int                metaTargetLFO    = 0;     // 0..3 → LFO1..4
    };

    WobblerVoice();

    void prepare(double sampleRate, int maxBlockSize);
    void noteOn(float freqHz, float velocity);
    void noteOff();
    void setBpm(float bpm);
    void applyParams();                     // flush Params/LFOParams to DSP

    float processSampleL();                 // call once per sample (left)
    float processSampleR();                 // call after L (right), uses same env val
    bool  isActive() const;

    Params&    getParams()           { return params; }
    LFOParams& getLFOParams(int i)   { return lfoParams[i]; }

private:
    double   sampleRate     = 44100.0;
    float    bpm            = 120.0f;
    float    currentFreq    = 440.0f;
    float    currentVelocity= 0.65f;
    float    panLeft        = 1.0f;
    float    panRight       = 1.0f;
    float    lastSample     = 0.0f;         // shared between L/R

    Params    params;
    LFOParams lfoParams[NUM_LFOS];

    Oscillator osc;
    Filter     filter;
    Envelope   ampEnv;
    Envelope   filterEnv;
    LFO        lfos[NUM_LFOS];

    void  updatePan();
    float computeAndStoreSample();          // called by processSampleL
    void  applyLFOModulation(float& cutoffMod, float& resMod,
                             float& volMod,    float& pitchMod,
                             float& noiseMod);
};
