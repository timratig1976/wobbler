#pragma once

#include "ModulationSource.h"
#include <JuceHeader.h>

class AIModulationSource : public ModulationSource
{
public:
    AIModulationSource();
    ~AIModulationSource() override;
    
    float getValue() override;
    void reset() override;
    
    void setPattern(const std::vector<float>& pattern);
    void setPlaybackRate(float rate);
    
private:
    std::vector<float> modulationPattern;
    float playbackPosition = 0.0f;
    float playbackRate = 1.0f;
};
