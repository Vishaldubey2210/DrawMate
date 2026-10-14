import React from 'react';
import { BRUSH_SIZES, BrushSizeOption } from './drawing.types.js';

interface BrushSizeSelectorProps {
  selectedWidth: number;
  onSelectWidth: (width: number) => void;
  disabled?: boolean;
}

export const BrushSizeSelector: React.FC<BrushSizeSelectorProps> = ({
  selectedWidth,
  onSelectWidth,
  disabled = false,
}) => {
  return (
    <div
      role="radiogroup"
      aria-label="Brush Thickness"
      className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60"
    >
      {BRUSH_SIZES.map((size: BrushSizeOption) => {
        const isSelected = Math.abs(selectedWidth - size.value) < 0.001;

        return (
          <button
            key={size.label}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${size.label} brush thickness`}
            title={`${size.label} thickness`}
            disabled={disabled}
            onClick={() => onSelectWidth(size.value)}
            className={`
              w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-primary-500
              ${
                disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
              }
              ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 shadow-sm text-primary-600 dark:text-primary-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }
            `}
          >
            <div
              className={`rounded-full transition-all duration-150 ${
                isSelected
                  ? 'bg-primary-600 dark:bg-primary-400'
                  : 'bg-slate-500 dark:bg-slate-400'
              }`}
              style={{
                width: `${size.iconSize}px`,
                height: `${size.iconSize}px`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
};
