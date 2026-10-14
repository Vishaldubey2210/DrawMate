# DrawMate — Multiplayer Gaming SaaS Platform (Phases 1–6)

**DrawMate** is a production-grade multiplayer drawing and guessing platform built as a modern social gaming SaaS product inspired by skribbl.io.

This repository implements:
- **Phase 1:** Core SaaS Foundation, Secure Authentication, User Onboarding, Player Profiles, Account Settings, and Reusable Design System.
- **Phase 2:** Complete Multiplayer Room Management, Room Discovery, Lobby, Real-Time Player Presence, Socket.IO Synchronization, and Host-Controlled Room Settings.
- **Phase 3:** Production-Quality Real-Time HTML5 Drawing Canvas, Brush/Eraser Engine, Normalized Coordinates, Point Batching, Socket.IO Synchronization, Canvas Undo/Clear, and Reconnection State Recovery.
- **Phase 4:** Complete Server-Authoritative Multiplayer Game Engine, Secret Word System, Timers, Live Guessing, Scoring, Progressive Hints, Leaderboard, and Match Persistence.
- **Phase 5:** Match history, player analytics, social friend squad, notifications, achievements, moderation, security hardening.
- **Phase 6:** Spectator Mode, Chronological Drawing Replay Engine, Custom Word Packs, Multilingual Word Banks (EN, HI, ES), Defined Game Modes (Normal, Hidden, Combination), and Advanced Room Configuration.
- **Deep Learning Sketch Recognizer:** 20-class Quick, Draw! CNN trained via 12-stage executed Jupyter Notebook (`01_quickdraw_cnn_experiments.ipynb`), achieving 88.38% Top-1 / 95.84% Top-3 test accuracy. Served via Python FastAPI inference service.
- **AI Practice Studio:** Real-time interactive AI practice mode (`/practice`) with canvas drawing, aspect-ratio preserved preprocessing, candidate predictions, and uncertainty rejection.
- **AI-Assisted Moderation:** Real-time moderation for chat and reported drawings with heuristic safety fallbacks and audit logging.
- **Imposter Game Mode:** Multiplayer social deduction mode with sequential isolated drawing turns, reveal phase, secret voting, and authoritative evasion scoring.
- **Advanced Capabilities:** Smart Reconnect & Room Recovery, Mobile-First Drawing Experience & Redo, Fair Play & AFK Protection, GenAI Word-Pack Generator, and Smart Word Selection with Adaptive Bayesian Difficulty.

---

## 🌟 Advanced Integrated Capabilities

### 1. Smart Reconnect & Room Recovery
- **Stable Identity**: Player identity decoupled from transient WebSocket socket IDs; participants keep their roster slot, role, and score across reconnects.
- **In-Game Reconnect Recovery**: Players reconnecting while `status === 'in_game'` immediately receive sanitized `game:state`, `room:state`, and vector `draw:state` without creating duplicate player instances or resetting turn timers.
- **Generation Token Protection**: Integer generation tokens protect 30s grace periods against delayed timeout callbacks from kicking reconnected users.
- **Role Confidentiality**: Secret words remain masked for guessers and spectators upon reconnect; only authorized drawers receive unmasked words.
- **Stroke Drop Safety**: Incomplete strokes from dropped drawers are safely cleaned up without canvas vector corruption.

### 2. Mobile-First Drawing Experience & Redo
- **Pointer Events Engine**: Full support for touch, stylus, and mouse with pointer capture and release (`setPointerCapture`).
- **Canvas-Only Touch Isolation**: `touch-action: none` isolated strictly to drawing surfaces; normal scrolling works seamlessly across the app.
- **Authoritative Redo**: Server-authoritative stroke redo with branch invalidation upon subsequent stroke creation.
- **High-DPI Coordinate Mapping**: Normalized $[0, 1]$ logical coordinates dynamically mapped to device pixel ratios via `ResizeObserver`.
- **Mobile Keyboard-Friendly**: Keyboard-safe guess chat and toolbar layout optimized for touch targets $\ge 40$px.

