import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../services/socket.js';
import { useAuth } from './AuthContext.js';
import { useToast } from './ToastContext.js';
import { RoomSnapshot, RoomPlayer, RoomSettings } from '../types/index.js';

interface RoomContextType {
  currentRoom: RoomSnapshot | null;
  socketStatus: 'connected' | 'connecting' | 'disconnected';
  isLoading: boolean;
  error: string | null;
  isHost: boolean;
  isSpectator: boolean;
  myPlayer: RoomPlayer | null;
  createRoom: (payload: {
    name?: string;
    visibility?: 'public' | 'private';
    settings?: Partial<RoomSettings>;
  }) => Promise<string>;
  joinRoom: (roomCode: string) => Promise<void>;
  joinRoomAsSpectator: (roomCode: string) => Promise<void>;
  leaveRoom: (roomCode: string) => Promise<void>;
  toggleReady: (isReady: boolean) => Promise<void>;
  updateSettings: (settings: Partial<RoomSettings>) => Promise<void>;
  requestStart: () => Promise<void>;
  fetchRoomState: (roomCode: string) => void;
  clearError: () => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [currentRoom, setCurrentRoom] = useState<RoomSnapshot | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socket = getSocket();

  useEffect(() => {
    const handleConnect = () => setSocketStatus('connected');
    const handleDisconnect = () => setSocketStatus('disconnected');
    const handleConnectError = () => setSocketStatus('disconnected');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) {
      setSocketStatus('connected');
    }

    // Room real-time event listeners
    const handleRoomState = (snapshot: RoomSnapshot) => {
      setCurrentRoom(snapshot);
    };

    const handlePlayerJoined = (data: { user: any; isReconnect: boolean }) => {
      if (data.isReconnect) {
        toast.info(`${data.user.displayName} reconnected to the room.`);
      } else {
        toast.info(`${data.user.displayName} joined the lobby!`);
      }
    };

    const handlePlayerLeft = (data: { displayName?: string; newHostId?: string; reason?: string }) => {
      if (data.displayName) {
        toast.info(`${data.displayName} left the room.`);
      }
      if (data.newHostId && user?._id === data.newHostId) {
        toast.success('You are now the host of this room!');
      }
    };

    const handlePlayerPresence = (data: { userId: string; isDisconnected: boolean; message?: string }) => {
      if (data.message) {
        toast.info(data.message);
      }
    };

    const handleSettingsUpdated = (data: { updatedBy: string }) => {
      toast.info(`Room settings were updated by ${data.updatedBy}`);
    };

    const handleRoomClosed = (data: { reason?: string }) => {
      toast.error(data.reason || 'The room has been closed.');
      setCurrentRoom(null);
      navigate('/rooms');
    };

    const handleStartResult = (data: { success: boolean; message?: string }) => {
      if (data.success) {
        toast.success(data.message || 'Lobby ready! Real-time game engine begins in Phase 3.');
      }
    };

    socket.on('room:state', handleRoomState);
    socket.on('room:player_joined', handlePlayerJoined);
    socket.on('room:player_left', handlePlayerLeft);
    socket.on('room:player_presence', handlePlayerPresence);
    socket.on('room:settings_updated', handleSettingsUpdated);
    socket.on('room:closed', handleRoomClosed);
    socket.on('room:start_request_result', handleStartResult);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('room:state', handleRoomState);
      socket.off('room:player_joined', handlePlayerJoined);
      socket.off('room:player_left', handlePlayerLeft);
      socket.off('room:player_presence', handlePlayerPresence);
      socket.off('room:settings_updated', handleSettingsUpdated);
      socket.off('room:closed', handleRoomClosed);
      socket.off('room:start_request_result', handleStartResult);
    };
  }, [socket, user, toast, navigate]);

  const createRoom = useCallback(
    (payload: { name?: string; visibility?: 'public' | 'private'; settings?: Partial<RoomSettings> }): Promise<string> => {
      setIsLoading(true);
      setError(null);

      return new Promise((resolve, reject) => {
        socket.emit('room:create', payload, (res: any) => {
          setIsLoading(false);
          if (res?.success && res.room) {
            setCurrentRoom(res.room);
            toast.success(`Room created! Code: ${res.room.roomCode}`);
            resolve(res.room.roomCode);
          } else {
            const errMsg = res?.error || 'Failed to create room.';
            setError(errMsg);
            toast.error(errMsg);
            reject(new Error(errMsg));
          }
        });
      });
    },
    [socket, toast]
  );

  const joinRoom = useCallback(
    (roomCode: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      return new Promise((resolve, reject) => {
        socket.emit('room:join', { roomCode }, (res: any) => {
          setIsLoading(false);
          if (res?.success && res.room) {
            setCurrentRoom(res.room);
            if (res.isReconnect) {
              toast.info('Reconnected to existing lobby.');
            } else {
              toast.success(`Joined room #${res.room.roomCode}`);
            }
            resolve();
          } else {
            const errMsg = res?.error || 'Failed to join room.';
            setError(errMsg);
            toast.error(errMsg);
            reject(new Error(errMsg));
          }
        });
      });
    },
    [socket, toast]
  );

  const joinRoomAsSpectator = useCallback(
    (roomCode: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      return new Promise((resolve, reject) => {
        socket.emit('room:join_spectator', { roomCode }, (res: any) => {
          setIsLoading(false);
          if (res?.success) {
            setCurrentRoom(res.room);
            toast.info(`Joined room #${roomCode} as Spectator.`);
            resolve();
          } else {
            const errMsg = res?.error || 'Failed to watch room as spectator.';
            setError(errMsg);
            toast.error(errMsg);
            reject(new Error(errMsg));
          }
        });
      });
    },
    [socket, toast]
  );

  const leaveRoom = useCallback(
    (roomCode: string): Promise<void> => {
      return new Promise((resolve) => {
        let finished = false;
        const cleanupAndExit = () => {
          if (finished) return;
          finished = true;
          setCurrentRoom(null);
          setError(null);
          toast.info('Left the room.');
          navigate('/rooms');
          resolve();
        };

        const timeout = setTimeout(cleanupAndExit, 1500);

        socket.emit('room:leave', { roomCode }, (_res: any) => {
          clearTimeout(timeout);
          cleanupAndExit();
        });
      });
    },
    [socket, toast, navigate]
  );

  const toggleReady = useCallback(
    (isReady: boolean): Promise<void> => {
      if (!currentRoom) return Promise.resolve();

      return new Promise((resolve, reject) => {
        socket.emit('room:ready', { roomCode: currentRoom.roomCode, isReady }, (res: any) => {
          if (res?.success) {
            resolve();
          } else {
            const errMsg = res?.error || 'Failed to update ready state.';
            toast.error(errMsg);
            reject(new Error(errMsg));
          }
        });
      });
    },
    [socket, currentRoom, toast]
  );

  const updateSettings = useCallback(
    (settings: Partial<RoomSettings>): Promise<void> => {
      if (!currentRoom) return Promise.resolve();

      return new Promise((resolve, reject) => {
        socket.emit(
          'room:update_settings',
          { roomCode: currentRoom.roomCode, settings },
          (res: any) => {
            if (res?.success) {
              toast.success('Room settings updated.');
              resolve();
            } else {
              const errMsg = res?.error || 'Failed to update settings.';
              toast.error(errMsg);
              reject(new Error(errMsg));
            }
          }
        );
      });
    },
    [socket, currentRoom, toast]
  );

  const requestStart = useCallback((): Promise<void> => {
    if (!currentRoom) return Promise.resolve();

    return new Promise((resolve, reject) => {
      socket.emit('room:start_request', { roomCode: currentRoom.roomCode }, (res: any) => {
        if (res?.success) {
          toast.success(res.message || 'Lobby verified successfully!');
          resolve();
        } else {
          const errMsg = res?.error || 'Cannot start room.';
          toast.error(errMsg);
          reject(new Error(errMsg));
        }
      });
    });
  }, [socket, currentRoom, toast]);

  const fetchRoomState = useCallback(
    (roomCode: string) => {
      socket.emit('room:get_state', { roomCode }, (res: any) => {
        if (res?.success && res.room) {
          setCurrentRoom(res.room);
        }
      });
    },
    [socket]
  );

  const clearError = () => setError(null);

  const isHost = Boolean(user && currentRoom && currentRoom.hostId === user._id);
  const isSpectator = Boolean(
    user && currentRoom && currentRoom.spectators?.some((s) => s.userId === user._id)
  );
  const myPlayer =
    user && currentRoom
      ? currentRoom.players.find((p) => p.userId === user._id) || null
      : null;

  return (
    <RoomContext.Provider
      value={{
        currentRoom,
        socketStatus,
        isLoading,
        error,
        isHost,
        isSpectator,
        myPlayer,
        createRoom,
        joinRoom,
        joinRoomAsSpectator,
        leaveRoom,
        toggleReady,
        updateSettings,
        requestStart,
        fetchRoomState,
        clearError,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};
