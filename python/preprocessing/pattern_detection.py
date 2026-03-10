import numpy as np
from scipy import signal

class WobblePatternDetector:
    def __init__(self, sample_rate=44100):
        self.sample_rate = sample_rate
        
    def detect_lfo_rate(self, modulation_curve, min_rate=0.1, max_rate=20.0):
        autocorr = np.correlate(modulation_curve, modulation_curve, mode='full')
        autocorr = autocorr[len(autocorr)//2:]
        
        peaks, _ = signal.find_peaks(autocorr)
        
        if len(peaks) > 1:
            period_samples = peaks[1] - peaks[0]
            period_seconds = period_samples / self.sample_rate
            rate = 1.0 / period_seconds
            
            if min_rate <= rate <= max_rate:
                return rate
        
        return 4.0
    
    def detect_wobble_type(self, modulation_curve):
        fft = np.fft.fft(modulation_curve)
        power = np.abs(fft[:len(fft)//2])
        
        peak_idx = np.argmax(power[1:]) + 1
        
        if peak_idx < 5:
            return 'classic'
        elif peak_idx < 15:
            return 'neuro'
        else:
            return 'growl'
    
    def segment_pattern(self, audio, segment_length_seconds=2.0):
        segment_samples = int(segment_length_seconds * self.sample_rate)
        
        num_segments = len(audio) // segment_samples
        segments = []
        
        for i in range(num_segments):
            start = i * segment_samples
            end = start + segment_samples
            segments.append(audio[start:end])
        
        return segments

if __name__ == '__main__':
    detector = WobblePatternDetector()
    
    test_curve = np.sin(2 * np.pi * 4.0 * np.linspace(0, 1, 1000))
    rate = detector.detect_lfo_rate(test_curve)
    print(f'Detected LFO rate: {rate} Hz')
    
    wobble_type = detector.detect_wobble_type(test_curve)
    print(f'Wobble type: {wobble_type}')
