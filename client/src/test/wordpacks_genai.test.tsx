import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenAIWordPackModal } from '../features/wordpacks/GenAIWordPackModal.js';
import { wordPackService } from '../services/wordPackService.js';
import { ToastProvider } from '../context/ToastContext.js';

vi.mock('../services/wordPackService.js', () => ({
  wordPackService: {
    generateWithAI: vi.fn(),
    createWordPack: vi.fn(),
  },
}));

describe('GenAIWordPackModal Component', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (isOpen = true) => {
    return render(
      <ToastProvider>
        <GenAIWordPackModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} />
      </ToastProvider>
    );
  };

  it('renders form fields when open', () => {
    renderModal(true);

    expect(screen.getByText(/GenAI Word Pack Generator/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Hindi Bollywood Blockbuster/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate word pack/i })).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderModal(false);
    expect(screen.queryByText(/GenAI Word Pack Generator/i)).not.toBeInTheDocument();
  });

  it('triggers word generation and displays preview word chips', async () => {
    vi.mocked(wordPackService.generateWithAI).mockResolvedValueOnce({
      theme: 'Retro Arcade Games',
      packName: 'Retro Arcade Games Pack',
      description: 'Classic pixel games',
      language: 'en',
      category: 'gaming',
      words: ['Pacman', 'Tetris', 'Galaga', 'Donkey Kong', 'Frogger'],
      wordDetails: [
        { word: 'Pacman', difficulty: 'easy' },
        { word: 'Tetris', difficulty: 'easy' },
        { word: 'Galaga', difficulty: 'medium' },
        { word: 'Donkey Kong', difficulty: 'medium' },
        { word: 'Frogger', difficulty: 'easy' },
      ],
      providerUsed: 'mock',
    });

    renderModal(true);

    const input = screen.getByPlaceholderText(/Hindi Bollywood Blockbuster/i);
    fireEvent.change(input, { target: { value: 'Retro Arcade Games' } });

    const generateBtn = screen.getByRole('button', { name: /generate word pack/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('Pacman')).toBeInTheDocument();
      expect(screen.getByText('Tetris')).toBeInTheDocument();
      expect(screen.getByText(/5 Accepted Words/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save to my packs/i })).toBeInTheDocument();
    });
  });

  it('allows removing an invalid generated word from preview', async () => {
    vi.mocked(wordPackService.generateWithAI).mockResolvedValueOnce({
      theme: 'Fruits',
      packName: 'Fruits Pack',
      description: 'Delicious fruits',
      language: 'en',
      category: 'food',
      words: ['Apple', 'Banana', 'Cherry', 'Mango', 'Peach'],
      wordDetails: [
        { word: 'Apple', difficulty: 'easy' },
        { word: 'Banana', difficulty: 'easy' },
        { word: 'Cherry', difficulty: 'easy' },
        { word: 'Mango', difficulty: 'medium' },
        { word: 'Peach', difficulty: 'easy' },
      ],
      providerUsed: 'mock',
    });

    renderModal(true);

    const input = screen.getByPlaceholderText(/Hindi Bollywood Blockbuster/i);
    fireEvent.change(input, { target: { value: 'Fruits' } });

    const generateBtn = screen.getByRole('button', { name: /generate word pack/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });

    // Remove 'Apple'
    const removeAppleBtn = screen.getByRole('button', { name: /remove apple/i });
    fireEvent.click(removeAppleBtn);

    await waitFor(() => {
      expect(screen.queryByText('Apple')).not.toBeInTheDocument();
      expect(screen.getByText(/4 Accepted Words/i)).toBeInTheDocument();
    });
  });
});
