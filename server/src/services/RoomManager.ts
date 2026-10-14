import mongoose from 'mongoose';
import { Room, IRoom, IRoomSettings } from '../models/Room.js';
import { generateRoomCode, normalizeRoomCode } from '../utils/roomCode.js';
import { CreateRoomInput, RoomSettingsInput } from '../schemas/roomSchemas.js';
import { DrawingSessionManager } from './DrawingSessionManager.js';
import { GameManager } from '../game/GameManager.js';
import { operationalMetrics } from './OperationalMetrics.js';
import { telemetryService } from './TelemetryService.js';

export interface PlayerSession {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  socketId: string;
  isHost: boolean;
  isReady: boolean;
  isDisconnected: boolean;
  joinedAt: Date;
  disconnectedAt?: Date;
}

export interface SpectatorSession {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  socketId: string;
  joinedAt: Date;
  isDisconnected: boolean;
}

export interface RoomSession {
  roomId: string;
  roomCode: string;
  name: string;
  visibility: 'public' | 'private';
  hostId: string;
  status: 'waiting' | 'starting' | 'in_game' | 'closed';
  settings: IRoomSettings;
  players: Map<string, PlayerSession>;
  spectators: Map<string, SpectatorSession>;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  disconnectGenerations: Map<string, number>;
  bannedUserIds: Set<string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SanitizedRoomSnapshot {
  roomId: string;
  roomCode: string;
  name: string;
  visibility: 'public' | 'private';
  hostId: string;
  status: 'waiting' | 'starting' | 'in_game' | 'closed';
  settings: IRoomSettings;
  players: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatar: string;
    isHost: boolean;
    isReady: boolean;
    isDisconnected: boolean;
    joinedAt: string;
  }>;
  spectators: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatar: string;
    joinedAt: string;
  }>;
  currentPlayersCount: number;
  maxPlayers: number;
  currentSpectatorsCount: number;
  maxSpectators: number;
  spectatorsAllowed: boolean;
  isLobbyReadyToStart: boolean;
  createdAt: string;
}

export class RoomManager {
  private static instance: RoomManager;
  private rooms: Map<string, RoomSession> = new Map(); // Keyed by normalized roomCode
  public disconnectGracePeriodMs: number = 30000; // 30 seconds default

  private constructor() {}

