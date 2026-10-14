# DrawMate Socket.IO Real-Time Event Contracts — Phase 2

All Socket.IO connections connect to the base URL and must authenticate during the connection handshake.

---

## 1. Handshake Authentication

- **Transport:** WebSocket / Polling
- **Payload:**
  ```javascript
  io('/', {
    auth: { token: '<JWT_ACCESS_TOKEN>' }
  });
  ```
- **Server Verification:**
  - Extracts and verifies access token via JWT secret.
  - Verifies user existence and active account status in MongoDB.
  - Binds verified session to `socket.data.user = { userId, username, displayName, avatar }`.
  - Rejects invalid handshakes with `'Authentication required'` error.

---

## 2. Client-to-Server Events

### `room:create`
Creates a new game lobby.
- **Direction:** Client -> Server
- **Payload:**
  ```json
  {
    "name": "Art Masters Lobby",
    "visibility": "public",
    "settings": {
      "maxPlayers": 8,
      "rounds": 3,
      "drawTimeSeconds": 80,
      "wordCount": 3,
      "hints": 2,
      "wordMode": "normal",
      "category": "general"
    }
  }
  ```
- **Acknowledgment / Response:** `{ "success": true, "room": RoomSnapshot }`
- **Side Effect:** Automatically adds creator as host and joins Socket.IO room channel `roomCode`.

### `room:join`
Joins an existing room by room code.
- **Direction:** Client -> Server
- **Payload:**
  ```json
  {
    "roomCode": "7X9K2M"
  }
  ```
- **Acknowledgment / Response:** `{ "success": true, "room": RoomSnapshot, "isReconnect": false }`
- **Errors:**
  - `Room not found or has closed.`
  - `Room is full (maximum capacity reached).`
  - `Cannot join room: game is currently in_game.`

### `room:ready`
Toggles readiness state in the lobby.
- **Direction:** Client -> Server
- **Payload:**
  ```json
  {
    "roomCode": "7X9K2M",
    "isReady": true
  }
  ```
- **Acknowledgment / Response:** `{ "success": true, "isReady": true }`

### `room:update_settings`
Host-only action to modify room settings before match start.
- **Direction:** Client -> Server
- **Authorization:** Only current room host (`room.hostId === socket.data.user.userId`).
- **Payload:**
  ```json
  {
    "roomCode": "7X9K2M",
    "settings": {
      "rounds": 5,
      "drawTimeSeconds": 60,
      "wordCount": 4
    }
  }
  ```
- **Acknowledgment / Response:** `{ "success": true, "settings": RoomSettings }`
- **Errors:**
  - `Unauthorized: Only the room host can modify settings.`
  - `Cannot set max players lower than current player count.`

### `room:start_request`
Host requests validation to start the match.
- **Direction:** Client -> Server
- **Authorization:** Only current room host.
- **Payload:**
  ```json
  {
    "roomCode": "7X9K2M"
  }
  ```
- **Acknowledgment / Response:** `{ "success": true, "canStart": true, "message": "Lobby validation passed!" }`
- **Errors:**
  - `At least 2 connected players are required to start.`
  - `All players must be ready before starting. Waiting on: ...`

### `room:leave`
Intentional departure from the room.
- **Direction:** Client -> Server
- **Payload:**
  ```json
  {
    "roomCode": "7X9K2M"
  }
  ```
- **Acknowledgment / Response:** `{ "success": true }`
- **Side Effect:** Immediately removes player, transfers host if host left, and leaves socket channel.

### `room:get_state`
Requests the authoritative snapshot of the room.
- **Direction:** Client -> Server
- **Payload:** `{ "roomCode": "7X9K2M" }`
- **Response:** Emits `room:state` with `RoomSnapshot`.

---

## 3. Server-to-Client Broadcast Events

### `room:state`
Emitted whenever the room roster, settings, or readiness changes.
- **Payload:** `RoomSnapshot`
  ```json
  {
    "roomId": "651a2b...",
    "roomCode": "7X9K2M",
    "name": "Art Masters Lobby",
    "visibility": "public",
    "hostId": "651a2b...",
    "status": "waiting",
    "settings": { ... },
    "players": [
      {
        "userId": "651a2b...",
        "username": "alex",
        "displayName": "Alex Painter",
        "avatar": "avatar-1",
        "isHost": true,
        "isReady": true,
        "isDisconnected": false,
        "joinedAt": "2026-10-13T12:00:00.000Z"
      }
    ],
    "currentPlayersCount": 1,
    "maxPlayers": 8,
    "isLobbyReadyToStart": false,
    "createdAt": "2026-10-13T12:00:00.000Z"
  }
  ```

### `room:player_joined`
Broadcast to peers when a new player connects.
- **Payload:** `{ "user": { "userId", "displayName", "username", "avatar" }, "isReconnect": false }`

### `room:player_left`
Broadcast to peers when a player departs or disconnect grace expires.
- **Payload:** `{ "userId": "...", "displayName": "...", "newHostId": "..." }`

### `room:player_presence`
Broadcast when a player unexpectedly disconnects (enters 30s grace).
- **Payload:** `{ "userId": "...", "isDisconnected": true, "message": "..." }`

### `room:player_ready`
Broadcast when a player toggles their readiness.
- **Payload:** `{ "userId": "...", "isReady": true }`

### `room:settings_updated`
Broadcast when the host modifies room rules.
- **Payload:** `{ "settings": { ... }, "updatedBy": "Host Display Name" }`

