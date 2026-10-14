# DrawMate — Operations Runbook

## 1. System Overview & Deployment Architecture

DrawMate is a real-time multiplayer drawing and guessing platform.

```
                      ┌──────────────────────┐
                      │   Client Browser     │
                      │  (React 18 + Vite)   │
                      └──────────┬───────────┘
                                 │ HTTPS / WSS
                                 ▼
                      ┌──────────────────────┐
                      │   DrawMate Server    │
                      │ (Node.js/Express/IO) │
                      └────┬────────────┬────┘
           MongoDB Wire    │            │ HTTP (Internal Port 8000)
                           ▼            ▼
             ┌───────────────┐        ┌───────────────────────┐
             │ MongoDB Atlas │        │  Sketch Recognizer    │
             │   (v6.0+)     │        │  (FastAPI + PyTorch)  │
             └───────────────┘        └───────────────────────┘
```

### Architectural Ground Rule
- Authoritative room, presence, drawing session, and game state is managed in-memory by `RoomManager`, `GameManager`, and `DrawingSessionManager`.
- **DrawMate must run as a single authoritative process instance per game lobby.**
- When running multiple instances behind a load balancer, sticky sessions (IP hash or cookie affinity) are strictly required, OR rooms must be assigned to designated process nodes.

---

## 2. Environment Configuration Reference

| Environment Variable | Mandatory? | Default (Dev) | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `development` | Set to `production` in live deployments. |
| `PORT` | Yes | `5000` | HTTP/WebSocket listening port. |
| `CLIENT_URL` | Yes | `http://localhost:5173` | Exact URL of the frontend for CORS and cookie origin. |
| `MONGODB_URI` | Yes | `mongodb://localhost:27017/drawmate` | MongoDB connection string. |
| `JWT_SECRET` | Yes | (auto-generated in dev) | 256-bit secret for signing access tokens (15m expiry). |
| `JWT_REFRESH_SECRET` | Yes | (auto-generated in dev) | 256-bit secret for signing refresh tokens (7d expiry). |
| `COOKIE_SECRET` | Yes | (auto-generated in dev) | Secret for signed cookies. |
| `SMTP_HOST` | Yes | `smtp.gmail.com` | Outbound mail server for verification & password resets. |
| `SMTP_PORT` | Yes | `587` | Outbound mail server port. |
| `SMTP_USER` | Yes | (empty) | SMTP username/email. |
| `SMTP_PASS` | Yes | (empty) | SMTP app password. |
| `SMTP_FROM` | Yes | `no-reply@drawmate.app` | Sender address for outgoing emails. |
| `SKETCH_RECOGNIZER_URL`| No | `http://localhost:8000` | Optional Python ML service URL. |
| `GEMINI_API_KEY` | No | (empty) | Optional Google Gemini key for GenAI word packs. |
| `OPENAI_API_KEY` | No | (empty) | Optional OpenAI key for GenAI word packs. |

---

## 3. Routine Operational Procedures

### 3.1 Starting the Services

**A. Node.js Game & API Server**:
```bash
npm --workspace=server run build
NODE_ENV=production node server/dist/server.js
```

**B. Python ML Sketch Recognizer (Optional)**:
```bash
cd ml/sketch_recognizer
uvicorn service.main:app --host 0.0.0.0 --port 8000 --workers 2
```

**C. Static Frontend Hosting**:
```bash
npm --workspace=client run build
# Serves dist/ directory via Nginx, Cloudflare Pages, Render, or Node.js Express static server
```

### 3.2 Database Index Initialization
Before launching a new database or after version upgrades:
```bash
npm --workspace=server run ensure-indexes
```
This script safely and non-destructively initializes all unique, compound, and TTL indexes on MongoDB.

---

## 4. Health Checks & Monitoring

### 4.1 Endpoints
- **Liveness Probe**: `GET /api/health`
  - Returns `HTTP 200 { "status": "ok", "uptime": 12345 }`.
- **Readiness Probe**: `GET /api/health/ready`
  - Validates active MongoDB database connection. Returns `HTTP 200` if healthy, `HTTP 503` if database is disconnected.
- **Observability Metrics**: `GET /api/metrics`
  - Provides active room counts, player counts, match completion counts, and memory usage.

### 4.2 Logging
- Structured JSON logs emitted to `stdout`.
- Sensitive fields (passwords, JWT secrets, refresh tokens) are automatically redacted.
- Error logs include contextual incident diagnostic IDs.

---

## 5. Troubleshooting & Incident Response

### Incident: Users Report Expired Session While Playing
- **Cause**: Client unable to reach `/api/auth/refresh` or refresh token revoked.
- **Verification**: Check server logs for `[Auth] Refresh token replay detected` or `Invalid refresh token`.
- **Resolution**: Advise user to log in again. Check browser cookie settings (ensure third-party cookies are not blocked if frontend and backend use different subdomains).

### Incident: Python ML Sketch Recognizer Is Down
- **Impact**: AI Guessing or quick sketch classification returns default fallback responses.
- **Behavior**: Gameplay continues uninterrupted; Node.js backend logs a warning and falls back to heuristic scoring after 2000ms timeout.
- **Resolution**: Restart the Python service (`uvicorn service.main:app --port 8000`). Gameplay does not need to be restarted.

### Incident: Match Statistics Did Not Immediately Appear on Leaderboard
- **Cause**: Asynchronous match finalization queue delayed or MongoDB write timeout.
- **Recovery**: The system automatically retries with crash-proof idempotency. Check `MatchResult` collection for `statsApplied: false` and verify user `processedMatchIds`.