  public static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  /**
   * Generates a collision-safe unique room code against active sessions and DB
   */
  public async generateUniqueCode(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const code = generateRoomCode(6);
      if (this.rooms.has(code)) continue;

      const existingInDb = await Room.findOne({ roomCode: code, status: { $ne: 'closed' } });
      if (!existingInDb) {
        return code;
      }
    }
    // Fallback extended length if high collision
    return generateRoomCode(8);
  }

  /**
   * Creates a new room authoritative session and persists to MongoDB
   */
  public async createRoom(
    creator: { userId: string; username: string; displayName: string; avatar: string },
    input: CreateRoomInput,
    socketId: string
  ): Promise<SanitizedRoomSnapshot> {
    const roomCode = await this.generateUniqueCode();
    const roomId = new mongoose.Types.ObjectId().toString();

    const initialSettings: IRoomSettings = {
      maxPlayers: input.settings?.maxPlayers ?? 8,
      rounds: input.settings?.rounds ?? 3,
      drawTimeSeconds: input.settings?.drawTimeSeconds ?? 80,
      wordCount: input.settings?.wordCount ?? 3,
      hints: input.settings?.hints ?? 2,
      wordMode: input.settings?.wordMode ?? 'normal',
      category: input.settings?.category ?? 'general',
      spectatorsAllowed: input.settings?.spectatorsAllowed ?? true,
      maxSpectators: input.settings?.maxSpectators ?? 10,
      allowLateSpectators: input.settings?.allowLateSpectators ?? true,
      wordLanguage: input.settings?.wordLanguage ?? 'en',
      wordSource: input.settings?.wordSource ?? 'builtin',
      customWordPackId: input.settings?.customWordPackId ?? null,
      gameMode: input.settings?.gameMode ?? 'classic',
    };

    // Persist to MongoDB
    await Room.create({
      roomId,
      roomCode,
      name: input.name,
      visibility: input.visibility,
      hostId: new mongoose.Types.ObjectId(creator.userId),
      status: 'waiting',
      settings: initialSettings,
      currentPlayersCount: 1,
      currentSpectatorsCount: 0,
    });

    // Create in-memory authoritative session
    const creatorPlayer: PlayerSession = {
      userId: creator.userId,
      username: creator.username,
      displayName: creator.displayName,
      avatar: creator.avatar,
      socketId,
      isHost: true,
      isReady: true, // Host is ready by default
      isDisconnected: false,
      joinedAt: new Date(),
    };

    const roomSession: RoomSession = {
      roomId,
      roomCode,
      name: input.name,
      visibility: input.visibility,
      hostId: creator.userId,
      status: 'waiting',
      settings: initialSettings,
      players: new Map([[creator.userId, creatorPlayer]]),
      spectators: new Map(),
      disconnectTimers: new Map(),
      disconnectGenerations: new Map(),
      bannedUserIds: new Set(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rooms.set(roomCode, roomSession);

    operationalMetrics.recordRoomCreated(true);
    telemetryService.trackEvent({
      eventName: 'room_created',
      userId: creator.userId,
      properties: {
        roomCode,
        visibility: input.visibility,
        gameMode: initialSettings.gameMode,
      },
    });

    return this.getSanitizedSnapshot(roomCode)!;
  }

  /**
   * Retrieves or hydrates room session from DB if needed
   */
  public async getOrHydrateRoom(rawCode: string): Promise<RoomSession | null> {
    const roomCode = normalizeRoomCode(rawCode);
    const inMemory = this.rooms.get(roomCode);
    if (inMemory) return inMemory;

    // Check DB if room was created or restarted
    const dbRoom = await Room.findOne({ roomCode, status: 'waiting' });
    if (!dbRoom) return null;

    // Hydrate empty active session
    const hydratedSession: RoomSession = {
      roomId: dbRoom.roomId,
      roomCode: dbRoom.roomCode,
      name: dbRoom.name,
      visibility: dbRoom.visibility,
      hostId: dbRoom.hostId.toString(),
      status: dbRoom.status,
      settings: dbRoom.settings,
      players: new Map(),
      spectators: new Map(),
      disconnectTimers: new Map(),
      disconnectGenerations: new Map(),
      bannedUserIds: new Set(),
      createdAt: dbRoom.createdAt,
      updatedAt: dbRoom.updatedAt,
    };

    this.rooms.set(roomCode, hydratedSession);
    return hydratedSession;
  }

  /**
   * Returns active room session if present
   */
  public getRoomSession(rawCode: string): RoomSession | null {
    const roomCode = normalizeRoomCode(rawCode);
    return this.rooms.get(roomCode) || null;
  }

  /**
   * Sets room status in memory and syncs to persistence
   */
  public setRoomStatus(rawCode: string, status: 'waiting' | 'starting' | 'in_game' | 'closed'): void {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (room) {
      room.status = status;
      room.updatedAt = new Date();
      Room.updateOne({ roomCode }, { status }).catch(console.error);
    }
  }

  /**
   * Spectator joins an existing room
   */
  public async joinRoomAsSpectator(
    rawCode: string,
    user: { userId: string; username: string; displayName: string; avatar: string },
    socketId: string
  ): Promise<{ snapshot: SanitizedRoomSnapshot; isReconnect: boolean }> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = await this.getOrHydrateRoom(roomCode);

    if (!room) {
      throw new Error(`Room with code "${roomCode}" was not found or has closed.`);
    }

    if (room.status === 'closed') {
      throw new Error(`Room has closed.`);
    }

    if (!room.settings.spectatorsAllowed) {
      throw new Error(`Spectators are not allowed in this room.`);
    }

    if (room.status !== 'waiting' && !room.settings.allowLateSpectators) {
      throw new Error(`Joining as a spectator after the game has started is not permitted in this room.`);
    }

    // A user cannot simultaneously be an active player and spectator
    if (room.players.has(user.userId)) {
      throw new Error(`You are already an active player in this room.`);
    }

    const existingSpectator = room.spectators.get(user.userId);
    if (existingSpectator) {
      existingSpectator.socketId = socketId;
      existingSpectator.isDisconnected = false;
      existingSpectator.displayName = user.displayName;
      existingSpectator.avatar = user.avatar;
      return {
        snapshot: this.getSanitizedSnapshot(roomCode)!,
        isReconnect: true,
      };
    }

    const maxSpectators = room.settings.maxSpectators ?? 10;
    if (room.spectators.size >= maxSpectators) {
      throw new Error(`Spectator capacity reached (maximum: ${maxSpectators} spectators).`);
    }

    const spectator: SpectatorSession = {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      socketId,
      joinedAt: new Date(),
      isDisconnected: false,
    };

    room.spectators.set(user.userId, spectator);
    room.updatedAt = new Date();

    Room.updateOne(
      { roomCode },
      { currentSpectatorsCount: room.spectators.size }
    ).catch(console.error);

    return {
      snapshot: this.getSanitizedSnapshot(roomCode)!,
      isReconnect: false,
    };
  }

  /**
   * Handles spectator departure
   */
  public async handleSpectatorLeave(
    rawCode: string,
    userId: string
  ): Promise<{ wasRemoved: boolean; snapshot: SanitizedRoomSnapshot | null }> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { wasRemoved: false, snapshot: null };
    }

    const wasRemoved = room.spectators.delete(userId);
    if (wasRemoved) {
      room.updatedAt = new Date();
      Room.updateOne(
        { roomCode },
        { currentSpectatorsCount: room.spectators.size }
      ).catch(console.error);
    }

    return {
      wasRemoved,
      snapshot: this.getSanitizedSnapshot(roomCode),
    };
  }

  /**
   * Player joins an existing room
   */
  public async joinRoom(
    rawCode: string,
    user: { userId: string; username: string; displayName: string; avatar: string },
    socketId: string
  ): Promise<{ snapshot: SanitizedRoomSnapshot; isReconnect: boolean }> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = await this.getOrHydrateRoom(roomCode);

    if (!room) {
      throw new Error(`Room with code "${roomCode}" was not found or has closed.`);
    }

    if (room.bannedUserIds?.has(user.userId)) {
      throw new Error('You have been kicked from this room.');
    }

    // Check if player is already registered in the room FIRST (allows in-game reconnect)
    const existingPlayer = room.players.get(user.userId);

    if (existingPlayer) {
      // Reconnection or reattachment
      const timer = room.disconnectTimers.get(user.userId);
      if (timer) {
        clearTimeout(timer);
        room.disconnectTimers.delete(user.userId);
      }

      // Invalidate any pending disconnect generation token
      const currentGen = (room.disconnectGenerations.get(user.userId) || 0) + 1;
      room.disconnectGenerations.set(user.userId, currentGen);

      existingPlayer.socketId = socketId;
      existingPlayer.isDisconnected = false;
      existingPlayer.disconnectedAt = undefined;
      // Refresh avatar/displayName in case profile was updated
      existingPlayer.displayName = user.displayName;
      existingPlayer.avatar = user.avatar;

      operationalMetrics.recordReconnectAttempt(true);
      telemetryService.trackEvent({
        eventName: 'reconnect_recovered',
        userId: user.userId,
        properties: { roomCode },
      });

      return {
        snapshot: this.getSanitizedSnapshot(roomCode)!,
        isReconnect: true,
      };
    }

    // New participants cannot join if game is not in waiting lobby
    if (room.status !== 'waiting') {
      operationalMetrics.recordRoomJoined(false);
      throw new Error(`Cannot join room: game is currently ${room.status}.`);
    }

    // Capacity check for new participant
    if (room.players.size >= room.settings.maxPlayers) {
      operationalMetrics.recordRoomJoined(false);
      throw new Error(`Room is full (maximum capacity: ${room.settings.maxPlayers} players).`);
    }

    // Add new participant
    const isFirstParticipant = room.players.size === 0;
    const newPlayer: PlayerSession = {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      socketId,
      isHost: isFirstParticipant || room.hostId === user.userId,
      isReady: isFirstParticipant, // Host is ready by default
      isDisconnected: false,
      joinedAt: new Date(),
    };

    if (isFirstParticipant) {
      room.hostId = user.userId;
    }

    room.players.set(user.userId, newPlayer);
    room.updatedAt = new Date();

    operationalMetrics.recordRoomJoined(true);
    telemetryService.trackEvent({
      eventName: 'room_joined',
      userId: user.userId,
      properties: { roomCode },
    });

    return {
      snapshot: this.getSanitizedSnapshot(roomCode)!,
      isReconnect: false,
    };
  }

  /**
   * Sets player ready status
   */
  public setPlayerReady(rawCode: string, userId: string, isReady: boolean): SanitizedRoomSnapshot {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error(`Room not found.`);
    }

    const player = room.players.get(userId);
    if (!player) {
      throw new Error(`Player is not in this room.`);
    }

    if (room.status !== 'waiting') {
      throw new Error(`Cannot change ready status while game is ${room.status}.`);
    }

    player.isReady = Boolean(isReady);
    room.updatedAt = new Date();

    return this.getSanitizedSnapshot(roomCode)!;
  }

  /**
   * Host updates room settings
   */
  public async updateSettings(
    rawCode: string,
    requesterUserId: string,
    newSettings: Partial<IRoomSettings>
  ): Promise<SanitizedRoomSnapshot> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error(`Room not found.`);
    }

    if (room.hostId !== requesterUserId) {
      throw new Error(`Unauthorized: Only the room host can modify settings.`);
    }

    if (room.status !== 'waiting') {
      throw new Error(`Room settings are locked while game is in progress.`);
    }

    // If maxPlayers is being lowered, ensure it's not below current connected players
    if (newSettings.maxPlayers !== undefined && newSettings.maxPlayers < room.players.size) {
      throw new Error(`Cannot set max players lower than current player count (${room.players.size}).`);
    }

    // If maxSpectators is being lowered, ensure it's not below current connected spectators
    if (newSettings.maxSpectators !== undefined && newSettings.maxSpectators < room.spectators.size) {
      throw new Error(`Cannot set max spectators lower than current spectator count (${room.spectators.size}).`);
    }

    if (newSettings.spectatorsAllowed === false && room.spectators.size > 0) {
      throw new Error(`Cannot disable spectators while spectators are currently present in the lobby.`);
    }

    // Merge validated settings
    room.settings = {
      ...room.settings,
      ...newSettings,
    };
    room.updatedAt = new Date();

    // Persist to MongoDB
    await Room.updateOne({ roomCode }, { settings: room.settings });

    return this.getSanitizedSnapshot(roomCode)!;
  }

  /**
   * Evaluates if room is eligible to start
   */
  public validateStartRequest(
    rawCode: string,
    requesterUserId: string
  ): { canStart: boolean; error?: string; snapshot?: SanitizedRoomSnapshot } {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { canStart: false, error: 'Room not found.' };
    }

    if (room.hostId !== requesterUserId) {
      return { canStart: false, error: 'Only the host can initiate game start.' };
    }

    const connectedPlayers = Array.from(room.players.values()).filter((p) => !p.isDisconnected);
    const minRequired = room.settings.gameMode === 'imposter' ? 4 : 2;

    if (connectedPlayers.length < minRequired) {
      return {
        canStart: false,
        error: `At least ${minRequired} connected players are required to start ${room.settings.gameMode === 'imposter' ? 'Imposter Mode' : 'the match'} (currently ${connectedPlayers.length}).`,
      };
    }

    const unreadyPlayers = connectedPlayers.filter((p) => !p.isReady);
    if (unreadyPlayers.length > 0) {
      const names = unreadyPlayers.map((p) => p.displayName).join(', ');
      return {
        canStart: false,
        error: `All players must be ready before starting. Waiting on: ${names}.`,
      };
    }

    return {
      canStart: true,
      snapshot: this.getSanitizedSnapshot(roomCode)!,
    };
  }

  /**
   * Handles player departure (intentional leave or disconnect expiration)
   */
  public async handlePlayerLeave(
    rawCode: string,
    userId: string,
    isExplicitLeave: boolean,
    onExpirationCallback?: (updatedSnapshot: SanitizedRoomSnapshot | null, departedUserId: string) => void
  ): Promise<{
    wasRemoved: boolean;
    newHostId?: string;
    roomClosed: boolean;
    snapshot: SanitizedRoomSnapshot | null;
  }> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { wasRemoved: false, roomClosed: true, snapshot: null };
    }

    const player = room.players.get(userId);
    if (!player) {
      return { wasRemoved: false, roomClosed: false, snapshot: this.getSanitizedSnapshot(roomCode) };
    }

    // IF EXPLICIT LEAVE: Remove immediately
    if (isExplicitLeave) {
      // Clear any pending timer
      const existingTimer = room.disconnectTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        room.disconnectTimers.delete(userId);
      }

      room.players.delete(userId);

      // If room is now empty: close it
      if (room.players.size === 0) {
        await this.closeRoom(roomCode);
        return { wasRemoved: true, roomClosed: true, snapshot: null };
      }

      // If departed user was the host, transfer to the oldest remaining connected participant
      let newHostId: string | undefined;
      if (room.hostId === userId) {
        const eligibleNextHost = this.findNextHost(room);
        if (eligibleNextHost) {
          eligibleNextHost.isHost = true;
          room.hostId = eligibleNextHost.userId;
          newHostId = eligibleNextHost.userId;
        }
      }

      // Reconcile active game lifecycle if in progress
      const activeGame = GameManager.getInstance().getGame(roomCode);
      if (activeGame && activeGame.phase !== 'game_over' && activeGame.phase !== 'cancelled') {
        const connectedCount = Array.from(room.players.values()).filter((p) => !p.isDisconnected).length;
        const minRequired = activeGame.gameMode === 'imposter' ? 3 : 2;
        if (connectedCount < minRequired) {
          activeGame.cancelGame('Player departed: Not enough connected players to continue match.');
        } else if (activeGame.currentDrawerId === userId && activeGame.phase === 'drawing') {
          activeGame.endRound('cancelled');
        }
      }

      Room.updateOne({ roomCode }, { currentPlayersCount: room.players.size, hostId: room.hostId }).catch(console.error);

      return {
        wasRemoved: true,
        newHostId,
        roomClosed: false,
        snapshot: this.getSanitizedSnapshot(roomCode),
      };
    }

    // IF UNEXPECTED DISCONNECT: Mark isDisconnected = true and start 30s grace period
    player.isDisconnected = true;
    player.disconnectedAt = new Date();

    // Safely cancel any active drawing stroke for the disconnected user
    DrawingSessionManager.getInstance().cancelActiveStroke(roomCode, userId);

    // Cancel existing timer if any
    const existingTimer = room.disconnectTimers.get(userId);
    if (existingTimer) clearTimeout(existingTimer);

    // Increment disconnect generation token to prevent stale cleanup callbacks
    const generation = (room.disconnectGenerations.get(userId) || 0) + 1;
    room.disconnectGenerations.set(userId, generation);

    const timer = setTimeout(async () => {
      // Verify generation token matches to prevent delayed cleanup from removing reconnected player
      if (room.disconnectGenerations.get(userId) !== generation) {
        return;
      }
      room.disconnectTimers.delete(userId);
      const stillDisconnectedPlayer = room.players.get(userId);
      if (stillDisconnectedPlayer && stillDisconnectedPlayer.isDisconnected) {
        room.players.delete(userId);

        if (room.players.size === 0) {
          await this.closeRoom(roomCode);
          if (onExpirationCallback) onExpirationCallback(null, userId);
          return;
        }

        // Host transfer if expired host
        if (room.hostId === userId) {
          const eligibleNextHost = this.findNextHost(room);
          if (eligibleNextHost) {
            eligibleNextHost.isHost = true;
            room.hostId = eligibleNextHost.userId;
          }
        }

        // Reconcile active game lifecycle upon disconnect grace period expiry
        const activeGame = GameManager.getInstance().getGame(roomCode);
        if (activeGame && activeGame.phase !== 'game_over' && activeGame.phase !== 'cancelled') {
          const connectedCount = Array.from(room.players.values()).filter((p) => !p.isDisconnected).length;
          const minRequired = activeGame.gameMode === 'imposter' ? 3 : 2;
          if (connectedCount < minRequired) {
            activeGame.cancelGame('Disconnect grace period expired: Not enough players to continue match.');
          }
        }

        Room.updateOne({ roomCode }, { currentPlayersCount: room.players.size, hostId: room.hostId }).catch(console.error);

        if (onExpirationCallback) {
          onExpirationCallback(this.getSanitizedSnapshot(roomCode), userId);
        }
      }
    }, this.disconnectGracePeriodMs);

    room.disconnectTimers.set(userId, timer);

    return {
      wasRemoved: false,
      roomClosed: false,
      snapshot: this.getSanitizedSnapshot(roomCode),
    };
  }

  /**
   * Host kicks a player or spectator from the room
   */
  public async kickPlayer(
    rawCode: string,
    hostUserId: string,
    targetUserId: string,
    reason?: string
  ): Promise<{ snapshot: SanitizedRoomSnapshot; kickedSocketId?: string }> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room not found.');
    }

    if (room.hostId !== hostUserId) {
      throw new Error('Unauthorized: Only the room host can kick participants.');
    }

    if (targetUserId === hostUserId) {
      throw new Error('Cannot kick yourself as host.');
    }

    let kickedSocketId: string | undefined;

    const player = room.players.get(targetUserId);
    if (player) {
      kickedSocketId = player.socketId;
      const timer = room.disconnectTimers.get(targetUserId);
      if (timer) clearTimeout(timer);
      room.disconnectTimers.delete(targetUserId);
      room.players.delete(targetUserId);
    } else {
      const spectator = room.spectators.get(targetUserId);
      if (spectator) {
        kickedSocketId = spectator.socketId;
        room.spectators.delete(targetUserId);
      } else {
        throw new Error('Target player not found in room.');
      }
    }

    if (!room.bannedUserIds) {
      room.bannedUserIds = new Set();
    }
    room.bannedUserIds.add(targetUserId);

    room.updatedAt = new Date();
    Room.updateOne({ roomCode }, { currentPlayersCount: room.players.size }).catch(console.error);

    // Cancel any active stroke for kicked player and reconcile active game session
    DrawingSessionManager.getInstance().cancelActiveStroke(roomCode, targetUserId);
    const activeGame = GameManager.getInstance().getGame(roomCode);
    if (activeGame && activeGame.phase !== 'game_over' && activeGame.phase !== 'cancelled') {
      const connectedCount = Array.from(room.players.values()).filter((p) => !p.isDisconnected).length;
      const minRequired = activeGame.gameMode === 'imposter' ? 3 : 2;
      if (connectedCount < minRequired) {
        activeGame.cancelGame('Player removed: Not enough connected players to continue match.');
      } else if (activeGame.currentDrawerId === targetUserId && activeGame.phase === 'drawing') {
        activeGame.endRound('cancelled');
      }
    }

    return {
      snapshot: this.getSanitizedSnapshot(roomCode)!,
      kickedSocketId,
    };
  }

  /**
   * Selects next host based on oldest joined connected participant
   */
  private findNextHost(room: RoomSession): PlayerSession | null {
    const participants = Array.from(room.players.values()).sort(
      (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
    );

    // Prefer connected participants first
    const connected = participants.find((p) => !p.isDisconnected);
    if (connected) return connected;

    // Fallback to any remaining participant
    return participants[0] || null;
  }

  /**
   * Closes and cleans up a room
   */
  public async closeRoom(rawCode: string): Promise<void> {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (room) {
      // Clear all active disconnect timers
      for (const timer of room.disconnectTimers.values()) {
        clearTimeout(timer);
      }
      room.disconnectTimers.clear();
      room.spectators.clear();
      room.status = 'closed';
      this.rooms.delete(roomCode);
      DrawingSessionManager.getInstance().endSession(roomCode);
      GameManager.getInstance().removeGame(roomCode);
    }

    await Room.updateOne({ roomCode }, { status: 'closed', currentPlayersCount: 0, currentSpectatorsCount: 0 });
  }

  /**
   * Returns list of public active rooms for room discovery
   */
  public async getPublicRoomsList(): Promise<
    Array<{
      roomCode: string;
      name: string;
      currentPlayersCount: number;
      maxPlayers: number;
      currentSpectatorsCount: number;
      maxSpectators: number;
      spectatorsAllowed: boolean;
      wordLanguage: string;
      wordMode: string;
      rounds: number;
      drawTimeSeconds: number;
      status: string;
      createdAt: string;
    }>
  > {
    // Read from DB for public rooms
    const publicRooms = await Room.find({
      visibility: 'public',
      status: 'waiting',
    })
      .sort({ createdAt: -1 })
      .limit(30);

    return publicRooms.map((r) => {
      // Reconcile with active in-memory count if active
      const active = this.rooms.get(r.roomCode);
      const count = active ? active.players.size : r.currentPlayersCount;
      const spectatorCount = active ? active.spectators.size : (r.currentSpectatorsCount ?? 0);

      return {
        roomCode: r.roomCode,
        name: r.name,
        currentPlayersCount: count,
        maxPlayers: r.settings.maxPlayers,
        currentSpectatorsCount: spectatorCount,
        maxSpectators: r.settings.maxSpectators ?? 10,
        spectatorsAllowed: r.settings.spectatorsAllowed ?? true,
        wordLanguage: r.settings.wordLanguage ?? 'en',
        wordMode: r.settings.wordMode ?? 'normal',
        rounds: r.settings.rounds,
        drawTimeSeconds: r.settings.drawTimeSeconds,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  /**
   * Returns sanitized client-safe snapshot of a room
   */
  public getSanitizedSnapshot(rawCode: string): SanitizedRoomSnapshot | null {
    const roomCode = normalizeRoomCode(rawCode);
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const playersList = Array.from(room.players.values()).map((p) => ({
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatar: p.avatar,
      isHost: p.userId === room.hostId,
      isReady: p.isReady,
      isDisconnected: p.isDisconnected,
      joinedAt: p.joinedAt.toISOString(),
    }));

    const spectatorsList = Array.from(room.spectators.values()).map((s) => ({
      userId: s.userId,
      username: s.username,
      displayName: s.displayName,
      avatar: s.avatar,
      joinedAt: s.joinedAt.toISOString(),
    }));

    const connectedPlayers = playersList.filter((p) => !p.isDisconnected);
    const isLobbyReadyToStart =
      connectedPlayers.length >= 2 && connectedPlayers.every((p) => p.isReady);

    return {
      roomId: room.roomId,
      roomCode: room.roomCode,
      name: room.name,
      visibility: room.visibility,
      hostId: room.hostId,
      status: room.status,
      settings: room.settings,
      players: playersList,
      spectators: spectatorsList,
      currentPlayersCount: room.players.size,
      maxPlayers: room.settings.maxPlayers,
      currentSpectatorsCount: room.spectators.size,
      maxSpectators: room.settings.maxSpectators ?? 10,
      spectatorsAllowed: room.settings.spectatorsAllowed ?? true,
      isLobbyReadyToStart,
      createdAt: room.createdAt.toISOString(),
    };
  }

  /**
   * Finds which room a given socket or user is currently participating in
   */
  public findUserRoom(userId: string, socketId?: string): {
    roomCode: string;
    player?: PlayerSession;
    spectator?: SpectatorSession;
    isSpectator: boolean;
  } | null {
    // If socketId provided, match the exact room where this specific socket is attached
    if (socketId) {
      for (const [roomCode, room] of this.rooms.entries()) {
        const player = room.players.get(userId);
        if (player && player.socketId === socketId) {
          return { roomCode, player, isSpectator: false };
        }
        const spectator = room.spectators?.get(userId);
        if (spectator && spectator.socketId === socketId) {
          return { roomCode, spectator, isSpectator: true };
        }
      }
    }

    // Fallback lookup by userId
    for (const [roomCode, room] of this.rooms.entries()) {
      const player = room.players.get(userId);
      if (player) {
        return { roomCode, player, isSpectator: false };
      }
      const spectator = room.spectators?.get(userId);
      if (spectator) {
        return { roomCode, spectator, isSpectator: true };
      }
    }
    return null;
  }
}
