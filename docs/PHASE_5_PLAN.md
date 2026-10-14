# Phase 5 Implementation Plan — Gaming SaaS Platform, Social, Analytics, Moderation & Deployment

## 1. Objectives & Executive Summary

Phase 5 elevates the DrawMate multiplayer drawing platform into a complete, secure, production-grade gaming SaaS platform. It builds upon:
- **Phase 1**: Authentication, Session Management, Onboarding, Profiles, Settings, and Dashboard.
- **Phase 2**: Real-time Rooms, Public/Private Lobbies, Presence, and Room Codes.
- **Phase 3**: HTML5 Canvas Drawing, Real-time Stroke Sync, Undo/Clear, and Recovery.
- **Phase 4**: Server-Authoritative Game Engine, Word Selection, Live Guessing, Turn Rotation, and Scoring.

Phase 5 delivers:
1. **Authoritative Match History & Finalization**: Exactly-once game completion persistence in MongoDB, historical match filtering, and match details.
2. **Player Analytics & Dynamic Statistics**: Calculation of wins, losses, win rate, score averages, streaks, and real-time dashboard analytics.
3. **Public Profiles & Privacy Controls**: Granular server-enforced privacy (`public`, `friends_only`, `private`) and shareable profiles.
4. **Friends & Social Hub**: Player discovery/search, full friend request lifecycle (send/accept/decline/cancel/remove), user blocking, and direct room invitations.
5. **Persistent Notification System**: System and in-game notifications (friend requests, room invites, achievements, match results) with Socket.IO live push and unread tracking.
6. **Achievement Progression System**: Server-validated achievement definitions, idempotent awards, and badge showcases.
7. **Competitive Leaderboards**: Server-computed rankings for total points, wins, and win rate with tie handling and authenticated player placement.
8. **Reporting & Moderation**: Player reports, role-based authorization (`user`, `moderator`, `admin`), disciplinary actions (room kicks, temporary suspensions, account bans), and immutable audit logs.
9. **Account Security, Lifecycle & Observability**: Safe data export, secure account deletion, rate limiting, role validation, health check endpoints (`/api/health`, `/api/health/ready`), and structured logging.
10. **Production Deployment & CI**: GitHub Actions workflow, Docker containerization, Docker Compose, Render configuration, and deployment guides.

---

## 2. Architecture & Data Model Enhancements

### 2.1 Database Models
- **`User` (Enhanced)**:
  - Add `role`: `'user' | 'moderator' | 'admin'` (default: `'user'`)
  - Update `profileVisibility`: `'public' | 'friends_only' | 'private'`
  - Add `blockedUserIds`: `string[]`
  - Add `suspendedUntil`: `Date | null`
  - Extended stats: `gamesPlayed`, `wins`, `losses`, `draws`, `winRate`, `totalScore`, `highestScore`, `correctGuesses`, `drawingTurns`, `currentStreak`, `bestStreak`
- **`MatchResult` (Enhanced)**:
  - Sourced authoritatively from `Game.ts` upon `endGame()` or `cancelGame()`
  - Indexed by `gameId` (unique), `roomCode`, and `players.userId`
- **`Friendship` (New)**:
  - `requesterId`, `recipientId`, `status`: `'pending' | 'accepted' | 'declined' | 'cancelled'`
  - Unique compound index on `[requesterId, recipientId]`
- **`Notification` (New)**:
  - `recipientId`, `type`, `title`, `message`, `data`, `isRead`, `createdAt`
  - Index on `[recipientId, isRead, createdAt]`
- **`UserAchievement` (New)**:
  - `userId`, `achievementId`, `unlockedAt`
  - Unique compound index on `[userId, achievementId]`
- **`Report` (New)**:
  - `reporterId`, `targetType` (`'user' | 'match' | 'room'`), `targetId`, `category`, `explanation`, `status` (`'open' | 'under_review' | 'resolved' | 'dismissed'`), `moderatorNotes`, `resolvedBy`, `resolvedAt`
- **`AuditLog` (New)**:
  - `actorId`, `action`, `targetType`, `targetId`, `reason`, `metadata`, `createdAt`

---

## 3. Implementation Steps & Acceptance Criteria

### Step 1: Data Integrity & Game Finalization
- Ensure `Game.ts` finalizes games exactly once using `isFinalized` lock.
- Record authoritative `MatchResult` and update each player's `User` record with derived stats.
- Trigger achievement evaluation and match notifications.

### Step 2: Match History & Player Statistics
- Build `MatchHistoryService` and REST endpoints: `GET /api/matches/my`, `GET /api/matches/:id`.
- Support filtering by status/outcome and bounded pagination.
- Add user statistics calculation & stats rebuild utility (`/api/users/stats/rebuild`).

### Step 3: Public Profiles & Social Hub
- Build `SocialService` and endpoints for search, friend requests, accepts, blocks, and room invites.
- Enforce profile visibility: public viewable by all, friends_only viewable only by accepted friends, private viewable only by self.

### Step 4: Notifications & Achievements
- Build `NotificationService` with REST endpoints (`GET /api/notifications`, mark read) and real-time Socket.IO emission to user rooms (`user:<userId>`).
- Define achievement catalog in `AchievementService` and server evaluation logic.

### Step 5: Competitive Leaderboards
- Build `LeaderboardService` and `GET /api/leaderboard` with categories: `score`, `wins`, `winRate`.
- Support player rank lookup for the requesting user.

### Step 6: Moderation & Admin Portal
- Build `ModerationService`, `Report` model, `AuditLog` model, and admin endpoints.
- Require `moderator` or `admin` role server-side.
- Enforce room kicks and account bans across login and room joins.

### Step 7: Security Hardening & Account Lifecycle
- Add personal data export (`GET /api/users/export`).
- Enhance account deletion to sanitize history and cascade social relationships.
- Health checks: `GET /api/health` and `GET /api/health/ready`.

### Step 8: Frontend SaaS Views & Integration
- Create `MatchHistoryPage`, enhance `ProfilePage` with full analytics and achievements.
- Implement real `FriendsPage`, `LeaderboardsPage`, and `AdminDashboardPage`.
- Add notification center dropdown in `AppLayout` and Report Player modal.

### Step 9: Testing, CI & Production Deployment
- Add comprehensive backend test suites in `server/tests/phase5_social_analytics.test.ts`.
- Add frontend test suite in `client/src/test/phase5.test.tsx`.
- Create `.github/workflows/ci.yml`, `Dockerfile`, `docker-compose.yml`, and `render.yaml`.
- Verify full test suite, linting, and production builds with exit code 0.
