import { useRef, useEffect, useCallback } from 'react';
import { Point, Stroke, DrawingTool } from './drawing.types.js';
import {
  toNormalizedPoint,
  drawStroke,
  drawIncrementalSegment,
  redrawAllStrokes,
} from './drawing.utils.js';

interface UseDrawingCanvasProps {
  isDrawer: boolean;
  activeTool: DrawingTool;
  activeColor: string;
  activeWidth: number;
  canonicalStrokes: Stroke[];
  remoteActiveStroke: Stroke | null;
  onStrokeStart: (strokeId: string, tool: DrawingTool, color: string, width: number, point: Point) => void;
  onAppendPoints: (strokeId: string, points: Point[]) => void;
  onStrokeEnd: (strokeId: string, finalPoints?: Point[]) => void;
}

export function useDrawingCanvas({
  isDrawer,
  activeTool,
  activeColor,
  activeWidth,
  canonicalStrokes,
  remoteActiveStroke,
  onStrokeStart,
  onAppendPoints,
  onStrokeEnd,
}: UseDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null!);

  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const pointsBatchRef = useRef<Point[]>([]);
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const logicalSizeRef = useRef<{ width: number; height: number }>({ width: 800, height: 600 });

  // Flush batched points over Socket.IO
  const flushBatch = useCallback(() => {
    if (pointsBatchRef.current.length > 0 && currentStrokeIdRef.current) {
      const batch = [...pointsBatchRef.current];
      pointsBatchRef.current = [];
      onAppendPoints(currentStrokeIdRef.current, batch);
    }
  }, [onAppendPoints]);

  // Redraw canvas whenever canonical strokes or remote active stroke changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = logicalSizeRef.current;
    redrawAllStrokes(ctx, canonicalStrokes, remoteActiveStroke, width, height);
  }, [canonicalStrokes, remoteActiveStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Handle high-DPI scaling and ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) continue;

        logicalSizeRef.current = { width, height };

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
          ctx.scale(dpr, dpr);
        }

        redraw();
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [redraw]);

  // Setup periodic batch flush (approx 20ms = 50 updates/sec max)
  useEffect(() => {
    batchIntervalRef.current = setInterval(() => {
      flushBatch();
    }, 20);

    return () => {
      if (batchIntervalRef.current) {
        clearInterval(batchIntervalRef.current);
      }
    };
  }, [flushBatch]);

  // If drawer status is revoked while drawing is in progress (e.g. turn or round ended),
  // finalize in-flight stroke immediately and clear active refs
  useEffect(() => {
    if (!isDrawer && isDrawingRef.current && currentStrokeIdRef.current) {
      const remainingBatch = [...pointsBatchRef.current];
      pointsBatchRef.current = [];
      const strokeId = currentStrokeIdRef.current;
      isDrawingRef.current = false;
      currentStrokeIdRef.current = null;
      lastPointRef.current = null;
      onStrokeEnd(strokeId, remainingBatch.length > 0 ? remainingBatch : undefined);
    }
  }, [isDrawer, onStrokeEnd]);

  // Cleanup on unmount: ensure in-flight stroke is cleanly ended
  useEffect(() => {
    return () => {
      if (isDrawingRef.current && currentStrokeIdRef.current) {
        const remainingBatch = [...pointsBatchRef.current];
        pointsBatchRef.current = [];
        const strokeId = currentStrokeIdRef.current;
        isDrawingRef.current = false;
        currentStrokeIdRef.current = null;
        lastPointRef.current = null;
        onStrokeEnd(strokeId, remainingBatch.length > 0 ? remainingBatch : undefined);
      }
    };
  }, [onStrokeEnd]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point = toNormalizedPoint(e.clientX, e.clientY, rect);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture may not be supported in some environments
    }

    const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    isDrawingRef.current = true;
    currentStrokeIdRef.current = strokeId;
    lastPointRef.current = point;
    pointsBatchRef.current = [];

    // Notify server of new stroke
    onStrokeStart(strokeId, activeTool, activeColor, activeWidth, point);

    // Render initial dot locally with 0ms latency
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const { width, height } = logicalSizeRef.current;
      drawStroke(
        ctx,
        {
          strokeId,
          drawerId: 'local',
          tool: activeTool,
          color: activeColor,
          width: activeWidth,
          points: [point],
          createdAt: Date.now(),
        },
        width,
        height
      );
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current || !currentStrokeIdRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point = toNormalizedPoint(e.clientX, e.clientY, rect);
    const lastPoint = lastPointRef.current;

    // Discard identical or micro-jitter points
    if (lastPoint && Math.abs(point.x - lastPoint.x) < 0.0005 && Math.abs(point.y - lastPoint.y) < 0.0005) {
      return;
    }

    // Render smooth segment locally immediately
    const ctx = canvas.getContext('2d');
    if (ctx && lastPoint) {
      const { width, height } = logicalSizeRef.current;
      drawIncrementalSegment(
        ctx,
        lastPoint,
        point,
        activeTool,
        activeColor,
        activeWidth,
        width,
        height
      );
    }

    lastPointRef.current = point;
    pointsBatchRef.current.push(point);

    // Eagerly flush if batch size exceeds 12 points
    if (pointsBatchRef.current.length >= 12) {
      flushBatch();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeIdRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    // Flush any remaining batched points
    const remainingBatch = [...pointsBatchRef.current];
    pointsBatchRef.current = [];

    const strokeId = currentStrokeIdRef.current;
    isDrawingRef.current = false;
    currentStrokeIdRef.current = null;
    lastPointRef.current = null;

    onStrokeEnd(strokeId, remainingBatch.length > 0 ? remainingBatch : undefined);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    handlePointerUp(e);
  };

  return {
    canvasRef,
    containerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    redraw,
  };
}
