#pragma once

class ModulationSource
{
public:
    virtual ~ModulationSource() = default;
    
    virtual float getValue() = 0;
    virtual void reset() {}
};
