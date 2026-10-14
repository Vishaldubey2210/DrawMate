# Production Deployment & Operations Guide — DrawMate

**Document Version:** 2.0  
**Updated:** October 13, 2026  
**Status:** Validated Production Runbook  

---

## 1. System Architecture & Topology

DrawMate consists of:
1. **Frontend SPA (`drawmate-client`)**: React 19, TypeScript, and Vite single-page application.
2. **Backend Server (`drawmate-api`)**: Node.js 20 / Express application hosting REST APIs and Socket.IO server.
3. **Database**: MongoDB 6.0+ cluster (e.g. MongoDB Atlas).
4. **AI/ML Microservice (`drawmate-sketch-recognizer`)**: Python 3.11 / FastAPI sketch-recognition inference service (standalone container).

```
[ Browser Clients ]
        |
        +---- HTTPS (Port 443) ----> [ Frontend CDN / Static Host (e.g., Render / Cloudflare) ]
        |
        +---- WSS & HTTPS (API) ---> [ Backend Web Service (Render / Railway / Docker) ]
                                             |                     |
                                             v                     v
                                  [ MongoDB Atlas Cluster ]  [ FastAPI ML Service ]
```

> [!IMPORTANT]
> **Single Authoritative Instance Assumption (Option A)**:
> In DrawMate, core gaming singletons (`RoomManager`, `GameManager`, `DrawingSessionManager`, and countdown timers) live in process memory. The backend must be deployed as a **single authoritative instance** (`numInstances: 1`). Do not configure multi-instance horizontal autoscaling without a distributed state store (e.g. Redis).

---

## 2. Production Environment Variables

### 2.1 Backend Environment (`server/.env` or Hosting Dashboard)

| Variable | Required | Description | Example / Constraints |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | Execution mode | Must be `production` |
| `PORT` | **Yes** | Internal listening port | `5000` (or `10000` on Render) |
| `CLIENT_URL` | **Yes** | Authoritative Frontend Origin for CORS & Socket.IO | `https://drawmate.app` (No wildcards permitted) |
| `MONGODB_URI` | **Yes** | MongoDB TLS Connection String | `mongodb+srv://user:pass@cluster.mongodb.net/drawmate?retryWrites=true&w=majority` |
| `JWT_ACCESS_SECRET` | **Yes** | Access Token Signing Secret | Minimum 32 random characters (64 hex recommended) |
| `JWT_REFRESH_SECRET`| **Yes** | Refresh Token Signing Secret | Minimum 32 random characters (64 hex recommended) |
| `COOKIE_SECRET` | **Yes** | Signed Cookie Secret | Minimum 32 random characters (64 hex recommended) |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token lifespan | `15m` (default) |
| `JWT_REFRESH_EXPIRES_IN`| No | Refresh token lifespan | `7d` (default) |
| `SKETCH_RECOGNIZER_URL` | No | Base URL for FastAPI ML Recognizer | `http://sketch_recognizer:8000` or cloud URL |
| `GEMINI_API_KEY` | No | Google AI Gemini API Key | Secret key for GenAI word-packs (mock used if unset) |
| `GEMINI_MODEL` | No | Gemini model identifier | `gemini-1.5-flash` (default) |
| `OPENAI_API_KEY` | No | OpenAI API Key | Optional moderation provider |

### 2.2 Frontend Environment (`client/.env` or CDN Build Settings)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | No | Backend HTTP API base URL | `https://api.drawmate.app` (Leave blank if same-origin) |
| `VITE_SOCKET_URL` | No | Backend Socket.IO WSS URL | `https://api.drawmate.app` (Leave blank if same-origin) |

---

## 3. Pre-Deployment Operations & Database Initialization

### 3.1 Controlled Index Synchronization
Before launching or promoting a release, execute index synchronization:
```bash
# From workspace root
npm --workspace=server run init-indexes
```
This guarantees that unique and compound indexes exist on all 12 collections (`User`, `MatchResult`, `Room`, `Session`, `PasswordResetToken`, `Friendship`, `Notification`, `AuditLog`, `RoundTelemetry`, `CustomWordPack`, `DrawingReplay`, `Report`) without dropping or locking collections in-flight.

### 3.2 Automated Production Build Verification
```bash
# Compiles server TypeScript and generates client/dist bundle
npm run build
```

---

