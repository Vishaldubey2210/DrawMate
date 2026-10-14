import { z } from 'zod';

export const roomSettingsSchema = z.object({
  maxPlayers: z.number().int().min(2, 'Max players must be at least 2').max(20, 'Max players cannot exceed 20').default(8),
  rounds: z.number().int().min(2, 'Rounds must be at least 2').max(10, 'Rounds cannot exceed 10').default(3),
  drawTimeSeconds: z.number().int().min(15, 'Draw time must be at least 15s').max(240, 'Draw time cannot exceed 240s').default(80),
  wordCount: z.number().int().min(1, 'Word choices must be at least 1').max(5, 'Word choices cannot exceed 5').default(3),
  hints: z.number().int().min(0, 'Hints cannot be negative').max(5, 'Hints cannot exceed 5').default(2),
  wordMode: z.enum(['normal', 'hidden', 'combination']).default('normal'),
  category: z.string().min(2).max(30).default('general'),
  spectatorsAllowed: z.boolean().default(true),
  maxSpectators: z.number().int().min(0).max(50).default(10),
  allowLateSpectators: z.boolean().default(true),
  gameMode: z.enum(['classic', 'imposter']).default('classic'),
  wordLanguage: z.enum(['en', 'hi', 'es']).default('en'),
  wordSource: z.enum(['builtin', 'custom', 'both']).default('builtin'),
  customWordPackId: z.string().nullable().optional(),
});

export const createRoomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters').max(50, 'Room name cannot exceed 50 characters').trim().default('Art Battle Room'),
  visibility: z.enum(['public', 'private']).default('private'),
  settings: roomSettingsSchema.default({}),
});

export const updateRoomSettingsSchema = roomSettingsSchema.partial();

export const joinRoomSchema = z.object({
  roomCode: z.string().min(4, 'Room code is required').max(10).trim(),
});

export type RoomSettingsInput = z.infer<typeof roomSettingsSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
