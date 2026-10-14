export type DrawingTool = 'brush' | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  strokeId: string;
  drawerId: string;
  tool: DrawingTool;
  color: string;
  width: number;
  points: Point[];
  createdAt: number;
}

export interface CanvasSnapshot {
  sessionId: string;
  roomCode: string;
  drawerId: string;
  status: 'active' | 'paused' | 'ended';
  revision: number;
  strokes: Stroke[];
  redoStack?: Stroke[];
  activeStroke: Stroke | null;
  updatedAt: number;
}

export interface BrushSizeOption {
  label: string;
  value: number; // Normalized width fraction
  iconSize: number; // Visual pixel diameter for UI preview
}

export const BRUSH_SIZES: BrushSizeOption[] = [
  { label: 'Thin', value: 0.006, iconSize: 4 },
  { label: 'Medium', value: 0.015, iconSize: 10 },
  { label: 'Thick', value: 0.035, iconSize: 18 },
];

export const PALETTE_COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#000000' },
  { name: 'Slate', hex: '#475569' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Brown', hex: '#78350f' },
];
