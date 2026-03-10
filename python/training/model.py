import torch
import torch.nn as nn

class WobblePatternLSTM(nn.Module):
    def __init__(self, latent_dim=128, hidden_dim=256, output_dim=64):
        super(WobblePatternLSTM, self).__init__()
        
        self.latent_dim = latent_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim
        
        self.fc_input = nn.Linear(latent_dim, hidden_dim)
        
        self.lstm = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=2,
            batch_first=True,
            dropout=0.2
        )
        
        self.fc_cutoff = nn.Linear(hidden_dim, output_dim)
        self.fc_pitch = nn.Linear(hidden_dim, 16)
        self.fc_distortion = nn.Linear(hidden_dim, output_dim)
        self.fc_lfo = nn.Linear(hidden_dim, 16)
        
    def forward(self, z):
        batch_size = z.size(0)
        
        x = torch.relu(self.fc_input(z))
        x = x.unsqueeze(1).repeat(1, self.output_dim, 1)
        
        lstm_out, _ = self.lstm(x)
        
        cutoff_curve = torch.tanh(self.fc_cutoff(lstm_out[:, :, :]))
        
        final_hidden = lstm_out[:, -1, :]
        pitch_pattern = torch.tanh(self.fc_pitch(final_hidden)) * 12.0
        distortion_curve = torch.sigmoid(self.fc_distortion(lstm_out[:, :, :]))
        lfo_rates = torch.sigmoid(self.fc_lfo(final_hidden)) * 10.0 + 0.1
        
        return {
            'cutoff_curve': cutoff_curve,
            'pitch_pattern': pitch_pattern,
            'distortion_curve': distortion_curve,
            'lfo_rates': lfo_rates
        }

class WobblePatternTransformer(nn.Module):
    def __init__(self, latent_dim=128, hidden_dim=256, output_dim=64, num_heads=4):
        super(WobblePatternTransformer, self).__init__()
        
        self.latent_dim = latent_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim
        
        self.embedding = nn.Linear(latent_dim, hidden_dim)
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=hidden_dim,
            nhead=num_heads,
            dim_feedforward=hidden_dim * 4,
            dropout=0.1,
            batch_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=3)
        
        self.fc_cutoff = nn.Linear(hidden_dim, output_dim)
        self.fc_pitch = nn.Linear(hidden_dim, 16)
        self.fc_distortion = nn.Linear(hidden_dim, output_dim)
        self.fc_lfo = nn.Linear(hidden_dim, 16)
        
    def forward(self, z):
        batch_size = z.size(0)
        
        x = self.embedding(z)
        x = x.unsqueeze(1).repeat(1, self.output_dim, 1)
        
        x = self.transformer(x)
        
        cutoff_curve = torch.tanh(self.fc_cutoff(x))
        
        pooled = x.mean(dim=1)
        pitch_pattern = torch.tanh(self.fc_pitch(pooled)) * 12.0
        distortion_curve = torch.sigmoid(self.fc_distortion(x))
        lfo_rates = torch.sigmoid(self.fc_lfo(pooled)) * 10.0 + 0.1
        
        return {
            'cutoff_curve': cutoff_curve,
            'pitch_pattern': pitch_pattern,
            'distortion_curve': distortion_curve,
            'lfo_rates': lfo_rates
        }
