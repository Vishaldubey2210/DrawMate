import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useRoom } from '../../context/RoomContext.js';
import { PlayerRoster } from '../../features/rooms/PlayerRoster.js';
import { RoomSettingsCard } from '../../features/rooms/RoomSettingsCard.js';
import { LobbyStatusBanner } from '../../features/rooms/LobbyStatusBanner.js';
import { CopyInviteButton } from '../../features/rooms/CopyInviteButton.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton.js';
import { DrawingStudio } from '../../features/drawing/DrawingStudio.js';
import { GameArena } from '../../features/game/GameArena.js';
import { getSocket } from '../../services/socket.js';
import {
  Globe,
  Lock,
  LogOut,
  Play,
  CheckCircle2,
  Clock,
  WifiOff,
  Sparkles,
  Users,
  Paintbrush,
  Gamepad2,
  Eye,
} from 'lucide-react';

export const RoomLobbyPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    currentRoom,
    socketStatus,
    isLoading,
    isHost,
    isSpectator,
    myPlayer,
    joinRoom,
    joinRoomAsSpectator,
    leaveRoom,
    toggleReady,
    requestStart,
  } = useRoom();
  const navigate = useNavigate();

  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<'lobby' | 'game' | 'drawing'>('lobby');

  const requestedSpectator = searchParams.get('role') === 'spectator';

  // Auto-connect / join if not already joined
  useEffect(() => {
    if (roomCode && (!currentRoom || currentRoom.roomCode !== roomCode.toUpperCase())) {
      const targetCode = roomCode.toUpperCase();
      if (requestedSpectator) {
        joinRoomAsSpectator(targetCode).catch(() => {
          navigate('/rooms');
        });
      } else {
        joinRoom(targetCode).catch(() => {
          navigate('/rooms');
        });
      }
    }
  }, [roomCode, currentRoom, joinRoom, joinRoomAsSpectator, requestedSpectator, navigate]);

  // If room is in_game or game starts, automatically switch to game arena tab
  useEffect(() => {
    if (currentRoom?.status === 'in_game') {
      setActiveTab('game');
    }

    const socket = getSocket();
    const handleGameStarted = () => {
      setActiveTab('game');
    };

    socket.on('game:started', handleGameStarted);
    return () => {
      socket.off('game:started', handleGameStarted);
    };
  }, [currentRoom?.status]);

  const handleLeave = async () => {
    if (!roomCode) return;
    try {
      setIsLeaving(true);
      await leaveRoom(roomCode);
    } catch {
      // Error handled
    } finally {
      setIsLeaving(false);
      setIsLeaveConfirmOpen(false);
    }
  };

  const handleStartGame = async () => {
    try {
      setIsStarting(true);
      await requestStart();
      setActiveTab('game');
    } catch {
      // Error handled in Toast
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading || !currentRoom) {
    return (
      <div className="space-y-6 animate-pulse">
        <LoadingSkeleton className="h-14 w-1/3 rounded-2xl" />
        <LoadingSkeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LoadingSkeleton className="h-64 lg:col-span-2 rounded-3xl" />
          <LoadingSkeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  const isReady = myPlayer?.isReady ?? false;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {currentRoom.name}
            </h1>
            <span className="font-mono text-xs font-black tracking-widest text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800">
              #{currentRoom.roomCode}
            </span>
            <Badge variant="neutral" size="sm">
              {currentRoom.visibility === 'public' ? (
                <>
                  <Globe className="w-3 h-3 mr-1 inline text-indigo-500" /> Public
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 mr-1 inline text-amber-500" /> Private
                </>
              )}
            </Badge>
            {socketStatus === 'disconnected' && (
              <Badge variant="danger" size="sm">
                <WifiOff className="w-3 h-3 mr-1 inline" /> Reconnecting...
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Waiting room lobby. Prepare your brushes and ready up before the host starts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <CopyInviteButton roomCode={currentRoom.roomCode} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLeaveConfirmOpen(true)}
            leftIcon={<LogOut className="w-3.5 h-3.5 text-rose-500" />}
            className="hover:border-rose-300 dark:hover:border-rose-900 hover:text-rose-600"
          >
            Leave Room
          </Button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('lobby')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'lobby'
              ? 'bg-primary-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Lobby & Roster</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('game')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'game'
              ? 'bg-primary-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Live Game Arena</span>
          {currentRoom.status === 'in_game' && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drawing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'drawing'
              ? 'bg-primary-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Paintbrush className="w-4 h-4" />
          <span>Drawing Studio</span>
          <Badge variant="brand" size="sm" className="ml-1 text-[10px] py-0 px-1.5 font-bold">
            Sandbox
          </Badge>
        </button>
      </div>

      {activeTab === 'game' ? (
        <GameArena
          roomCode={currentRoom.roomCode}
          currentUserId={user?._id || ''}
          onReturnToLobby={() => setActiveTab('lobby')}
        />
      ) : activeTab === 'drawing' ? (
        /* Real-Time Drawing Studio */
        <DrawingStudio
          roomCode={currentRoom.roomCode}
          currentUserId={user?._id || ''}
          currentUserName={user?.displayName || user?.username || 'Player'}
          players={currentRoom.players.map((p) => ({ userId: p.userId, displayName: p.displayName }))}
          isHost={isHost}
        />
      ) : (
        /* Lobby Overview Layout */
        <>
          {/* Lobby Readiness Status Banner */}
          <LobbyStatusBanner room={currentRoom} />

          {/* Main Grid: Roster on Left (2 cols), Settings on Right (1 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Player Roster */}
            <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
              <PlayerRoster
                players={currentRoom.players}
                maxPlayers={currentRoom.maxPlayers}
                currentUserId={user?._id}
                spectators={currentRoom.spectators}
                maxSpectators={currentRoom.settings.maxSpectators}
              />
            </div>

            {/* Right Column: Match Configuration Card */}
            <div className="space-y-6">
              <RoomSettingsCard settings={currentRoom.settings} isHost={isHost} />
            </div>
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {isSpectator ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <Eye className="w-4 h-4" /> You are observing this match as a Spectator (View Only)
                </span>
              ) : myPlayer?.isReady ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> You are Ready
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" /> Please click ready when set
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Toggle Ready / Unready Button (Active players only) */}
              {!isSpectator && (
                <Button
                  variant={isReady ? 'outline' : 'primary'}
                  size="md"
                  onClick={() => toggleReady(!isReady)}
                  leftIcon={isReady ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                >
                  {isReady ? 'Set Unready' : "I'm Ready!"}
                </Button>
              )}

              {/* Host Start Match CTA */}
              {isHost && (
                <Button
                  variant="primary"
                  size="md"
                  disabled={!currentRoom.isLobbyReadyToStart || isStarting}
                  isLoading={isStarting}
                  onClick={handleStartGame}
                  rightIcon={<Play className="w-4 h-4" />}
                  className="bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  title={
                    !currentRoom.isLobbyReadyToStart
                      ? 'All players must be ready and at least 2 connected players are required to start.'
                      : 'Start Match'
                  }
                >
                  Start Match & Open Studio
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Leave Room Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isLeaveConfirmOpen}
        onClose={() => setIsLeaveConfirmOpen(false)}
        onConfirm={handleLeave}
        title="Leave Game Lobby?"
        message={
          isHost
            ? 'You are currently the host. Leaving will automatically transfer host privileges to the next player in line.'
            : 'Are you sure you want to exit the lobby? You can rejoin anytime with the room code.'
        }
        confirmText="Exit Lobby"
        isLoading={isLeaving}
      />
    </div>
  );
};
