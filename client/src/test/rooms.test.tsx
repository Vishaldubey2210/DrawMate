import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PlayerRoster } from '../features/rooms/PlayerRoster.js';
import { LobbyStatusBanner } from '../features/rooms/LobbyStatusBanner.js';
import { RoomSettingsCard } from '../features/rooms/RoomSettingsCard.js';
import { JoinRoomCard } from '../features/rooms/JoinRoomCard.js';
import { RoomPlayer, RoomSnapshot } from '../types/index.js';
import { ToastProvider } from '../context/ToastContext.js';
import { RoomProvider } from '../context/RoomContext.js';
import { AuthProvider } from '../context/AuthContext.js';

const mockPlayers: RoomPlayer[] = [
  {
    userId: 'user-1',
    username: 'alice',
    displayName: 'Alice Painter',
    avatar: 'avatar-1',
    isHost: true,
    isReady: true,
    isDisconnected: false,
    joinedAt: new Date().toISOString(),
  },
  {
    userId: 'user-2',
    username: 'bob',
    displayName: 'Bob Guesser',
    avatar: 'avatar-2',
    isHost: false,
    isReady: false,
    isDisconnected: false,
    joinedAt: new Date().toISOString(),
  },
];

const mockRoom: RoomSnapshot = {
  roomId: 'room-123',
  roomCode: 'TEST66',
  name: 'Test Lobby',
  visibility: 'public',
  hostId: 'user-1',
  status: 'waiting',
  settings: {
    maxPlayers: 8,
    rounds: 3,
    drawTimeSeconds: 80,
    wordCount: 3,
    hints: 2,
    wordMode: 'normal',
    category: 'general',
  },
  players: mockPlayers,
  currentPlayersCount: 2,
  maxPlayers: 8,
  isLobbyReadyToStart: false,
  createdAt: new Date().toISOString(),
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <RoomProvider>{ui}</RoomProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

describe('Phase 2 - Rooms & Lobby UI Components', () => {
  describe('PlayerRoster', () => {
    it('renders all players, host crown, and readiness badges', () => {
      render(
        <PlayerRoster
          players={mockPlayers}
          maxPlayers={8}
          currentUserId="user-1"
        />
      );

      expect(screen.getByText('Alice Painter')).toBeInTheDocument();
      expect(screen.getByText('Bob Guesser')).toBeInTheDocument();
      expect(screen.getByTitle('Room Host')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Waiting')).toBeInTheDocument();
    });
  });

  describe('LobbyStatusBanner', () => {
    it('explains waiting on unready players', () => {
      render(<LobbyStatusBanner room={mockRoom} />);
      expect(screen.getByText(/Waiting on players to ready up/i)).toBeInTheDocument();
      expect(screen.getByText(/Bob Guesser/i)).toBeInTheDocument();
    });

    it('shows ready status when all players are ready', () => {
      const allReadyRoom: RoomSnapshot = {
        ...mockRoom,
        players: mockPlayers.map((p) => ({ ...p, isReady: true })),
        isLobbyReadyToStart: true,
      };
      render(<LobbyStatusBanner room={allReadyRoom} />);
      expect(screen.getByText(/Lobby Ready!/i)).toBeInTheDocument();
    });
  });

  describe('RoomSettingsCard', () => {
    it('renders current match configuration rules', () => {
      renderWithProviders(<RoomSettingsCard settings={mockRoom.settings} isHost={true} />);
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 rounds
      expect(screen.getByText('80s')).toBeInTheDocument(); // 80s
      expect(screen.getByRole('button', { name: /edit rules/i })).toBeInTheDocument();
    });
  });

  describe('JoinRoomCard', () => {
    it('renders room code input with uppercase styling', () => {
      renderWithProviders(<JoinRoomCard />);
      const input = screen.getByPlaceholderText(/e\.g\. 7X9K2M/i);
      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { value: 'abc123' } });
      expect((input as HTMLInputElement).value).toBe('ABC123');
    });
  });
});
