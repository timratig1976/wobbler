#include "AIModulationSource.h"

AIModulationSource::AIModulationSource()
{
    modulationPattern.resize(64, 0.0f);
}

AIModulationSource::~AIModulationSource()
{
}

float AIModulationSource::getValue()
{
    if (modulationPattern.empty())
        return 0.0f;
    
    int index = static_cast<int>(playbackPosition) % modulationPattern.size();
    
    playbackPosition += playbackRate;
    if (playbackPosition >= static_cast<float>(modulationPattern.size()))
        playbackPosition = 0.0f;
    
    return modulationPattern[index];
}

void AIModulationSource::reset()
{
    playbackPosition = 0.0f;
}

void AIModulationSource::setPattern(const std::vector<float>& pattern)
{
    modulationPattern = pattern;
    playbackPosition = 0.0f;
}

void AIModulationSource::setPlaybackRate(float rate)
{
    playbackRate = juce::jlimit(0.01f, 10.0f, rate);
}
