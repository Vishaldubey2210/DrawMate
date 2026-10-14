import React from 'react';
import { Modal } from '../../components/ui/Modal.js';
import { Badge } from '../../components/ui/Badge.js';
import { RoundSummary } from './game.types.js';
import { CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface RoundResultsModalProps {
  isOpen: boolean;
  summary?: RoundSummary;
  countdownSeconds: number;
}

export const RoundResultsModal: React.FC<RoundResultsModalProps> = ({
  isOpen,
  summary,
  countdownSeconds,
}) => {
  if (!isOpen || !summary) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title={`Round ${summary.roundNumber} Results`}
      maxWidth="md"
    >
      <div className="space-y-6 text-center py-3">
        {/* Secret Word Reveal Card */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            The secret word was
          </span>
          <div className="p-4 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 rounded-3xl">
            <span className="font-mono text-2xl sm:text-3xl font-black uppercase text-primary-600 dark:text-primary-400 tracking-wider">
              {summary.secretWord}
            </span>
          </div>
        </div>

        {/* Outcome Description */}
        <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs sm:text-sm">
          {summary.reason === 'guessed' && summary.winnerName ? (
            <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>{summary.winnerName} guessed the word!</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-slate-500 font-medium">
              <Clock className="w-4 h-4" />
              <span>Time expired before anyone guessed the word.</span>
            </div>
          )}

          <div className="pt-2 text-slate-600 dark:text-slate-300">
            Artist: <strong className="text-slate-900 dark:text-white">{summary.drawerName}</strong>
          </div>
        </div>

        {/* Countdown Next Turn */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Next turn starting in {countdownSeconds}s...</span>
        </div>
      </div>
    </Modal>
  );
};
