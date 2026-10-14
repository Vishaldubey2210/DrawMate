import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../../services/socket.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Stroke,
  Point,
  DrawingTool,
  CanvasSnapshot,
} from './drawing.types.js';

interface UseDrawingSessionProps {
  roomCode: string;
  currentUserId: string;
  authoritativeDrawerId?: string;
}

export function useDrawingSession({
  roomCode,
  currentUserId,
  authoritativeDrawerId,
}: UseDrawingSessionProps) {
  const socket = getSocket();
  const toast = useToast();

  const [drawerId, setDrawerId] = useState<string>(authoritativeDrawerId || '');
  const [revision, setRevision] = useState<number>(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [remoteActiveStroke, setRemoteActiveStroke] = useState<Stroke | null>(null);
  const [redoCount, setRedoCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;

  // Sync with authoritative drawer id from game session
  useEffect(() => {
    if (authoritativeDrawerId) {
      setDrawerId(authoritativeDrawerId);
    }
  }, [authoritativeDrawerId]);

  const effectiveDrawerId = authoritativeDrawerId || drawerId;
  const isDrawer = Boolean(effectiveDrawerId && effectiveDrawerId === currentUserId);

  /**
   * Request full authoritative snapshot from server
   */
  const requestSnapshot = useCallback(() => {
    if (!roomCode) return;
    socket.emit('draw:get_state', { roomCode }, (res: any) => {
      setIsLoading(false);
      if (res?.success && res.state) {
        const state: CanvasSnapshot = res.state;
        setDrawerId(state.drawerId);
        setRevision(state.revision);
        setStrokes(state.strokes);
        setRemoteActiveStroke(state.activeStroke);
        setRedoCount(state.redoStack ? state.redoStack.length : 0);
      }
    });
  }, [socket, roomCode]);

  /**
   * Listen to server drawing events
   */
  useEffect(() => {
    if (!roomCode) return;

    requestSnapshot();

    const handleState = (state: CanvasSnapshot) => {
      setIsLoading(false);
      setDrawerId(state.drawerId);
      setRevision(state.revision);
      setStrokes(state.strokes);
      setRemoteActiveStroke(state.activeStroke);
      setRedoCount(state.redoStack ? state.redoStack.length : 0);
    };

    const handleStrokeStarted = (data: { stroke: Stroke; revision: number }) => {
      setRemoteActiveStroke(data.stroke);
      setRevision(data.revision);
      setRedoCount(0);
    };

    const handleStrokeUpdate = (data: { strokeId: string; points: Point[] }) => {
      setRemoteActiveStroke((prev) => {
        if (!prev || prev.strokeId !== data.strokeId) {
          return {
            strokeId: data.strokeId,
            drawerId: effectiveDrawerId || '',
            tool: 'brush',
            color: '#000000',
            width: 0.006,
            points: data.points,
            createdAt: Date.now(),
          };
        }
        return {
          ...prev,
          points: [...prev.points, ...data.points],
        };
      });
    };

    const handleStrokeCompleted = (data: { completedStroke: Stroke; revision: number }) => {
      setStrokes((prev) => [...prev, data.completedStroke]);
      setRemoteActiveStroke(null);
      setRevision(data.revision);
      setRedoCount(0);
    };

    const handleUndoApplied = (data: { removedStrokeId: string; revision: number }) => {
      setStrokes((prev) => prev.filter((s) => s.strokeId !== data.removedStrokeId));
      setRemoteActiveStroke(null);
      setRevision(data.revision);
      setRedoCount((prev) => prev + 1);
    };

    const handleRedoApplied = (data: { restoredStroke: Stroke; revision: number }) => {
      setStrokes((prev) => [...prev, data.restoredStroke]);
      setRemoteActiveStroke(null);
      setRevision(data.revision);
      setRedoCount((prev) => Math.max(0, prev - 1));
    };

    const handleCanvasCleared = (data: { revision: number }) => {
      setStrokes([]);
      setRemoteActiveStroke(null);
      setRevision(data.revision);
      setRedoCount(0);
    };

    const handleError = (data: { error: string }) => {
      if (data?.error) {
        toast.error(data.error);
      }
    };

    socket.on('draw:state', handleState);
    socket.on('draw:stroke_started', handleStrokeStarted);
    socket.on('draw:stroke_update', handleStrokeUpdate);
    socket.on('draw:stroke_completed', handleStrokeCompleted);
    socket.on('draw:undo_applied', handleUndoApplied);
    socket.on('draw:redo_applied', handleRedoApplied);
    socket.on('draw:canvas_cleared', handleCanvasCleared);
    socket.on('draw:error', handleError);

    return () => {
      socket.off('draw:state', handleState);
      socket.off('draw:stroke_started', handleStrokeStarted);
      socket.off('draw:stroke_update', handleStrokeUpdate);
      socket.off('draw:stroke_completed', handleStrokeCompleted);
      socket.off('draw:undo_applied', handleUndoApplied);
      socket.off('draw:redo_applied', handleRedoApplied);
      socket.off('draw:canvas_cleared', handleCanvasCleared);
      socket.off('draw:error', handleError);
    };
  }, [socket, roomCode, requestSnapshot, toast]);

  /**
   * Drawer starts a new stroke
   */
  const startStroke = useCallback(
    (strokeId: string, tool: DrawingTool, color: string, width: number, point: Point) => {
      if (!isDrawer) return;

      socket.emit('draw:stroke_start', {
        roomCode,
        strokeId,
        tool,
        color,
        width,
        point,
      });
    },
    [socket, roomCode, isDrawer]
  );

  /**
   * Drawer appends batched points
   */
  const appendPoints = useCallback(
    (strokeId: string, points: Point[]) => {
      if (!isDrawer || points.length === 0) return;

      socket.emit('draw:stroke_points', {
        roomCode,
        strokeId,
        points,
      });
    },
    [socket, roomCode, isDrawer]
  );

  /**
   * Drawer completes the stroke
   */
  const endStroke = useCallback(
    (strokeId: string, finalPoints?: Point[]) => {
      if (!isDrawer) return;

      socket.emit('draw:stroke_end', {
        roomCode,
        strokeId,
        points: finalPoints,
      });
    },
    [socket, roomCode, isDrawer]
  );

  /**
   * Drawer triggers Undo
   */
  const undo = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isDrawer) {
        toast.error('Only the active drawer can undo strokes.');
        return reject(new Error('Unauthorized'));
      }

      socket.emit('draw:undo', { roomCode }, (res: any) => {
        if (res?.success) {
          resolve();
        } else {
          const errMsg = res?.error || 'Failed to undo stroke.';
          toast.error(errMsg);
          reject(new Error(errMsg));
        }
      });
    });
  }, [socket, roomCode, isDrawer, toast]);

  /**
   * Drawer triggers Redo
   */
  const redo = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isDrawer) {
        toast.error('Only the active drawer can redo strokes.');
        return reject(new Error('Unauthorized'));
      }

      socket.emit('draw:redo', { roomCode }, (res: any) => {
        if (res?.success) {
          resolve();
        } else {
          const errMsg = res?.error || 'Failed to redo stroke.';
          toast.error(errMsg);
          reject(new Error(errMsg));
        }
      });
    });
  }, [socket, roomCode, isDrawer, toast]);

  /**
   * Drawer triggers Clear Canvas
   */
  const clear = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!isDrawer) {
        toast.error('Only the active drawer can clear the canvas.');
        return reject(new Error('Unauthorized'));
      }

      socket.emit('draw:clear', { roomCode }, (res: any) => {
        if (res?.success) {
          resolve();
        } else {
          const errMsg = res?.error || 'Failed to clear canvas.';
          toast.error(errMsg);
          reject(new Error(errMsg));
        }
      });
    });
  }, [socket, roomCode, isDrawer, toast]);

  /**
   * Development-only harness method to switch/assign active drawer
   */
  const setDrawerHarness = useCallback(
    (targetUserId: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        socket.emit(
          'draw:session_init',
          { roomCode, drawerId: targetUserId },
          (res: any) => {
            if (res?.success) {
              toast.success('Active drawer updated for drawing session.');
              resolve();
            } else {
              const errMsg = res?.error || 'Failed to set drawer.';
              toast.error(errMsg);
              reject(new Error(errMsg));
            }
          }
        );
      });
    },
    [socket, roomCode, toast]
  );

  return {
    drawerId,
    isDrawer,
    revision,
    strokes,
    remoteActiveStroke,
    redoCount,
    canRedo: redoCount > 0,
    isLoading,
    startStroke,
    appendPoints,
    endStroke,
    undo,
    redo,
    clear,
    setDrawerHarness,
    requestSnapshot,
  };
}
