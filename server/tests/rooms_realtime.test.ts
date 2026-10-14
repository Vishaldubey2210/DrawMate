import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupRealtimeServer } from '../src/realtime/socket.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Room } from '../src/models/Room.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';

describe('Phase 2 - Real-Time Rooms, Lobby & Presence System', () => {
  let httpServer: HttpServer;
  let serverPort: number;

  let userA: any;
  let tokenA: string;
  let userB: any;
  let tokenB: string;
  let userC: any;
  let tokenC: string;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Room.deleteMany({});

    // Create 3 test users
    const pwdHash = await hashPassword('Password123!');

    userA = await User.create({
      displayName: 'Alice Drawer',
      username: 'alice_draws',
      normalizedUsername: 'alice_draws',
      email: 'alice@example.com',
      normalizedEmail: 'alice@example.com',
      passwordHash: pwdHash,
      avatar: 'avatar-1',
      isOnboarded: true,
    });

    userB = await User.create({
      displayName: 'Bob Guesser',
      username: 'bob_guesses',
      normalizedUsername: 'bob_guesses',
      email: 'bob@example.com',
      normalizedEmail: 'bob@example.com',
      passwordHash: pwdHash,
      avatar: 'avatar-2',
      isOnboarded: true,
    });

    userC = await User.create({
      displayName: 'Charlie Sketcher',
      username: 'charlie_sketch',
      normalizedUsername: 'charlie_sketch',
      email: 'charlie@example.com',
      normalizedEmail: 'charlie@example.com',
      passwordHash: pwdHash,
      avatar: 'avatar-3',
      isOnboarded: true,
    });

    tokenA = signAccessToken({ userId: userA._id.toString(), username: userA.username, email: userA.email });
    tokenB = signAccessToken({ userId: userB._id.toString(), username: userB.username, email: userB.email });
    tokenC = signAccessToken({ userId: userC._id.toString(), username: userC.username, email: userC.email });

    // Spin up test HTTP and Socket.IO server on an ephemeral port
    httpServer = createServer(app);
    setupRealtimeServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr: any = httpServer.address();
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    httpServer.close();
    await disconnectDB();
  });

  const createClientSocket = (token?: string): Promise<ClientSocketType> => {
    return new Promise((resolve, reject) => {
      const socket = ClientSocket(`http://localhost:${serverPort}`, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        reconnection: false,
      });

      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });
  };

  describe('Socket.IO Handshake Authentication', () => {
    it('rejects connection without token', async () => {
      await expect(createClientSocket()).rejects.toThrow(/Authentication required/i);
    });

    it('rejects connection with invalid token', async () => {
      await expect(createClientSocket('invalid-jwt-token')).rejects.toThrow(/Authentication failed/i);
    });

    it('successfully connects authenticated user', async () => {
      const socket = await createClientSocket(tokenA);
      expect(socket.connected).toBe(true);
      socket.disconnect();
    });
  });

  describe('Room Creation & Discovery', () => {
    let createdRoomCode = '';

    it('creates a private room with creator as host', async () => {
      const socket = await createClientSocket(tokenA);

      const res: any = await new Promise((resolve) => {
        socket.emit(
          'room:create',
          {
            name: "Alice's Secret Party",
            visibility: 'private',
            settings: { maxPlayers: 2, rounds: 4 },
          },
          (response: any) => resolve(response)
        );
      });

      expect(res.success).toBe(true);
      expect(res.room.roomCode).toBeDefined();
      expect(res.room.visibility).toBe('private');
      expect(res.room.hostId).toBe(userA._id.toString());
      expect(res.room.players).toHaveLength(1);
      expect(res.room.players[0].isHost).toBe(true);
      expect(res.room.settings.maxPlayers).toBe(2);
      expect(res.room.settings.rounds).toBe(4);

      createdRoomCode = res.room.roomCode;
      socket.disconnect();
    });

    it('ensures private rooms do not appear in public room discovery', async () => {
      const res = await request(app).get('/api/rooms/public');
      expect(res.status).toBe(200);
      const matching = res.body.rooms.find((r: any) => r.roomCode === createdRoomCode);
      expect(matching).toBeUndefined(); // Must NEVER leak private rooms!
    });

    it('creates a public room and displays it in discovery', async () => {
      const socket = await createClientSocket(tokenA);

      const createRes: any = await new Promise((resolve) => {
        socket.emit(
          'room:create',
          {
            name: 'Public Sketch Room',
            visibility: 'public',
            settings: { maxPlayers: 5 },
          },
          (response: any) => resolve(response)
        );
      });

      expect(createRes.success).toBe(true);
      const publicCode = createRes.room.roomCode;

      const discoveryRes = await request(app).get('/api/rooms/public');
      expect(discoveryRes.status).toBe(200);
      const publicRoom = discoveryRes.body.rooms.find((r: any) => r.roomCode === publicCode);
      expect(publicRoom).toBeDefined();
      expect(publicRoom.name).toBe('Public Sketch Room');
      expect(publicRoom.maxPlayers).toBe(5);

      socket.disconnect();
    });
  });

  describe('Multiplayer Lobby, Presence & Readiness Flow', () => {
    let clientA: ClientSocketType;
    let clientB: ClientSocketType;
    let roomCode = '';

    beforeAll(async () => {
      clientA = await createClientSocket(tokenA);
      clientB = await createClientSocket(tokenB);
    });

    afterAll(() => {
      clientA.disconnect();
      clientB.disconnect();
    });

    it('User A creates room and User B joins in real time', async () => {
      // User A creates room
      const createRes: any = await new Promise((resolve) => {
        clientA.emit(
          'room:create',
          {
            name: 'Lobby Test Room',
            visibility: 'public',
            settings: { maxPlayers: 2, rounds: 3 },
          },
          (res: any) => resolve(res)
        );
      });

      expect(createRes.success).toBe(true);
      roomCode = createRes.room.roomCode;

      // User A listens for player join notification
      const playerJoinPromise = new Promise((resolve) => {
        clientA.once('room:player_joined', (data) => resolve(data));
      });

      // User B joins room
      const joinRes: any = await new Promise((resolve) => {
        clientB.emit('room:join', { roomCode }, (res: any) => resolve(res));
      });

      expect(joinRes.success).toBe(true);
      expect(joinRes.room.players).toHaveLength(2);

      const joinEvent: any = await playerJoinPromise;
      expect(joinEvent.user.displayName).toBe('Bob Guesser');
    });

    it('enforces room capacity (rejects User C when room is full at 2 players)', async () => {
      const clientC = await createClientSocket(tokenC);

      const joinRes: any = await new Promise((resolve) => {
        clientC.emit('room:join', { roomCode }, (res: any) => resolve(res));
      });

      expect(joinRes.success).toBe(false);
      expect(joinRes.error).toMatch(/room is full/i);

      clientC.disconnect();
    });

    it('synchronizes ready status between players', async () => {
      const readyUpdatePromise = new Promise((resolve) => {
        clientA.once('room:player_ready', (data) => resolve(data));
      });

      // User B toggles ready
      const readyRes: any = await new Promise((resolve) => {
        clientB.emit('room:ready', { roomCode, isReady: true }, (res: any) => resolve(res));
      });

      expect(readyRes.success).toBe(true);
      expect(readyRes.isReady).toBe(true);

      const broadcastData: any = await readyUpdatePromise;
      expect(broadcastData.userId).toBe(userB._id.toString());
      expect(broadcastData.isReady).toBe(true);
    });

    it('rejects non-host attempts to update settings', async () => {
      const updateRes: any = await new Promise((resolve) => {
        clientB.emit(
          'room:update_settings',
          { roomCode, settings: { rounds: 5 } },
          (res: any) => resolve(res)
        );
      });

      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toMatch(/unauthorized/i);
    });

    it('allows host to update settings and broadcasts to all participants', async () => {
      const settingsBroadcastPromise = new Promise((resolve) => {
        clientB.once('room:settings_updated', (data) => resolve(data));
      });

      const updateRes: any = await new Promise((resolve) => {
        clientA.emit(
          'room:update_settings',
          { roomCode, settings: { rounds: 5, drawTimeSeconds: 60 } },
          (res: any) => resolve(res)
        );
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.settings.rounds).toBe(5);

      const broadcast: any = await settingsBroadcastPromise;
      expect(broadcast.settings.rounds).toBe(5);
      expect(broadcast.settings.drawTimeSeconds).toBe(60);
    });

    it('validates start request when all connected players are ready', async () => {
      const startRes: any = await new Promise((resolve) => {
        clientA.emit('room:start_request', { roomCode }, (res: any) => resolve(res));
      });

      expect(startRes.success).toBe(true);
      expect(startRes.canStart).toBe(true);
    });

    it('transfers host ownership when host leaves room explicitly', async () => {
      const hostTransferPromise = new Promise((resolve) => {
        clientB.once('room:player_left', (data) => resolve(data));
      });

      const leaveRes: any = await new Promise((resolve) => {
        clientA.emit('room:leave', { roomCode }, (res: any) => resolve(res));
      });

      expect(leaveRes.success).toBe(true);

      const leaveEvent: any = await hostTransferPromise;
      expect(leaveEvent.userId).toBe(userA._id.toString());
      expect(leaveEvent.newHostId).toBe(userB._id.toString());
    });
  });
});
