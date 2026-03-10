#pragma once

#include "ONNXInference.h"
#include "LockFreeQueue.h"
#include <JuceHeader.h>
#include <vector>
#include <thread>
#include <atomic>

struct GeneratedPattern
{
    std::vector<float> cutoffCurve;
    std::vector<float> pitchPattern;
    std::vector<float> distortionCurve;
    std::vector<float> lfoRates;
};

class PatternGenerator
{
public:
    PatternGenerator();
    ~PatternGenerator();
    
    void initialize(const std::string& modelPath);
    void requestNewPattern();
    bool getNextPattern(GeneratedPattern& pattern);
    
    void startWorkerThread();
    void stopWorkerThread();
    
private:
    ONNXInference inference;
    LockFreeQueue<GeneratedPattern> patternQueue;
    
    std::thread workerThread;
    std::atomic<bool> shouldRun;
    std::atomic<bool> generateRequested;
    
    void workerThreadFunction();
    GeneratedPattern generatePattern();
};
