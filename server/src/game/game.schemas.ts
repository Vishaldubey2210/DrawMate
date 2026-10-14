import { z } from 'zod';

export const gameStartSchema = z.object({
  roomCode: z.string().min(1).max(16),
});

export const wordSelectSchema = z.object({
  roomCode: z.string().min(1).max(16),
  word: z.string().min(1).max(50),
});

export const guessSchema = z.object({
  roomCode: z.string().min(1).max(16),
  text: z.string().min(1).max(100),
});

export const getGameStateSchema = z.object({
  roomCode: z.string().min(1).max(16),
});

export const imposterVoteSchema = z.object({
  roomCode: z.string().min(1).max(16),
  targetUserId: z.string().min(1),
});
