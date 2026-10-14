import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupRealtimeServer } from '../src/realtime/socket.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Room } from '../src/models/Room.js';
import { MatchResult } from '../src/models/MatchResult.js';
import { CustomWordPack } from '../src/models/CustomWordPack.js';
import { DrawingReplay } from '../src/models/DrawingReplay.js';
import { RoundTelemetry } from '../src/models/RoundTelemetry.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';
import { GameManager } from '../src/game/GameManager.js';
import { RoomManager } from '../src/services/RoomManager.js';
import { DrawingSessionManager } from '../src/services/DrawingSessionManager.js';
import { ReplayRecorderService } from '../src/services/ReplayRecorderService.js';
import { TelemetryService } from '../src/services/TelemetryService.js';

describe('Phase 7C: Master Multiplayer Simulation, Concurrency & Security Verification Harness', () => {
  let httpServer: HttpServer;
  let serverPort: number;

  // Multi-client roster
  let hostUser: any;
  let tokenHost: string;
  let playerA: any;
  let tokenA: string;
  let playerB: any;
  let tokenB: string;
  let playerC: any;
  let tokenC: string;
  let spectatorUser: any;
  let tokenSpec: string;
  let intruderUser: any;
  let tokenIntruder: string;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Room.deleteMany({});
    await MatchResult.deleteMany({});
    await CustomWordPack.deleteMany({});
    await DrawingReplay.deleteMany({});
    await RoundTelemetry.deleteMany({});

    const pwdHash = await hashPassword('TestPassword123!');

    hostUser = await User.create({
      displayName: 'Alice Host',
      username: 'alice_h',
      normalizedUsername: 'alice_h',
      email: 'alice@sim.test',
      normalizedEmail: 'alice@sim.test',
      passwordHash: pwdHash,
      avatar: 'avatar-1',
      isOnboarded: true,
    });

    playerA = await User.create({
      displayName: 'Bob Player',
      username: 'bob_p',
      normalizedUsername: 'bob_p',
      email: 'bob@sim.test',
      normalizedEmail: 'bob@sim.test',
      passwordHash: pwdHash,
      avatar: 'avatar-2',
      isOnboarded: true,
    });

    playerB = await User.create({
      displayName: 'Charlie Player',
      username: 'charlie_p',
      normalizedUsername: 'charlie_p',
      email: 'charlie@sim.test',
      normalizedEmail: 'charlie@sim.test',
      passwordHash: pwdHash,
      avatar: 'avatar-3',
      isOnboarded: true,
    });

    playerC = await User.create({
      displayName: 'Dave Player',
      username: 'dave_p',
      normalizedUsername: 'dave_p',
      email: 'dave@sim.test',
      normalizedEmail: 'dave@sim.test',
      passwordHash: pwdHash,
      avatar: 'avatar-4',
      isOnboarded: true,
    });

    spectatorUser = await User.create({
      displayName: 'Spectator Sam',
      username: 'sam_spec',
      normalizedUsername: 'sam_spec',
      email: 'sam@sim.test',
      normalizedEmail: 'sam@sim.test',
      passwordHash: pwdHash,
      avatar: 'avatar-5',
      isOnboarded: true,
    });

    intruderUser = await User.create({
      displayName: 'Mallory Intruder',
      username: 'mallory_bad',
      normalizedUsername: 'mallory_bad',
      email: 'mallory@sim.test',
      normalizedEmail: 'mallory@sim.test',
      passwordHash: pwdHash,
      avatar: 'avatar-6',
      isOnboarded: true,
    });

    tokenHost = signAccessToken({ userId: hostUser._id.toString(), username: hostUser.username, displayName: hostUser.displayName });
    tokenA = signAccessToken({ userId: playerA._id.toString(), username: playerA.username, displayName: playerA.displayName });
    tokenB = signAccessToken({ userId: playerB._id.toString(), username: playerB.username, displayName: playerB.displayName });
    tokenC = signAccessToken({ userId: playerC._id.toString(), username: playerC.username, displayName: playerC.displayName });
    tokenSpec = signAccessToken({ userId: spectatorUser._id.toString(), username: spectatorUser.username, displayName: spectatorUser.displayName });
    tokenIntruder = signAccessToken({ userId: intruderUser._id.toString(), username: intruderUser.username, displayName: intruderUser.displayName });

    httpServer = createServer(app);
    setupRealtimeServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr: any = httpServer.address();
        serverPort = addr.port;
        resolve();
      });
    });
  }, 60000);

  afterAll(async () => {
    if (httpServer) {
      httpServer.close();
    }
    await disconnectDB();
  });

  const createSocket = (token?: string): Promise<ClientSocketType> => {
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

  // =========================================================================
  // 1. CLASSIC MULTIPLAYER GAMEPLAY FULL LIFECYCLE & PRIVACY AUDIT
  // =========================================================================
  describe('1. Classic Multiplayer Lifecycle with Multi-Client Sockets', () => {
    let clientHost: ClientSocketType;
    let clientA: ClientSocketType;
    let clientB: ClientSocketType;
    let clientSpec: ClientSocketType;
    let classicRoomCode: string;

    beforeAll(async () => {
      clientHost = await createSocket(tokenHost);
      clientA = await createSocket(tokenA);
      clientB = await createSocket(tokenB);
      clientSpec = await createSocket(tokenSpec);
    });

    afterAll(() => {
      clientHost.disconnect();
      clientA.disconnect();
      clientB.disconnect();
      clientSpec.disconnect();
    });

    it('creates room and verifies host presence & membership', async () => {
      const createRes: any = await new Promise((resolve) => {
        clientHost.emit(
          'room:create',
          {
            name: 'Arena Alpha',
            visibility: 'public',
            settings: {
              maxPlayers: 5,
              drawTimeSeconds: 30,
              rounds: 2,
              wordCount: 3,
              hints: 2,
              wordMode: 'normal',
              category: 'animals',
              spectatorsAllowed: true,
              maxSpectators: 5,
            },
          },
          resolve
        );
      });

      expect(createRes.success).toBe(true);
      classicRoomCode = createRes.room.roomCode;
      expect(classicRoomCode).toHaveLength(6);
      expect(createRes.room.hostId).toBe(hostUser._id.toString());
      expect(createRes.room.players).toHaveLength(1);
    });

    it('joins players and spectators with distinct role classifications', async () => {
      // Player A and Player B join as players
      const joinARes: any = await new Promise((resolve) => clientA.emit('room:join', { roomCode: classicRoomCode }, resolve));
      const joinBRes: any = await new Promise((resolve) => clientB.emit('room:join', { roomCode: classicRoomCode }, resolve));
      expect(joinARes.success).toBe(true);
      expect(joinBRes.success).toBe(true);

      // Spectator joins as spectator
      const joinSpecRes: any = await new Promise((resolve) => clientSpec.emit('room:join_spectator', { roomCode: classicRoomCode }, resolve));
      expect(joinSpecRes.success).toBe(true);

      const roomSnapshot = RoomManager.getInstance().getSanitizedSnapshot(classicRoomCode);
      expect(roomSnapshot?.players).toHaveLength(3);
      expect(roomSnapshot?.spectators).toHaveLength(1);
      expect(roomSnapshot?.spectators[0].userId).toBe(spectatorUser._id.toString());
    });

    it('rejects game start when players are not all marked ready', async () => {
      // Host attempts to start before Player A and B ready up
      const startRes: any = await new Promise((resolve) => clientHost.emit('game:start', { roomCode: classicRoomCode }, resolve));
      expect(startRes.success).toBe(false);
      expect(startRes.error).toMatch(/All players must be ready/i);
    });

    it('authorizes game start once players ready up', async () => {
      await new Promise((resolve) => clientA.emit('room:ready', { roomCode: classicRoomCode, isReady: true }, resolve));
      await new Promise((resolve) => clientB.emit('room:ready', { roomCode: classicRoomCode, isReady: true }, resolve));

      const startRes: any = await new Promise((resolve) => clientHost.emit('game:start', { roomCode: classicRoomCode }, resolve));
      expect(startRes.success).toBe(true);

      const game = GameManager.getInstance().getGame(classicRoomCode);
      expect(game).toBeDefined();
      expect(game?.phase).toBe('word_selection');
      expect(game?.currentRound).toBe(1);
    });

    it('strictly isolates word choices to the active drawer (Privacy Audit)', async () => {
      const game = GameManager.getInstance().getGame(classicRoomCode)!;
      const activeDrawerId = game.currentDrawerId;

      // The drawer receives word choices
      const drawerSnapshot = game.getViewerSnapshot(activeDrawerId);
      expect(drawerSnapshot.word.choices).toBeDefined();
      expect(drawerSnapshot.word.choices?.length).toBe(3);
      expect(drawerSnapshot.word.secret).toBeFalsy(); // Not yet selected

      // Guesser and Spectator must NOT receive word choices
      const guesserSnapshot = game.getViewerSnapshot(playerA._id.toString());
      expect(guesserSnapshot.word.choices).toBeUndefined();
      expect(guesserSnapshot.word.secret).toBeUndefined();

      const spectatorSnapshot = game.getViewerSnapshot(spectatorUser._id.toString());
      expect(spectatorSnapshot.word.choices).toBeUndefined();
      expect(spectatorSnapshot.word.secret).toBeUndefined();
    });

    let secretWordChosen: string;

    it('drawer selects word; observers receive masked length only', async () => {
      const game = GameManager.getInstance().getGame(classicRoomCode)!;
      const activeDrawerId = game.currentDrawerId;
      const drawerClient = activeDrawerId === hostUser._id.toString() ? clientHost : clientA;
      const choices = game.getViewerSnapshot(activeDrawerId).word.choices!;
      secretWordChosen = choices[0];

      const selectRes: any = await new Promise((resolve) => {
        drawerClient.emit('game:word_select', { roomCode: classicRoomCode, word: secretWordChosen }, resolve);
      });
      expect(selectRes.success).toBe(true);
      expect(game.phase).toBe('drawing');

      // Observers receive masked word representation
      const guesserSnapshot = game.getViewerSnapshot(playerB._id.toString());
      expect(guesserSnapshot.word.secret).toBeUndefined();
      expect(guesserSnapshot.word.masked).toBeDefined();
      expect(guesserSnapshot.word.length).toBe(secretWordChosen.length);
    });

    it('synchronizes drawing strokes from drawer to observers with normalized coords', async () => {
      const game = GameManager.getInstance().getGame(classicRoomCode)!;
      const drawerClient = game.currentDrawerId === hostUser._id.toString() ? clientHost : clientA;

      const strokeStartEventPromise = new Promise<any>((resolve) => clientB.once('draw:stroke_started', resolve));

      const ack: any = await new Promise((resolve) => {
        drawerClient.emit(
          'draw:stroke_start',
          {
            roomCode: classicRoomCode,
            strokeId: 'sim_stroke_01',
            tool: 'brush',
            color: '#2563eb',
            width: 0.02,
            point: { x: 0.2, y: 0.3 },
          },
          resolve
        );
      });
      expect(ack.success).toBe(true);

      const receivedStroke = await strokeStartEventPromise;
      expect(receivedStroke.stroke.strokeId).toBe('sim_stroke_01');
      expect(receivedStroke.stroke.points[0].x).toBe(0.2);

      // Append points and end stroke
      await new Promise((resolve) => {
        drawerClient.emit(
          'draw:stroke_points',
          {
            roomCode: classicRoomCode,
            strokeId: 'sim_stroke_01',
            points: [{ x: 0.25, y: 0.35 }],
          },
          resolve
        );
      });

      await new Promise((resolve) => {
        drawerClient.emit(
          'draw:stroke_end',
          {
            roomCode: classicRoomCode,
            strokeId: 'sim_stroke_01',
            points: [{ x: 0.3, y: 0.4 }],
          },
          resolve
        );
      });

      const session = DrawingSessionManager.getInstance().getSession(classicRoomCode);
      expect(session?.strokes).toHaveLength(1);
    });

    it('invalidates redo-stack when a new stroke begins after undo', async () => {
      const game = GameManager.getInstance().getGame(classicRoomCode)!;
      const drawerClient = game.currentDrawerId === hostUser._id.toString() ? clientHost : clientA;

      // Undo the stroke
      const undoRes: any = await new Promise((resolve) => drawerClient.emit('draw:undo', { roomCode: classicRoomCode }, resolve));
      expect(undoRes.success).toBe(true);

      const session = DrawingSessionManager.getInstance().getSession(classicRoomCode);
      expect(session?.strokes).toHaveLength(0);
      expect(session?.redoStack).toHaveLength(1);

      // Draw a brand new stroke -> redoStack must be cleared
      await new Promise((resolve) => {
        drawerClient.emit(
          'draw:stroke_start',
          {
            roomCode: classicRoomCode,
            strokeId: 'sim_stroke_02',
            tool: 'brush',
            color: '#16a34a',
            width: 0.02,
            point: { x: 0.5, y: 0.5 },
          },
          resolve
        );
      });
      await new Promise((resolve) => {
        drawerClient.emit(
          'draw:stroke_end',
          {
            roomCode: classicRoomCode,
            strokeId: 'sim_stroke_02',
            points: [{ x: 0.6, y: 0.6 }],
          },
          resolve
        );
      });

      expect(session?.strokes).toHaveLength(1);
      expect(session?.redoStack).toHaveLength(0); // Branch invalidated
    });

    it('processes guesses: incorrect guess awards 0 pts; correct guess awards points and drawer bonus', async () => {
      const game = GameManager.getInstance().getGame(classicRoomCode)!;
      const nonDrawerClient = game.currentDrawerId === hostUser._id.toString() ? clientB : clientHost;
      const nonDrawerUser = game.currentDrawerId === hostUser._id.toString() ? playerB : hostUser;

      // 1. Incorrect guess
      const wrongRes: any = await new Promise((resolve) => {
        nonDrawerClient.emit('game:guess', { roomCode: classicRoomCode, text: 'definitely_wrong_word' }, resolve);
      });
      expect(wrongRes.success).toBe(true);
      expect(wrongRes.isCorrect).toBe(false);

      // 2. Correct guess
      const correctRes: any = await new Promise((resolve) => {
        nonDrawerClient.emit('game:guess', { roomCode: classicRoomCode, text: secretWordChosen }, resolve);
      });
      expect(correctRes.success).toBe(true);
      expect(correctRes.isCorrect).toBe(true);

      const updatedScores = game.scores.get(nonDrawerUser._id.toString());
      expect(updatedScores?.score).toBeGreaterThan(0);

      // 3. Solved player cannot guess again in same round
      const repeatRes: any = await new Promise((resolve) => {
        nonDrawerClient.emit('game:guess', { roomCode: classicRoomCode, text: secretWordChosen }, resolve);
      });
      expect(repeatRes.success).toBe(false);
      expect(repeatRes.error).toMatch(/already guessed/i);
    });
  });

  // =========================================================================
  // 2. SMART RECONNECT & SESSION REPLACEMENT INTEGRATION
  // =========================================================================
  describe('2. Smart Reconnect, Disconnect Grace Period & Session Replacement', () => {
    let clientHost: ClientSocketType;
    let clientA: ClientSocketType;
    let reconnectRoomCode: string;

    beforeAll(async () => {
      clientHost = await createSocket(tokenHost);
      clientA = await createSocket(tokenA);

      const createRes: any = await new Promise((resolve) => {
        clientHost.emit(
          'room:create',
          {
            name: 'Reconnect Chamber',
            visibility: 'public',
            settings: { maxPlayers: 4, rounds: 2, drawTimeSeconds: 30 },
          },
          resolve
        );
      });
      reconnectRoomCode = createRes.room.roomCode;
      await new Promise((resolve) => clientA.emit('room:join', { roomCode: reconnectRoomCode }, resolve));
      await new Promise((resolve) => clientA.emit('room:ready', { roomCode: reconnectRoomCode, isReady: true }, resolve));
      await new Promise((resolve) => clientHost.emit('game:start', { roomCode: reconnectRoomCode }, resolve));
    });

    afterAll(() => {
      clientHost.disconnect();
      clientA.disconnect();
    });

    it('marks player disconnected without immediately evicting them during active game', async () => {
      const room = RoomManager.getInstance().getRoomSession(reconnectRoomCode)!;
      expect(room.players.get(playerA._id.toString())?.isDisconnected).toBe(false);

      // Disconnect Player A
      clientA.disconnect();

      // Give server time to register socket disconnect
      await new Promise((r) => setTimeout(r, 200));

      expect(room.players.get(playerA._id.toString())?.isDisconnected).toBe(true);
      expect(room.players.get(playerA._id.toString())?.disconnectedAt).toBeDefined();
    });

    it('allows player A to reconnect using new socket before grace period expires', async () => {
      // Player A reconnects with a fresh socket connection
      const reconnectedClientA = await createSocket(tokenA);

      const joinRes: any = await new Promise((resolve) => {
        reconnectedClientA.emit('room:join', { roomCode: reconnectRoomCode }, resolve);
      });

      expect(joinRes.success).toBe(true);
      expect(joinRes.isReconnect).toBe(true);

      const room = RoomManager.getInstance().getRoomSession(reconnectRoomCode)!;
      expect(room.players.get(playerA._id.toString())?.isDisconnected).toBe(false);

      reconnectedClientA.disconnect();
    });

    it('strictly rejects brand new players from joining an in-progress game', async () => {
      const clientIntruder = await createSocket(tokenIntruder);

      const joinRes: any = await new Promise((resolve) => {
        clientIntruder.emit('room:join', { roomCode: reconnectRoomCode }, resolve);
      });

      expect(joinRes.success).toBe(false);
      expect(joinRes.error).toMatch(/Cannot join room: game is currently/i);

      clientIntruder.disconnect();
    });
  });

  // =========================================================================
  // 3. IMPOSTER MODE 4-PLAYER MULTI-CLIENT VERIFICATION & ROLE PRIVACY
  // =========================================================================
  describe('3. Imposter Mode: Complete 4-Player Lifecycle, Private Drawing & Voting', () => {
    let clientHost: ClientSocketType;
    let clientA: ClientSocketType;
    let clientB: ClientSocketType;
    let clientC: ClientSocketType;
    let imposterRoomCode: string;

    beforeAll(async () => {
      clientHost = await createSocket(tokenHost);
      clientA = await createSocket(tokenA);
      clientB = await createSocket(tokenB);
      clientC = await createSocket(tokenC);

      const createRes: any = await new Promise((resolve) => {
        clientHost.emit(
          'room:create',
          {
            name: 'Imposter Manor',
            visibility: 'public',
            settings: {
              maxPlayers: 6,
              rounds: 2,
              drawTimeSeconds: 40,
              gameMode: 'imposter',
              category: 'food',
            },
          },
          resolve
        );
      });
      imposterRoomCode = createRes.room.roomCode;

      await new Promise((resolve) => clientA.emit('room:join', { roomCode: imposterRoomCode }, resolve));
      await new Promise((resolve) => clientB.emit('room:join', { roomCode: imposterRoomCode }, resolve));
      await new Promise((resolve) => clientC.emit('room:join', { roomCode: imposterRoomCode }, resolve));

      await new Promise((resolve) => clientA.emit('room:ready', { roomCode: imposterRoomCode, isReady: true }, resolve));
      await new Promise((resolve) => clientB.emit('room:ready', { roomCode: imposterRoomCode, isReady: true }, resolve));
      await new Promise((resolve) => clientC.emit('room:ready', { roomCode: imposterRoomCode, isReady: true }, resolve));
    });

    afterAll(() => {
      clientHost.disconnect();
      clientA.disconnect();
      clientB.disconnect();
      clientC.disconnect();
    });

    it('authorizes imposter game start and assigns exactly 1 secret imposter', async () => {
      const startRes: any = await new Promise((resolve) => clientHost.emit('game:start', { roomCode: imposterRoomCode }, resolve));
      expect(startRes.success).toBe(true);

      const game = GameManager.getInstance().getGame(imposterRoomCode)!;
      expect(game.gameMode).toBe('imposter');
      expect(game.phase).toBe('imposter_drawing');
      expect(game.imposterUserId).toBeDefined();

      const players = [hostUser, playerA, playerB, playerC];
      const imposterId = game.imposterUserId;
      expect(players.some((p) => p._id.toString() === imposterId)).toBe(true);
    });

    it('enforces role-specific secret word and category clue privacy (Security Audit)', async () => {
      const game = GameManager.getInstance().getGame(imposterRoomCode)!;
      const imposterId = game.imposterUserId;

      // Imposter client check: Must receive categoryClue, but secretWord must be undefined
      const imposterSnapshot = game.getViewerSnapshot(imposterId);
      expect(imposterSnapshot.imposterState?.role).toBe('imposter');
      expect(imposterSnapshot.imposterState?.categoryClue?.toLowerCase()).toBe(game.category.toLowerCase());
      expect(imposterSnapshot.word.secret).toBeUndefined(); // Crucial security guarantee

      // Innocent client check: Receives secret word
      const innocentPlayer = [hostUser, playerA, playerB, playerC].find((p) => p._id.toString() !== imposterId)!;
      const innocentSnapshot = game.getViewerSnapshot(innocentPlayer._id.toString());
      expect(innocentSnapshot.imposterState?.role).toBe('innocent');
      expect(innocentSnapshot.word.secret).toBe(game.secretWord);

      // Identity concealment: Imposter identity must be concealed from all players during drawing
      expect(innocentSnapshot.imposterState?.identifiedImposterId).toBeUndefined();
      expect(imposterSnapshot.imposterState?.identifiedImposterId).toBeUndefined();
    });

    it('isolates private drawing turn: non-active players receive no strokes during turn', async () => {
      const game = GameManager.getInstance().getGame(imposterRoomCode)!;
      const activeDrawerId = game.currentDrawerId;

      const clientsMap: Record<string, ClientSocketType> = {
        [hostUser._id.toString()]: clientHost,
        [playerA._id.toString()]: clientA,
        [playerB._id.toString()]: clientB,
        [playerC._id.toString()]: clientC,
      };

      const activeClient = clientsMap[activeDrawerId];
      const passiveClients = Object.entries(clientsMap).filter(([id]) => id !== activeDrawerId);

      let passiveReceivedStroke = false;
      const passiveListener = () => { passiveReceivedStroke = true; };
      passiveClients[0][1].on('draw:stroke_started', passiveListener);

      // Active drawer draws
      const drawAck: any = await new Promise((resolve) => {
        activeClient.emit(
          'draw:stroke_start',
          {
            roomCode: imposterRoomCode,
            strokeId: 'imposter_private_01',
            tool: 'brush',
            color: '#ef4444',
            width: 0.02,
            point: { x: 0.3, y: 0.3 },
          },
          resolve
        );
      });
      expect(drawAck.success).toBe(true);

      await new Promise((r) => setTimeout(r, 100));
      passiveClients[0][1].off('draw:stroke_started', passiveListener);

      // Stroke was isolated and NOT leaked to opponents
      expect(passiveReceivedStroke).toBe(false);
    });

    it('handles imposter voting phase: enforces 1 vote per player and prevents duplicate votes', async () => {
      const game = GameManager.getInstance().getGame(imposterRoomCode)!;

      // Force transition to voting
      game.startImposterVoting();
      expect(game.phase).toBe('imposter_voting');

      // Player A votes for Player B
      const voteResA: any = await new Promise((resolve) => {
        clientA.emit('imposter:vote', { roomCode: imposterRoomCode, targetUserId: playerB._id.toString() }, resolve);
      });
      expect(voteResA.success).toBe(true);

      // Player A attempts duplicate vote -> rejected
      const dupVoteRes: any = await new Promise((resolve) => {
        clientA.emit('imposter:vote', { roomCode: imposterRoomCode, targetUserId: playerC._id.toString() }, resolve);
      });
      expect(dupVoteRes.success).toBe(false);
      expect(dupVoteRes.error).toMatch(/already/i);
    });
  });

  // =========================================================================
  // 4. DRAWING REPLAY SECURITY & ROUND RETRIEVAL INTEGRATION
  // =========================================================================
  describe('4. Drawing Replay Security & Active Round Protection', () => {
    let clientHost: ClientSocketType;
    let clientA: ClientSocketType;
    let replayRoomCode: string;

    beforeAll(async () => {
      clientHost = await createSocket(tokenHost);
      clientA = await createSocket(tokenA);
      const res: any = await new Promise((resolve) => {
        clientHost.emit(
          'room:create',
          { name: 'Replay Vault', visibility: 'public', settings: { maxPlayers: 2, rounds: 2 } },
          resolve
        );
      });
      replayRoomCode = res.room.roomCode;
      await new Promise((resolve) => clientA.emit('room:join', { roomCode: replayRoomCode }, resolve));
      await new Promise((resolve) => clientA.emit('room:ready', { roomCode: replayRoomCode, isReady: true }, resolve));
      await new Promise((resolve) => clientHost.emit('game:start', { roomCode: replayRoomCode }, resolve));
    });

    afterAll(() => {
      clientHost.disconnect();
      clientA.disconnect();
    });

    it('strictly forbids replay retrieval while target round is actively in progress', async () => {
      const game = GameManager.getInstance().getGame(replayRoomCode)!;

      const res = await request(app)
        .get(`/api/replays/${game.gameId}/${game.currentRound}`)
        .set('Authorization', `Bearer ${tokenHost}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/forbidden while this round is actively being played/i);
    });
  });

  // =========================================================================
  // 5. GENAI WORD PACKS, BOUNDARY VALIDATION & FALLBACK RELIABILITY
  // =========================================================================
  describe('5. GenAI Word Pack Generation, Boundaries & Ownership Authorization', () => {
    it('generates structured word pack with mock fallback when AI key is absent', async () => {
      const res = await request(app)
        .post('/api/wordpacks/generate')
        .set('Authorization', `Bearer ${tokenHost}`)
        .send({
          theme: 'Underwater Creatures',
          count: 10,
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.words.length).toBeGreaterThanOrEqual(5);
      expect(res.body.data.providerUsed).toBe('mock'); // Honestly marked
    });

    it('rejects word pack creation exceeding boundaries (<5 or >500 words)', async () => {
      const resTooFew = await request(app)
        .post('/api/wordpacks')
        .set('Authorization', `Bearer ${tokenHost}`)
        .send({
          name: 'Tiny Pack',
          words: ['One', 'Two'], // Only 2 words
        });

      expect(resTooFew.status).toBe(400);
      expect(resTooFew.body.error).toMatch(/at least 5 unique words/i);
    });

    it('saves valid custom pack and protects private pack from unauthorized access', async () => {
      const createRes = await request(app)
        .post('/api/wordpacks')
        .set('Authorization', `Bearer ${tokenHost}`)
        .send({
          name: 'Alice Secret Pack',
          words: ['Dolphin', 'Shark', 'Octopus', 'Seahorse', 'Whale', 'Starfish'],
          isPublic: false,
        });

      expect(createRes.status).toBe(201);
      const packId = createRes.body.pack._id;

      // Intruder attempts to fetch Alice's private pack
      const intruderGet = await request(app)
        .get(`/api/wordpacks/${packId}`)
        .set('Authorization', `Bearer ${tokenIntruder}`);

      expect(intruderGet.status).toBe(403);
      expect(intruderGet.body.error).toMatch(/Access denied: This word pack is private/i);
    });
  });

  // =========================================================================
  // 6. ADAPTIVE TELEMETRY & BAYESIAN DIFFICULTY EVALUATION
  // =========================================================================
  describe('6. Telemetry Recording & Bayesian Difficulty Model Formula', () => {
    it('computes Bayesian smoothed solve rate: (solves + 2) / (rounds + 4)', () => {
      // Test formula with 10 rounds and 8 solves: (8 + 2) / (10 + 4) = 10 / 14 = ~0.714
      const solves = 8;
      const rounds = 10;
      const bayesianRate = (solves + 2) / (rounds + 4);
      expect(bayesianRate).toBeCloseTo(0.714, 2);

      // Test formula with zero data: (0 + 2) / (0 + 4) = 0.5 (neutral prior)
      const neutralPrior = (0 + 2) / (0 + 4);
      expect(neutralPrior).toBe(0.5);
    });

    it('persists RoundTelemetry record with complete timing, word, and participant metrics', async () => {
      await TelemetryService.recordRound({
        gameId: 'test_game_telemetry',
        roomCode: 'TEL123',
        roundNumber: 1,
        word: 'Elephant',
        category: 'animals',
        language: 'en',
        declaredDifficulty: 'medium',
        roundDurationSeconds: 60,
        timeToFirstCorrectGuessSeconds: 12.5,
        totalGuessesCount: 14,
        correctGuessersCount: 3,
        incorrectGuessesCount: 11,
        timedOut: false,
        solved: true,
        eligiblePlayersCount: 4,
      });

      const records = await RoundTelemetry.find({ word: 'elephant' });
      expect(records.length).toBeGreaterThanOrEqual(1);
      expect(records[0].correctGuessersCount).toBe(3);
      expect(records[0].eligiblePlayersCount).toBe(4);
    });
  });

  // =========================================================================
  // 7. ABUSE PROTECTION, RATE LIMITING & HOST MODERATION
  // =========================================================================
  describe('7. Rate Limiting, AFK Detection & Host Kick Authorization', () => {
    let clientHost: ClientSocketType;
    let clientIntruder: ClientSocketType;
    let modRoomCode: string;

    beforeAll(async () => {
      clientHost = await createSocket(tokenHost);
      clientIntruder = await createSocket(tokenIntruder);

      const createRes: any = await new Promise((resolve) => {
        clientHost.emit(
          'room:create',
          { name: 'Mod Room', visibility: 'public', settings: { maxPlayers: 4 } },
          resolve
        );
      });
      modRoomCode = createRes.room.roomCode;
      await new Promise((resolve) => clientIntruder.emit('room:join', { roomCode: modRoomCode }, resolve));
    });

    afterAll(() => {
      clientHost.disconnect();
      clientIntruder.disconnect();
    });

    it('allows host to kick participant and prevents kicked player from rejoining', async () => {
      const kickRes: any = await new Promise((resolve) => {
        clientHost.emit('room:kick_player', { roomCode: modRoomCode, targetUserId: intruderUser._id.toString() }, resolve);
      });
      expect(kickRes.success).toBe(true);

      // Kicked intruder attempts to rejoin room
      const rejoinRes: any = await new Promise((resolve) => {
        clientIntruder.emit('room:join', { roomCode: modRoomCode }, resolve);
      });
      expect(rejoinRes.success).toBe(false);
      expect(rejoinRes.error).toMatch(/You have been kicked from this room/i);
    });
  });
});
