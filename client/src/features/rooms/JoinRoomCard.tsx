import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../../context/RoomContext.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { KeyRound, ArrowRight, Eye } from 'lucide-react';

export const JoinRoomCard: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const { joinRoom, joinRoomAsSpectator, isLoading } = useRoom();
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) return;

    try {
      await joinRoom(cleanCode);
      navigate(`/rooms/${cleanCode}`);
    } catch {
      // Error handled by Toast in context
    }
  };

  const handleSpectate = async (e: React.MouseEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) return;

    try {
      await joinRoomAsSpectator(cleanCode);
      navigate(`/rooms/${cleanCode}`);
    } catch {
      // Error handled by Toast
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Join by Code</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Have a 6-character room code or invite code?
          </p>
        </div>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3 pt-1">
        <div className="flex-1">
          <Input
            id="join-code-input"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="e.g. 7X9K2M"
            className="font-mono uppercase tracking-widest text-center font-bold text-base"
            maxLength={8}
            required
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="md"
            isLoading={isLoading}
            disabled={!roomCode.trim()}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="shrink-0"
          >
            Join as Player
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleSpectate}
            disabled={!roomCode.trim() || isLoading}
            leftIcon={<Eye className="w-4 h-4" />}
            className="shrink-0"
          >
            Watch
          </Button>
        </div>
      </form>
    </div>
  );
};
