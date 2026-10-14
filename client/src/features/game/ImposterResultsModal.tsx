import React from 'react';
import { Modal } from '../../components/ui/Modal.js';
import { Badge } from '../../components/ui/Badge.js';
import { SanitizedGameSnapshot } from './game.types.js';
import { ShieldCheck, ShieldAlert, Sparkles, Clock, Users } from 'lucide-react';

interface ImposterResultsModalProps {
  isOpen: boolean;
  game: SanitizedGameSnapshot;
  countdownSeconds: number;
}

export const ImposterResultsModal: React.FC<ImposterResultsModalProps> = ({
  isOpen,
  game,
  countdownSeconds,
}) => {
  const imposter = game.imposterState || (game as any).imposter;
  if (!isOpen || !imposter) return null;

  const wasCaught = imposter.wasImposterCaught;
  const imposterName = imposter.identifiedImposterName || 'Unknown Imposter';
  const voters = imposter.votersForImposter || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="🎭 Imposter Mode Round Results"
      maxWidth="md"
    >
      <div className="space-y-6 text-center py-2">
        {/* Outcome Badge & Banner */}
        <div
          className={`p-6 rounded-3xl border space-y-2 ${
            wasCaught
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50'
          }`}
        >
          {wasCaught ? (
            <>
              <ShieldCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-200">
                The Imposter was CAUGHT!
              </h3>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                The crew successfully identified the secret saboteur.
              </p>
            </>
          ) : (
            <>
              <ShieldAlert className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto" />
              <h3 className="text-lg font-black text-rose-900 dark:text-rose-200">
                The Imposter ESCAPED!
              </h3>
              <p className="text-xs text-rose-700/80 dark:text-rose-400/80">
                The group voted incorrectly, giving victory to the imposter.
              </p>
            </>
          )}
        </div>

        {/* Revealed Secret Imposter */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="text-[11px] uppercase font-bold text-slate-400">The Secret Imposter was:</div>
          <div className="text-base font-black text-slate-900 dark:text-white">
            🎭 {imposterName}
          </div>
          {imposter.categoryClue && (
            <div className="text-xs text-slate-500">
              Category Clue Given: <span className="font-semibold text-slate-700 dark:text-slate-300">{imposter.categoryClue}</span>
            </div>
          )}
          {game.word.secret && (
            <div className="text-xs text-slate-500">
              Actual Secret Word: <span className="font-semibold uppercase text-indigo-600 dark:text-indigo-400">{game.word.secret}</span>
            </div>
          )}
        </div>

        {/* Voters who caught them */}
        {wasCaught && voters.length > 0 && (
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1">
              <Users className="w-3.5 h-3.5" /> Correct Detectives (+Points):
            </span>
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {voters.map((voterId: string) => {
                const p = game.scores.find((s) => s.userId === voterId);
                return (
                  <Badge key={voterId} variant="success" size="sm">
                    {p?.displayName || 'Player'}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Next Round Countdown */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Next round starts in {countdownSeconds}s</span>
        </div>
      </div>
    </Modal>
  );
};