### 3. Fair Play, AFK Protection & Anti-Abuse
- **Server-Authoritative AFK Detection**: Tracks valid canvas strokes from the current drawer; inactive drawers receive a 10s `game:afk_warning` countdown before turns are automatically skipped (`game:afk_turn_skipped`).
- **Audit Logging**: AFK turn skips and moderation actions are permanently logged in `AuditLog`.
- **Guess Rate Limiting**: Max 6 guesses per 5-second sliding window prevents brute-force bot flooding.
- **Duplicate Guess Suppression**: Consecutive identical guesses from the same player are safely rejected.
- **Host Room Kicks**: Hosts can kick disruptive users via `room:kick_player` with automatic ban list enforcement preventing rejoining.

### 4. GenAI-Powered Word-Pack Generator
- **Multi-Provider Adapter**: Native integrations for Google Gemini (`gemini-1.5-flash`), OpenAI (`gpt-4o-mini`), and high-quality multi-language heuristic mock fallbacks.
- **Pre-Game Lifecycle**: AI generation occurs in custom word pack studio or pre-game setup, never stalling live gameplay rounds.
- **Strict Server Validation**: Zod schema validation enforcing length (2-50 chars), family-friendly content, whitespace trimming, and deduplication.
- **Interactive Studio UI**: Dedicated `GenAIWordPackModal` with theme prompts, language selection (English, Hindi, Spanish), live preview chips, and direct deck saving.

### 5. Smart Word Selection & Adaptive Bayesian Difficulty
- **Stage 1 Bayesian Beta-Binomial Smoothing**: Real-time solve rate calculation $\frac{\text{Solves} + 2}{\text{Rounds} + 4}$ prevents extreme volatility with low sample counts.
- **Chronic Timeout Penalty**: Words with $> 65\%$ observed timeouts are dynamically penalized in selection weights to prevent player frustration.
- **Balanced Difficulty Mixing**: Offers balanced easy, medium, and hard word choices when available.
- **Round Telemetry**: Every completed round persists telemetry to MongoDB via `RoundTelemetry`.
- **Offline ML Readiness Script**: `evaluate_difficulty_model.ts` evaluates telemetry datasets against majority baselines, Brier score, and gates ML model training behind a 500-sample threshold.

---

### Phase 5: Gaming SaaS Platform, Social Features, Player Analytics, Moderation & Security Hardening
1. **Persistent Match History & Exactly-Once Finalization**
   - Authoritative game completion sourced strictly from server-side `Game.ts` engine via `MatchResult` MongoDB model.
   - Idempotency guard (`isFinalized` atomic flag) guarantees duplicate finalization events never duplicate match records or user statistics.
   - Dedicated `/history` page with cursor-based pagination and outcome filtering (`all`, `wins`, `losses`, `draws`, `cancelled`).
   - Match details modal displaying actual persisted scores, participants, and placement rankings.

2. **Player Statistics & Dynamic Profile Analytics**
   - Core metrics: completed games, wins, losses, draws, win rate `(wins / gamesPlayed) * 100`, total points, average score, highest score, correct guesses, drawing turns, and win streaks.
   - Administrative rebuild endpoint (`/api/users/stats/rebuild`) recalculates user stats deterministically from canonical `MatchResult` documents.
   - Real-time dashboard integration displaying overview stats, recent matches, and achievement progress with polished zero-state cards.

3. **Public Player Profiles & Granular Privacy Controls**
   - Dedicated `/profile/:username` public profile routes displaying avatars, stats, match summaries, and achievements.
   - Server-enforced privacy policy (`public`, `friends_only`, `private`).
   - Friends-only profiles verified against authenticated friendship records; private profiles restricted to account owner.
   - Sensitive credentials (emails, password hashes, tokens, moderation notes) are completely excluded from public serializers.

4. **Friends & Social Hub**
   - Player discovery at `/friends` with bounded username search, avoiding unbounded database queries.
   - Complete friend request lifecycle: send, accept, decline, cancel outgoing, and unfriend.
   - User blocking (`blockedUserIds`): blocks prevent new friend requests and room invitations.
   - Direct room invitations: send real-time invites to online friends leading to server-validated room membership.

