#pragma once

#include <array>

class Wavetables
{
public:
    static constexpr int tableSize = 2048;
    
    static void generateSaw(std::array<float, tableSize>& table);
    static void generateSquare(std::array<float, tableSize>& table);
    static void generateSine(std::array<float, tableSize>& table);
    static void generateTriangle(std::array<float, tableSize>& table);
};