### `room:closed`
Broadcast when the host closes the room or all participants depart.
- **Payload:** `{ "reason": "Host closed the room or all players departed." }`

### `room:error`
Emitted to the initiating socket upon any operation failure.
- **Payload:** `{ "success": false, "error": "Descriptive message" }`

---

## 3. Real-Time Drawing Events — Phase 3

### `draw:session_init`
Initializes or configures the drawing session for a room (host or dev test harness).
- **Direction:** Client -> Server
- **Payload:** `{ "roomCode": "7X9K2M", "drawerId": "user_id_optional" }`
- **Acknowledgment:** `{ "success": true, "session": CanvasSnapshot }`
- **Broadcast:** Emits `draw:state` snapshot to `room:${roomCode}`.

### `draw:stroke_start`
Drawer begins a new stroke.
- **Direction:** Client -> Server
- **Authorization:** Only current active drawer (`session.drawerId === socket.data.user.userId`).
- **Payload:**
  ```json
  {
    "roomCode": "7X9K2M",
    "strokeId": "stroke_12345",
    "tool": "brush",
    "color": "#dc2626",
    "width": 0.015,
    "point": { "x": 0.25, "y": 0.35 }
  }
  ```
- **Acknowledgment:** `{ "success": true, "stroke": Stroke, "revision": number }`
- **Broadcast:** Emits `draw:stroke_started` with `{ stroke, revision }` to room peers.

### `draw:stroke_points`
Drawer streams intermediate points for the active stroke.
- **Direction:** Client -> Server
- **Authorization:** Only current active drawer.
- **Payload:**
  ```json
  {
    "roomCode": "7X9K2M",
    "strokeId": "stroke_12345",
    "points": [
      { "x": 0.26, "y": 0.36 },
      { "x": 0.28, "y": 0.38 }
    ]
  }
  ```
- **Acknowledgment:** `{ "success": true, "strokeId": string, "points": Point[] }`
- **Broadcast:** Emits `draw:stroke_update` with `{ strokeId, points }` to room peers.

### `draw:stroke_end`
Drawer completes the active stroke.
- **Direction:** Client -> Server
- **Authorization:** Only current active drawer.
- **Payload:**
  ```json
  {
    "roomCode": "7X9K2M",
    "strokeId": "stroke_12345",
    "points": [{ "x": 0.30, "y": 0.40 }]
  }
  ```
- **Acknowledgment:** `{ "success": true, "completedStroke": Stroke, "revision": number }`
- **Broadcast:** Emits `draw:stroke_completed` with `{ completedStroke, revision }` to room peers.

### `draw:undo`
Drawer undoes the last completed stroke from canonical history.
- **Direction:** Client -> Server
- **Authorization:** Only current active drawer.
- **Payload:** `{ "roomCode": "7X9K2M" }`
- **Acknowledgment:** `{ "success": true, "removedStrokeId": string, "revision": number }`
- **Broadcast:** Emits `draw:undo_applied` with `{ removedStrokeId, revision }` to all room members.

### `draw:clear`
Drawer removes all strokes and clears the canvas.
- **Direction:** Client -> Server
- **Authorization:** Only current active drawer.
- **Payload:** `{ "roomCode": "7X9K2M" }`
- **Acknowledgment:** `{ "success": true, "revision": number }`
- **Broadcast:** Emits `draw:canvas_cleared` with `{ revision }` to all room members.

### `draw:get_state`
Any authorized participant requests the full authoritative canvas snapshot (used on initial mount or reconnect).
- **Direction:** Client -> Server
- **Payload:** `{ "roomCode": "7X9K2M" }`
- **Acknowledgment:** `{ "success": true, "state": CanvasSnapshot }`
- **Response:** Also emits `draw:state` snapshot to requesting socket.

### `draw:error`
Emitted to the initiating socket upon validation or authorization failure.
- **Payload:** `{ "success": false, "error": "Descriptive message" }`

---

## 5. Phase 6 — Spectator Real-Time Events

### `room:join_spectator`
Authorized user requests to join room in spectator role.
- **Direction:** Client -> Server
- **Payload:** `{ "roomCode": "7X9K2M" }`
- **Server Authorization & Verification:**
  - Checks `spectatorsAllowed` setting on room.
  - Checks `currentSpectatorsCount < maxSpectators` limit.
  - If match is active, verifies `allowLateSpectators` is permitted.
  - Registers session in `room.spectators` Map.
- **Acknowledgment:** `{ "success": true, "room": RoomSnapshot, "isSpectator": true }`
- **Broadcast:** Emits `room:state` updating spectator roster and count to all room occupants.

### `room:leave_spectator`
Spectator requests departure from room.
- **Direction:** Client -> Server
- **Payload:** `{ "roomCode": "7X9K2M" }`
- **Acknowledgment:** `{ "success": true }`
- **Broadcast:** Emits `room:state` with decremented spectator count.

### `chat:spectator_message`
Spectators send non-gameplay chat messages to the room.
- **Direction:** Client -> Server
- **Payload:** `{ "roomCode": "7X9K2M", "text": "Great sketch!" }`
- **Server Guarantee:**
  - Tagged as non-gameplay chat.
  - Strictly excluded from secret word guessing validation.
  - Never triggers points or score bonuses.
- **Broadcast:** Emits `chat:message` with `{ id, userId, displayName, text, isSpectator: true, timestamp }` to room peers.

