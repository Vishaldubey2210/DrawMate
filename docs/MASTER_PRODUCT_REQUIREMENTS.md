# DrawMate — Master Product Requirements Document (PRD)

## 1. Document Control & Executive Summary
- Document Version: 1.0.0
- System: DrawMate Real-Time Multiplayer Drawing & Guessing SaaS
- Authoritative Runtime: Express 4.x, Socket.IO 4.x, React 18, Vite 6, Tailwind CSS, MongoDB 7.x, FastAPI QuickDraw ML Service
- Status: Ratified Production Specification

DrawMate is a production-grade, server-authoritative multiplayer drawing-and-guessing web platform designed for competitive, casual, and social party play. This document defines the ratified product requirements, user journeys, data contracts, security perimeters, and boundary definitions derived from the actual code base and operational testing.

---

## 2. Core User Personas & Permissions Hierarchy

### 2.1 Anonymous Guest
- Discovery and landing page navigation (`/`, `/about`).
- Exploration of public game lobbies via unauthenticated preview endpoints.
- AI Practice Mode sandbox (drawing freely against the local/cloud Quick, Draw! neural classifier without score persistence).
- Requirements: Must register or authenticate to participate in multiplayer matches, persist match history, create custom word packs, or acquire achievements.

### 2.2 Standard Player (Authenticated)
- Account lifecycle: Self-service registration, bcrypt-secured authentication, session cookie management, profile updates (display name, custom avatar, theme, audio preferences).
- Social & Matchmaking: Create and join public/private game rooms with custom room codes.
- Gameplay: Turn-based drawing, stroke synchronization, guessing, AFK timeout handling, smart reconnect.
- Modes: Classic multiplayer, Imposter Mode, multilingual word banks (English, Hindi, Spanish), custom word packs.
- Social Features: Player profiles, match history, match replay viewer, personal stats, achievement badges.

### 2.3 Room Host (Contextual Role)
- Room creation and configuration: Max players (2-20), rounds (2-10), draw time (15s-240s), word choices (1-5), hints (0-5), word mode (`normal`, `hidden`, `combination`), language (`en`, `hi`, `es`), game mode (`classic`, `imposter`).
- Lobby management: Kick uncooperative participants, transfer host role, toggle spectator allowances.
- Match start authority: Server-authoritative start trigger once all players are marked ready.

### 2.4 Platform Administrator (`role: 'admin'`)
- Operational monitoring: Direct inspection of Prometheus-compatible `/api/observability/metrics` and system health.
- Audit logs: Querying historical administrative actions, security rejections, and moderation events.
- Feature flags: Runtime toggling of system flags (`enableGenAIWordPacks`, `enableImposterMode`, `enableDrawingReplay`, `maintenanceMode`) without requiring server reboot.
- Moderation oversight: Inspecting player reports and moderation intervention metrics.

---

## 3. Multiplayer Game Modes & Rules Engine

### 3.1 Classic Mode (Server-Authoritative Turn Progression)
1. **Lobby Assembly**: Players assemble in room; minimum 2 players required. Each player must assert `room:ready`.
2. **Word Selection Phase (15 seconds)**:
   - Server randomly assigns the active drawer.
   - Server selects 3 candidate words based on category and adaptive difficulty metrics.
   - Candidates are delivered *strictly* to the active drawer (`snapshot.word.choices`). Observers receive empty choice arrays.
   - If drawer times out without choosing, server authoritatively selects the first candidate.
3. **Drawing Phase (configurable 15s - 240s)**:
   - Only the active drawer is authorized to dispatch `draw:stroke_start`, `draw:stroke_points`, `draw:stroke_end`, `draw:undo`, and `draw:clear`. Unauthorized draw attempts are discarded with HTTP/Socket error events.
   - Non-drawing participants submit guesses via `game:guess`.
   - Normalization: Guesses are lowercased, stripped of non-alphanumeric punctuation, and trimmed.
   - Fair-Play Rate Limiting: Max 6 guesses per 5 seconds per player; duplicate consecutive guesses are rejected.
   - Scoring: First correct guesser receives up to 500 points (decaying by time elapsed); subsequent correct guessers receive decaying points; drawer receives bonus points proportional to how many players guessed correctly.
   - Hints: Automated hint timers reveal periodic letters (or mask hints) according to room configuration.
   - AFK Protection: 20 seconds of drawer inactivity triggers a warning; continued inactivity skips the turn.
4. **Round Summary Phase (5 seconds)**: Displays secret word, points awarded, and updated leaderboard.
5. **Game Over Phase**: Persists `Match` record to MongoDB with player statistics and awards achievements.

