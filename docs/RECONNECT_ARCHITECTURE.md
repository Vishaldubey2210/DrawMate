# Smart Reconnect & Room Recovery Architecture

## 1. Overview
In a real-time multiplayer drawing and guessing SaaS application, network drops, mobile tab swaps, and browser refreshes are common occurrences. The **Smart Reconnect & Room Recovery** system ensures players seamlessly restore their active game participation without resetting timers, creating duplicate identities, resetting scores, or leaking role-specific secret words.

---

## 2. Stable Player Identity Model
DrawMate separates socket lifecycle from participant state:
- **Account Identity**: Authenticated `userId` derived from server-verified JWT token.
- **Room Membership**: Maintained in `RoomSession.players` (`Map<string, PlayerSession>`), keyed by stable `userId`.
- **Active Socket Connection**: `player.socketId` is dynamic and updated upon reconnection.
- **Temporary Disconnect State**: `isDisconnected: boolean` and `disconnectedAt: Date`.
- **Game Participation**: Maintained in `Game.players` and `Game.scores`, completely independent of socket ID.

---

## 3. Disconnect Handling & Grace Period
When a Socket.IO connection drops:
1. `RoomManager.handlePlayerLeave(roomCode, userId, false)` marks `isDisconnected = true`.
2. Any active incomplete stroke being drawn by the user is safely cancelled via `DrawingSessionManager.cancelActiveStroke(roomCode, userId)`.
3. A 30-second configurable grace period timer (`RoomManager.disconnectGracePeriodMs`) begins.
4. **Generation Token Protection**: To prevent delayed timer callbacks from removing a player who reconnected right before timeout expiration, an integer generation counter (`disconnectGenerations: Map<string, number>`) is incremented. If the generation at callback execution does not match the active generation, the cleanup callback aborts immediately.

---

## 4. Reconnection Procedure & Authoritative State Restoration
When a player reconnects:
1. Socket handshake validates JWT token (`socketAuthMiddleware`).
2. Player emits `room:join` with their target `roomCode`.
3. `RoomManager.joinRoom` checks if the authenticated user is already in `room.players`:
   - If present, reconnection is authorized **even if `room.status === 'in_game'`**.
   - Pending disconnect timer is cleared.
   - `disconnectGenerations` is incremented, neutralizing any in-flight expiration callbacks.
   - Socket ID is rebound, and `isDisconnected = false`.
4. Reconnecting socket immediately receives:
   - `room:joined` with `{ isReconnect: true }`
   - `room:state` sanitized lobby snapshot
   - `game:state` role-sanitized game state snapshot (see section 5)
   - `draw:state` authoritative canvas snapshot with stroke history
5. The remaining room participants receive `room:player_joined` and `room:player_presence` updating the player's online status.

---

## 5. Security & Timer Preservation
- **Secret Word Confidentiality**: The secret word is strictly masked in `getViewerSnapshot(viewerUserId)` for all guessers and spectators. Only the current drawer receives the unmasked secret word and word choices.
- **Authoritative Timers**: Timers are maintained on the server as absolute timestamp deadlines (`timerDeadline: number`). The client countdown calculates `Math.ceil((deadline - Date.now()) / 1000)`. Reconnection never resets or alters the turn deadline.
