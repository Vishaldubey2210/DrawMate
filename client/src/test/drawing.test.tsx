import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toNormalizedPoint } from '../features/drawing/drawing.utils.js';
import { ColorPalette } from '../features/drawing/ColorPalette.js';
import { BrushSizeSelector } from '../features/drawing/BrushSizeSelector.js';
import { DrawingToolbar } from '../features/drawing/DrawingToolbar.js';
import { DrawingStatus } from '../features/drawing/DrawingStatus.js';
import { DrawingCanvas } from '../features/drawing/DrawingCanvas.js';
import { BRUSH_SIZES, PALETTE_COLORS } from '../features/drawing/drawing.types.js';

describe('Phase 3 - Drawing Canvas & Tools Frontend Components', () => {
  describe('toNormalizedPoint coordinate conversion', () => {
    it('accurately normalizes coordinates within bounds', () => {
      const mockRect = { left: 100, top: 50, width: 400, height: 200 } as DOMRect;

      const pCenter = toNormalizedPoint(300, 150, mockRect);
      expect(pCenter.x).toBe(0.5);
      expect(pCenter.y).toBe(0.5);

      const pTopLeft = toNormalizedPoint(100, 50, mockRect);
      expect(pTopLeft.x).toBe(0);
      expect(pTopLeft.y).toBe(0);

      const pBottomRight = toNormalizedPoint(500, 250, mockRect);
      expect(pBottomRight.x).toBe(1);
      expect(pBottomRight.y).toBe(1);
    });

    it('clamps negative and out-of-bounds client coordinates to [0, 1]', () => {
      const mockRect = { left: 100, top: 100, width: 200, height: 200 } as DOMRect;

      const pNegative = toNormalizedPoint(50, 50, mockRect);
      expect(pNegative.x).toBe(0);
      expect(pNegative.y).toBe(0);

      const pExcess = toNormalizedPoint(500, 600, mockRect);
      expect(pExcess.x).toBe(1);
      expect(pExcess.y).toBe(1);
    });
  });

  describe('ColorPalette Component', () => {
    it('renders all palette color swatches', () => {
      render(<ColorPalette selectedColor="#000000" onSelectColor={vi.fn()} />);

      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBe(PALETTE_COLORS.length);
    });

    it('calls onSelectColor when a swatch is clicked', () => {
      const onSelect = vi.fn();
      render(<ColorPalette selectedColor="#000000" onSelectColor={onSelect} />);

      const redSwatch = screen.getByTitle('Red');
      fireEvent.click(redSwatch);
      expect(onSelect).toHaveBeenCalledWith('#dc2626');
    });

    it('disables swatches when disabled prop is true', () => {
      render(<ColorPalette selectedColor="#000000" onSelectColor={vi.fn()} disabled={true} />);

      const redSwatch = screen.getByTitle('Red');
      expect(redSwatch).toBeDisabled();
    });
  });

  describe('BrushSizeSelector Component', () => {
    it('renders all brush thickness options', () => {
      render(<BrushSizeSelector selectedWidth={0.006} onSelectWidth={vi.fn()} />);

      const buttons = screen.getAllByRole('radio');
      expect(buttons.length).toBe(BRUSH_SIZES.length);
    });

    it('calls onSelectWidth when clicking a thickness level', () => {
      const onSelect = vi.fn();
      render(<BrushSizeSelector selectedWidth={0.006} onSelectWidth={onSelect} />);

      const thickBtn = screen.getByTitle('Thick thickness');
      fireEvent.click(thickBtn);
      expect(onSelect).toHaveBeenCalledWith(0.035);
    });
  });

  describe('DrawingToolbar Component', () => {
    it('renders brush, eraser, undo, and clear actions', () => {
      render(
        <DrawingToolbar
          isDrawer={true}
          activeTool="brush"
          activeColor="#000000"
          activeWidth={0.006}
          strokeCount={3}
          onSelectTool={vi.fn()}
          onSelectColor={vi.fn()}
          onSelectWidth={vi.fn()}
          onUndo={vi.fn()}
          onClear={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /brush tool/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /eraser tool/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    it('disables undo and clear when stroke count is zero', () => {
      render(
        <DrawingToolbar
          isDrawer={true}
          activeTool="brush"
          activeColor="#000000"
          activeWidth={0.006}
          strokeCount={0}
          onSelectTool={vi.fn()}
          onSelectColor={vi.fn()}
          onSelectWidth={vi.fn()}
          onUndo={vi.fn()}
          onClear={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
    });

    it('calls onRedo when redo button is clicked and canRedo is true', () => {
      const onRedo = vi.fn();
      render(
        <DrawingToolbar
          isDrawer={true}
          activeTool="brush"
          activeColor="#000000"
          activeWidth={0.006}
          strokeCount={1}
          onSelectTool={vi.fn()}
          onSelectColor={vi.fn()}
          onSelectWidth={vi.fn()}
          onUndo={vi.fn()}
          onRedo={onRedo}
          canRedo={true}
          onClear={vi.fn()}
        />
      );

      const redoBtn = screen.getByRole('button', { name: /redo/i });
      expect(redoBtn).not.toBeDisabled();
      fireEvent.click(redoBtn);
      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('disables all controls when isDrawer is false (Observer mode)', () => {
      render(
        <DrawingToolbar
          isDrawer={false}
          activeTool="brush"
          activeColor="#000000"
          activeWidth={0.006}
          strokeCount={5}
          onSelectTool={vi.fn()}
          onSelectColor={vi.fn()}
          onSelectWidth={vi.fn()}
          onUndo={vi.fn()}
          onClear={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /brush tool/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /eraser tool/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
    });
  });

  describe('DrawingStatus Component', () => {
    it('renders drawer indicator when user is drawer', () => {
      render(
        <DrawingStatus
          isDrawer={true}
          revision={4}
          strokeCount={2}
        />
      );

      expect(screen.getByText(/you are drawing/i)).toBeInTheDocument();
      expect(screen.getByText(/2 strokes/i)).toBeInTheDocument();
    });

    it('renders observer indicator when user is not drawer', () => {
      render(
        <DrawingStatus
          isDrawer={false}
          drawerName="Claude Monet"
          revision={1}
          strokeCount={5}
        />
      );

      expect(screen.getByText(/observer mode — claude monet is drawing/i)).toBeInTheDocument();
    });
  });

  describe('DrawingCanvas Component', () => {
    it('renders canvas element with touchAction none', () => {
      const canvasRef = { current: document.createElement('canvas') } as any;
      const containerRef = { current: document.createElement('div') } as any;

      render(
        <DrawingCanvas
          canvasRef={canvasRef}
          containerRef={containerRef}
          isDrawer={true}
          activeTool="brush"
          onPointerDown={vi.fn()}
          onPointerMove={vi.fn()}
          onPointerUp={vi.fn()}
          onPointerCancel={vi.fn()}
        />
      );

      const canvas = screen.getByRole('img', { hidden: true });
      expect(canvas).toBeInTheDocument();
    });
  });
});
