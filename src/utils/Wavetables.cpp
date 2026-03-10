#include "Wavetables.h"
#include <cmath>

void Wavetables::generateSaw(std::array<float, tableSize>& table)
{
    for (int i = 0; i < tableSize; ++i)
    {
        float t = static_cast<float>(i) / static_cast<float>(tableSize);
        table[i] = 2.0f * t - 1.0f;
    }
}

void Wavetables::generateSquare(std::array<float, tableSize>& table)
{
    for (int i = 0; i < tableSize; ++i)
    {
        float t = static_cast<float>(i) / static_cast<float>(tableSize);
        table[i] = (t < 0.5f) ? 1.0f : -1.0f;
    }
}

void Wavetables::generateSine(std::array<float, tableSize>& table)
{
    for (int i = 0; i < tableSize; ++i)
    {
        float t = static_cast<float>(i) / static_cast<float>(tableSize);
        table[i] = std::sin(2.0f * 3.14159265359f * t);
    }
}

void Wavetables::generateTriangle(std::array<float, tableSize>& table)
{
    for (int i = 0; i < tableSize; ++i)
    {
        float t = static_cast<float>(i) / static_cast<float>(tableSize);
        table[i] = (t < 0.5f) ? (4.0f * t - 1.0f) : (3.0f - 4.0f * t);
    }
}
