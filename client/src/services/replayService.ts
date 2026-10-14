import { api } from './api.js';
import { DrawingReplay } from '../types/index.js';

export const replayService = {
  async getRoundReplay(gameId: string, roundNumber: number): Promise<DrawingReplay> {
    const res = await api.get<{ success: boolean; replay: DrawingReplay }>(
      `/replays/${gameId}/${roundNumber}`
    );
    return res.data.replay;
  },

  async getMatchReplays(gameId: string): Promise<
    Array<{
      gameId: string;
      roomCode: string;
      roundNumber: number;
      drawerDisplayName: string;
      secretWord: string;
      category: string;
      language: string;
      durationMs: number;
      createdAt: string;
    }>
  > {
    const res = await api.get<{
      success: boolean;
      replays: Array<{
        gameId: string;
        roomCode: string;
        roundNumber: number;
        drawerDisplayName: string;
        secretWord: string;
        category: string;
        language: string;
        durationMs: number;
        createdAt: string;
      }>;
    }>(`/replays/${gameId}`);
    return res.data.replays;
  },
};
