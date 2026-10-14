import React, { useState } from 'react';
import { DrawingTool } from './drawing.types.js';
import { ColorPalette } from './ColorPalette.js';
import { BrushSizeSelector } from './BrushSizeSelector.js';
import { Button } from '../../components/ui/Button.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
import { Paintbrush, Eraser, Undo2, Redo2, Trash2 } from 'lucide-react';

interface DrawingToolbarProps {
  isDrawer: boolean;
  activeTool: DrawingTool;
  activeColor: string;
  activeWidth: number;
  strokeCount: number;
  onSelectTool: (tool: DrawingTool) => void;
  onSelectColor: (color: string) => void;
  onSelectWidth: (width: number) => void;
  onUndo: () => void;
  onRedo?: () => void;
  canRedo?: boolean;
  onClear: () => void;
}

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  isDrawer,
  activeTool,
  activeColor,
  activeWidth,
  strokeCount,
  onSelectTool,
  onSelectColor,
  onSelectWidth,
  onUndo,
  onRedo,
  canRedo = false,
  onClear,
}) => {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const handleConfirmClear = () => {
    onClear();
    setIsClearConfirmOpen(false);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 sm:p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-sm">
        {/* Tool Mode Toggles */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 shrink-0">
          <button
            type="button"
            aria-label="Brush tool"
            title="Brush Tool"
            disabled={!isDrawer}
            onClick={() => onSelectTool('brush')}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 min-h-[40px]
              ${
                !isDrawer
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
              }
              ${
                activeTool === 'brush'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300'
              }
            `}
          >
            <Paintbrush className="w-4 h-4" />
            <span>Brush</span>
          </button>

          <button
            type="button"
            aria-label="Eraser tool"
            title="Eraser Tool"
            disabled={!isDrawer}
            onClick={() => onSelectTool('eraser')}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 min-h-[40px]
              ${
                !isDrawer
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
              }
              ${
                activeTool === 'eraser'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-slate-300'
              }
            `}
          >
            <Eraser className="w-4 h-4" />
            <span>Eraser</span>
          </button>
        </div>

        {/* Color Palette */}
        <div className="overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-thin">
          <ColorPalette
            selectedColor={activeColor}
            onSelectColor={onSelectColor}
            disabled={!isDrawer || activeTool === 'eraser'}
          />
        </div>

        {/* Brush Thickness & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <BrushSizeSelector
            selectedWidth={activeWidth}
            onSelectWidth={onSelectWidth}
            disabled={!isDrawer}
          />

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          {/* Undo Action */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!isDrawer || strokeCount === 0}
            onClick={onUndo}
            title="Undo last stroke"
            aria-label="Undo last stroke"
            className="flex items-center gap-1.5 rounded-2xl min-h-[40px]"
          >
            <Undo2 className="w-4 h-4" />
            <span className="hidden sm:inline">Undo</span>
            {strokeCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 font-mono">
                {strokeCount}
              </span>
            )}
          </Button>

          {/* Redo Action */}
          {onRedo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!isDrawer || !canRedo}
              onClick={onRedo}
              title="Redo stroke"
              aria-label="Redo stroke"
              className="flex items-center gap-1.5 rounded-2xl min-h-[40px]"
            >
              <Redo2 className="w-4 h-4" />
              <span className="hidden sm:inline">Redo</span>
            </Button>
          )}

          {/* Clear Canvas Action */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!isDrawer || strokeCount === 0}
            onClick={() => setIsClearConfirmOpen(true)}
            title="Clear entire canvas"
            aria-label="Clear canvas"
            className="flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-2xl"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={handleConfirmClear}
        title="Clear Drawing Canvas?"
        message="This will immediately remove all completed strokes on the shared canvas for all players. Are you sure you want to proceed?"
        confirmText="Clear Canvas"
        isDestructive={true}
      />
    </>
  );
};
