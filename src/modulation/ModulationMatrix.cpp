#include "ModulationMatrix.h"

ModulationMatrix::ModulationMatrix()
{
}

ModulationMatrix::~ModulationMatrix()
{
}

void ModulationMatrix::addSource(ModulationSource* source)
{
    sources.push_back(source);
}

void ModulationMatrix::routeToParameter(int sourceIndex, int parameterIndex, float amount)
{
    routings[{sourceIndex, parameterIndex}] = amount;
}

float ModulationMatrix::getModulatedValue(int parameterIndex, float baseValue)
{
    float modulatedValue = baseValue;
    
    for (size_t i = 0; i < sources.size(); ++i)
    {
        auto it = routings.find({static_cast<int>(i), parameterIndex});
        if (it != routings.end())
        {
            float modAmount = it->second;
            float modValue = sources[i]->getValue();
            modulatedValue += modValue * modAmount;
        }
    }
    
    return modulatedValue;
}
