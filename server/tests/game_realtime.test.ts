import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app } from '../src/app.js';
import { setupRealtimeServer } from '../src/realtime/socket.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Room } from '../src/models/Room.js';
import { MatchResult } from '../src/models/MatchResult.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { hashPassword } from '../src/utils/password.js';
import { WordService } from '../src/game/WordService.js';
import { ScoringService } from '../src/game/ScoringService.js';
import { HintService } from '../src/game/HintService.js';
import { GameManager } from '../src/game/GameManager.js';
import { DrawingSessionManager } from '../src/services/DrawingSessionManager.js';

describe('Phase 4 - Multiplayer Game Engine, Timers, Guessing, Scoring, Hints & Persistence', () => {
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
    await MatchResult.deleteMany({});

    const pwdHash = await hashPassword('Password123!');

    userA = await User.create({
      displayName: 'Alice Host',
      username: 'alice_host',
      normalizedUsername: 'alice_host',
      email: 'alice@example.com',
      normalizedEmail: 'alice@example.com',
      passwordHash: pwdHash,
      avatar: 'avatar-1',
      isOnboarded: true,
    });

    userB = await User.create({
      displayName: 'Bob Guesser',
      username: 'bob_guess',
      normalizedUsername: 'bob_guess',
      email: 'bob@example.com',
      normalizedEmail: 'bob@example.com',
      passwordHash: pwdHash,
      avatar: 'avatar-2',
      isOnboarded: true,
    });

    userC = await User.create({
      displayName: 'Charlie Guesser',
      username: 'charlie_guess',
      normalizedUsername: 'charlie_guess',
      email: 'charlie@example.com',
      normalizedEmail: 'charlie@example.com',
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
  }, 60000);

  afterAll(async () => {
    if (httpServer) {
      httpServer.close();
    }
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

  // ==========================================
  // 1. UNIT LOGIC TESTS
  // ==========================================
  describe('WordService & Normalization Unit Tests', () => {
    it('normalizes guesses correctly (case, whitespace, diacritics)', () => {
      expect(WordService.normalizeWord('  Elephant  ')).toBe('elephant');
      expect(WordService.normalizeWord('Éléphant')).toBe('elephant');
      expect(WordService.normalizeWord('PIZZA')).toBe('pizza');
    });

    it('verifies exact matches and rejects mismatches', () => {
      expect(WordService.isMatch('Elephant', 'elephant')).toBe(true);
      expect(WordService.isMatch('  ELEPHANT  ', 'elephant')).toBe(true);
      expect(WordService.isMatch('elephants', 'elephant')).toBe(false);
      expect(WordService.isMatch('eleph', 'elephant')).toBe(false);
    });

    it('generates masked blanks for words and preserves spaces', () => {
      expect(WordService.generateMask('cat')).toBe('_ _ _');
      expect(WordService.generateMask('ice cream')).toBe('_ _ _   _ _ _ _ _');
    });

    it('returns requested count of unique word choices', () => {
      const choices = WordService.getRandomChoices('animals', 3);
      expect(choices).toHaveLength(3);
      const unique = new Set(choices.map((c) => c.word.toLowerCase()));
      expect(unique.size).toBe(3);
    });
  });

  describe('ScoringService Unit Tests', () => {
    it('awards maximum points for instant guesses and minimum for buzzer-beaters', () => {
      // drawTime = 60s, timeRemaining = 60s -> 100 base + 100 speed = 200 pts
      const maxScore = ScoringService.calculateGuesserScore(60, 60);
      expect(maxScore).toBe(200);

      // timeRemaining = 0s -> 100 base + 0 speed = 100 pts
      const minScore = ScoringService.calculateGuesserScore(0, 60);
      expect(minScore).toBe(100);

      // timeRemaining = 30s (halfway) -> 100 base + 50 speed = 150 pts
      const midScore = ScoringService.calculateGuesserScore(30, 60);
      expect(midScore).toBe(150);
    });

    it('returns fixed artist bonus points', () => {
      expect(ScoringService.calculateDrawerBonus()).toBe(50);
    });
  });

  describe('HintService Unit Tests', () => {
    it('schedules progressive hint offsets evenly', () => {
      const offsets = HintService.calculateHintOffsets(60, 3);
      expect(offsets).toHaveLength(3);
      expect(offsets[0]).toBe(15000);
      expect(offsets[1]).toBe(30000);
      expect(offsets[2]).toBe(45000);
    });

    it('returns empty offsets when hints are disabled (0 hints)', () => {
      const offsets = HintService.calculateHintOffsets(60, 0);
      expect(offsets).toHaveLength(0);
    });

    it('reveals letters without disclosing full secret', () => {
      const secret = 'planet';
      const revealed = [0];
      const nextIndex = HintService.revealNextCharacter(secret, revealed);
      expect(nextIndex).not.toBeNull();
      expect(nextIndex).not.toBe(0);
      expect(nextIndex! < secret.length).toBe(true);
    });
  });

  // ==========================================
  // 2. REALTIME MULTI-CLIENT GAMEPLAY TESTS
  // ==========================================
  describe('Full Real-Time Multiplayer Game Engine Flow', () => {
    let clientA: ClientSocketType;
    let clientB: ClientSocketType;
    let clientC: ClientSocketType;
    let testRoomCode: string;

    beforeAll(async () => {
      clientA = await createClientSocket(tokenA);
      clientB = await createClientSocket(tokenB);
      clientC = await createClientSocket(tokenC);

      // Create test room via Alice
      const res = await new Promise<any>((resolve) => {
        clientA.emit(
          'room:create',
          {
            name: 'Phase 4 Arena',
            visibility: 'public',
            settings: {
              maxPlayers: 6,
              drawTimeSeconds: 30,
              rounds: 2,
              wordCount: 3,
              hints: 2,
              wordMode: 'normal',
              category: 'animals',
            },
          },
          resolve
        );
      });
      testRoomCode = res.room.roomCode;

      // Bob and Charlie join room
      await new Promise<any>((resolve) => {
        clientB.emit('room:join', { roomCode: testRoomCode }, resolve);
      });
      await new Promise<any>((resolve) => {
        clientC.emit('room:join', { roomCode: testRoomCode }, resolve);
      });

      // All players mark ready
      await new Promise<any>((resolve) => clientA.emit('room:ready', { roomCode: testRoomCode, isReady: true }, resolve));
      await new Promise<any>((resolve) => clientB.emit('room:ready', { roomCode: testRoomCode, isReady: true }, resolve));
      await new Promise<any>((resolve) => clientC.emit('room:ready', { roomCode: testRoomCode, isReady: true }, resolve));
    });

    afterAll(() => {
      clientA.disconnect();
      clientB.disconnect();
      clientC.disconnect();
    });

    it('rejects game:start from non-host player', async () => {
      const res: any = await new Promise((resolve) => {
        clientB.emit('game:start', { roomCode: testRoomCode }, resolve);
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Only the room host can start/i);
    });

    it('starts game via host and initiates word_selection with role-specific privacy', async () => {
      const statePromiseA = new Promise<any>((resolve) => {
        clientA.once('game:state', resolve);
      });
      const statePromiseB = new Promise<any>((resolve) => {
        clientB.once('game:state', resolve);
      });

      const startRes: any = await new Promise((resolve) => {
        clientA.emit('game:start', { roomCode: testRoomCode }, resolve);
      });
      expect(startRes.success).toBe(true);

      const [stateA, stateB] = await Promise.all([statePromiseA, statePromiseB]);

      // Phase is word_selection
      expect(stateA.phase).toBe('word_selection');
      expect(stateB.phase).toBe('word_selection');

      // Alice is first drawer in deterministic order
      expect(stateA.drawerId).toBe(userA._id.toString());
      expect(stateA.drawerId === userA._id.toString()).toBe(true);
      expect(stateB.drawerId === userB._id.toString()).toBe(false);

      // PRIVACY AUDIT: Alice receives choices, Bob receives NO choices and NO secret
      expect(stateA.word.choices).toBeDefined();
      expect(stateA.word.choices.length).toBe(3);

      expect(stateB.word.choices).toBeUndefined();
      expect(stateB.word.secret).toBeUndefined();
    });

    it('rejects word selection from unauthorized guessing player', async () => {
      const res: any = await new Promise((resolve) => {
        clientB.emit('game:word_select', { roomCode: testRoomCode, word: 'cat' }, resolve);
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Only the current drawer can select/i);
    });

    let chosenWord: string;

    it('authorizes drawer word selection and broadcasts masked word to observers', async () => {
      // Alice picks the first choice
      const gameManager = GameManager.getInstance();
      const game = gameManager.getGame(testRoomCode);
      const snapshotAlice = game!.getViewerSnapshot(userA._id.toString());
      chosenWord = snapshotAlice.word.choices![0];

      const statePromiseB = new Promise<any>((resolve) => {
        clientB.once('game:state', resolve);
      });

      const selectRes: any = await new Promise((resolve) => {
        clientA.emit('game:word_select', { roomCode: testRoomCode, word: chosenWord }, resolve);
      });
      expect(selectRes.success).toBe(true);

      const stateB = await statePromiseB;
      expect(stateB.phase).toBe('drawing');

      // PRIVACY AUDIT: Guessers NEVER receive secretWord
      expect(stateB.word.secret).toBeUndefined();
      expect(stateB.word.masked).toBeDefined();
      expect(stateB.word.length).toBe(chosenWord.length);

      // Verify DrawingSessionManager authorized Alice as the drawer
      const drawingSession = DrawingSessionManager.getInstance().getOrCreateSession(testRoomCode);
      expect(drawingSession.drawerId).toBe(userA._id.toString());
    });

    it('rejects drawing operations from guessers while permitting drawer', async () => {
      // Bob attempts to draw
      const unauthorizedRes: any = await new Promise((resolve) => {
        clientB.emit(
          'draw:stroke_start',
          {
            roomCode: testRoomCode,
            strokeId: 'str_unauth',
            tool: 'brush',
            color: '#000000',
            width: 0.01,
            point: { x: 0.1, y: 0.1 },
          },
          resolve
        );
      });
      expect(unauthorizedRes.success).toBe(false);
      expect(unauthorizedRes.error).toMatch(/unauthorized/i);

      // SEC-01 Regression: Bob attempts to hijack drawer role via draw:session_init
      const hijackRes: any = await new Promise((resolve) => {
        clientB.emit(
          'draw:session_init',
          { roomCode: testRoomCode, drawerId: userB._id.toString() },
          resolve
        );
      });
      expect(hijackRes.success).toBe(false);
      expect(hijackRes.error).toMatch(/unauthorized/i);

      // Verify that Alice remains the authoritative drawer
      const session = DrawingSessionManager.getInstance().getSession(testRoomCode);
      expect(session?.drawerId).toBe(userA._id.toString());

      // Alice draws
      const strokePromiseB = new Promise<any>((resolve) => {
        clientB.once('draw:stroke_started', resolve);
      });

      const authorizedRes: any = await new Promise((resolve) => {
        clientA.emit(
          'draw:stroke_start',
          {
            roomCode: testRoomCode,
            strokeId: 'str_auth_1',
            tool: 'brush',
            color: '#ff0000',
            width: 0.02,
            point: { x: 0.2, y: 0.2 },
          },
          resolve
        );
      });
      expect(authorizedRes.success).toBe(true);

      const strokeStarted = await strokePromiseB;
      expect(strokeStarted.stroke.strokeId).toBe('str_auth_1');
    });

    it('rejects guess submissions from the active drawer', async () => {
      const res: any = await new Promise((resolve) => {
        clientA.emit('game:guess', { roomCode: testRoomCode, text: chosenWord }, resolve);
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/(Drawer cannot submit guesses|artist)/i);
    });

    it('broadcasts incorrect guesses to room with zero points', async () => {
      const guessResultPromise = new Promise<any>((resolve) => {
        clientC.once('game:guess_result', resolve);
      });

      const res: any = await new Promise((resolve) => {
        clientB.emit('game:guess', { roomCode: testRoomCode, text: 'wrongguessxyz' }, resolve);
      });
      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);

      const broadcastMsg = await guessResultPromise;
      expect(broadcastMsg.text).toBe('wrongguessxyz');
      expect(broadcastMsg.isCorrect).toBe(false);
    });

    it('awards points on correct guess, ends round, and updates scores', async () => {
      const roundEndPromise = new Promise<any>((resolve) => {
        clientB.once('game:round_ended', resolve);
      });
      const guessedPromise = new Promise<any>((resolve) => {
        clientC.once('game:player_guessed', resolve);
      });

      // Bob submits exact secret word (case-insensitive with whitespace)
      const res: any = await new Promise((resolve) => {
        clientB.emit('game:guess', { roomCode: testRoomCode, text: `  ${chosenWord.toUpperCase()}  ` }, resolve);
      });
      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);

      const guessedData = await guessedPromise;
      expect(guessedData.userId).toBe(userB._id.toString());
      expect(guessedData.points).toBeGreaterThanOrEqual(100);
      expect(guessedData.drawerBonus).toBe(50);

      const roundSummary = await roundEndPromise;
      expect(roundSummary.winnerId).toBe(userB._id.toString());
      expect(roundSummary.secretWord).toBe(chosenWord);
      expect(roundSummary.reason).toBe('guessed');
    });

    it('rejects duplicate guess from same player in same round', async () => {
      const res: any = await new Promise((resolve) => {
        clientB.emit('game:guess', { roomCode: testRoomCode, text: chosenWord }, resolve);
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/(already guessed|active drawing phase)/i);
    });

    it('allows reconnected player to retrieve safe state snapshot with intact scores', async () => {
      const res: any = await new Promise((resolve) => {
        clientC.emit('game:get_state', { roomCode: testRoomCode }, resolve);
      });
      expect(res.success).toBe(true);
      expect(res.game).toBeDefined();
      expect(res.game.roomCode).toBe(testRoomCode);
      expect(res.game.scores).toHaveLength(3);

      const bobScore = res.game.scores.find((p: any) => p.userId === userB._id.toString());
      expect(bobScore.score).toBeGreaterThanOrEqual(100);
    });

    it('persists MatchResult in MongoDB upon game completion', async () => {
      const gameManager = GameManager.getInstance();
      const game = gameManager.getGame(testRoomCode);
      expect(game).toBeDefined();

      // Trigger endGame directly to test authoritative game-over & persistence
      game!.endGame();

      // Wait a moment for async DB write
      await new Promise((r) => setTimeout(r, 200));

      const savedMatch = await MatchResult.findOne({ roomCode: testRoomCode });
      expect(savedMatch).not.toBeNull();
      expect(savedMatch!.players).toHaveLength(3);
      expect(savedMatch!.status).toBe('completed');
      expect(savedMatch!.winner.score).toBeGreaterThan(0);
    });
  });
});
