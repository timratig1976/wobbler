#pragma once

#include <vector>
#include <string>

class ONNXInference
{
public:
    ONNXInference();
    ~ONNXInference();
    
    bool loadModel(const std::string& modelPath);
    std::vector<float> runInference(const std::vector<float>& input);
    
    bool isModelLoaded() const { return modelLoaded; }
    
private:
    bool modelLoaded = false;
};
