import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useRoom } from '../../context/RoomContext.js';
import { PublicRoomSummary } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton.js';
import { Globe, Users, RefreshCw, Search, ArrowRight, Layers, Clock, Eye, Sparkles } from 'lucide-react';

export const PublicRoomList: React.FC<{ onOpenCreateModal: () => void }> = ({ onOpenCreateModal }) => {
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { joinRoom, joinRoomAsSpectator } = useRoom();
  const navigate = useNavigate();

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/rooms/public');
      if (res.data?.success) {
        setRooms(res.data.rooms || []);
      }
    } catch (e) {
      console.warn('Failed to fetch public rooms', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.roomCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleJoin = async (roomCode: string) => {
    try {
      await joinRoom(roomCode);
      navigate(`/rooms/${roomCode}`);
    } catch {
      // Handled by context toast
    }
  };

  const handleSpectate = async (roomCode: string) => {
    try {
      await joinRoomAsSpectator(roomCode);
      navigate(`/rooms/${roomCode}?role=spectator`);
    } catch {
      // Handled by context toast
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-500" />
            <span>Public Room Discovery</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Join ongoing public lobbies or match with players worldwide.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms or code..."
              className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRooms}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            title="Refresh room list"
          >
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <LoadingSkeleton key={n} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={search ? 'No rooms match your filter' : 'No public rooms active right now'}
          description={
            search
              ? 'Try a different keyword or create your own room.'
              : 'Be the first to create a public lobby and welcome sketchers to your match!'
          }
          actionText="Create Public Room"
          onAction={onOpenCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRooms.map((room) => {
            const isFull = room.currentPlayersCount >= room.maxPlayers;
            const spectatorsAllowed = room.spectatorsAllowed !== false;
            const spectatorsCount = room.currentSpectatorsCount || 0;
            const maxSpectators = room.maxSpectators || 10;
            const isSpectatorFull = spectatorsCount >= maxSpectators;

            return (
              <div
                key={room.roomCode}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 bg-slate-50/60 dark:bg-slate-950/40 transition-all flex flex-col justify-between gap-4 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <span className="font-mono text-xs font-black tracking-widest text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
                      #{room.roomCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={isFull ? 'danger' : 'success'} size="sm">
                        <Users className="w-3 h-3 mr-1 inline" />
                        {room.currentPlayersCount} / {room.maxPlayers}
                      </Badge>
                      {spectatorsAllowed && (
                        <Badge variant="neutral" size="sm">
                          <Eye className="w-3 h-3 mr-1 inline text-indigo-400" />
                          {spectatorsCount}/{maxSpectators}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {room.name}
                  </h4>

                  <div className="flex items-center flex-wrap gap-2 text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" /> {room.rounds} rds
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {room.drawTimeSeconds}s
                    </span>
                    {room.wordLanguage && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">
                        {room.wordLanguage}
                      </span>
                    )}
                    {room.wordMode && room.wordMode !== 'normal' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase">
                        {room.wordMode}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    disabled={isFull}
                    onClick={() => handleJoin(room.roomCode)}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    className="flex-1"
                  >
                    {isFull ? 'Player Full' : 'Join Match'}
                  </Button>
                  {spectatorsAllowed && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSpectatorFull}
                      onClick={() => handleSpectate(room.roomCode)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      className="shrink-0"
                      title={isSpectatorFull ? 'Spectators full' : 'Watch as Spectator'}
                    >
                      Watch
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
