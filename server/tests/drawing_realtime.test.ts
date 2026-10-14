import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/app.js';
import { setupRealtimeServer } from '../src/realtime/socket.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Room } from '../src/models/Room.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';
import { DrawingSessionManager } from '../src/services/DrawingSessionManager.js';

describe('Phase 3 - Real-Time Drawing Canvas & Synchronization Engine', () => {
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

    const pwdHash = await hashPassword('Password123!');

    userA = await User.create({
      displayName: 'Picasso Artist',
      username: 'picasso_art',
      normalizedUsername: 'picasso_art',
      email: 'picasso@example.com',
      normalizedEmail: 'picasso@example.com',
      passwordHash: pwdHash,
      avatar: 'avatar-1',
      isOnboarded: true,
    });

    userB = await User.create({
      displayName: 'Observer DaVinci',
      username: 'davinci_watch',
      normalizedUsername: 'davinci_watch',
      email: 'davinci@example.com',
      normalizedEmail: 'davinci@example.com',
      passwordHash: pwdHash,
      avatar: 'avatar-2',
      isOnboarded: true,
    });

    userC = await User.create({
      displayName: 'Late Joiner Monet',
      username: 'monet_late',
      normalizedUsername: 'monet_late',
      email: 'monet@example.com',
      normalizedEmail: 'monet@example.com',
      passwordHash: pwdHash,
      avatar: 'avatar-3',
      isOnboarded: true,
    });

    tokenA = signAccessToken({ userId: userA._id.toString(), username: userA.username, email: userA.email });
    tokenB = signAccessToken({ userId: userB._id.toString(), username: userB.username, email: userB.email });
    tokenC = signAccessToken({ userId: userC._id.toString(), username: userC.username, email: userC.email });

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

  describe('DrawingSessionManager Service Unit Logic', () => {
    const drawingManager = DrawingSessionManager.getInstance();
    const testCode = 'TEST01';
    const artistId = 'artist_123';

    it('initializes a session and assigns an active drawer', () => {
      const session = drawingManager.getOrCreateSession(testCode, artistId);
      expect(session).toBeDefined();
      expect(session.roomCode).toBe(testCode);
      expect(session.drawerId).toBe(artistId);
      expect(session.revision).toBe(0);
      expect(session.strokes).toHaveLength(0);
    });

    it('allows active drawer to start and end a stroke', () => {
      const startResult = drawingManager.startStroke(testCode, artistId, {
        strokeId: 'str_1',
        tool: 'brush',
        color: '#dc2626',
        width: 0.015,
        point: { x: 0.1, y: 0.2 },
      });
      expect(startResult.stroke.strokeId).toBe('str_1');

      drawingManager.appendPoints(testCode, artistId, 'str_1', [
        { x: 0.15, y: 0.25 },
        { x: 0.2, y: 0.3 },
      ]);

      const endResult = drawingManager.endStroke(testCode, artistId, 'str_1', [{ x: 0.25, y: 0.35 }]);
      expect(endResult.completedStroke.points).toHaveLength(4);
      expect(endResult.revision).toBe(1);

      const snapshot = drawingManager.getSnapshot(testCode);
      expect(snapshot?.strokes).toHaveLength(1);
    });

    it('rejects stroke modifications from non-drawers', () => {
      expect(() => {
        drawingManager.startStroke(testCode, 'imposter_user', {
          strokeId: 'str_bad',
          tool: 'brush',
          color: '#000',
          width: 0.01,
          point: { x: 0.5, y: 0.5 },
        });
      }).toThrow(/Unauthorized/);
    });

    it('allows active drawer to undo the last stroke', () => {
      const undoResult = drawingManager.undo(testCode, artistId);
      expect(undoResult.removedStrokeId).toBe('str_1');
      expect(undoResult.revision).toBe(2);

      const snapshot = drawingManager.getSnapshot(testCode);
      expect(snapshot?.strokes).toHaveLength(0);
    });

    it('throws error when attempting to undo on an empty canvas', () => {
      expect(() => {
        drawingManager.undo(testCode, artistId);
      }).toThrow(/Nothing to undo/);
    });

    it('clears canvas and increments revision', () => {
      drawingManager.startStroke(testCode, artistId, {
        strokeId: 'str_2',
        tool: 'brush',
        color: '#2563eb',
        width: 0.01,
        point: { x: 0.2, y: 0.2 },
      });
      drawingManager.endStroke(testCode, artistId, 'str_2');

      const clearResult = drawingManager.clear(testCode, artistId);
      expect(clearResult.revision).toBe(4);

      const snapshot = drawingManager.getSnapshot(testCode);
      expect(snapshot?.strokes).toHaveLength(0);
    });
  });

  describe('Multi-Client Real-Time Socket.IO Synchronization', () => {
    let clientA: ClientSocketType; // Host & Drawer
    let clientB: ClientSocketType; // Observer
    let roomCode: string;

    beforeAll(async () => {
      clientA = await createClientSocket(tokenA);
      clientB = await createClientSocket(tokenB);

      // Client A creates room
      await new Promise<void>((resolve) => {
        clientA.emit(
          'room:create',
          {
            name: 'Studio Test Room',
            visibility: 'public',
            settings: { maxPlayers: 8, rounds: 3, drawTimeSeconds: 80 },
          },
          (res: any) => {
            roomCode = res.room.roomCode;
            resolve();
          }
        );
      });

      // Client B joins room
      await new Promise<void>((resolve) => {
        clientB.emit('room:join', { roomCode }, () => {
          resolve();
        });
      });

      // Set Client A as authorized drawer
      await new Promise<void>((resolve) => {
        clientA.emit('draw:session_init', { roomCode, drawerId: userA._id.toString() }, () => {
          resolve();
        });
      });
    });

    afterAll(() => {
      clientA.disconnect();
      clientB.disconnect();
    });

    it('synchronizes stroke start from drawer to observer', async () => {
      const strokeStartPromise = new Promise<any>((resolve) => {
        clientB.once('draw:stroke_started', (data) => resolve(data));
      });

      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit(
          'draw:stroke_start',
          {
            roomCode,
            strokeId: 'stroke_multi_1',
            tool: 'brush',
            color: '#dc2626',
            width: 0.015,
            point: { x: 0.25, y: 0.35 },
          },
          (res: any) => resolve(res)
        );
      });

      const [ack, remoteBroadcast] = await Promise.all([ackPromise, strokeStartPromise]);
      expect(ack.success).toBe(true);
      expect(remoteBroadcast.stroke.strokeId).toBe('stroke_multi_1');
      expect(remoteBroadcast.stroke.color).toBe('#dc2626');
    });

    it('synchronizes batched point updates from drawer to observer', async () => {
      const updatePromise = new Promise<any>((resolve) => {
        clientB.once('draw:stroke_update', (data) => resolve(data));
      });

      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit(
          'draw:stroke_points',
          {
            roomCode,
            strokeId: 'stroke_multi_1',
            points: [
              { x: 0.28, y: 0.38 },
              { x: 0.32, y: 0.42 },
            ],
          },
          (res: any) => resolve(res)
        );
      });

      const [ack, remoteBroadcast] = await Promise.all([ackPromise, updatePromise]);
      expect(ack.success).toBe(true);
      expect(remoteBroadcast.points).toHaveLength(2);
    });

    it('synchronizes completed stroke to observer', async () => {
      const completePromise = new Promise<any>((resolve) => {
        clientB.once('draw:stroke_completed', (data) => resolve(data));
      });

      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit(
          'draw:stroke_end',
          {
            roomCode,
            strokeId: 'stroke_multi_1',
            points: [{ x: 0.35, y: 0.45 }],
          },
          (res: any) => resolve(res)
        );
      });

      const [ack, remoteBroadcast] = await Promise.all([ackPromise, completePromise]);
      expect(ack.success).toBe(true);
      expect(remoteBroadcast.completedStroke.points.length).toBeGreaterThanOrEqual(4);
    });

    it('rejects drawing operations from observer (Client B)', async () => {
      const ackPromise = new Promise<any>((resolve) => {
        clientB.emit(
          'draw:stroke_start',
          {
            roomCode,
            strokeId: 'stroke_unauth',
            tool: 'brush',
            color: '#000000',
            width: 0.015,
            point: { x: 0.5, y: 0.5 },
          },
          (res: any) => resolve(res)
        );
      });

      const ack = await ackPromise;
      expect(ack.success).toBe(false);
      expect(ack.error).toMatch(/Unauthorized/);
    });

    it('rejects invalid payload coordinates (NaN or out of bounds)', async () => {
      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit(
          'draw:stroke_start',
          {
            roomCode,
            strokeId: 'stroke_invalid',
            tool: 'brush',
            color: '#000000',
            width: 0.015,
            point: { x: 99.9, y: -5.0 }, // Out of bounds
          },
          (res: any) => resolve(res)
        );
      });

      const ack = await ackPromise;
      expect(ack.success).toBe(false);
    });

    it('synchronizes undo action across all clients', async () => {
      const undoPromiseB = new Promise<any>((resolve) => {
        clientB.once('draw:undo_applied', (data) => resolve(data));
      });

      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit('draw:undo', { roomCode }, (res: any) => resolve(res));
      });

      const [ack, broadcastB] = await Promise.all([ackPromise, undoPromiseB]);
      expect(ack.success).toBe(true);
      expect(ack.removedStrokeId).toBe('stroke_multi_1');
      expect(broadcastB.removedStrokeId).toBe('stroke_multi_1');
    });

    it('synchronizes clear canvas action across all clients', async () => {
      // First draw a new stroke
      await new Promise<void>((resolve) => {
        clientA.emit(
          'draw:stroke_start',
          {
            roomCode,
            strokeId: 'stroke_to_clear',
            tool: 'brush',
            color: '#000',
            width: 0.01,
            point: { x: 0.1, y: 0.1 },
          },
          () => resolve()
        );
      });
      await new Promise<void>((resolve) => {
        clientA.emit('draw:stroke_end', { roomCode, strokeId: 'stroke_to_clear' }, () => resolve());
      });

      const clearPromiseB = new Promise<any>((resolve) => {
        clientB.once('draw:canvas_cleared', (data) => resolve(data));
      });

      const ackPromise = new Promise<any>((resolve) => {
        clientA.emit('draw:clear', { roomCode }, (res: any) => resolve(res));
      });

      const [ack, broadcastB] = await Promise.all([ackPromise, clearPromiseB]);
      expect(ack.success).toBe(true);
      expect(broadcastB.revision).toBeDefined();
    });

    it('restores authoritative canvas snapshot for late joiner (Client C)', async () => {
      // Client A draws a stroke
      await new Promise<void>((resolve) => {
        clientA.emit(
          'draw:stroke_start',
          {
            roomCode,
            strokeId: 'stroke_for_late_joiner',
            tool: 'brush',
            color: '#16a34a',
            width: 0.015,
            point: { x: 0.4, y: 0.4 },
          },
          () => resolve()
        );
      });
      await new Promise<void>((resolve) => {
        clientA.emit(
          'draw:stroke_end',
          { roomCode, strokeId: 'stroke_for_late_joiner', points: [{ x: 0.5, y: 0.5 }] },
          () => resolve()
        );
      });

      // Client C connects and joins room
      const clientC = await createClientSocket(tokenC);
      await new Promise<void>((resolve) => {
        clientC.emit('room:join', { roomCode }, () => resolve());
      });

      // Client C requests state snapshot
      const snapshot: any = await new Promise((resolve) => {
        clientC.emit('draw:get_state', { roomCode }, (res: any) => resolve(res));
      });

      expect(snapshot.success).toBe(true);
      expect(snapshot.state.strokes.length).toBeGreaterThanOrEqual(1);
      const lastStroke = snapshot.state.strokes[snapshot.state.strokes.length - 1];
      expect(lastStroke.strokeId).toBe('stroke_for_late_joiner');
      expect(lastStroke.color).toBe('#16a34a');

      clientC.disconnect();
    });
  });
});
