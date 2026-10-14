# Fair Play, AFK Protection & Anti-Abuse Policy

## 1. Overview
DrawMate enforces server-authoritative fair play rules to ensure matches remain active, entertaining, and free of spam or disruptive behavior.

---

## 2. Drawer AFK Inactivity Detection
- **Role-Based Activity Signal**: Only the authorized active drawer is tracked for drawing activity. Guessers and observers are not penalized for quiet observation.
- **Activity Signal Source**: Drawing activity is recorded directly from server-validated stroke updates (`draw:stroke_start`, `draw:stroke_points`).
- **Warning Threshold**: If the drawer produces no drawing strokes for `min(20s, 35% of turn time)`:
  1. The server broadcasts `game:afk_warning` to the room with a 10-second countdown.
  2. If the drawer draws, `recordDrawerActivity` resets the warning and emits `game:afk_cleared`.
  3. If inactivity persists after the 10-second warning countdown:
     - The turn is automatically skipped via `endRound('afk_skip')`.
     - `game:afk_turn_skipped` is emitted to all room participants.
     - An audit log entry is recorded in `AuditLog` (`action: AFK_TURN_SKIPPED`).
- **Precedence Over Disconnect**: Network disconnects enter the Reconnection Grace Period flow rather than being misclassified as ordinary AFK inactivity.

---

## 3. Guess Rate Limiting & Anti-Spam
To prevent automated brute-forcing or chat flooding:
- **Rate Limit Window**: Players may submit a maximum of **6 guesses per 5-second sliding window**. Excess attempts are rejected with `Guess rate limit reached. Please wait a moment.`
- **Consecutive Duplicate Suppression**: Identical trimmed, lowercase guesses from the same player are rejected with `Duplicate guess ignored.`
- **Post-Solve Suppression**: Once a player has solved the word in a round, further guesses are rejected to prevent message spam.

---

## 4. Host Moderation & Kicks
- Room hosts have authority to kick disruptive participants via `room:kick_player`.
- Kicked participants are removed from the room, their socket is disconnected from the room channel, and their `userId` is added to `room.bannedUserIds` to prevent rejoining.
- Every host moderation action is permanently audited in `AuditLog` (`action: ROOM_KICK_PLAYER`).