5. **Persistent Notification System**
   - Stored in MongoDB (`Notification` model) with read/unread tracking and pagination.
   - Real-time live push over Socket.IO to private user rooms (`user:<userId>`).
   - Interactive `NotificationBell` in navigation with live unread badge, mark individual as read, and mark all as read.
   - Supported triggers: incoming/accepted friend requests, room game invites, match conclusions, achievement unlocks.

6. **Achievement Progression System**
   - Centrally defined catalog in `AchievementService` (`first_game`, `first_win`, `first_guess`, `five_matches`, `ten_guesses`, `streak_milestone`).
   - Server-evaluated upon match finalization; idempotent awards stored in `UserAchievement` model.
   - Badge showcase in profile and dashboard with criteria descriptions and unlock timestamps.

7. **Competitive Global Leaderboards**
   - Server-computed rankings at `/leaderboards` across categories: Highest Score, Most Wins, and Best Win Rate.
   - Authenticated player placement indicator showing current user ranking even when outside top page.
   - Strict tie handling and exclusion of incomplete/cancelled matches.

8. **Reporting, Moderation & Administrative Security**
   - Player reporting modal (`ReportModal`) submitting category-validated reports (`hate_speech`, `inappropriate_drawing`, `spam`, `cheating`, `harassment`).
   - Role-based authorization (`user`, `moderator`, `admin`) enforced server-side; client role tampering strictly forbidden.
   - Dedicated `/admin` Admin Dashboard: report resolution queue, user lookup, disciplinary actions (suspend, ban, unban).
   - Immutable `AuditLog` collection recording actor ID, action type, target ID, reason, and metadata.

9. **Account Lifecycle, Data Export & Security Hardening**
   - User-initiated personal data export (`GET /api/users/export`) returning clean JSON without password hashes or internal secrets.
   - Safe account deletion (`DELETE /api/users/me`) cascading social relationships and anonymizing historical match participant records.
   - Health check endpoints (`GET /api/health`, `GET /api/health/ready`) reporting process uptime, memory usage, and database ping.

10. **Containerized Production Deployment & CI**
    - Multi-stage production `Dockerfile` compiling frontend client and backend server into a minimal runtime image.
    - `docker-compose.yml` for unified local/self-hosted deployment with MongoDB.
    - GitHub Actions CI workflow (`.github/workflows/ci.yml`) testing builds, linting, and integration suites on pull requests.
    - Declarative `render.yaml` blueprint for zero-downtime deployment on Render / Railway.

---

### Phase 4: Multiplayer Game Engine, Word System, Timers, Guessing, Scoring & Leaderboard
1. **Server-Authoritative Game State Machine**
   - Single source of truth managing phases: `waiting` $\rightarrow$ `word_selection` $\rightarrow$ `drawing` $\rightarrow$ `round_ending` $\rightarrow$ `game_over` / `cancelled`.
   - Prevents client-supplied phases, scores, words, or roles; state changes are validated and emitted atomically.

2. **Categorized Word Bank & Secret Word Selection**
   - Curated dictionary across animals, food, objects, nature, sports, technology, and general.
   - Authorized drawer receives 3 randomized distinct choices; guessers receive waiting status.
   - 15-second selection deadline auto-picks on timeout.

3. **Strict Secret Word Security & Role-Specific Serialization**
   - Non-drawers never receive the canonical secret word during selection or drawing.
   - Guessers receive masked representation (`_ _ _ _`) and scheduled progressive hints.
   - Private user socket rooms (`user.userId`) ensure targeted state delivery without information leakage.

4. **Authoritative Timers & Progressive Hints**
   - Server deadlines recorded as epoch timestamps; client countdowns derived locally without 1-second server tick spam.
   - Configurable hints (0–5) scheduled at even intervals across turn duration revealing letters without exposing the entire secret.

5. **Live Guessing & Scoring Engine**
   - Server-side case-insensitive normalization stripping whitespace and diacritics.
   - Drawer is forbidden from submitting guesses.
   - Correct guesses award points based on speed (100 base + up to 100 speed bonus) and award a 50-point drawer bonus.
   - Idempotent round completion ends turn on valid correct guess and prevents duplicate scoring.

