# Phase 5 System Architecture — Gaming SaaS Platform

## 1. Overview & Architectural Principles

Phase 5 completes the gaming platform by providing persistent social and competitive layers on top of real-time multiplayer drawing and guessing sessions.

### Principles:
1. **Server-Authoritative Match Persistence**: Only the server game engine creates completed match records. Clients cannot fabricate match statistics or alter leaderboards.
2. **Idempotent Finalization**: A game session cannot be finalized multiple times. Repeated finalization calls or concurrent reconnection events resolve safely without inflating user stats.
3. **Role-Based Server Authorization**: Operational and moderation actions (`kick`, `suspend`, `ban`, report resolution) require verified server roles (`admin`, `moderator`).
4. **Least-Privilege Data Exposure**: Passwords, hashes, reset tokens, session identifiers, and moderator private notes are never leaked in public endpoints or serialized objects.
5. **Decoupled Real-Time & Persistent Notifications**: Notifications are saved to MongoDB first and then pushed over Socket.IO to connected sockets joining the authenticated `user:<userId>` room.

---

## 2. Entity Relationship & Data Flow Diagram

```
                 +-----------------------+
                 |       User Model      |
                 |-----------------------|
                 | role: user|mod|admin  |
                 | profileVisibility     |
                 | stats (wins, streaks) |
                 +-----------+-----------+
                             |
       +---------------------+---------------------+
       |                     |                     |
       v                     v                     v
+--------------+      +--------------+      +------------------+
|  Friendship  |      | Notification |      | UserAchievement  |
|--------------|      |--------------|      |------------------|
| requesterId  |      | recipientId  |      | userId           |
| recipientId  |      | type, isRead |      | achievementId    |
| status       |      | data payload |      | unlockedAt       |
+--------------+      +--------------+      +------------------+
                             ^
                             | (Triggers on completion)
                 +-----------+-----------+
                 |      MatchResult      |
                 |-----------------------|
                 | gameId (unique index) |
                 | roomCode, rounds      |
                 | players (stats, rank) |
                 | winner, status        |
                 +-----------+-----------+
                             ^
                             |
                   Authoritative Game
                   (Game.ts engine)
```

---

## 3. Domain Modules

### 3.1 Match History & Statistics (`MatchHistoryService`)
- Sourced directly from `MatchResult` MongoDB records.
- Calculates aggregates: games played, wins, losses, win rate `(wins / gamesPlayed) * 100`, average score, highest score, current and best win streaks.
- Includes an administrative rebuild utility: recalculates player stats deterministically by aggregating all canonical completed `MatchResult` records for a user.

### 3.2 Social Hub & Player Discovery (`SocialService`)
- Search: Case-insensitive prefix search on `normalizedUsername` and `displayName`, rejecting self and blocked accounts.
- Friendship Lifecycle:
  - `pending` -> Requester initiates, recipient can `accept` or `decline`.
  - `accepted` -> Both players are mutual friends.
  - `declined` / `cancelled` -> Resolved states allowing subsequent requests if not blocked.
- Blocks: When user A blocks user B, any active friendship or pending requests between them are terminated. User B cannot find or request user A.

### 3.3 Notifications (`NotificationService`)
- Persisted in MongoDB with an unread status flag.
- Real-time emission: When a user authenticates via Socket.IO, their socket joins `user:<userId>`. Notifications are broadcast to this channel in real time (`notification:new`).
- Channels honored via user preferences (`gameInvites`, `emailNotifications`, `productUpdates`).

### 3.4 Achievement Progression (`AchievementService`)
- Centralized catalogue:
  - `first_game`: "First Canvas" — Finish your first match.
  - `first_win`: "Master Guesser" — Win a multiplayer game.
  - `five_matches`: "Seasoned Doodler" — Complete 5 matches.
  - `ten_guesses`: "Sharp Instincts" — Reach 10 correct guesses.
  - `streak_3`: "Triple Threat" — Achieve a 3-game win streak.
  - `high_scorer`: "High Roller" — Score 1,500+ points in a single match.
- Evaluated deterministically at match end; awards are strictly idempotent (`UserAchievement` unique index).

### 3.5 Global Leaderboards (`LeaderboardService`)
- Categories:
  - `score`: Total points accumulated across completed matches.
  - `wins`: Total games won.
  - `winRate`: Win percentage (minimum 3 games played required to avoid 1-game skew).
- Computes rank with standard competition ranking (1, 2, 2, 4) for ties.
- Retrieves the requesting user's actual position regardless of pagination page.

### 3.6 Reporting, Moderation & Audit Logs (`ModerationService`)
- Reporting: Users can report bad actors, malicious sketches, or abusive chat messages.
- Moderation Lifecycle: `open` -> `under_review` -> `resolved` / `dismissed`.
- Disciplinary Actions:
  - Room Kick: Host or moderator forcefully ejects player from room via `room:moderation_kick`.
  - Suspension: Sets `suspendedUntil` date; blocks authentication and room joins until expiration.
  - Account Ban: Sets `status: 'suspended'` permanently.
- Audit Log: Records `actorId`, `action`, `targetId`, `reason`, and timestamp for administrative traceability.

### 3.7 Observability & Health
- `GET /api/health`: Returns process status, uptime, memory usage, and timestamp.
- `GET /api/health/ready`: Validates active database connectivity before reporting readiness.
