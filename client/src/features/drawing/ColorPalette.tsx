import React from 'react';
import { PALETTE_COLORS } from './drawing.types.js';
import { Check } from 'lucide-react';

interface ColorPaletteProps {
  selectedColor: string;
  onSelectColor: (hex: string) => void;
  disabled?: boolean;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({
  selectedColor,
  onSelectColor,
  disabled = false,
}) => {
  return (
    <div
      role="radiogroup"
      aria-label="Color Palette"
      className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60"
    >
      {PALETTE_COLORS.map((c) => {
        const isSelected = selectedColor.toLowerCase() === c.hex.toLowerCase();
        const isWhite = c.hex.toLowerCase() === '#ffffff';

        return (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={c.name}
            title={c.name}
            disabled={disabled}
            onClick={() => onSelectColor(c.hex)}
            className={`
              relative w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all duration-150
              flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary-500
              ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-110 active:scale-95 cursor-pointer'}
              ${isWhite ? 'border border-slate-300 dark:border-slate-600' : ''}
              ${isSelected ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md' : 'shadow-sm'}
            `}
            style={{ backgroundColor: c.hex }}
          >
            {isSelected && (
              <Check
                className={`w-4 h-4 stroke-[3] ${
                  isWhite || c.hex === '#eab308' || c.hex === '#06b6d4'
                    ? 'text-slate-900'
                    : 'text-white'
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