6. **Drawing Engine Integration & Automatic Canvas Reset**
   - Direct integration with Phase 3 `DrawingSessionManager`.
   - Drawer privileges granted upon word selection; old strokes wiped so every turn begins on a clean canvas.
   - Drawer privileges revoked immediately upon round completion.

7. **Match Persistence & Leaderboard**
   - Concluded matches persist to MongoDB via `MatchResult` model.
   - Final podium ranking sorted by total score descending with tie-handling.
   - Return-to-lobby action transitions room smoothly back to pre-game lobby.

---

### Phase 3: Real-Time Drawing Canvas & Synchronization Engine
1. **Responsive HTML5 Vector Canvas**
   - High-DPI / Retina display buffer scaling with `window.devicePixelRatio` and logical CSS coordinates tracked via `ResizeObserver`.
   - Responsive aspect ratio preserving drawing proportion across mobile, tablet, and desktop viewports without distortion or stretching.
   - Touch gestures configured with `touch-action: none` to prevent unintended page scroll during canvas interaction.

2. **Normalized Coordinate System ([0, 1])**
   - Client pointer coordinates are mapped to normalized fractions `x, y ∈ [0, 1]`, clamped and rounded to 4 decimals.
   - Authoritative drawing model is viewport-independent and renders identically on all screen sizes.

3. **Smooth Stroke Rendering & Genuine Eraser**
   - Quadratic Bezier midpoint interpolation for organic, curve-smoothed brush strokes.
   - Genuine eraser using HTML5 canvas `globalCompositeOperation = 'destination-out'` to erase strokes down to canvas transparency rather than painting white paint.

4. **Curated Palette & Brush Thickness**
   - 12 accessible color swatches with active visual rings and keyboard focus.
   - 3 normalized thickness presets: Thin (`0.006`), Medium (`0.015`), Thick (`0.035`).

5. **Server-Side Authorization & Permissions**
   - Server-enforced permissions: only the active authorized `drawerId` can start strokes, append points, undo, or clear.
   - Observers receive real-time streams and snapshots with disabled interactive drawing controls.

6. **Low-Latency Transport & Point Batching**
   - Local active strokes render with 0ms instantaneous feedback.
   - Intermediate pointer points are batched and streamed at 50Hz (every 20ms) to prevent server flooding while maintaining smooth remote rendering.

7. **Authoritative Undo & Clear Canvas**
   - Undo pops the last completed stroke from canonical server history and advances the state `revision`.
   - Clear Canvas wipes the stroke list with confirmation dialog guard and advances `revision`.

8. **Snapshot Recovery & Reconnection**
   - Late joiners and reconnecting participants fetch the authoritative `CanvasSnapshot` (`draw:get_state`), reconstructing the full canvas vector history.

9. **Phase 3 Development Test Harness**
   - Built directly into the Room Lobby (`RoomLobbyPage.tsx`) under the "Drawing Canvas Studio" tab.
   - Explicitly labeled `[Phase 3 Real-Time Canvas Test Environment]` allowing claiming/passing the drawer role among participants to verify multi-client drawer vs. observer synchronization without simulated gameplay.

---

### Phase 2: Multiplayer Room, Lobby & Real-Time Presence System
1. **Authoritative Socket.IO Architecture:** Handshake JWT authentication verifying access tokens against canonical MongoDB user records (`socket.data.user`).
2. **Room Creation & Identity:** Cryptographically secure 6-character room codes (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) with collision avoidance.
3. **Public Discovery & Private Rooms:** Live room browser at `/rooms` with search and capacity filtering; private rooms excluded from discovery.
4. **Real-Time Lobby:** Live player roster with host crown badges, ready tags, and connection statuses.
5. **Host Ownership & Transfer:** Deterministic host succession on host departure.
6. **Grace Period Reconnection:** 30-second disconnect grace timer allowing seamless reconnection without duplicate player entries.

---

### Phase 1: SaaS Foundation & Authentication
1. **Public Marketing Website:** Responsive landing page with feature overview and FAQ accordion.
2. **Authentication System:** Secure registration, password hashing (`bcrypt`, 12 rounds), login with timing-safe error feedback, and refresh token rotation.
3. **Onboarding & Profiles:** Multi-step onboarding wizard (`/onboarding`) and player profiles (`/profile`).
4. **Account Settings:** General, notification preferences, privacy visibility, and account deletion (`/settings`).