## 4. Containerized Deployment (Docker & Compose)

The repository provides a multi-stage, non-root, hardened `Dockerfile` and `docker-compose.yml`.

### Running Locally or on Self-Hosted VMs:
```bash
# 1. Build and launch all services in detached mode
docker compose up --build -d

# 2. Inspect running container status
docker compose ps

# 3. View service logs
docker compose logs -f app
```

### Container Endpoints:
- **DrawMate Web App (Frontend + API)**: `http://localhost:5000`
- **FastAPI Sketch Recognizer**: `http://localhost:8000`
- **MongoDB**: `localhost:27017`

---

## 5. Cloud Platform Deployment (Render / Railway)

### 5.1 Using Infrastructure as Code (`render.yaml`)
Pushing to GitHub automatically configures services via the root `render.yaml`:
- **`drawmate-api`**: Web Service, Node runtime, `numInstances: 1`, build: `npm ci && npm --workspace=server run build`, start: `npm --workspace=server run start`.
- **`drawmate-client`**: Static Site, build: `npm ci && npm --workspace=client run build`, publish: `client/dist`, SPA rewrite rule: `/*` -> `/index.html`.
- **`drawmate-sketch-recognizer`**: Docker Service from `ml/sketch_recognizer/Dockerfile`.

### 5.2 Health Probes & Monitoring
Configure the following HTTP health check paths on your hosting provider:
- **Liveness Probe**: `GET /api/health` or `GET /api/health/live` (Returns process uptime and memory usage; responds 200).
- **Readiness Probe**: `GET /api/health/ready` (Verifies active MongoDB connection state; returns 200 when ready, 503 when disconnected).

---

## 6. Post-Deployment Smoke Verification

Immediately following deployment, run the automated smoke test suite against the target URL:
```bash
# Run against staging or production URL
TARGET_URL=https://api.drawmate.app npm run test:smoke
```

The smoke test validates 9 critical pathways:
1. Backend Liveness (`/api/health`)
2. Database Readiness (`/api/health/ready`)
3. Protected Resource Authentication Gate (`/api/profile/me` rejects unauthenticated)
4. Safe Error Format on Invalid Login (`/api/auth/login`)
5. Safe 404 on Malformed API Route
6. Frontend Root HTML Delivery (`index.html`)
7. Direct SPA Route Resolution (`/practice` -> `index.html`)
8. Real-time Socket.IO Handshake Connectivity
9. Sketch Recognizer ML Health Check (`/health`)

---

## 7. Scaling Constraints & Limits (Single Instance)

Under the verified single-instance architecture (Option A):
- **Concurrent Players**: Supports **500 – 1,000 simultaneous active players** on a 1 vCPU / 2GB RAM container.
- **Concurrent Games**: Supports **50 – 100 simultaneous drawing rooms** with active stroke broadcasting.
- **Network Bandwidth**: Average ~15–30 KB/s per active drawing room utilizing normalized point batching.
- **Process Memory Footprint**: ~120MB baseline; scales linearly (~500KB per active room session).

---

## 8. Rollback & Disaster Recovery Procedures

### 8.1 Application Code Rollback
If a defect is identified post-release:
1. Revert to the previous known-good Git commit:
   ```bash
   git revert HEAD
   git push origin main
   ```
2. Trigger the hosting platform's redeploy or rollback mechanism.
3. Database schemas and indexes in DrawMate are strictly additive and backward-compatible; rolling back application code does not require index dropping.

### 8.2 Database Backup & Restoration Procedure
- **Backup Frequency**: Configure MongoDB Atlas Continuous Cloud Backups (snapshots every 6 hours, 7-day retention).
- **Point-in-Time Restore**: In the MongoDB Atlas Console, navigate to **Cluster -> Backup -> Restore** and select the recovery timestamp prior to the incident.
- **Restoration Safety Rule**: Always restore to a temporary or staging cluster first; verify collection integrity before swapping connection strings.

### 8.3 Unplanned Backend Restart Handling
Because active game objects live in memory, an unplanned process crash or node migration terminates active match countdowns:
- Interrupted active rooms are automatically cleared from memory.
- Completed match histories, player XP, rankings, and custom word-packs remain safely persisted in MongoDB.
- Reconnecting clients whose active rooms were purged receive a clean lobby redirect with informative feedback, preventing state corruption or dangling timers.
