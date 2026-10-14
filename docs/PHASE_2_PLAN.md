# Phase 2 Implementation Plan — Multiplayer Room, Lobby & Real-Time Presence System

## 1. Audit Assessment of Phase 1 Foundation
- **Authentication & User Identity:** Phase 1 established persistent accounts in MongoDB with JWT tokens (access: 15m, refresh: 7d), HTTP-only cookies, and unique normalized usernames. This canonical identity will be verified during the Socket.IO connection handshake to ensure no client can spoof user IDs, usernames, or avatars.
- **Design System & Shell:** Reusable atomic UI components (`Button`, `Input`, `Badge`, `Avatar`, `Modal`, `ConfirmDialog`, `Toast`, `PageHeader`, `ThemeToggle`) and responsive layouts are ready to host the Room Browser, Room Creator, and Lobby UI.
- **Existing Placeholders:** Routes such as `/rooms` are ready to be transformed from static indicators into the live Room Browser, Create Room modal, Join by Code interface, and real-time Room Lobby (`/rooms/:roomCode`).

---

## 2. Phase 2 Scope & Architectural Design

### 2.1 Backend Architecture (`server/src/realtime/` & `server/src/services/`)
- **HTTP & Socket.IO Hybrid Server:** Mount Socket.IO onto the HTTP server in `server/src/index.ts`.
- **Handshake Authentication:** Extract JWT token from `socket.handshake.auth.token` or `socket.handshake.headers.cookie`. Look up the canonical `User` in MongoDB. Attach `socket.data.user = { userId, username, displayName, avatar }`. Reject unauthenticated connections with descriptive errors.
- **Authoritative In-Memory & Database Coordination:**
  - `Room` model in MongoDB: Persists room ID, unique 6-character room code (unambiguous charset `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), room name, visibility (`public` | `private`), host ID, room settings, lifecycle status (`waiting` | `starting` | `in_game` | `closed`), and timestamps.
  - `RoomManager` (Singleton in-memory service): Fast in-memory state for active lobbies (socket maps, player readiness, presence timestamps, reconnect grace timers).
  - Periodic and on-event synchronization ensuring consistency between MongoDB and active memory.
- **Player Limits & Concurrency:** Max players constrained between 2 and 20. Atomic join locks prevent capacity overflow when multiple clients attempt to join simultaneously.
- **Disconnection & Reconnection Strategy:**
  - Grace period: 30 seconds default.
  - On socket disconnect: mark participant `isDisconnected = true`, start 30s timer, broadcast presence change.
  - If user reconnects within 30s with valid JWT: restore active connection, cancel timer, send authoritative snapshot, notify lobby.
  - If grace period expires: finalize departure, trigger host transfer if departed user was host, recalculate readiness, clean up empty rooms.
  - On explicit `room:leave`: immediate departure without grace period delay.
- **Host Permissions & Deterministic Host Transfer:**
  - Only the authoritative host can modify settings or initiate game start requests.
  - If the host leaves or disconnects beyond grace period: ownership transfers automatically to the oldest eligible connected participant. If 0 players remain, room transitions to `closed` and cleans up.
- **Settings Range Enforcement:**
  - `visibility`: `'public'` | `'private'`
  - `maxPlayers`: 2–20 (default 8)
  - `rounds`: 2–10 (default 3)
  - `drawTimeSeconds`: 15–240 (default 80)
  - `wordCount`: 1–5 (default 3)
  - `hints`: 0–5 (default 2)
  - `wordMode`: `'normal'` | `'hidden'` | `'combination'` (default `'normal'`)
  - `category`: string (default `'general'`)

### 2.2 Frontend Architecture (`client/src/features/rooms/` & `client/src/pages/rooms/`)
- **Socket Client Service:** Singleton Socket.IO connection manager (`src/services/socket.ts`) with automatic authentication token injection, connection state tracking (`connected`, `connecting`, `disconnected`), and event listener cleanup.
- **Room Browser (`/rooms`):**
  - Public room listing with live capacity, host info, settings badges, and instant Join button.
  - Filter by search query, capacity status, and manual refresh trigger.
  - "Join by Code" input card with code normalization (uppercase, trimmed) and instant error feedback.
  - "Create Room" modal with comprehensive settings controls and validation preview.
- **Room Lobby (`/rooms/:roomCode`):**
  - Authoritative room header: Room name, room code badge, public/private badge, Copy Invite Link button.
  - Real-time Player Roster: Avatars, display names, host crown badge, ready/not-ready indicator, connection status tag.
  - Host Controls Panel: Edit Room Settings modal, Start Game button (with real validation requirement: min 2 connected players and 100% ready status; shows honest Phase 3 gameplay note on start confirmation).
  - Player Controls: Toggle Ready / Unready, Leave Room with confirmation modal.
  - Real-time notification banners for player joins, leaves, host transfers, and settings updates.

---

## 3. Real-Time Event Contracts (Summary)
Detailed in `docs/SOCKET_EVENTS.md`:
- `room:create` -> `room:created`
- `room:join` -> `room:joined`, broadcast `room:player_joined`
- `room:leave` -> `room:left`, broadcast `room:player_left`
- `room:ready` -> broadcast `room:player_ready`
- `room:update_settings` -> broadcast `room:settings_updated`
- `room:start_request` -> `room:start_result`
- `room:get_state` -> `room:state`
- `room:error` (actionable error message)

---

## 4. Acceptance Criteria
- [x] Phase 1 code preserved and functional.
- [x] Socket.IO server configured with JWT authentication handshake.
- [x] Room model in MongoDB with unique room codes and settings schema.
- [x] RoomManager singleton managing authoritative live rosters, readiness, and grace periods.
- [x] Public room discovery endpoint and UI browser displaying real live rooms.
- [x] Private rooms excluded from discovery but joinable via code / invite URL.
- [x] Real-time player readiness toggles and validation before game start.
- [x] Host-only authorization for settings updates and start requests.
- [x] Automatic host transfer on host departure/disconnect expiry.
- [x] Multi-client automated integration tests verifying multi-player synchronization.
- [x] Complete documentation in `docs/PHASE_2_PLAN.md`, `docs/PHASE_2_ARCHITECTURE.md`, `docs/SOCKET_EVENTS.md`, and `README.md`.