---

## 🛠️ Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, React Router v6, Socket.IO Client, React Hook Form, Axios.
- **Backend:** Node.js, Express.js, TypeScript, Socket.IO, Mongoose, Zod, bcryptjs, jsonwebtoken, cookie-parser, express-rate-limit, helmet.
- **Database:** MongoDB with automated in-memory fallback (`mongodb-memory-server`) for zero-friction local development and testing.
- **Testing:** Vitest, Supertest, Socket.IO Client (multi-client integration tests), React Testing Library.

---

## 📦 Prerequisites

- Node.js >= 18.0.0 (Tested on Node.js v22)
- npm >= 9.0.0
- *(Optional)* Local MongoDB instance or Atlas URI. If omitted, an embedded in-memory MongoDB is launched automatically.

---

## ⚙️ Quick Start Instructions

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd web3task
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

### 3. Run Development Servers
```bash
# Starts both frontend (port 5173) and backend (port 5000)
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Room Browser: `http://localhost:5173/rooms`

### 4. Run Test Suites
```bash
# Runs all 177 automated tests (133 server tests + 44 client tests)
npm test

# Run backend tests only (133 tests across auth, rooms, drawing, game, social/analytics, phase 6, AI & imposter)
npm run test:server

# Run frontend tests only (44 tests across auth, components, rooms, drawing, and game features)
npm run test:client
```

### 5. Production Build & Lint Checks
```bash
# Typecheck & bundle both server and client
npm run build

# Run TypeScript checks across both workspaces
npm run lint
```

---

## 📚 Documentation Reference

- **Phase 6 Implementation Plan:** [`docs/PHASE_6_PLAN.md`](docs/PHASE_6_PLAN.md)
- **Phase 6 System Architecture:** [`docs/PHASE_6_ARCHITECTURE.md`](docs/PHASE_6_ARCHITECTURE.md)
- **Phase 6 Advanced Gameplay Manual:** [`docs/ADVANCED_GAMEPLAY.md`](docs/ADVANCED_GAMEPLAY.md)
- **Real-Time Socket.IO Contracts:** [`docs/SOCKET_EVENTS.md`](docs/SOCKET_EVENTS.md)
- **Phase 5 System Architecture:** [`docs/PHASE_5_ARCHITECTURE.md`](docs/PHASE_5_ARCHITECTURE.md)
- **Phase 4 Game Engine Architecture:** [`docs/GAME_ENGINE_ARCHITECTURE.md`](docs/GAME_ENGINE_ARCHITECTURE.md)
- **Phase 3 System Architecture:** [`docs/PHASE_3_ARCHITECTURE.md`](docs/PHASE_3_ARCHITECTURE.md)
- **Phase 2 System Architecture:** [`docs/PHASE_2_ARCHITECTURE.md`](docs/PHASE_2_ARCHITECTURE.md)
- **REST API Reference:** [`docs/API.md`](docs/API.md)

---

## 🗺️ Roadmap & Phases

- **Phase 1 (Completed):** SaaS Foundation, Auth, Onboarding, Profiles, Settings, Shell, Design System.
- **Phase 2 (Completed):** Multiplayer Room Management, Public Discovery, Lobby Presence, Socket.IO Sync, Host Controls & Transfer, Disconnect Recovery.
- **Phase 3 (Completed):** Real-Time HTML5 Drawing Canvas, Smooth Brush/Eraser Engine, Normalized Coordinates, Point Batching, Undo/Clear Sync, Snapshot Recovery.
- **Phase 4 (Completed):** Server-Authoritative Multiplayer Game Engine, Secret Word System, Timers, Live Guessing, Scoring, Progressive Hints, Leaderboard, and Match Persistence.
- **Phase 5 (Completed):** Match history, player analytics, social friend squad, notifications, achievements, moderation, security hardening.
- **Phase 6 (Completed):** Spectator Mode, Chronological Drawing Replay Engine, Custom Word Packs, Multilingual Word Banks (EN, HI, ES), Defined Game Modes (Normal, Hidden, Combination), and Advanced Room Configuration.
# DrawMate
