import crypto from 'crypto';
import {
  DrawingSession,
  Stroke,
  Point,
  CanvasSnapshot,
  DrawingTool,
} from '../realtime/drawing/drawing.types.js';
import { normalizeRoomCode } from '../utils/roomCode.js';
import { ReplayRecorderService } from './ReplayRecorderService.js';

export class DrawingSessionManager {
  private static instance: DrawingSessionManager;
  private sessions: Map<string, DrawingSession> = new Map(); // Keyed by normalized roomCode

  public readonly MAX_STROKES_PER_SESSION = 1000;
  public readonly MAX_POINTS_PER_STROKE = 5000;

  private constructor() {}

  public static getInstance(): DrawingSessionManager {
    if (!DrawingSessionManager.instance) {
      DrawingSessionManager.instance = new DrawingSessionManager();
    }
    return DrawingSessionManager.instance;
  }

  /**
   * Retrieves an existing session or initializes a new one for a room
   */
  public getOrCreateSession(rawCode: string, defaultDrawerId: string = ''): DrawingSession {
    const roomCode = normalizeRoomCode(rawCode);
    let session = this.sessions.get(roomCode);

    if (!session) {
      session = {
        sessionId: crypto.randomUUID(),
        roomCode,
        drawerId: defaultDrawerId,
        status: 'active',
        revision: 0,
        strokes: [],
        redoStack: [],
        activeStroke: null,
        updatedAt: Date.now(),
      };
      this.sessions.set(roomCode, session);
    } else if (defaultDrawerId && !session.drawerId) {
      session.drawerId = defaultDrawerId;
      session.updatedAt = Date.now();
    }

    return session;
  }

  /**
   * Retrieves active session by room code
   */
  public getSession(rawCode: string): DrawingSession | null {
    const roomCode = normalizeRoomCode(rawCode);
    return this.sessions.get(roomCode) || null;
  }

  /**
   * Retrieves current in-progress active stroke if any
   */
  public getActiveStroke(rawCode: string): Stroke | null {
    const session = this.getSession(rawCode);
    return session?.activeStroke || null;
  }

  /**
   * Sets or transfers the authorized active drawer
   */
  public setDrawer(rawCode: string, drawerId: string): DrawingSession {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.getOrCreateSession(roomCode, drawerId);

    session.drawerId = drawerId;
    session.activeStroke = null;
    session.redoStack = [];
    session.revision += 1;
    session.updatedAt = Date.now();

    return session;
  }

  /**
   * Validates if a user is the authorized active drawer
   */
  public isAuthorizedDrawer(rawCode: string, userId: string): boolean {
    const session = this.getSession(rawCode);
    if (!session || session.status !== 'active') return false;
    return session.drawerId === userId;
  }

  /**
   * Starts a new stroke
   */
  public startStroke(
    rawCode: string,
    userId: string,
    data: {
      strokeId: string;
      tool: DrawingTool;
      color: string;
      width: number;
      point: Point;
    }
  ): { stroke: Stroke; revision: number } {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);

    if (!session || session.status !== 'active') {
      throw new Error('Drawing session is not active for this room.');
    }

    if (session.drawerId !== userId) {
      throw new Error('Unauthorized: Only the current drawer can draw.');
    }

    const stroke: Stroke = {
      strokeId: data.strokeId,
      drawerId: userId,
      tool: data.tool,
      color: data.color,
      width: data.width,
      points: [data.point],
      createdAt: Date.now(),
    };

    session.activeStroke = stroke;
    session.updatedAt = Date.now();

    ReplayRecorderService.getInstance().recordEvent(roomCode, 'stroke_start', stroke);

