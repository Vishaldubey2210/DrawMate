import React from 'react';
import { RoomSnapshot } from '../../types/index.js';
import { Users, CheckCircle2, Clock } from 'lucide-react';

export const LobbyStatusBanner: React.FC<{ room: RoomSnapshot }> = ({ room }) => {
  const connectedPlayers = room.players.filter((p) => !p.isDisconnected);
  const unreadyPlayers = connectedPlayers.filter((p) => !p.isReady);

  if (connectedPlayers.length < 2) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs">
        <Users className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <p className="font-bold">Waiting for players to join</p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
            A minimum of 2 connected players is required before the match can begin. Share your room code!
          </p>
        </div>
      </div>
    );
  }

  if (unreadyPlayers.length > 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-indigo-800 dark:text-indigo-200 text-xs">
        <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <div>
          <p className="font-bold">Waiting on players to ready up</p>
          <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
            {unreadyPlayers.length} player{unreadyPlayers.length > 1 ? 's are' : ' is'} not ready ({unreadyPlayers.map((p) => p.displayName).join(', ')}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs">
      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <div>
        <p className="font-bold">Lobby Ready!</p>
        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
          All participants are locked in. The host can initiate the match.
        </p>
      </div>
    </div>
  );
};
