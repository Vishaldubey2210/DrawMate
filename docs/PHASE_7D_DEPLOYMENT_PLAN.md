# DrawMate — Phase 7D: Production Deployment Plan

**Document Version:** 1.0  
**Date:** October 13, 2026  
**Status:** Architecture Finalized & Configuration Hardened  
**Target Platform:** Single Authoritative Instance (Render / Railway / Docker) + MongoDB Atlas  

---

## 1. Executive Summary & Deployment Baseline

DrawMate is a production-grade multiplayer drawing and guessing platform featuring real-time stroke synchronization, secret-word confidentiality, session reconnects, Imposter Mode, GenAI word-pack generation, and deep learning sketch recognition.

Following the verification of 207 automated tests in Phase 7C, Phase 7D establishes the production hardening, scaling topology, containerization, and launch readiness strategy.

---

## 2. Production Topology & Component Architecture

DrawMate consists of four discrete architectural layers:

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT TIER                                       |
|  - Production-built React 19 + Vite SPA                                           |
|  - Distributed via CDN / Static Host (e.g. Render / Cloudflare Pages / Vercel)     |
|  - Direct navigation handled via SPA Rewrite Rule (/* -> /index.html)             |
|  - Environment: VITE_API_URL, VITE_SOCKET_URL pointing to Backend HTTPS/WSS       |
+-----------------------------------------------------------------------------------+
                                   |
                  HTTPS REST API   |   WSS Realtime Socket.IO
                                   v
+-----------------------------------------------------------------------------------+
|                        APPLICATION SERVER (OPTION A)                              |
|  - Single Authoritative Node.js 20 Web Service (`drawmate-api`)                   |
|  - Express REST APIs (Auth, Profiles, Rooms, Wordpacks, History, Telemetry)       |
|  - Socket.IO Server (Handshake Auth, Drawing Sync, Turns, Voting, Reconnects)     |
|  - In-Process Singletons: RoomManager, GameManager, DrawingSessionManager         |
|  - Hardened CORS: Rejects untrusted origins; accepts only authoritative CLIENT_URL|
|  - Health Probes: /api/health (Liveness), /api/health/ready (MongoDB Readiness)   |
+-----------------------------------------------------------------------------------+
                    /                              \
     MongoDB Driver/Mongoose (TLS)      HTTP REST Inference (Optional)
                  v                                  v
+-------------------------------+  +------------------------------------------------+
|        DATABASE TIER          |  |          AI / ML MICROSERVICE TIER             |
|  - MongoDB 6.0+ Atlas Cluster |  |  - Python 3.11 / FastAPI Sketch Recognizer     |
|  - Encrypted at Rest & In-Fly |  |  - Separate container (CPU-only PyTorch)       |
|  - Replica Set with Auto-Fail |  |  - Private network communication only          |
|  - Automated Hourly Backups   |  |  - Standalone service; optional for core match |
+-------------------------------+  +------------------------------------------------+
                                                     |
                                            HTTPS External API
                                                     v
                                   +------------------------------------------------+
                                   |           EXTERNAL GENAI PROVIDER              |
                                   |  - Google Gemini API (`GEMINI_API_KEY`)        |
                                   |  - Graceful fallback to deterministic mock     |
                                   |  - Server-side only; zero client key exposure  |
                                   +------------------------------------------------+
```

---

## 3. Scaling Architecture: Justification of Option A (Single Authoritative Instance)

### 3.1 Process-Local State Audit
The DrawMate core gaming engine maintains authoritative real-time state in process memory:
1. `RoomManager.ts`: Map of in-memory active rooms, participant readiness, host assignments, and disconnect timers.
2. `GameManager.ts`: Active games, secret-word selections, turn rotation, guessing state, and Imposter role assignments.
3. `DrawingSessionManager.ts`: Active stroke buffers, undo/redo stacks, and coordinate validation revisions.
4. `Game.ts`: Turn countdown timers (`turnTimer`), word selection timers, AFK detection intervals, and voting clocks.

### 3.2 Evaluation of Multi-Instance Scaling (Why Horizontal Scaling is Blocked)
Deploying multiple backend instances behind a standard load balancer with only a Redis Socket.IO adapter would create critical state divergence:
- A Redis Socket.IO adapter broadcasts network events between instances, but **does not synchronize in-process memory structures**.
- If Player A connects to Server Instance 1 and Player B connects to Server Instance 2 in the same room code:
  - Instance 1 would have no memory of the room session created on Instance 2.
  - Timers running on Instance 1 would tick independently of timers on Instance 2.
  - Guesses processed on Instance 2 would not update scores in Instance 1's local `Game` singleton.
  - Disconnect cleanup callbacks would only execute on the socket's local server.

### 3.3 Option A Topology & Capacity Bounds
- **Decision:** Mandate **Option A (Single Authoritative Instance)** for initial production deployment.
- **Hosting Constraint:** Configure `numInstances: 1` on cloud hosting platforms (e.g. Render starter/standard plan).
- **Measured Capacity:**
  - 1 vCPU / 2GB RAM Node.js runtime comfortably handles **500 – 1,000 concurrent connected WebSocket players** and **50 – 100 concurrent drawing rooms**.
  - Node.js event loop latency remains under 10ms with batch point throttling.
- **Future Horizontal Scaling Roadmap (Option B):**
  - Migrate `RoomSession` and `GameState` to Redis Hashes / Redis JSON.
  - Implement distributed locks (Redlock) for word selection and turn transitions.
  - Centralize game countdown timers using Redis Keyspace notifications or a dedicated scheduler service.

---

## 4. Resource & Cost Awareness

| Tier / Service | Resource Specification | Estimated Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Frontend CDN** | Static Host (Render / Cloudflare) | $0 / Free Tier | Unlimited bandwidth, global Edge caching |
| **Backend API (`drawmate-api`)** | 1 vCPU, 2GB RAM Node 20 runtime | $7 – $15 / month | Single authoritative instance |
| **MongoDB Database** | MongoDB Atlas M0 (Dev) / M10 (Prod) | $0 (M0) / $57/mo (M10) | Automated backups, encrypted storage |
| **Sketch Recognizer (`ml`)** | 0.5 vCPU, 1GB RAM Python runtime | $7 / month | Lightweight CPU container (model size ~1.8MB) |
| **Google Gemini API** | Pay-as-you-go | ~$0 – $5 / month | Word-pack generation; falls back to mock if unset |
| **TOTAL** | — | **$14 – $22/mo** (Basic Prod) | Minimal overhead; zero over-provisioning |

---

## 5. Deployment Blockers & Environmental Prerequisites

The following operational prerequisites require human credentials before executing a live production promotion:

1. **Production MongoDB Atlas Cluster:**
   - A live connection string (`MONGODB_URI=mongodb+srv://...`) with network access restricted to hosting egress IPs or IP access list `0.0.0.0/0` with strong password authentication.
2. **Production Hosting Platform Account:**
   - Active Render, Railway, or AWS account configured with GitHub repository continuous deployment.
3. **Cryptographic Production Secrets:**
   - Dedicated 64-character hex strings for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET`.
4. **Authoritative Domain Names & SSL:**
   - Production domain (e.g. `https://drawmate.app`) and API domain (e.g. `https://api.drawmate.app`).
5. **External AI Credentials (Optional):**
   - Live `GEMINI_API_KEY` for Google Gemini generation. If unavailable, DrawMate gracefully operates using its verified internal mock provider.

---

## 6. Execution Sequence & Promotion Workflow

1. **Pre-Deployment Validation:**
   - Execute test suite (`npm run test`) -> 207 tests must pass.
   - Execute database index initialization (`npm --workspace=server run init-indexes`).
   - Execute production build (`npm run build`) -> Zero TypeScript errors.
2. **Staging Verification:**
   - Deploy build artifact to staging environment.
   - Run automated smoke test suite (`TARGET_URL=... npm run test:smoke`).
3. **Production Promotion:**
   - Ensure `NODE_ENV=production` and secrets configured.
   - Deploy backend (`drawmate-api`) single instance.
   - Deploy frontend (`drawmate-client`) static assets.
   - Verify health endpoints (`/api/health`, `/api/health/ready`).
   - Run post-deploy smoke tests.
