# DrawMate — Production Readiness Checklist

This checklist defines the operational verification gates required before and during deployment to production.

---

## 1. Environment & Configuration Verification

- [x] **Node.js Environment**: Node.js v20.x or v22.x LTS installed and verified.
- [x] **Secure Secrets Configuration**:
  - `JWT_SECRET`: Random 256-bit cryptographically secure string (minimum 32 chars).
  - `JWT_REFRESH_SECRET`: Independent random 256-bit secret.
  - `COOKIE_SECRET`: Independent signing secret.
  - No default, placeholder, or dev secrets (`secret`, `devsecret`) permitted in production.
- [x] **CORS & Domain Whitelisting**:
  - `NODE_ENV=production` enforces strict matching against `CLIENT_URL`.
  - Development localhost origins blocked in production.
- [x] **Cookie Security**:
  - Cookies set with `httpOnly: true`, `secure: true` (in production), and `sameSite: 'lax'`.
- [x] **Database Connectivity**:
  - `MONGODB_URI` points to dedicated MongoDB instance with authentication.
  - User and connection pool settings tuned (`maxPoolSize: 50`).

---

## 2. Data Integrity & Crash Safety Verification

- [x] **Single-Document Atomic Match Idempotency**:
  - User model includes indexed `processedMatchIds: [String]`.
  - Stats increments use atomic `$inc` with `{ processedMatchIds: { $ne: gameId } }`.
  - Process crashes during match finalization recover safely without duplicate score/games-played increments.
- [x] **Non-Destructive Database Indexes**:
  - `npm --workspace=server run ensure-indexes` run before traffic cutover.
  - TTL indexes active on `EmailVerificationToken` (24h) and `PasswordResetToken` (15m).
  - Unique sparse indexes active on `username`, `email`, and `gameId`.

---

## 3. Real-Time WebSocket & State Machine Boundaries

- [x] **Handshake Authentication**:
  - Bearer JWT required in Socket.IO handshake `auth.token`.
  - Database lookup verifies active, non-suspended account status.
- [x] **Room & Game State Isolation**:
  - Players cannot join or ready up during active matches.
  - Drawer turn rotation strictly isolates secret words from observers.
  - Incomplete strokes cancelled when drawers disconnect.
  - Automatic game cancellation triggered if participants drop below minimum viable threshold.
- [x] **Rate Limiting & Abuse Prevention**:
  - Chat/guess rate limiter: max 5 guesses per 5 seconds per player.
  - Duplicate guess suppression active.
  - Inactivity cleanup prevents memory leaks in rate-limit Maps.

---

## 4. Frontend & User Experience Assurance

- [x] **Silent Token Refresh**:
  - Axios 401 interceptor queues concurrent requests during token renewal.
  - Zero disruption or unexpected logouts for active users.
- [x] **Socket Identity Isolation**:
  - Logging out immediately terminates active Socket.IO connection and detaches listeners.
  - Logging into another account performs clean fresh handshake with new user ID.
- [x] **Canvas Redo Synchronization**:
  - Redo stack state tracked in real time; buttons disabled when redo stack is empty.
  - Canvas drawing bitmap preserved across browser resizing and mobile keyboard toggles.
- [x] **Accessibility**:
  - Modals include `role="dialog"`, `aria-modal="true"`, and accessible close buttons.

---

## 5. Machine Learning & Optional Service Resilience

- [x] **Sketch Recognition Service**:
  - Python/FastAPI service passes unit tests (`pytest ml/sketch_recognizer/tests`).
  - Service exposes `/health` and `/predict` endpoints on port 8000.
  - If Python ML service is unavailable, Node.js backend times out within 2000ms and falls back to heuristic scoring without crashing.
- [x] **GenAI Word-Pack Service**:
  - If external AI API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are missing or fail, mock heuristic provider generates valid, filtered word packs seamlessly.

---

## 6. Pre-Flight Release Commands

Execute in order on staging environment prior to production release:

```bash
# 1. Typecheck and linting
npm run lint

# 2. Server regression test suite (221 tests)
npm run test:server

# 3. Client regression test suite (69 tests)
npm run test:client

# 4. Python ML service tests (5 tests)
python3 -m pytest ml/sketch_recognizer/tests

# 5. Production bundle build
npm run build
```
