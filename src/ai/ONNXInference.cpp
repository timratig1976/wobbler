#include "ONNXInference.h"

ONNXInference::ONNXInference()
{
}

ONNXInference::~ONNXInference()
{
}

bool ONNXInference::loadModel(const std::string& modelPath)
{
    modelLoaded = false;
    return modelLoaded;
}

std::vector<float> ONNXInference::runInference(const std::vector<float>& input)
{
    std::vector<float> output(64, 0.0f);
    
    for (size_t i = 0; i < output.size(); ++i)
    {
        float t = static_cast<float>(i) / static_cast<float>(output.size());
        output[i] = std::sin(t * 6.28318f * 4.0f);
    }
    
    return output;
}
