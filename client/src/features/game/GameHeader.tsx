import React from 'react';
import { SanitizedGameSnapshot } from './game.types.js';
import { WordHintDisplay } from './WordHintDisplay.js';
import { Badge } from '../../components/ui/Badge.js';
import { Clock, Pencil, Sparkles } from 'lucide-react';

interface GameHeaderProps {
  game: SanitizedGameSnapshot;
  isDrawer: boolean;
  countdownSeconds: number;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  game,
  isDrawer,
  countdownSeconds,
}) => {
  const isUrgent = countdownSeconds <= 10 && countdownSeconds > 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-sm">
      {/* Left Column: Round & Drawer Info */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Badge variant="brand" className="font-bold text-xs uppercase tracking-wider">
              Round {game.currentRound} / {game.totalRounds}
            </Badge>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Turn {game.turnIndex}/{game.totalTurnsInRound}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
            {isDrawer ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <Pencil className="w-3.5 h-3.5" /> You are drawing!
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                Artist: <strong className="text-slate-900 dark:text-white">{game.drawerName}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Secret Word, Imposter Clue, or Masked Hints */}
      <div className="flex-1 flex justify-center">
        {game.gameMode === 'imposter' ? (
          (() => {
            const imposter = game.imposterState || (game as any).imposter;
            const isImposter = imposter?.role === 'imposter';

            return (
              <div className="flex flex-col items-center gap-1">
                <Badge
                  variant={isImposter ? 'danger' : 'success'}
                  className="font-black uppercase tracking-wider text-[11px]"
                >
                  {isImposter ? '🎭 You are the Imposter' : '🕵️ You are Innocent'}
                </Badge>
                <div
                  className={`flex items-center gap-2 px-5 py-2 rounded-2xl shadow-sm border ${
                    isImposter
                      ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className="font-mono text-sm sm:text-base font-black tracking-wide">
                    {isImposter
                      ? `Category Clue: ${imposter?.categoryClue || 'Secret'} (Blend In!)`
                      : `Secret Word: ${(game.word.secret || game.word.masked).toUpperCase()}`}
                  </span>
                </div>
              </div>
            );
          })()
        ) : isDrawer && game.word.secret ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Your Secret Word
            </span>
            <div className="flex items-center gap-2 px-5 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-mono text-lg sm:text-2xl font-black uppercase text-emerald-700 dark:text-emerald-300 tracking-wider">
                {game.word.secret}
              </span>
            </div>
          </div>
        ) : game.phase === 'word_selection' ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 italic">
            <span>{isDrawer ? 'Select a word to draw below...' : `${game.drawerName} is choosing a word...`}</span>
          </div>
        ) : (
          <WordHintDisplay
            maskedWord={game.word.masked}
            wordLength={game.word.length}
          />
        )}
      </div>

      {/* Right Column: Authoritative Countdown Timer */}
      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-mono text-sm sm:text-base font-black border transition-all duration-300 ${
            isUrgent
              ? 'bg-rose-500/10 text-rose-600 border-rose-500/40 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
          }`}
          title="Round Deadline"
        >
          <Clock className={`w-4 h-4 ${isUrgent ? 'text-rose-500' : 'text-slate-500'}`} />
          <span>{countdownSeconds}s</span>
        </div>
      </div>
    </div>
  );
};
