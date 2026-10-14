import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { SanitizedGameSnapshot, PlayerScore } from './game.types.js';
import { getSocket } from '../../services/socket.js';
import { ShieldAlert, Vote, CheckCircle2, Clock } from 'lucide-react';

interface ImposterVotingModalProps {
  isOpen: boolean;
  game: SanitizedGameSnapshot;
  currentUserId: string;
  countdownSeconds: number;
  roomCode: string;
}

export const ImposterVotingModal: React.FC<ImposterVotingModalProps> = ({
  isOpen,
  game,
  currentUserId,
  countdownSeconds,
  roomCode,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const imposter = game.imposterState || (game as any).imposter;
  const hasVoted = imposter?.hasVoted;
  const votedForId = imposter?.votedForUserId;

  if (!isOpen) return null;

  const handleVote = (targetUserId: string) => {
    if (hasVoted || submitting) return;
    setSubmitting(true);
    const socket = getSocket();
    socket.emit('imposter:vote', { roomCode, targetUserId }, () => {
      setSubmitting(false);
    });
  };

  const eligibleTargets = game.scores.filter((p: PlayerScore) => p.userId !== currentUserId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="🕵️ Vote for the Secret Imposter!"
      description="Who was drawing without knowing the secret word? Cast your vote before time expires."
      maxWidth="md"
    >
      <div className="space-y-5 py-2">
        {/* Timer Banner */}
        <div className="flex items-center justify-between p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl text-amber-800 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Discussion & Voting Phase</span>
          </div>
          <div className="flex items-center gap-1 font-mono font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{countdownSeconds}s</span>
          </div>
        </div>

        {hasVoted ? (
          <div className="p-6 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Your Vote Has Been Cast!</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Waiting for other players to complete voting or for timer to expire...
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              Select Suspected Player:
            </p>
            <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {eligibleTargets.map((player: PlayerScore) => {
                const isSelected = votedForId === player.userId;
                return (
                  <div
                    key={player.userId}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar avatarId={player.avatar} size="sm" />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {player.displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          @{player.username}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isSelected ? 'primary' : 'outline'}
                      leftIcon={<Vote className="w-3.5 h-3.5" />}
                      disabled={submitting || hasVoted}
                      onClick={() => handleVote(player.userId)}
                    >
                      {isSelected ? 'Voted' : 'Vote Imposter'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