### 3.2 Imposter Mode (Social Deduction)
1. **Prerequisites**: Minimum 4 players required.
2. **Role Assignment**: Server designates 1 secret Imposter; all other players are Innocents.
3. **Word Distribution**: Innocents receive the secret word (e.g., "Eagle") and category ("Animals"). The Imposter receives *only* the category clue ("Animals"). Observers/Spectators receive masked hints only.
4. **Sequential Drawing Phase**: Each player takes a brief turn (e.g., 20 seconds) contributing strokes to a single shared canvas without verbal discussion.
5. **Voting Phase (30 seconds)**: All players cast votes on who they suspect is the Imposter.
6. **Resolution & Scoring**:
   - If the majority identifies the Imposter: Innocents receive +150 points.
   - If the Imposter evades detection: Imposter receives +300 points bonus.
   - Imposter Guessing Clause: Imposter may guess the secret word for double bonus.

### 3.3 AI Practice Mode (Solo Sketch Recognition)
- Unauthenticated or authenticated player selects a category (from Quick, Draw! 345-class taxonomy).
- Player draws on canvas while browser dispatches stroke vectors to the local ML inference service (`POST /predict` or `/api/practice/predict`).
- Top-5 prediction probabilities and confidence scores are returned in real time (< 50ms inference latency).
- Zero database write overhead, enabling unlimited solo practice.

---

## 4. Room Lifecycle & Generational Reconnect

### 4.1 Room States
- `waiting`: Lobby open; players joining and readying up.
- `in_progress`: Match actively executing turns, rounds, or voting.
- `finished`: Final leaderboard presented; players may return to lobby or leave.

### 4.2 Smart Reconnect Specification
- Sockets authenticate via JWT Bearer handshake.
- Upon socket disconnect (network glitch, mobile sleep, tab reload), room session holds the player's slot for a 60-second grace window (`isDisconnected: true`).
- Upon reconnection with the same `userId`:
  - Socket rejoins the room channel and user room.
  - Room session restores player slot (`isDisconnected: false`).
  - Active game engine immediately delivers full viewer snapshot (`game:state`).
  - Drawing session manager immediately delivers full vector stroke history (`draw:state`).
  - Flag `isReconnect: true` is emitted, informing frontend to avoid full reset.

---

## 5. Security & Fair-Play Boundaries

### 5.1 Authentication & Authorization
- Password hashing using `bcryptjs` with salt rounds = 10.
- JWT access tokens (15-minute expiry) and refresh tokens (7-day HTTP-only cookies).
- CSRF protection on mutation routes.
- Strict input validation using Zod schemas on all HTTP bodies and Socket.IO payloads.

### 5.2 Word & Role Confidentiality
- Secret words and Imposter roles are sanitized *at the server boundary*. Sanitization is never entrusted to client-side filtering.
- Stroke coordinates must strictly satisfy normalized bounding boxes `x, y in [0, 1]` with widths `[0.001, 0.1]` and valid tools (`brush`, `eraser`).

### 5.3 Abuse & Resource Exhaustion Controls
- Express IP rate limiters on auth routes (`50 req / 15 min`), general routes (`300 req / 1 min`).
- In-memory registries (`guessRateLimits`, `userPredictionLimits`) bounded with key eviction above 2,000 items.
- Profanity and harassment filtering via `AIModerationService`.

---

## 6. SaaS Operational & Privacy Standards

### 6.1 Account Lifecycle & Privacy
- Users retain right to data export (`GET /api/users/profile`) and permanent deletion (`POST /api/users/delete-account`).
- Account deletion purges user profile, auth credentials, personal word packs, and sanitizes historical match records.
- Zero storage of raw audio, canvas video, or biometric stroke velocity.

### 6.2 Observability & Reliability
- Liveness probe (`/api/health`) verifies process uptime, heap memory, and socket connection counters.
- Readiness probe (`/api/health/ready`) verifies active MongoDB read/write connectivity.
- Prometheus metrics (`/api/observability/metrics`) tracks socket connect/disconnect rates, active rooms, room joins, drawing events, and reconnect recovery success.

---

## 7. Deferred & Non-Applicable Capabilities

The following features were reviewed during the Master Engineering Program and deliberately categorized as **Deferred / Not Applicable** for the current release:

1. **Credit Card Billing / Stripe Subscriptions**: DrawMate currently operates as a community and competitive SaaS without monetization mandates. Integrating payment webhooks prematurely adds third-party dependencies, failure modes, and compliance costs without business justification.
2. **Distributed Microservice Decomposition**: Splitting the real-time engine across multiple microservices (e.g. gRPC match service, Kafka stroke streamer) would introduce network hops and serialization latency into sub-millisecond drawing loops. The current modular monolith architecture meets all requirements cleanly.
3. **Distributed Redis Locks**: Premature introduction of distributed Redis locks for room state before horizontal multi-instance routing is deployed introduces operational overhead without performance gains.
