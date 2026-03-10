#pragma once

#include <JuceHeader.h>
#include "ModulationSource.h"

class ModulationMatrix
{
public:
    ModulationMatrix();
    ~ModulationMatrix();
    
    void addSource(ModulationSource* source);
    void routeToParameter(int sourceIndex, int parameterIndex, float amount);
    
    float getModulatedValue(int parameterIndex, float baseValue);
    
private:
    std::vector<ModulationSource*> sources;
    std::map<std::pair<int, int>, float> routings;
};
