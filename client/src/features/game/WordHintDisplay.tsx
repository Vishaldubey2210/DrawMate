import React from 'react';
import { Badge } from '../../components/ui/Badge.js';

interface WordHintDisplayProps {
  maskedWord: string;
  wordLength: number;
  category?: string;
}

export const WordHintDisplay: React.FC<WordHintDisplayProps> = ({
  maskedWord,
  wordLength,
  category = 'General',
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-xl sm:text-2xl md:text-3xl font-black tracking-[0.25em] text-slate-900 dark:text-white select-none"
          title="Secret Word Blanks"
        >
          {maskedWord || '_ '.repeat(wordLength).trim()}
        </span>
        <Badge variant="neutral" size="sm" className="font-mono text-xs">
          {wordLength} letters
        </Badge>
      </div>

      <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">
        Category: {category}
      </span>
    </div>
  );
};
