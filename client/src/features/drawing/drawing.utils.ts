import { Point, Stroke, DrawingTool } from './drawing.types.js';

/**
 * Converts mouse/touch client coordinates into normalized [0, 1] canvas coordinates
 */
export function toNormalizedPoint(clientX: number, clientY: number, rect: DOMRect): Point {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  const rawX = (clientX - rect.left) / rect.width;
  const rawY = (clientY - rect.top) / rect.height;

  // Clamp within bounds and round to 4 decimal places for precision without bloat
  const clampedX = Math.max(0, Math.min(1, rawX));
  const clampedY = Math.max(0, Math.min(1, rawY));

  return {
    x: Math.round(clampedX * 10000) / 10000,
    y: Math.round(clampedY * 10000) / 10000,
  };
}

/**
 * Renders a full stroke onto the canvas context with high-fidelity curves and composite operations
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!stroke.points || stroke.points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pixelWidth = Math.max(1, stroke.width * canvasWidth);
  ctx.lineWidth = pixelWidth;

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
  }

  const pts = stroke.points;

  if (pts.length === 1) {
    // Single tap/click renders a circular dot
    ctx.beginPath();
    ctx.arc(pts[0].x * canvasWidth, pts[0].y * canvasHeight, pixelWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0].x * canvasWidth, pts[0].y * canvasHeight);

    if (pts.length === 2) {
      ctx.lineTo(pts[1].x * canvasWidth, pts[1].y * canvasHeight);
    } else {
      // Smooth path with quadratic midpoint interpolation
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = ((pts[i].x + pts[i + 1].x) / 2) * canvasWidth;
        const yc = ((pts[i].y + pts[i + 1].y) / 2) * canvasHeight;
        ctx.quadraticCurveTo(pts[i].x * canvasWidth, pts[i].y * canvasHeight, xc, yc);
      }
      const last = pts[pts.length - 1];
      ctx.lineTo(last.x * canvasWidth, last.y * canvasHeight);
    }

    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders an incremental segment between two points with zero latency
 */
export function drawIncrementalSegment(
  ctx: CanvasRenderingContext2D,
  fromPoint: Point,
  toPoint: Point,
  tool: DrawingTool,
  color: string,
  normalizedWidth: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pixelWidth = Math.max(1, normalizedWidth * canvasWidth);
  ctx.lineWidth = pixelWidth;

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
  }

  ctx.beginPath();
  ctx.moveTo(fromPoint.x * canvasWidth, fromPoint.y * canvasHeight);
  ctx.lineTo(toPoint.x * canvasWidth, toPoint.y * canvasHeight);
  ctx.stroke();

  ctx.restore();
}

/**
 * Clears canvas and replays all canonical strokes and any active stroke
 */
export function redrawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  activeStroke: Stroke | null,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (const stroke of strokes) {
    drawStroke(ctx, stroke, canvasWidth, canvasHeight);
  }

  if (activeStroke) {
    drawStroke(ctx, activeStroke, canvasWidth, canvasHeight);
  }
}
