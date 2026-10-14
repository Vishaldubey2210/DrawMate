# Phase 4 Implementation Plan — Multiplayer Game Engine, Word System, Timers, Guessing, Scoring & Leaderboard

## 1. Audit Assessment of Existing Foundations (Phases 1, 2 & 3)
- **Phase 1 Foundations:** Verified persistent user accounts, unique usernames, avatars, JWT authentication, and cohesive design system.
- **Phase 2 Foundations:** `RoomManager` tracking player presence, normalized room codes (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), host permissions, room settings (`rounds: 2-10`, `drawTimeSeconds: 15-240`, `wordCount: 1-5`, `hints: 0-5`, `wordMode`, `category`), lobby readiness validation, and Socket.IO channels (`room:${roomCode}`).
- **Phase 3 Foundations:** Authoritative `DrawingSessionManager` with normalized coordinates ([0, 1]), stroke synchronization, brush and genuine eraser tools, point batching, undo, and clear canvas.
- **Phase 4 Integration Goal:** Connect the validated lobby and drawing canvas to a server-authoritative turn-based game engine:
  - Turn rotation: Deterministic order across eligible players.
  - Word selection: Word bank with categories, drawer chooses 1 of 3 options.
  - Secret word confidentiality: Non-drawers receive masked blanks (`_ _ _ _ _`) and scheduled progressive hints; raw secret word is never broadcast to observers.
  - Authoritative timers: Word selection timer (15s), drawing turn timer (15–240s based on settings), round results interval (6s).
  - Live guess chat: Guess input, case-insensitive normalization, drawer cannot guess. Correct guesses award points (base 100 + speed bonus up to 100 + drawer bonus 50) and end the round.
  - Leaderboard & persistence: Final match results stored in MongoDB (`MatchResult` model).

---

## 2. Server-Side Architecture (`server/src/game/`)

```
server/src/
├── game/
│   ├── game.types.ts               # Core game types (GameState, PlayerScore, GuessMessage, RoundSummary)
│   ├── game.schemas.ts             # Zod validation schemas for game inputs
│   ├── words.data.ts               # Structured, categorized word bank
│   ├── WordService.ts              # Word filtering, selection options, mask generation
│   ├── ScoringService.ts           # Authoritative point calculations (base, speed, drawer bonus)
│   ├── HintService.ts              # Progressive hint scheduling (0–5 hints across turn duration)
│   ├── Game.ts                     # Single authoritative game instance (state machine, rounds, turns, timers)
│   └── GameManager.ts              # Singleton managing all active game sessions and room bindings
├── models/
│   └── MatchResult.ts              # MongoDB model for completed match history & scores
└── realtime/
    ├── game/
    │   └── gameHandlers.ts         # Socket.IO handlers for game:start, game:word_select, game:guess, game:get_state
    └── socket.ts                   # Attaches game handlers on connection
```

---

## 3. Client-Side Architecture (`client/src/features/game/`)

```
client/src/
├── features/
│   └── game/
│       ├── game.types.ts           # Client-side game snapshot and message types
│       ├── useGameSession.ts       # Hook managing Socket.IO game events, role-specific state, countdowns
│       ├── GameHeader.tsx          # Round counter, turn timer, drawer info, secret word or masked blanks
│       ├── WordSelectionModal.tsx  # Drawer modal with 3 word buttons and 15s timer
│       ├── WordHintDisplay.tsx     # Display for blanks and progressively revealed letters
│       ├── GameChat.tsx            # Live guess chat stream with correct guess badges & guess input
│       ├── GameLeaderboard.tsx     # Live player standings and scores
│       ├── RoundResultsModal.tsx   # End of turn summary (revealed word, points, drawer)
│       ├── GameOverScreen.tsx      # Final podium, top players, match recap, return to lobby CTA
│       └── GameArena.tsx           # Full game workspace integrating Canvas, Chat, Leaderboard & Modals
```

---

## 4. Game Lifecycle & State Transitions

1. `waiting`: Lobby waiting for host start request.
2. `word_selection`: Server picks next drawer and generates 3 secret word options. Drawer has 15s to pick.
3. `drawing`: Authorized drawer draws secret word on canvas; guessers submit guesses via chat. Timers and hints tick authoritatively.
4. `round_ending`: Turn finishes (correct guess or timeout). Server reveals the word, distributes scores, displays Round Results for 6s.
5. Cycle repeats for all players across all configured rounds.
6. `game_over`: All rounds complete. Server calculates winner(s), creates durable `MatchResult` in MongoDB, and presents final leaderboard.

---

## 5. Acceptance Criteria
- [x] Server-authoritative `Game` state machine with validated transitions.
- [x] Word bank organized across multiple categories with clean, safe words.
- [x] Strict secret word security: non-drawers receive masked representation and never raw secret words.
- [x] Progressive hints (0–5) calculated and revealed according to room settings.
- [x] Authoritative timers (selection, turn duration, round result) managed server-side.
- [x] Guess processing: Case-insensitive normalization, drawer cannot guess, correct guess awards points and triggers round end.
- [x] Deterministic scoring: Base 100 + speed bonus up to 100 + drawer bonus 50.
- [x] Seamless Phase 3 Canvas integration: Drawer is granted canvas access on turn start; canvas clears on new turn.
- [x] Reconnection & late-join recovery: Sanitized role-specific snapshots sent via `game:get_state`.
- [x] Match results persisted to MongoDB on game completion (`MatchResult` model).
- [x] Multi-client Socket.IO integration tests verifying full gameplay flow (3 players, word select, guess, scoring, game over).
- [x] Comprehensive documentation in `docs/PHASE_4_PLAN.md`, `docs/GAME_ENGINE_ARCHITECTURE.md`, `docs/GAME_EVENTS.md`, and `README.md`.
- [x] 103 automated tests passing across backend and frontend test suites.
