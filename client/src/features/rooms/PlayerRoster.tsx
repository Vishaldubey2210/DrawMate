import React from 'react';
import { RoomPlayer, RoomSpectator } from '../../types/index.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import { Crown, CheckCircle2, Clock, WifiOff, UserPlus, Eye } from 'lucide-react';

interface PlayerRosterProps {
  players: RoomPlayer[];
  maxPlayers: number;
  currentUserId?: string;
  spectators?: RoomSpectator[];
  maxSpectators?: number;
}

export const PlayerRoster: React.FC<PlayerRosterProps> = ({
  players,
  maxPlayers,
  currentUserId,
  spectators = [],
  maxSpectators = 10,
}) => {
  const emptySlotsCount = Math.max(0, maxPlayers - players.length);

  return (
    <div className="space-y-6">
      {/* Active Players */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Players in Lobby ({players.length} / {maxPlayers})
          </h4>
          <span className="text-xs text-slate-400">
            {players.filter((p) => p.isReady).length} / {players.length} Ready
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {players.map((player) => {
            const isMe = player.userId === currentUserId;

            return (
              <div
                key={player.userId}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  player.isDisconnected
                    ? 'border-dashed border-rose-300 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 opacity-75'
                    : isMe
                    ? 'border-indigo-500/80 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="relative">
                    <Avatar avatarId={player.avatar} size="md" />
                    {player.isHost && (
                      <div
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-900"
                        title="Room Host"
                      >
                        <Crown className="w-3 h-3 fill-amber-950" />
                      </div>
                    )}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {player.displayName}
                      </p>
                      {isMe && (
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          (You)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">@{player.username}</p>
                  </div>
                </div>

                {/* Status badges */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {player.isDisconnected ? (
                    <Badge variant="danger" size="sm">
                      <WifiOff className="w-3 h-3 mr-1 inline" /> Disconnected
                    </Badge>
                  ) : player.isReady ? (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Ready
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      <Clock className="w-3 h-3 mr-1 inline" /> Waiting
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty placeholder slots */}
          {Array.from({ length: Math.min(emptySlotsCount, 4) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="p-3.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-950/20 flex items-center gap-3 text-slate-400"
            >
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center">
                <UserPlus className="w-4 h-4 opacity-40" />
              </div>
              <span className="text-xs italic opacity-60">Open Player Slot</span>
            </div>
          ))}
        </div>
      </div>

      {/* Observing Spectators Section */}
      {spectators.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-500" />
              <span>Observing Spectators ({spectators.length} / {maxSpectators})</span>
            </h4>
            <span className="text-xs text-slate-400">View-only mode</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {spectators.map((spec) => {
              const isMe = spec.userId === currentUserId;
              return (
                <div
                  key={spec.userId}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                    isMe
                      ? 'border-indigo-400/80 bg-indigo-50/30 dark:bg-indigo-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Avatar avatarId={spec.avatar} size="sm" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {spec.displayName} {isMe && <span className="text-indigo-500 text-[10px]">(You)</span>}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">@{spec.username}</p>
                    </div>
                  </div>
                  <Badge variant="neutral" size="sm">
                    <Eye className="w-3 h-3 mr-1 inline text-indigo-400" /> Watching
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
