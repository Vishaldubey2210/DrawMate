# DrawMate Phase 2 — System Architecture Specification

## 1. Executive Summary & Architectural Scope

Phase 2 establishes the core real-time multiplayer multiplayer room, lobby, presence, and host synchronization foundation for **DrawMate**, a production-grade multiplayer drawing and guessing platform.

Phase 2 provides:
- **Authoritative Server Coordination:** Complete state ownership is maintained on the Node.js / Express backend with Socket.IO; client payloads are validated, sanitised, and never trusted for security-critical operations (identity, host privileges, readiness).
- **Hybrid In-Memory + MongoDB Persistence:** Fast, low-latency, in-memory lobby management (`RoomManager`) paired with persistent room configuration in MongoDB for durability and indexing.
- **Cryptographic Room Identification:** Non-confusing, collision-safe 6-character room codes (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
- **Resilient Connection Handling:** 30-second disconnect grace period with state restoration, seamless reconnects without duplicate rosters, and deterministic host transfer when hosts leave.
- **Clean Boundaries for Phase 3:** Complete isolation of the room/lobby lifecycle from future game mechanics (canvas strokes, word guessing, timers, scoring).

---

## 2. Overall Real-Time Architecture

The system uses a hybrid architecture combining an Express REST API with an authoritative Socket.IO real-time engine attached to the primary Node.js HTTP server:

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Clients                       │
│      React 19 + Vite + Tailwind CSS + Socket.IO Client      │
└──────────────┬──────────────────────────────┬───────────────┘
               │ HTTP REST (CORS/Cookies)     │ WebSockets (JWT Auth)
               ▼                              ▼
┌──────────────────────────────┐  ┌───────────────────────────┐
│     Express REST Router      │  │     Socket.IO Server      │
│  - /api/auth/*               │  │  - Handshake Auth         │
│  - /api/rooms/public         │  │  - Event Handlers         │
│  - /api/rooms/:code/check    │  │  - Room Channels          │
└──────────────┬───────────────┘  └───────────┬───────────────┘
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Authoritative RoomManager                   │
│   (In-Memory Singleton: Rosters, Readiness, Timers, Locks)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Reads/Writes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      MongoDB Database                       │
│    - Users Collection (Auth, Profiles)                      │
│    - Rooms Collection (Config, Visibility, Host, Lifecycle) │
└─────────────────────────────────────────────────────────────┘
```

### Module Organization
- `server/src/realtime/socket.ts`: HTTP server binding, CORS configuration, Socket.IO instance initialization.
- `server/src/realtime/socketAuth.ts`: Handshake authentication middleware verifying access tokens against MongoDB.
- `server/src/realtime/socketHandlers.ts`: Thin event controllers dispatching client requests to `RoomManager` and broadcasting snapshots.
- `server/src/services/RoomManager.ts`: Authoritative domain service managing live room state, locks, timers, presence, and host transfers.
- `server/src/models/Room.ts`: Mongoose schema and model persisting room records.
- `server/src/schemas/roomSchemas.ts`: Zod validation schemas for all incoming room settings and actions.

---

## 3. Socket.IO Handshake Authentication & Security

### 3.1 Handshake Flow
1. Client initiates Socket.IO connection providing bearer token via `socket.handshake.auth.token` or HTTP-only cookies (`socket.handshake.headers.cookie`).
2. `socketAuthMiddleware` parses and verifies the JWT token using `JWT_ACCESS_SECRET`.
3. The authenticated user is queried from MongoDB to ensure the account exists and is not suspended.
4. Authoritative profile information (`userId`, `username`, `displayName`, `avatar`) is attached directly to `socket.data.user`.
5. If invalid or missing, the handshake is rejected with `new Error('Authentication required')`.

### 3.2 Security Guarantees
- **No Client-Supplied Identity:** Operations (ready, start, leave, settings) derive the acting user purely from `socket.data.user.userId`.
- **No Client Host Impersonation:** Host privilege checks compare `socket.data.user.userId` with `room.hostId` stored in server memory and database.
- **Strict Payload Validation:** All event payloads are parsed with Zod schemas (`createRoomSchema`, `updateSettingsSchema`, etc.), rejecting unexpected fields and invalid formats.
- **Restricted Broadcasts:** Sockets are joined strictly to Socket.IO channel `room:${roomCode}` on verified join/creation; clients cannot inject messages into rooms they do not belong to.

---

## 4. Room Identity & Code Generation

### 4.1 Room Codes
- **Length:** 6 characters.
- **Alphabet:** `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (Base-32).
  - Explicitly excludes `0` (zero) and `O` (uppercase O).
  - Explicitly excludes `1` (one) and `I` (uppercase I).
- **Generation:** Utilizes `crypto.randomInt` for cryptographic unpredictability.
- **Normalization:** Room codes are trimmed and uppercased upon intake across all REST and Socket.IO endpoints.
- **Collision Handling:** Room creation checks both in-memory `RoomManager` and MongoDB with retry loops up to 10 attempts; MongoDB maintains a unique sparse index on `roomCode`.

---

## 5. Room Domain Model & Lifecycle

### 5.1 Lifecycle States
- `waiting`: Lobby is open; players can join, toggle ready/unready; host can adjust settings.
- `starting`: Host initiated start; server validated player count (≥ 2) and readiness (100%). Ready to transition into gameplay.
- `in_game`: Reserved for Phase 3 drawing canvas and game loop.
- `closed`: Room has terminated; no further actions or joins allowed.

### 5.2 Room Settings & Permitted Ranges
Settings are strictly validated on both client and server:

| Setting | Type | Range / Options | Default | Description |
|---|---|---|---|---|
| `visibility` | Enum | `'public'`, `'private'` | `'private'` | Public rooms appear in discovery |
| `maxPlayers` | Number | 2 – 20 | 8 | Upper capacity limit |
| `rounds` | Number | 2 – 10 | 3 | Total rounds per game |
| `drawTimeSeconds`| Number | 15 – 240 | 80 | Turn duration in seconds |
| `wordCount` | Number | 1 – 5 | 3 | Words offered to artist |
| `hints` | Number | 0 – 5 | 2 | Hints revealed over turn duration |
| `wordMode` | Enum | `'normal'`, `'hidden'`, `'combination'` | `'normal'` | Word display variant |
| `category` | String | `'general'`, `'animals'`, `'food'`, `'technology'`, `'gaming'` | `'general'` | Vocabulary pool |

---

## 6. Player Presence, Readiness & Reconnection

### 6.1 Real-Time Presence
Each player in `room.players` contains:
- `userId`: Canonical account identifier.
- `username`: Unique handle.
- `displayName`: Profile display name.
- `avatar`: Profile avatar string or generated URL.
- `isHost`: Boolean indicating host ownership.
- `isReady`: Readiness toggle state.
- `isDisconnected`: Boolean indicating active socket vs. temporary disconnect.
- `socketId`: Current active Socket.IO connection ID.
- `joinedAt`: Timestamp used for deterministic host succession.

### 6.2 Temporary Disconnect & 30-Second Grace Period
1. When a client socket disconnects unexpectedly without an explicit `room:leave` event:
   - The player's `isDisconnected` flag is set to `true`.
   - A 30-second grace timer is initiated via `disconnectTimers.set(userId, timer)`.
   - The room broadcasts `room:player_presence` to inform lobby members.
2. If the user reconnects within 30 seconds:
   - The pending timer is cleared and removed.
   - The player's `socketId` is updated and `isDisconnected` is restored to `false`.
   - Authoritative snapshot is returned to the user without duplicating player cards.
   - `room:player_presence` is broadcast with `isDisconnected: false`.
3. If the timer expires:
   - The player is removed from the active roster.
   - If the departed player was the host, deterministic host transfer executes immediately.
   - If 0 players remain, the room is closed and cleaned up.
   - Room broadcasts `room:player_left`.

### 6.3 Intentional Departure
When a player clicks "Leave Room" (`room:leave` event):
- The departure is executed immediately without grace period delay.
- The player is removed from `room.players`.
- If the leaving player was the host, ownership transfers to the oldest connected participant.
- The client receives an acknowledgment and leaves the Socket.IO room channel.

### 6.4 Host Transfer Policy
When the active host leaves (intentionally or via grace period expiry):
1. Remaining participants who are connected (`isDisconnected === false`) are filtered.
2. The oldest connected participant (ordered by `joinedAt` ascending) is selected.
3. If no connected participants are available, any remaining participant is selected.
4. If 0 participants remain, the room state is transitioned to `closed` and deleted from memory.
5. Otherwise, `room.hostId` is updated in memory and MongoDB, and `room:player_left` broadcasts the `newHostId`.

---

## 7. Public Room Discovery vs. Private Rooms

### 7.1 Public Rooms
- Created with `visibility: 'public'`.
- Visible in `GET /api/rooms/public` and the `/rooms` UI browser.
- Displays sanitized data: room code, room name, host displayName/avatar, current players, max capacity, settings summary.
- Filterable by title/code and capacity status.

### 7.2 Private Rooms
- Created with `visibility: 'private'`.
- **Strictly filtered out** of `GET /api/rooms/public` database queries (`visibility: 'public'` condition).
- Accessible exclusively via direct room code or shareable invite URL (`/rooms/:roomCode`).

---

## 8. Persistence & Multi-Instance Architecture

### 8.1 Current Single-Instance Model
The Phase 2 server runs as an authoritative single-instance service:
- Active room operations (real-time presence, socket IDs, grace timers) reside in `RoomManager` memory for sub-millisecond responsiveness.
- Durable configuration and room metadata reside in MongoDB (`Room` collection).
- On server restart: In-memory active connections drop; sockets reconnect automatically and can re-join valid rooms. Any dangling rooms with 0 players are purged or closed.

### 8.2 Horizontal Scaling Strategy (Future Phases)
To scale beyond a single Node.js instance:
1. **Socket.IO Redis Adapter (`@socket.io/redis-adapter`):** Enables event broadcasting across multiple server instances via Redis Pub/Sub.
2. **Redis In-Memory State (`ioredis`):** Migrate `RoomManager` maps (players, readiness, timers) into Redis hashes with TTLs.
3. **Sticky Sessions:** Configure load balancers (e.g., NGINX, ALB) for session affinity based on socket connection cookies/handshakes.

---

## 9. Integration Boundary with Phase 3 (Drawing & Game Engine)

Phase 2 deliberately isolates the room and lobby management from game logic:
- The host start action (`room:start_request`) performs real validation:
  1. Room must have at least 2 connected players (`connectedCount >= 2`).
  2. All connected players must be marked ready (`allReady === true`).
- Upon meeting criteria, Phase 2 returns `{ success: true, message: 'Lobby validated and ready to start game! Phase 3 will launch game canvas.' }`.
- In Phase 3, this handler will transition `lifecycle: 'in_game'`, spawn the game round timer loop, initialize the secret word repository, and dispatch the first drawer turn.

---

## 10. Automated Testing & Verification

Comprehensive automated test suites cover all layers:
- **Server Tests (30 / 30 passing):**
  - Unit tests for room code generation and collision avoidance.
  - Integration tests for room creation, public discovery, private exclusion, and REST endpoints.
  - Multi-client Socket.IO integration tests (`rooms_realtime.test.ts`):
    - Handshake authentication.
    - Two-player room join and snapshot synchronization.
    - Real-time readiness toggling.
    - Host-only settings updates (authorized vs. unauthorized non-host rejection).
    - Host start request validation (failing when players not ready, succeeding when ready).
    - Disconnection, 30s grace timer handling, and reconnect restoration.
    - Host departure and automatic host transfer to the second player.
- **Client Tests (15 / 15 passing):**
  - Room browser rendering, public lists, and empty states.
  - Join by code card normalization and validation.
  - Real-time Player Roster badges (Host crown, ready tags, disconnect indicators).
  - Room Settings card and host controls.
  - Copy invite button clipboard handling.
