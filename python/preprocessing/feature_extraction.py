import librosa
import numpy as np
import soundfile as sf

class BassFeatureExtractor:
    def __init__(self, sample_rate=44100):
        self.sample_rate = sample_rate
        
    def extract_features(self, audio_path):
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        
        features = {}
        
        features['spectral_centroid'] = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        
        features['spectral_rolloff'] = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        
        features['spectral_flux'] = self._compute_spectral_flux(y, sr)
        
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        features['pitch'] = self._extract_pitch_contour(pitches, magnitudes)
        
        features['amplitude_envelope'] = np.abs(librosa.stft(y))
        
        features['rms'] = librosa.feature.rms(y=y)[0]
        
        return features
    
    def _compute_spectral_flux(self, y, sr):
        S = np.abs(librosa.stft(y))
        flux = np.sqrt(np.sum(np.diff(S, axis=1)**2, axis=0))
        return flux
    
    def _extract_pitch_contour(self, pitches, magnitudes):
        pitch_contour = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            pitch_contour.append(pitch if pitch > 0 else 0)
        return np.array(pitch_contour)
    
    def extract_modulation_pattern(self, features, segment_length=64):
        centroid = features['spectral_centroid']
        
        if len(centroid) < segment_length:
            centroid = np.pad(centroid, (0, segment_length - len(centroid)), mode='edge')
        else:
            centroid = centroid[:segment_length]
        
        cutoff_curve = (centroid - centroid.min()) / (centroid.max() - centroid.min() + 1e-8)
        cutoff_curve = cutoff_curve * 2 - 1
        
        pitch = features['pitch']
        if len(pitch) < 16:
            pitch = np.pad(pitch, (0, 16 - len(pitch)), mode='edge')
        else:
            pitch = pitch[:16]
        
        pitch_pattern = librosa.hz_to_midi(pitch + 1e-8) - 60
        
        return {
            'cutoff_curve': cutoff_curve,
            'pitch_pattern': pitch_pattern
        }

def process_audio_file(audio_path, output_path):
    extractor = BassFeatureExtractor()
    
    features = extractor.extract_features(audio_path)
    
    pattern = extractor.extract_modulation_pattern(features)
    
    np.savez(output_path, **pattern)
    
    return pattern

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 3:
        print('Usage: python feature_extraction.py <input_audio> <output_npz>')
        sys.exit(1)
    
    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    
    pattern = process_audio_file(audio_path, output_path)
    print(f'Extracted pattern saved to {output_path}')