    return { stroke, revision: session.revision };
  }

  /**
   * Appends intermediate points to the active stroke
   */
  public appendPoints(
    rawCode: string,
    userId: string,
    strokeId: string,
    newPoints: Point[]
  ): { points: Point[]; strokeId: string } {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);

    if (!session || session.status !== 'active') {
      throw new Error('Drawing session is not active for this room.');
    }

    if (session.drawerId !== userId) {
      throw new Error('Unauthorized: Only the current drawer can draw.');
    }

    if (!session.activeStroke || session.activeStroke.strokeId !== strokeId) {
      throw new Error('Invalid stroke update: Active stroke mismatch or stroke already ended.');
    }

    // Append points with bounds checking
    const remainingSlots = this.MAX_POINTS_PER_STROKE - session.activeStroke.points.length;
    if (remainingSlots <= 0) {
      return { points: [], strokeId };
    }

    const pointsToAdd = newPoints.slice(0, remainingSlots);
    session.activeStroke.points.push(...pointsToAdd);
    session.updatedAt = Date.now();

    ReplayRecorderService.getInstance().recordEvent(roomCode, 'stroke_points', {
      strokeId,
      points: pointsToAdd,
    });

    return { points: pointsToAdd, strokeId };
  }

  /**
   * Finalizes and commits the active stroke to the canonical stroke history
   */
  public endStroke(
    rawCode: string,
    userId: string,
    strokeId: string,
    finalPoints?: Point[]
  ): { completedStroke: Stroke; revision: number } {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);

    if (!session || session.status !== 'active') {
      throw new Error('Drawing session is not active for this room.');
    }

    if (session.drawerId !== userId) {
      throw new Error('Unauthorized: Only the current drawer can draw.');
    }

    if (!session.activeStroke || session.activeStroke.strokeId !== strokeId) {
      throw new Error('Invalid stroke completion: Active stroke mismatch or stroke already completed.');
    }

    if (finalPoints && finalPoints.length > 0) {
      const remainingSlots = this.MAX_POINTS_PER_STROKE - session.activeStroke.points.length;
      if (remainingSlots > 0) {
        session.activeStroke.points.push(...finalPoints.slice(0, remainingSlots));
      }
    }

    const completedStroke = session.activeStroke;
    session.activeStroke = null;

    // Maintain bounded stroke history
    if (session.strokes.length >= this.MAX_STROKES_PER_SESSION) {
      session.strokes.shift(); // Remove oldest stroke
    }

    session.strokes.push(completedStroke);
    session.redoStack = []; // Invalidate redo history on new stroke creation
    session.revision += 1;
    session.updatedAt = Date.now();

    ReplayRecorderService.getInstance().recordEvent(roomCode, 'stroke_end', {
      strokeId,
    });

    return { completedStroke, revision: session.revision };
  }

  /**
   * Undoes the last completed stroke from canonical history
   */
  public undo(
    rawCode: string,
    userId: string
  ): { removedStrokeId: string; revision: number } {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);

    if (!session || session.status !== 'active') {
      throw new Error('Drawing session is not active for this room.');
    }

    if (session.drawerId !== userId) {
      throw new Error('Unauthorized: Only the current drawer can undo strokes.');
    }

    // Cancel active stroke if in progress
    if (session.activeStroke) {
      session.activeStroke = null;
    }

    if (session.strokes.length === 0) {
      throw new Error('Nothing to undo: Canvas is empty.');
    }

    const removedStroke = session.strokes.pop()!;
    if (!session.redoStack) session.redoStack = [];
    session.redoStack.push(removedStroke);
    session.revision += 1;
    session.updatedAt = Date.now();

    ReplayRecorderService.getInstance().recordEvent(roomCode, 'stroke_undo', {
      removedStrokeId: removedStroke.strokeId,
    });

    return {
      removedStrokeId: removedStroke.strokeId,
      revision: session.revision,
    };
  }

  /**
   * Redoes the last undone stroke
   */
  public redo(
    rawCode: string,
    userId: string
  ): { restoredStroke: Stroke; revision: number } {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);

    if (!session || session.status !== 'active') {
      throw new Error('Drawing session is not active for this room.');
    }

    if (session.drawerId !== userId) {
      throw new Error('Unauthorized: Only the current drawer can redo strokes.');
    }

    if (!session.redoStack || session.redoStack.length === 0) {
      throw new Error('Nothing to redo.');
    }

    const restoredStroke = session.redoStack.pop()!;
    session.strokes.push(restoredStroke);
    session.revision += 1;
    session.updatedAt = Date.now();

    ReplayRecorderService.getInstance().recordEvent(roomCode, 'stroke_start', {
      strokeId: restoredStroke.strokeId,
      tool: restoredStroke.tool,
      color: restoredStroke.color,
      width: restoredStroke.width,
      point: restoredStroke.points[0] || { x: 0, y: 0 },
    });

    if (restoredStroke.points.length > 1) {
      ReplayRecorderService.getInstance().recordEvent(roomCode, 'stroke_points', {
        strokeId: restoredStroke.strokeId,
        points: restoredStroke.points.slice(1),
      });
    }

    ReplayRecorderService.getInstance().recordEvent(roomCode, 'stroke_end', {
      strokeId: restoredStroke.strokeId,
    });

    return {
      restoredStroke,
      revision: session.revision,
    };
  }

  /**
   * Cancels any incomplete active stroke safely
   */
  public cancelActiveStroke(rawCode: string, drawerId: string): void {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);
    if (!session || session.drawerId !== drawerId) return;
    if (session.activeStroke) {
      session.activeStroke = null;
    }
  }

  /**
   * Clears all strokes on the canvas
   */
  public clear(
    rawCode: string,
    userId: string
  ): { revision: number } {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);

    if (!session || session.status !== 'active') {
      throw new Error('Drawing session is not active for this room.');
    }

    if (session.drawerId !== userId) {
      throw new Error('Unauthorized: Only the current drawer can clear the canvas.');
    }

    session.strokes = [];
    session.redoStack = [];
    session.activeStroke = null;
    session.revision += 1;
    session.updatedAt = Date.now();

    ReplayRecorderService.getInstance().recordEvent(roomCode, 'stroke_clear', {});

    return { revision: session.revision };
  }

  /**
   * Server-internal: Reset canvas strokes for a new drawing turn (bypasses drawer auth).
   * Use only from server-authoritative game logic, never directly from untrusted client requests.
   */
  public resetSession(rawCode: string): void {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);
    if (!session) return;
    session.strokes = [];
    session.redoStack = [];
    session.activeStroke = null;
    session.revision += 1;
    session.updatedAt = Date.now();
  }

  /**
   * Alias for resetSession / server-side clear
   */
  public clearCanvas(rawCode: string, _userId?: string): void {
    this.resetSession(rawCode);
  }

  /**
   * Returns a snapshot of the current drawing session
   */
  public getSnapshot(rawCode: string): CanvasSnapshot | null {
    const roomCode = normalizeRoomCode(rawCode);
    const session = this.sessions.get(roomCode);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      roomCode: session.roomCode,
      drawerId: session.drawerId,
      status: session.status,
      revision: session.revision,
      strokes: [...session.strokes],
      redoStack: session.redoStack ? [...session.redoStack] : [],
      activeStroke: session.activeStroke ? { ...session.activeStroke } : null,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Cleans up drawing session resources when room terminates
   */
  public endSession(rawCode: string): void {
    const roomCode = normalizeRoomCode(rawCode);
    this.sessions.delete(roomCode);
  }
}
