# Advanced Features Implementation Plan

## 1. Executive Summary & Objective

This document outlines the architecture, implementation sequence, and acceptance criteria for integrating five core advanced product capabilities into the DrawMate multiplayer platform:

1. **Feature A — Smart Reconnect and Room Recovery**:
   - Stable player identity via authenticated account IDs (`userId`), independent of transient Socket.IO connection IDs.
   - Generation ID / Cancel Token based disconnect grace period (30s) preventing race conditions from delayed cleanup timers.
   - Multi-tab duplicate session prevention.
   - Authoritative state recovery: room, game phase, drawer, absolute deadlines, public scores, hints, canonical drawing strokes, role.
   - Role-specific snapshot delivery: secret words remain strictly hidden from guessers and spectators upon reconnection.
   - Incomplete stroke cancellation on drawer disconnect.

2. **Feature B — Mobile-First Drawing Experience**:
   - Full touch, pen, and mouse support via Pointer Events with capture and cancellation.
   - `touch-action: none` applied strictly to canvas container, preserving normal page scroll elsewhere.
   - Responsive touch-friendly toolbar with high-contrast active states, touch targets $\ge 44\text{px}$, and horizontal scrolling palette.
   - Server-authoritative **Redo** support (`draw:redo`, `draw:redo_applied`), with branch invalidation upon new stroke.
   - High-DPI coordinate consistency with normalized coordinates $[0, 1]$.
   - Mobile virtual keyboard adaptation for live guessing.

3. **Feature C — Fair Play, AFK Protection and Anti-Abuse**:
   - Server-authoritative drawer activity tracking (validated drawing operations reset AFK timer).
   - Configurable AFK policy: Inactivity warning threshold, countdown grace period, and automated turn-skip / round transition.
   - Separation of disconnect handling (grace period) from active AFK behavior.
   - Rate limiting and duplicate prevention for chat and guesses (max 5 guesses per 5 seconds, identical guess block).
   - Host kick capabilities (`room:kick_player`) and moderation audit logging (`AFK_WARNING`, `AFK_SKIP`, `ROOM_KICK`, `RATE_LIMIT_EXCEEDED`).

4. **Feature D — GenAI-Powered Word-Pack Generator**:
   - Extensible provider adapter abstraction supporting Google Gemini API, OpenAI API, and Mock/Heuristic provider.
   - Server-side prompt templating, JSON schema enforcement, and zero API key leakage to client.
   - Rigorous validation: 2–60 chars per word, 5–500 words per pack, duplicate rejection, and content-safety filtering.
   - Interactive generator UI modal (`GenAIWordPackModal`) in Word Packs page with editable preview before saving.
   - Robust fallback: normal gameplay and manual word packs remain 100% operational when AI provider is unavailable.

5. **Feature E — Smart Word Selection and Adaptive Difficulty**:
   - Stage 1 Rule-Based Selection: Easy, Medium, Hard pools, category weighting, recent-word avoidance in current match, duplicate prevention.
   - Round Outcome Telemetry: `RoundTelemetry` collection recording round duration, time-to-first-correct-guess, completion rate, timeouts, player count.
   - Data Quality Rules: Excludes cancelled games, incomplete rounds, or all-disconnect matches.
   - Word-Level Metrics & Bayesian Beta-Binomial Smoothing: $\frac{\text{solves} + 2}{\text{rounds} + 4}$ for robust difficulty estimates.
   - Adaptive Word Selection: Penalizes repeatedly timed-out words, balances choices (Easy, Medium, Hard).
   - Stage 2 Machine Learning Readiness: Evaluation script `server/scripts/evaluate_difficulty_model.ts` with baseline comparisons.

---

## 2. Implementation Sequence

```
Step 1: Audit & Preservation (Completed)
  │
Step 2: Feature A — Smart Reconnect and Room Recovery
  ├─ Add generation ID to RoomPlayer in RoomManager
  ├─ Update DrawingSessionManager stroke cancellation on disconnect
  ├─ Enforce multi-tab socket replacement without duplicate player/score records
  └─ Ensure absolute timer preservation and role-specific snapshot delivery
  │
Step 3: Feature B — Mobile-First Drawing Experience & Redo Support
  ├─ Implement Redo in DrawingSessionManager (server) and useDrawingSession (client)
  ├─ Add Redo button and mobile touch layout to DrawingToolbar
  ├─ Add pointer capture, cancel, and lostpointercapture in useDrawingCanvas
  └─ Optimize GameChat mobile input & responsiveness
  │
Step 4: Feature C — Fair Play, AFK Protection and Anti-Abuse
  ├─ Implement AFK tracking in Game.ts (warning threshold, countdown, turn skip)
  ├─ Add rate limiting & duplicate filtering for guesses in gameHandlers.ts
  ├─ Add room:kick_player socket handler in socketHandlers.ts
  └─ Connect to AuditLog for fair play observability
  │
Step 5: Feature D — GenAI-Powered Word-Pack Generator
  ├─ Create GenAIProviderService in server supporting Gemini, OpenAI & Mock
  ├─ Add POST /api/word-packs/generate endpoint with Zod schema validation
  ├─ Build GenAIWordPackModal in frontend WordPacksPage
  └─ Verify caching, quota limits, and offline fallback
  │
Step 6: Feature E — Smart Word Selection and Adaptive Difficulty
  ├─ Create RoundTelemetry Mongoose model
  ├─ Integrate telemetry recording in GameManager on round finalization
  ├─ Build TelemetryService with Bayesian smoothed solve rates
  ├─ Update WordService with adaptive selection weighting
  └─ Create offline evaluation script server/scripts/evaluate_difficulty_model.ts
  │
Step 7: Automated Testing & Multi-Client Verification
  ├─ Reconnect & timer preservation tests
  ├─ Redo & mobile touch tests
  ├─ AFK warning & turn skip tests
  ├─ GenAI generation & fallback tests
  └─ Adaptive telemetry & difficulty tests
  │
Step 8: Build Verification & Final Report
```

---

## 3. Data Models & Schemas

### 3.1 `RoundTelemetry` (MongoDB)
- `gameId`: string
- `roundNumber`: number
- `word`: string (lowercase)
- `category`: string
- `language`: 'en' | 'hi' | 'es'
- `difficulty`: 'easy' | 'medium' | 'hard'
- `roundDurationSeconds`: number
- `timeToFirstCorrectGuessSeconds`: number | null
- `timeToCompletionSeconds`: number | null
- `totalGuessesCount`: number
- `correctGuessersCount`: number
- `timedOut`: boolean
- `eligiblePlayersCount`: number
- `isValid`: boolean
- `createdAt`: Date

### 3.2 Drawing Redo Stack
- Server `DrawingSession`:
  - `strokes: Stroke[]`
  - `redoStack: Stroke[]`
  - `activeStroke: Stroke | null`
  - `revision: number`

### 3.3 Reconnect Generation ID
- `RoomPlayer`:
  - `reconnectGeneration: number`
  - `disconnectedAt?: Date`
  - `isDisconnected: boolean`
