import React from 'react';
import { PlayerScore } from './game.types.js';
import { Button } from '../../components/ui/Button.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import { Trophy, Crown, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';

interface GameOverScreenProps {
  winner?: {
    userId: string;
    displayName: string;
    score: number;
    isTie?: boolean;
  };
  scores: PlayerScore[];
  onReturnToLobby: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  winner,
  scores,
  onReturnToLobby,
}) => {
  const topPlayers = scores.slice(0, 3);

  return (
    <div className="space-y-8 p-6 sm:p-10 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-xl max-w-4xl mx-auto text-center animate-in zoom-in-95 duration-300">
      {/* Top Trophy Banner */}
      <div className="space-y-3">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center border-2 border-amber-500/30 shadow-lg shadow-amber-500/20">
          <Trophy className="w-10 h-10 animate-bounce" />
        </div>

        <div className="space-y-1">
          <Badge variant="warning" className="px-3 py-1 font-bold uppercase tracking-widest text-xs">
            Match Concluded
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
            {winner?.isTie ? 'Epic Tie Game!' : `${winner?.displayName || 'Winner'} Wins!`}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Final standings across all rounds of intense sketching and guessing.
          </p>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-4 max-w-2xl mx-auto">
        {topPlayers.map((player, idx) => {
          const isFirst = idx === 0;
          const isSecond = idx === 1;
          const isThird = idx === 2;

          return (
            <div
              key={player.userId}
              className={`p-6 rounded-3xl border transition-all ${
                isFirst
                  ? 'bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-slate-900 border-amber-400/60 shadow-lg sm:-translate-y-4 order-1 sm:order-2'
                  : isSecond
                  ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 order-2 sm:order-1'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-amber-800/30 order-3'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar name={player.displayName} size={isFirst ? 'lg' : 'md'} />
                  {isFirst && (
                    <div className="absolute -top-3 -right-2 w-7 h-7 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center shadow-md">
                      <Crown className="w-4 h-4 fill-current" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white block truncate max-w-[150px]">
                    {player.displayName}
                  </span>
                  <Badge variant={isFirst ? 'warning' : 'neutral'} size="sm" className="font-mono font-bold">
                    {player.score} pts
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Leaderboard Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl mx-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">Rank</th>
              <th className="py-3 px-4">Player</th>
              <th className="py-3 px-4 text-center">Correct Guesses</th>
              <th className="py-3 px-4 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {scores.map((p, index) => (
              <tr key={p.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-3 px-4 font-mono font-bold text-slate-400">
                  #{index + 1}
                </td>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                  {p.displayName}
                </td>
                <td className="py-3 px-4 text-center text-slate-500 font-mono">
                  {p.correctGuesses}
                </td>
                <td className="py-3 px-4 text-right font-mono font-black text-primary-600 dark:text-primary-400">
                  {p.score} pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 flex justify-center">
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onReturnToLobby}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="rounded-2xl px-6"
        >
          Return to Lobby
        </Button>
      </div>
    </div>
  );
};
