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

export interface DrawingSession {
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
