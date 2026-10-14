import React from 'react';
import { PlayerScore } from './game.types.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import { Trophy, Pencil, CheckCircle2 } from 'lucide-react';

interface GameLeaderboardProps {
  scores: PlayerScore[];
  currentDrawerId: string;
  guessedUserIds?: string[];
}

export const GameLeaderboard: React.FC<GameLeaderboardProps> = ({
  scores,
  currentDrawerId,
  guessedUserIds = [],
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <Trophy className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Leaderboard
        </span>
      </div>

      <div className="space-y-2">
        {scores.map((player, index) => {
          const isDrawer = player.userId === currentDrawerId;
          const hasGuessed = guessedUserIds.includes(player.userId);
          const isTopThree = index < 3;

          return (
            <div
              key={player.userId}
              className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-5 text-center font-mono font-black text-xs ${
                  index === 0 ? 'text-amber-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-700' : 'text-slate-400'
                }`}>
                  #{index + 1}
                </span>

                <Avatar
                  name={player.displayName}
                  size="sm"
                />

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {player.displayName}
                    </span>
                    {isDrawer && (
                      <span title="Currently Drawing">
                        <Pencil className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      </span>
                    )}
                    {hasGuessed && (
                      <span title="Guessed Correctly">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      </span>
                    )}
                  </div>
                  {player.roundScore > 0 && (
                    <span className="text-[10px] text-emerald-600 font-bold">
                      +{player.roundScore} pts this round
                    </span>
                  )}
                </div>
              </div>

              <Badge
                variant={isTopThree ? 'brand' : 'neutral'}
                size="sm"
                className="font-mono text-xs font-bold shrink-0"
              >
                {player.score} pts
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
};
