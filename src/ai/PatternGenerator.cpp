#include "PatternGenerator.h"
#include <random>

PatternGenerator::PatternGenerator()
    : patternQueue(16), shouldRun(false), generateRequested(false)
{
}

PatternGenerator::~PatternGenerator()
{
    stopWorkerThread();
}

void PatternGenerator::initialize(const std::string& modelPath)
{
    inference.loadModel(modelPath);
}

void PatternGenerator::requestNewPattern()
{
    generateRequested.store(true, std::memory_order_release);
}

bool PatternGenerator::getNextPattern(GeneratedPattern& pattern)
{
    return patternQueue.pop(pattern);
}

void PatternGenerator::startWorkerThread()
{
    if (shouldRun.load())
        return;
    
    shouldRun.store(true);
    workerThread = std::thread(&PatternGenerator::workerThreadFunction, this);
}

void PatternGenerator::stopWorkerThread()
{
    shouldRun.store(false);
    if (workerThread.joinable())
        workerThread.join();
}

void PatternGenerator::workerThreadFunction()
{
    while (shouldRun.load(std::memory_order_acquire))
    {
        if (generateRequested.load(std::memory_order_acquire))
        {
            generateRequested.store(false, std::memory_order_release);
            
            GeneratedPattern pattern = generatePattern();
            patternQueue.push(pattern);
        }
        
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
}

GeneratedPattern PatternGenerator::generatePattern()
{
    GeneratedPattern pattern;
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<float> dist(0.0f, 1.0f);
    
    std::vector<float> input(128);
    for (auto& val : input)
        val = dist(gen);
    
    std::vector<float> output = inference.runInference(input);
    
    pattern.cutoffCurve.resize(64);
    pattern.pitchPattern.resize(16);
    pattern.distortionCurve.resize(64);
    pattern.lfoRates.resize(16);
    
    for (size_t i = 0; i < 64; ++i)
    {
        if (i < output.size())
            pattern.cutoffCurve[i] = output[i];
        else
            pattern.cutoffCurve[i] = 0.0f;
    }
    
    for (size_t i = 0; i < 16; ++i)
    {
        pattern.pitchPattern[i] = (dist(gen) - 0.5f) * 12.0f;
        pattern.lfoRates[i] = 1.0f + dist(gen) * 8.0f;
    }
    
    for (size_t i = 0; i < 64; ++i)
    {
        pattern.distortionCurve[i] = dist(gen) * 0.5f;
    }
    
    return pattern;
}
