import { z } from 'zod';

export const pointSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});

export const toolSchema = z.enum(['brush', 'eraser']);

export const colorSchema = z.string().regex(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/, {
  message: 'Color must be a valid hex string (e.g. #000000 or #FFF)',
});

export const widthSchema = z.number().finite().min(0.001).max(0.1);

export const strokeStartSchema = z.object({
  roomCode: z.string().min(1).max(16),
  strokeId: z.string().min(1).max(64),
  tool: toolSchema,
  color: colorSchema,
  width: widthSchema,
  point: pointSchema,
});

export const strokePointsSchema = z.object({
  roomCode: z.string().min(1).max(16),
  strokeId: z.string().min(1).max(64),
  points: z.array(pointSchema).min(1).max(200),
});

export const strokeEndSchema = z.object({
  roomCode: z.string().min(1).max(16),
  strokeId: z.string().min(1).max(64),
  points: z.array(pointSchema).max(200).optional(),
});

export const undoSchema = z.object({
  roomCode: z.string().min(1).max(16),
});

export const clearSchema = z.object({
  roomCode: z.string().min(1).max(16),
});

export const getStateSchema = z.object({
  roomCode: z.string().min(1).max(16),
});

export const sessionInitSchema = z.object({
  roomCode: z.string().min(1).max(16),
  drawerId: z.string().min(1).max(64).optional(),
});
