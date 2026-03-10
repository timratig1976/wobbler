import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import argparse
import os

from model import WobblePatternLSTM, WobblePatternTransformer
from dataset import SyntheticWobbleDataset

def train_model(model, train_loader, num_epochs, device, save_path):
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    criterion_mse = nn.MSELoss()
    
    model.train()
    
    for epoch in range(num_epochs):
        total_loss = 0.0
        
        for batch_idx, batch in enumerate(train_loader):
            latent = batch['latent'].to(device)
            target_cutoff = batch['cutoff_curve'].to(device)
            target_pitch = batch['pitch_pattern'].to(device)
            target_distortion = batch['distortion_curve'].to(device)
            target_lfo = batch['lfo_rates'].to(device)
            
            optimizer.zero_grad()
            
            outputs = model(latent)
            
            loss_cutoff = criterion_mse(outputs['cutoff_curve'], target_cutoff)
            loss_pitch = criterion_mse(outputs['pitch_pattern'], target_pitch)
            loss_distortion = criterion_mse(outputs['distortion_curve'], target_distortion)
            loss_lfo = criterion_mse(outputs['lfo_rates'], target_lfo)
            
            loss = loss_cutoff + loss_pitch + loss_distortion + loss_lfo
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            
            if batch_idx % 100 == 0:
                print(f'Epoch [{epoch+1}/{num_epochs}], Batch [{batch_idx}/{len(train_loader)}], Loss: {loss.item():.4f}')
        
        avg_loss = total_loss / len(train_loader)
        print(f'Epoch [{epoch+1}/{num_epochs}] Average Loss: {avg_loss:.4f}')
        
        if (epoch + 1) % 10 == 0:
            checkpoint_path = f'{save_path}_epoch_{epoch+1}.pth'
            torch.save(model.state_dict(), checkpoint_path)
            print(f'Checkpoint saved: {checkpoint_path}')
    
    torch.save(model.state_dict(), save_path)
    print(f'Final model saved: {save_path}')

def export_to_onnx(model, save_path, device):
    model.eval()
    
    dummy_input = torch.randn(1, 128).to(device)
    
    onnx_path = save_path.replace('.pth', '.onnx')
    
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['latent_vector'],
        output_names=['cutoff_curve', 'pitch_pattern', 'distortion_curve', 'lfo_rates'],
        dynamic_axes={
            'latent_vector': {0: 'batch_size'},
            'cutoff_curve': {0: 'batch_size'},
            'pitch_pattern': {0: 'batch_size'},
            'distortion_curve': {0: 'batch_size'},
            'lfo_rates': {0: 'batch_size'}
        }
    )
    
    print(f'ONNX model exported: {onnx_path}')

def main():
    parser = argparse.ArgumentParser(description='Train Wobble Pattern Generator')
    parser.add_argument('--model', type=str, default='lstm', choices=['lstm', 'transformer'])
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--batch_size', type=int, default=32)
    parser.add_argument('--num_samples', type=int, default=10000)
    parser.add_argument('--save_dir', type=str, default='../models')
    
    args = parser.parse_args()
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Using device: {device}')
    
    if args.model == 'lstm':
        model = WobblePatternLSTM().to(device)
    else:
        model = WobblePatternTransformer().to(device)
    
    print(f'Model: {args.model}')
    print(f'Parameters: {sum(p.numel() for p in model.parameters())}')
    
    dataset = SyntheticWobbleDataset(num_samples=args.num_samples)
    train_loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)
    
    os.makedirs(args.save_dir, exist_ok=True)
    save_path = os.path.join(args.save_dir, f'wobble_pattern_{args.model}.pth')
    
    train_model(model, train_loader, args.epochs, device, save_path)
    
    export_to_onnx(model, save_path, device)

if __name__ == '__main__':
    main()
