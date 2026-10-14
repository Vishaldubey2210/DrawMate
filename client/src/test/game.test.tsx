import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WordHintDisplay } from '../features/game/WordHintDisplay.js';
import { GameHeader } from '../features/game/GameHeader.js';
import { WordSelectionModal } from '../features/game/WordSelectionModal.js';
import { GameChat } from '../features/game/GameChat.js';
import { GameLeaderboard } from '../features/game/GameLeaderboard.js';
import { RoundResultsModal } from '../features/game/RoundResultsModal.js';
import { GameOverScreen } from '../features/game/GameOverScreen.js';
import { GuessMessage, RoundSummary, SanitizedGameSnapshot, PlayerScore } from '../features/game/game.types.js';

describe('Phase 4 - Frontend Game Engine Components', () => {
  describe('WordHintDisplay', () => {
    it('renders masked word blanks, letter count, and category', () => {
      render(
        <WordHintDisplay
          maskedWord="_ _ _ _ _"
          wordLength={5}
          category="animals"
        />
      );

      expect(screen.getByText('_ _ _ _ _')).toBeInTheDocument();
      expect(screen.getByText('5 letters')).toBeInTheDocument();
      expect(screen.getByText(/animals/i)).toBeInTheDocument();
    });
  });

  describe('GameHeader', () => {
    const mockGame: SanitizedGameSnapshot = {
      gameId: 'game-123',
      roomCode: 'PLAY01',
      phase: 'drawing',
      currentRound: 2,
      totalRounds: 3,
      drawerId: 'user-1',
      drawerName: 'Alice',
      turnIndex: 1,
      totalTurnsInRound: 3,
      word: {
        masked: '_ _ _ _',
        revealedIndices: [],
        length: 4,
        secret: 'LION',
      },
      scores: [
        {
          userId: 'user-1',
          username: 'alice',
          displayName: 'Alice',
          avatar: 'avatar-1',
          score: 150,
          roundScore: 50,
          correctGuesses: 1,
          drawingTurns: 1,
        },
      ],
      recentGuesses: [],
      timer: {
        durationSeconds: 60,
        startedAt: Date.now(),
        deadline: Date.now() + 45000,
      },
      revision: 1,
    };

    it('renders round counter, artist badge, countdown, and secret word for drawer', () => {
      render(
        <GameHeader
          game={mockGame}
          isDrawer={true}
          countdownSeconds={45}
        />
      );

      expect(screen.getByText(/Round 2/i)).toBeInTheDocument();
      expect(screen.getByText('45s')).toBeInTheDocument();
      expect(screen.getByText('LION')).toBeInTheDocument();
      expect(screen.getByText(/You are drawing/i)).toBeInTheDocument();
    });

    it('renders masked hint and observer label for guesser', () => {
      const guesserGame: SanitizedGameSnapshot = {
        ...mockGame,
        word: {
          masked: '_ _ _ _',
          revealedIndices: [],
          length: 4,
        },
      };

      render(
        <GameHeader
          game={guesserGame}
          isDrawer={false}
          countdownSeconds={30}
        />
      );

      expect(screen.getByTitle('Secret Word Blanks')).toBeInTheDocument();
      expect(screen.getByText(/Artist:/i)).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.queryByText('LION')).not.toBeInTheDocument();
    });
  });

  describe('WordSelectionModal', () => {
    it('renders selectable word choices with countdown for drawer', () => {
      const handleSelect = vi.fn();
      const choices = ['Elephant', 'Guitar', 'Rocket'];

      render(
        <WordSelectionModal
          isOpen={true}
          isDrawer={true}
          drawerName="Alice"
          choices={choices}
          countdownSeconds={12}
          onSelectWord={handleSelect}
        />
      );

      expect(screen.getByText(/Elephant/i)).toBeInTheDocument();
      expect(screen.getByText(/Guitar/i)).toBeInTheDocument();
      expect(screen.getByText(/Rocket/i)).toBeInTheDocument();
      expect(screen.getByText(/Selection time: 12s/i)).toBeInTheDocument();

      fireEvent.click(screen.getByText(/Guitar/i));
      expect(handleSelect).toHaveBeenCalledWith('Guitar');
    });

    it('renders waiting banner for guessers', () => {
      render(
        <WordSelectionModal
          isOpen={true}
          isDrawer={false}
          drawerName="Alice"
          countdownSeconds={10}
          onSelectWord={() => {}}
        />
      );

      expect(screen.getByText(/Alice is selecting a word/i)).toBeInTheDocument();
    });
  });

  describe('GameChat', () => {
    const mockMessages: GuessMessage[] = [
      {
        id: 'msg-1',
        userId: 'user-2',
        displayName: 'Bob',
        text: 'zebra',
        isCorrect: false,
        timestamp: Date.now(),
      },
      {
        id: 'msg-2',
        userId: 'user-3',
        displayName: 'Charlie',
        text: 'Guessed the secret word!',
        isCorrect: true,
        timestamp: Date.now() + 1000,
      },
    ];

    it('renders stream of guesses including correct guess notifications', () => {
      render(
        <GameChat
          messages={mockMessages}
          onSendGuess={() => Promise.resolve(true)}
          isDrawer={false}
          hasGuessedCorrectly={false}
        />
      );

      expect(screen.getByText('Bob:')).toBeInTheDocument();
      expect(screen.getByText('zebra')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText(/guessed the word!/i)).toBeInTheDocument();
    });

    it('disables input when player is the drawer', () => {
      render(
        <GameChat
          messages={[]}
          onSendGuess={() => Promise.resolve(true)}
          isDrawer={true}
          hasGuessedCorrectly={false}
        />
      );

      const input = screen.getByPlaceholderText(/You are drawing/i);
      expect(input).toBeDisabled();
    });

    it('submits valid guess text and clears input field', async () => {
      const handleGuess = vi.fn().mockImplementation(() => Promise.resolve(true));
      render(
        <GameChat
          messages={[]}
          onSendGuess={handleGuess}
          isDrawer={false}
          hasGuessedCorrectly={false}
        />
      );

      const input = screen.getByPlaceholderText(/Type your guess here/i);
      fireEvent.change(input, { target: { value: 'elephant' } });
      fireEvent.submit(input.closest('form')!);

      expect(handleGuess).toHaveBeenCalledWith('elephant');
      await waitFor(() => {
        expect((input as HTMLInputElement).value).toBe('');
      });
    });
  });

  describe('GameLeaderboard', () => {
    const mockScores: PlayerScore[] = [
      {
        userId: 'user-1',
        username: 'alice',
        displayName: 'Alice Winner',
        avatar: 'avatar-1',
        score: 350,
        roundScore: 50,
        correctGuesses: 2,
        drawingTurns: 1,
      },
      {
        userId: 'user-2',
        username: 'bob',
        displayName: 'Bob Artist',
        avatar: 'avatar-2',
        score: 200,
        roundScore: 0,
        correctGuesses: 1,
        drawingTurns: 1,
      },
    ];

    it('renders ordered player ranks, scores, and drawer indicator', () => {
      render(
        <GameLeaderboard
          scores={mockScores}
          currentDrawerId="user-2"
          guessedUserIds={['user-1']}
        />
      );

      expect(screen.getByText('Alice Winner')).toBeInTheDocument();
      expect(screen.getByText('350 pts')).toBeInTheDocument();
      expect(screen.getByText('Bob Artist')).toBeInTheDocument();
      expect(screen.getByText('200 pts')).toBeInTheDocument();
      expect(screen.getByTitle('Currently Drawing')).toBeInTheDocument();
    });
  });

  describe('RoundResultsModal', () => {
    const mockSummary: RoundSummary = {
      roundNumber: 1,
      drawerId: 'user-2',
      drawerName: 'Bob',
      secretWord: 'GIRAFFE',
      winnerId: 'user-1',
      winnerName: 'Alice',
      reason: 'guessed',
      pointsAwarded: {
        'user-1': 175,
        'user-2': 50,
      },
    };

    it('renders round summary, revealed word, winner name, and points', () => {
      render(
        <RoundResultsModal
          isOpen={true}
          summary={mockSummary}
          countdownSeconds={5}
        />
      );

      expect(screen.getByText('Round 1 Results')).toBeInTheDocument();
      expect(screen.getByText('GIRAFFE')).toBeInTheDocument();
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
      expect(screen.getByText(/guessed the word!/i)).toBeInTheDocument();
      expect(screen.getByText(/Next turn starting in 5s/i)).toBeInTheDocument();
    });
  });

  describe('GameOverScreen', () => {
    const mockScores: PlayerScore[] = [
      {
        userId: 'user-1',
        username: 'alice',
        displayName: 'Alice Champion',
        avatar: 'avatar-1',
        score: 600,
        roundScore: 0,
        correctGuesses: 3,
        drawingTurns: 2,
      },
      {
        userId: 'user-2',
        username: 'bob',
        displayName: 'Bob Runner-Up',
        avatar: 'avatar-2',
        score: 450,
        roundScore: 0,
        correctGuesses: 2,
        drawingTurns: 2,
      },
    ];

    it('renders podium champion, leaderboard table, and triggers return to lobby', () => {
      const handleReturn = vi.fn();
      render(
        <GameOverScreen
          winner={{
            userId: 'user-1',
            displayName: 'Alice Champion',
            score: 600,
          }}
          scores={mockScores}
          onReturnToLobby={handleReturn}
        />
      );

      expect(screen.getByText(/Match Concluded/i)).toBeInTheDocument();
      expect(screen.getByText(/Alice Champion Wins!/i)).toBeInTheDocument();
      expect(screen.getAllByText('Bob Runner-Up').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/600\s*pts/i).length).toBeGreaterThanOrEqual(1);

      const returnBtn = screen.getByRole('button', { name: /Return to Lobby/i });
      fireEvent.click(returnBtn);
      expect(handleReturn).toHaveBeenCalledTimes(1);
    });
  });
});
