#pragma once

#include <atomic>
#include <vector>

template<typename T>
class LockFreeQueue
{
public:
    explicit LockFreeQueue(size_t capacity)
        : buffer(capacity), capacity(capacity), writeIndex(0), readIndex(0)
    {
    }
    
    bool push(const T& item)
    {
        size_t currentWrite = writeIndex.load(std::memory_order_relaxed);
        size_t nextWrite = (currentWrite + 1) % capacity;
        
        if (nextWrite == readIndex.load(std::memory_order_acquire))
            return false;
        
        buffer[currentWrite] = item;
        writeIndex.store(nextWrite, std::memory_order_release);
        return true;
    }
    
    bool pop(T& item)
    {
        size_t currentRead = readIndex.load(std::memory_order_relaxed);
        
        if (currentRead == writeIndex.load(std::memory_order_acquire))
            return false;
        
        item = buffer[currentRead];
        readIndex.store((currentRead + 1) % capacity, std::memory_order_release);
        return true;
    }
    
    bool isEmpty() const
    {
        return readIndex.load(std::memory_order_acquire) == 
               writeIndex.load(std::memory_order_acquire);
    }
    
private:
    std::vector<T> buffer;
    size_t capacity;
    std::atomic<size_t> writeIndex;
    std::atomic<size_t> readIndex;
};
