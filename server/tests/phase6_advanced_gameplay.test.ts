import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import request from 'supertest';
import { app } from '../src/app.js';
import { setupRealtimeServer } from '../src/realtime/socket.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Room } from '../src/models/Room.js';
import { CustomWordPack } from '../src/models/CustomWordPack.js';
import { DrawingReplay } from '../src/models/DrawingReplay.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';
import { WordService } from '../src/game/WordService.js';
import { HintService } from '../src/game/HintService.js';
import { GameManager } from '../src/game/GameManager.js';
import { RoomManager } from '../src/services/RoomManager.js';
import { ReplayRecorderService } from '../src/services/ReplayRecorderService.js';

describe('Phase 6 — Advanced Multiplayer Gameplay, Spectators, Replay, Word Packs & Multilingual', () => {
  let httpServer: HttpServer;
  let serverPort: number;

  let playerA: any; // Host
  let tokenA: string;
  let playerB: any; // Guesser
  let tokenB: string;
  let spectatorUser: any; // Spectator
  let tokenSpec: string;
  let intruderUser: any;
  let tokenIntruder: string;

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({});
    await Room.deleteMany({});
    await CustomWordPack.deleteMany({});
    await DrawingReplay.deleteMany({});

    const pwdHash = await hashPassword('Secret123!');

    playerA = await User.create({
      displayName: 'Player One',
      username: 'player_one',
      normalizedUsername: 'player_one',
      email: 'p1@test.com',
      normalizedEmail: 'p1@test.com',
      passwordHash: pwdHash,
      avatar: 'avatar-1',
      isOnboarded: true,
    });

    playerB = await User.create({
      displayName: 'Player Two',
      username: 'player_two',
      normalizedUsername: 'player_two',
      email: 'p2@test.com',
      normalizedEmail: 'p2@test.com',
      passwordHash: pwdHash,
      avatar: 'avatar-2',
      isOnboarded: true,
    });

    spectatorUser = await User.create({
      displayName: 'Spectator Sam',
      username: 'spectator_sam',
      normalizedUsername: 'spectator_sam',
      email: 'spec@test.com',
      normalizedEmail: 'spec@test.com',
      passwordHash: pwdHash,
      avatar: 'avatar-3',
      isOnboarded: true,
    });

    intruderUser = await User.create({
      displayName: 'Intruder Ian',
      username: 'intruder_ian',
      normalizedUsername: 'intruder_ian',
      email: 'intruder@test.com',
      normalizedEmail: 'intruder@test.com',
      passwordHash: pwdHash,
      avatar: 'avatar-4',
      isOnboarded: true,
    });

    tokenA = signAccessToken({ userId: playerA._id.toString(), email: playerA.email });
    tokenB = signAccessToken({ userId: playerB._id.toString(), email: playerB.email });
    tokenSpec = signAccessToken({ userId: spectatorUser._id.toString(), email: spectatorUser.email });
    tokenIntruder = signAccessToken({ userId: intruderUser._id.toString(), email: intruderUser.email });

    httpServer = createServer(app);
    setupRealtimeServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 3000;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await disconnectDB();
  });

  const createSocket = (token: string): Promise<ClientSocketType> => {
    return new Promise((resolve, reject) => {
      const socket = ClientSocket(`http://localhost:${serverPort}`, {
        auth: { token },
        transports: ['websocket'],
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });
  };

  // =========================================================================
  // 1. MULTILINGUAL WORD BANK & GUESS NORMALIZATION UNIT TESTS
  // =========================================================================
  describe('Multilingual Word Bank & Language-Aware Normalization', () => {
    it('returns language-specific words for English, Hindi, and Spanish', () => {
      const enChoices = WordService.getWordChoices({ language: 'en', count: 3 });
      expect(enChoices).toHaveLength(3);

      const hiChoices = WordService.getWordChoices({ language: 'hi', count: 3 });
      expect(hiChoices).toHaveLength(3);
      // Hindi choices should include Devanagari characters
      expect(/[\u0900-\u097F]/.test(hiChoices[0])).toBe(true);

      const esChoices = WordService.getWordChoices({ language: 'es', count: 3 });
      expect(esChoices).toHaveLength(3);
    });

    it('correctly matches Spanish words with and without accents', () => {
      expect(WordService.isMatch('arbol', 'árbol', [], 'es')).toBe(true);
      expect(WordService.isMatch('árbol', 'árbol', [], 'es')).toBe(true);
      expect(WordService.isMatch('musica', 'música', [], 'es')).toBe(true);
      expect(WordService.isMatch('avion', 'avión', [], 'es')).toBe(true);
    });

    it('correctly matches Hindi Devanagari words and transliterated aliases', () => {
      // Direct Devanagari match
      expect(WordService.isMatch('हाथी', 'हाथी', ['elephant'], 'hi')).toBe(true);
      // Transliterated / registered alias match
      expect(WordService.isMatch('elephant', 'हाथी', ['elephant'], 'hi')).toBe(true);
      expect(WordService.isMatch('hathi', 'हाथी', ['hathi', 'elephant'], 'hi')).toBe(true);
      expect(WordService.isMatch('शेर', 'हाथी', ['elephant'], 'hi')).toBe(false);
    });

    it('generates grapheme-safe Unicode masks for multi-byte Hindi and accented Spanish', () => {
      const esMask = WordService.generateMask('árbol', [0, 2]);
      expect(esMask).toBe('Á _ B _ _');

      const hiMask = WordService.generateMask('हाथी', [0]);
      expect(hiMask.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. GAME MODES UNIT TESTS (NORMAL, HIDDEN, COMBINATION)
  // =========================================================================
  describe('Game Modes (Normal, Hidden, Combination)', () => {
    it('Normal Mode: provides character-spaced mask and reveals progressive characters', () => {
      const mask = WordService.generateMask('banana', [0, 2], 'normal');
      expect(mask).toBe('B _ N _ _ _');
    });

    it('Hidden Mode: obscures character count pattern completely from guessers', () => {
      const mask = WordService.generateMask('elephant', [0, 1, 2], 'hidden');
      expect(mask).toBe('? ? ? ? ?');
    });

    it('Combination Mode: pairs eligible words into multi-word challenge phrases', () => {
      const comboChoices = WordService.getWordChoices({
        wordMode: 'combination',
        count: 3,
        language: 'en',
      });
      expect(comboChoices).toHaveLength(3);
      // All combination choices should contain a space boundary
      expect(comboChoices[0].includes(' ')).toBe(true);
    });
  });

  // =========================================================================
  // 3. CUSTOM WORD PACKS HTTP API TESTS
  // =========================================================================
  describe('Custom Word Packs Management & Validation', () => {
    let createdPackId: string;

    it('creates a custom word pack with valid input and deduplicates words', async () => {
      const res = await request(app)
        .post('/api/word-packs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Video Game Legends',
          description: 'Iconic gaming characters and items',
          language: 'en',
          category: 'gaming',
          words: ['Mario', 'Luigi', 'Zelda', 'mario', 'Link', 'Bowser', 'Pikachu'],
          isPublic: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.pack.name).toBe('Video Game Legends');
      // Case-insensitive duplicate 'mario' should be pruned: 6 unique words
      expect(res.body.pack.words).toHaveLength(6);
      createdPackId = res.body.pack._id;
    });

    it('rejects word pack with fewer than minimum required unique words (5)', async () => {
      const res = await request(app)
        .post('/api/word-packs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Too Short Pack',
          language: 'en',
          words: ['apple', 'banana', 'cherry'],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/at least 5 unique words/i);
    });

    it('allows owner to retrieve and update their pack', async () => {
      const getRes = await request(app)
        .get(`/api/word-packs/${createdPackId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.pack.name).toBe('Video Game Legends');

      const updateRes = await request(app)
        .patch(`/api/word-packs/${createdPackId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Classic Gaming Legends',
          isPublic: true,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.pack.name).toBe('Classic Gaming Legends');
      expect(updateRes.body.pack.isPublic).toBe(true);
    });

    it('prevents non-owner from updating or deleting another users pack', async () => {
      const patchRes = await request(app)
        .patch(`/api/word-packs/${createdPackId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked Name' });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.error).toMatch(/only edit your own/i);

      const delRes = await request(app)
        .delete(`/api/word-packs/${createdPackId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(delRes.status).toBe(403);
      expect(delRes.body.error).toMatch(/only delete your own/i);
    });

    it('prevents unauthorized access to private packs', async () => {
      // Create private pack
      const privRes = await request(app)
        .post('/api/word-packs')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Top Secret Pack',
          language: 'en',
          words: ['wordone', 'wordtwo', 'wordthree', 'wordfour', 'wordfive'],
          isPublic: false,
        });

      const privId = privRes.body.pack._id;

      const intruderRes = await request(app)
        .get(`/api/word-packs/${privId}`)
        .set('Authorization', `Bearer ${tokenIntruder}`);

      expect(intruderRes.status).toBe(403);
      expect(intruderRes.body.error).toMatch(/private/i);
    });
  });

  // =========================================================================
  // 4. REAL-TIME SPECTATOR MODE & CAPACITY TESTS
  // =========================================================================
  describe('Authoritative Spectator Mode & Permissions', () => {
    let clientHost: ClientSocketType;
    let clientPlayer: ClientSocketType;
    let clientSpectator: ClientSocketType;
    let spectatorRoomCode: string;

    beforeAll(async () => {
      clientHost = await createSocket(tokenA);
      clientPlayer = await createSocket(tokenB);
      clientSpectator = await createSocket(tokenSpec);
    });

    afterAll(() => {
      clientHost.disconnect();
      clientPlayer.disconnect();
      clientSpectator.disconnect();
    });

    it('creates room with spectator settings and allows spectator to join', async () => {
      const createRes = await new Promise<any>((resolve) => {
        clientHost.emit(
          'room:create',
          {
            name: 'Spectator Arena',
            visibility: 'public',
            settings: {
              maxPlayers: 4,
              spectatorsAllowed: true,
              maxSpectators: 2,
              allowLateSpectators: true,
              drawTimeSeconds: 40,
              rounds: 2,
              wordLanguage: 'en',
              wordMode: 'normal',
            },
          },
          resolve
        );
      });

      spectatorRoomCode = createRes.room.roomCode;
      expect(createRes.room.maxSpectators).toBe(2);

      // Player B joins as active player
      await new Promise<any>((resolve) => {
        clientPlayer.emit('room:join', { roomCode: spectatorRoomCode }, resolve);
      });

      // Spectator Sam joins as Spectator
      const specJoinRes = await new Promise<any>((resolve) => {
        clientSpectator.emit('room:join_spectator', { roomCode: spectatorRoomCode }, resolve);
      });

      expect(specJoinRes.success).toBe(true);
      expect(specJoinRes.isSpectator).toBe(true);
      expect(specJoinRes.room.currentSpectatorsCount).toBe(1);
      expect(specJoinRes.room.spectators[0].displayName).toBe('Spectator Sam');
    });

    it('enforces spectator capacity limits', async () => {
      const clientSpec2 = await createSocket(tokenIntruder);

      // Join 2nd spectator (reaching capacity of 2)
      const res2 = await new Promise<any>((resolve) => {
        clientSpec2.emit('room:join_spectator', { roomCode: spectatorRoomCode }, resolve);
      });
      expect(res2.success).toBe(true);

      // Attempt 3rd spectator from extra user
      const extraUser = await User.create({
        displayName: 'Extra User',
        username: 'extra_user',
        normalizedUsername: 'extra_user',
        email: 'extra@test.com',
        normalizedEmail: 'extra@test.com',
        passwordHash: 'dummy',
        isOnboarded: true,
      });
      const extraToken = signAccessToken({ userId: extraUser._id.toString(), email: extraUser.email });
      const clientSpec3 = await createSocket(extraToken);

      const res3 = await new Promise<any>((resolve) => {
        clientSpec3.emit('room:join_spectator', { roomCode: spectatorRoomCode }, resolve);
      });

      expect(res3.success).toBe(false);
      expect(res3.error).toMatch(/Spectator capacity reached/i);

      clientSpec2.disconnect();
      clientSpec3.disconnect();
    });

    it('spectator receives live sanitized game snapshot without secret word leak', async () => {
      // Mark players ready
      await new Promise((r) => clientHost.emit('room:ready', { roomCode: spectatorRoomCode, isReady: true }, r));
      await new Promise((r) => clientPlayer.emit('room:ready', { roomCode: spectatorRoomCode, isReady: true }, r));

      const specStatePromise = new Promise<any>((resolve) => {
        clientSpectator.once('game:state', resolve);
      });

      // Host starts game
      const startRes = await new Promise<any>((resolve) => {
        clientHost.emit('game:start', { roomCode: spectatorRoomCode }, resolve);
      });
      expect(startRes.success).toBe(true);

      const specSnapshot = await specStatePromise;
      expect(specSnapshot.isSpectator).toBe(true);
      expect(specSnapshot.word.secret).toBeUndefined(); // SECRET WORD MUST NEVER LEAK!
      expect(specSnapshot.word.choices).toBeUndefined();
    });

    it('rejects draw, guess, and word-select actions from spectator', async () => {
      // Spectator attempts to submit a guess
      const guessRes = await new Promise<any>((resolve) => {
        clientSpectator.emit('game:guess', { roomCode: spectatorRoomCode, text: 'cheating' }, resolve);
      });
      expect(guessRes.success).toBe(false);
      expect(guessRes.error).toMatch(/Spectators cannot submit gameplay guesses/i);

      // Spectator attempts to start a stroke
      const strokeRes = await new Promise<any>((resolve) => {
        clientSpectator.emit(
          'draw:stroke_start',
          {
            roomCode: spectatorRoomCode,
            strokeId: 'fake-stroke',
            tool: 'brush',
            color: '#000000',
            width: 0.02,
            point: { x: 0.5, y: 0.5 },
          },
          resolve
        );
      });
      expect(strokeRes.success).toBe(false);
      expect(strokeRes.error).toMatch(/Unauthorized/i);
    });

    it('allows spectator non-gameplay chat without score alteration', async () => {
      const chatPromise = new Promise<any>((resolve) => {
        clientHost.once('chat:spectator_message', resolve);
      });

      clientSpectator.emit('chat:spectator_message', {
        roomCode: spectatorRoomCode,
        text: 'Great drawing so far!',
      });

      const receivedMsg = await chatPromise;
      expect(receivedMsg.displayName).toBe('Spectator Sam');
      expect(receivedMsg.text).toBe('Great drawing so far!');
      expect(receivedMsg.isSpectator).toBe(true);
    });
  });

  // =========================================================================
  // 5. DRAWING REPLAY RECORDING & CONFIDENTIALITY TESTS
  // =========================================================================
  describe('Drawing Replay Recording, Playback & Privacy', () => {
    let testGameId: string;
    const testRoom = 'RPLAY1';

    beforeAll(() => {
      testGameId = `game_replay_test_${Date.now()}`;
    });

    it('records accepted drawing events chronologically and finalizes to MongoDB', async () => {
      const recorder = ReplayRecorderService.getInstance();

      recorder.startRecording({
        gameId: testGameId,
        roomCode: testRoom,
        roundNumber: 1,
        drawerId: playerA._id.toString(),
        drawerDisplayName: 'Player One',
        secretWord: 'sunflower',
        category: 'nature',
        language: 'en',
      });

      // Record stroke start
      recorder.recordEvent(testRoom, 'stroke_start', {
        strokeId: 's1',
        tool: 'brush',
        color: '#ff0000',
        width: 5,
        points: [{ x: 10, y: 10 }],
      });

      // Record points
      recorder.recordEvent(testRoom, 'stroke_points', {
        strokeId: 's1',
        points: [{ x: 20, y: 20 }, { x: 30, y: 30 }],
      });

      // Record undo
      recorder.recordEvent(testRoom, 'stroke_undo', { revision: 1 });

      // Finalize round recording
      const savedReplay = await recorder.finalizeRecording(testRoom);
      expect(savedReplay).not.toBeNull();
      expect(savedReplay?.gameId).toBe(testGameId);
      expect(savedReplay?.secretWord).toBe('sunflower');
      expect(savedReplay?.events.length).toBe(3);
      expect(savedReplay?.events[0].type).toBe('stroke_start');
      expect(savedReplay?.events[2].type).toBe('stroke_undo');
    });

    it('retrieves finalized replay via authenticated HTTP API', async () => {
      const res = await request(app)
        .get(`/api/replays/${testGameId}/1`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.replay.secretWord).toBe('sunflower');
      expect(res.body.replay.events).toHaveLength(3);
    });

    it('returns match replay list for game review', async () => {
      const res = await request(app)
        .get(`/api/replays/${testGameId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.replays).toHaveLength(1);
      expect(res.body.replays[0].drawerDisplayName).toBe('Player One');
    });

    it('returns 404 for non-existent replay round', async () => {
      const res = await request(app)
        .get(`/api/replays/${testGameId}/99`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
