import React from 'react';
import { DrawingTool } from './drawing.types.js';

interface DrawingCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  isDrawer: boolean;
  activeTool: DrawingTool;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  canvasRef,
  containerRef,
  isDrawer,
  activeTool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) => {
  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] max-h-[640px] bg-white rounded-3xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-xl select-none"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        role="img"
        aria-label="Drawing Canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className={`w-full h-full block ${
          !isDrawer
            ? 'cursor-not-allowed'
            : activeTool === 'eraser'
            ? 'cursor-cell'
            : 'cursor-crosshair'
        }`}
        style={{
          touchAction: 'none',
        }}
      />

      {!isDrawer && (
        <div className="absolute top-3 right-3 pointer-events-none opacity-60">
          <span className="text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 bg-slate-900/10 dark:bg-slate-900/40 backdrop-blur-md rounded-full text-slate-700 dark:text-slate-300">
            Observer Surface
          </span>
        </div>
      )}
    </div>
  );
};
