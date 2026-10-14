# DrawMate — Observability, Analytics & Incident Management

**Version:** 1.0.0-beta  
**Date:** October 13, 2026  
**Audience:** Platform Engineering, Site Reliability, Product Operations  

---

## 1. Architecture Overview

DrawMate implements a two-tier telemetry architecture designed for production resilience and strict player privacy:

1. **Operational Metrics & Runtime Diagnostics (Tier 1 - Ephemeral & Fast):**
   - In-memory metrics registry (`OperationalMetrics.ts`) tracking live HTTP status codes, latency percentiles, socket connections, disconnections, reconnection rates, match completions, persistence failures, and AI provider availability.
   - Bounded incident ring buffer (`IncidentDiagnosticService.ts`) storing the last 100 system anomalies with fingerprint deduplication and credential redaction.
   - Zero database overhead for real-time traffic monitoring.
2. **Product Analytics (Tier 2 - Persistent & Sanitized):**
   - Asynchronous MongoDB event persistence (`ProductAnalyticsEvent.ts`) capturing high-level engagement and feature adoption KPIs.
   - Automated 30-day TTL index for automated data pruning.
   - Server-enforced privacy filter dropping secret words, player guesses, chat transcripts, canvas coordinates, and authentication tokens.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          INCOMING TRAFFIC                              │
│             HTTP REST API                   Real-Time Socket.IO        │
└───────────────────────┬───────────────────────────────┬────────────────┘
                        │                               │
                        ▼                               ▼
       ┌─────────────────────────────────┐   ┌───────────────────────────┐
       │     requestLogger Middleware    │   │  socket.ts Event Handlers │
       └────────────────┬────────────────┘   └──────────┬────────────────┘
                        │                               │
                        ├───────────────────────────────┤
                        ▼                               ▼
       ┌─────────────────────────────────────────────────────────────────┐
       │              OperationalMetrics Singleton (In-Memory)           │
       │  • HTTP Requests & Latency (p50, p95, p99)                      │
       │  • Socket Connections, Disconnections, Reconnections            │
       │  • Match Starts, Completions, Cancellations, Persistence        │
       │  • AI Provider & Sketch Recognizer Availability                 │
       └────────────────┬───────────────────────────────┬────────────────┘
                        │                               │
     Non-Blocking Async │            Incident Diagnostics (Errors & 5xx)
                        ▼                               ▼
       ┌─────────────────────────────────┐   ┌───────────────────────────┐
       │     TelemetryService.ts         │   │ IncidentDiagnosticService │
       │  • Privacy Sanitization Gate    │   │  • Ring Buffer (Max 100)  │
       │  • Drops Forbidden Attributes   │   │  • Redacts Tokens & PII   │
       └────────────────┬────────────────┘   └──────────┬────────────────┘
                        │                               │
                        ▼                               ▼
       ┌─────────────────────────────────┐   ┌───────────────────────────┐
       │   ProductAnalyticsEvent (Mongo) │   │ Admin Dashboard (/admin)  │
       │   • 30-Day TTL Pruning Index    │   │ • Real-Time Health & KPIs │
       └─────────────────────────────────┘   └───────────────────────────┘
```

---

## 2. Operational Metrics Dictionary

Operational metrics are exposed via the authenticated admin endpoint `GET /api/admin/metrics/operational`:

### 2.1 Application Health Metrics

| Metric Key | Type | Description | Alert Threshold |
| :--- | :---: | :--- | :--- |
| `uptimeSeconds` | Counter | Node.js process uptime in seconds. | < 60s (unexpected restart) |
| `memoryRssMb` | Gauge | Resident Set Size memory consumption in Megabytes. | > 1,500 MB |
| `heapUsedMb` | Gauge | V8 heap memory actively utilized in Megabytes. | > 1,200 MB |
| `httpRequestsTotal` | Counter | Total incoming HTTP requests handled since launch. | N/A |
| `httpErrorsTotal` | Counter | Total HTTP 5xx server responses. | > 1% of total requests |
| `latency.p50` | Gauge | Median response latency across rolling 500 requests (ms). | > 50 ms |
| `latency.p95` | Gauge | 95th percentile response latency (ms). | > 200 ms |
| `latency.p99` | Gauge | 99th percentile response latency (ms). | > 500 ms |

### 2.2 Multiplayer & Real-Time Metrics

| Metric Key | Type | Description | Target |
| :--- | :---: | :--- | :--- |
| `activeSockets` | Gauge | Currently connected Socket.IO client connections. | Real-time gauge |
| `socketConnects` | Counter | Total successful Socket.IO handshake connections. | Monotonic counter |
| `socketDisconnects` | Counter | Total socket disconnections (clean + unexpected). | Monotonic counter |
| `reconnectAttempts` | Counter | Total player reconnect requests received within grace window. | Monotonic counter |
| `reconnectSuccesses` | Counter | Successfully restored player room and game sessions. | Monotonic counter |
| `reconnectRate` | Percentage | Calculated as `reconnectSuccesses / reconnectAttempts`. | > 80% |
| `roomCreations` | Counter | Total game lobbies created. | Monotonic counter |
| `roomJoins` | Counter | Total successful room joins. | Monotonic counter |
| `matchesStarted` | Counter | Total multiplayer matches initiated. | Monotonic counter |
| `matchesCompleted` | Counter | Matches that concluded with a final leaderboard. | Monotonic counter |
| `matchesCancelled` | Counter | Matches terminated prematurely (e.g., host abandoned). | < 10% |
| `persistenceFailures`| Counter | MongoDB failures while saving `MatchResult` records. | **0 (Zero)** |

### 2.3 External AI & ML Microservice Health

| Metric Key | Type | Description | Target |
| :--- | :---: | :--- | :--- |
| `aiRequestsTotal` | Counter | Total inference or generation requests sent to AI services. | Monotonic counter |
| `aiRequestsSuccess` | Counter | Successful provider responses. | > 95% |
| `aiFallbacksUsed` | Counter | Fallback to offline heuristics or mock packs triggered. | Tracked for budget |
| `sketchServiceAvailable` | Boolean | Health probe status of FastAPI sketch recognition container. | `true` |
| `genAiAvailable` | Boolean | Verification of Google Gemini API key or active fallback. | `true` |

---

## 3. Product Analytics Event Schema

Product analytics events are saved into the `ProductAnalyticsEvent` MongoDB collection with a guaranteed 30-day TTL index.

### 3.1 Event Document Schema

```typescript
interface IProductAnalyticsEvent {
  eventName: string;         // Standard snake_case identifier (e.g., 'room_created')
  timestamp: Date;           // Event generation timestamp (Indexed with 30-day TTL)
  schemaVersion: number;     // Integer schema version (currently 1)
  userId: string | null;     // Pseudonymized user identifier (null for guests)
  sessionId: string | null;  // Browser session UUID
  gameId: string | null;     // Game session identifier
  platform: string;          // Client platform ('web', 'mobile_web', etc.)
  appVersion: string;        // Client build release version ('1.0.0-beta')
  properties: Record<string, any>; // Strictly sanitized key-value diagnostics
}
```

### 3.2 Monitored Event Catalog

| Event Name | Trigger Location | Allowed Properties | Purpose |
| :--- | :--- | :--- | :--- |
| `user_registered` | `authController.ts` | `{ provider: 'local' }` | Acquisition tracking |
| `user_logged_in` | `authController.ts` | `{ isDemoUser: boolean }` | Activation tracking |
| `room_created` | `RoomManager.ts` | `{ visibility: 'public' \| 'private', maxPlayers: number }` | Host engagement |
| `room_joined` | `RoomManager.ts` | `{ isReconnection: boolean }` | Player participation |
| `classic_match_started` | `GameManager.ts` | `{ rounds: number, drawTime: number, playerCount: number }` | Gameplay adoption |
| `imposter_match_started`| `GameManager.ts` | `{ playerCount: number }` | Imposter mode adoption |
| `ai_practice_session_started` | `practiceController.ts` | `{ targetWordLength: number }` | Solo mode engagement |
| `match_completed` | `GameManager.ts` | `{ durationSeconds: number, roundsPlayed: number, totalScore: number }` | Retention indicator |
| `match_cancelled` | `GameManager.ts` | `{ reason: string, roundNumber: number }` | Churn diagnostics |
| `feedback_submitted` | `observabilityController.ts` | `{ category: string, hasGameId: boolean }` | Beta user feedback rate |

---

## 4. Privacy, Data Minimization & Sanitization

To guarantee fair play and player data confidentiality, `TelemetryService.ts` applies a strict sanitization gate before every persistence attempt.

### 4.1 Strictly Forbidden Properties
The following keys are permanently stripped and never saved:
- **Game Integrity:** `word`, `secretWord`, `secret_word`, `guess`, `guessedWord`, `imposterId`, `impostorId`
- **User Privacy:** `text`, `message`, `chatMessage`, `email`, `password`, `token`, `cookie`, `authorization`
- **Canvas Surveillance:** Raw coordinate objects `{ x, y, time }` and path vectors.

### 4.2 Safe Transformations
- When an array of drawing strokes is provided (`properties.strokes = [...]`), the sanitizer converts the array to its length count (`properties.strokes = strokes.length`), preserving diagnostic stroke counts while discarding coordinates.

---

## 5. Security & Access Control

1. **Server-Authoritative Role Verification:**
   - Every administrative metric and feature flag route (`/api/admin/metrics/*`, `/api/admin/features`, `/api/admin/incidents`) requires valid JWT authentication with `req.user.role === 'admin'`.
   - Unauthorized attempts receive HTTP 403 Forbidden and are logged to `AuditLog`.
2. **Public Endpoint Rate Limiting:**
   - `POST /api/feedback`: Restricted to 5 submissions per 15 minutes per IP address.
   - `GET /api/features`: Cached in memory and protected against scraping bursts.

---

## 6. Incident Diagnostics & Error Grouping

The runtime diagnostic service (`IncidentDiagnosticService.ts`) maintains a ring buffer of recent server anomalies:

- **Ring Buffer Size:** Bounded to 100 entries. Oldest entries are automatically evicted in memory.
- **Deduplication:** Groups recurring exceptions by stable fingerprint (`errorName:message`).
- **Sanitization:** Error stacks and messages are scrubbed of JWT tokens, passwords, and database connection strings before being stored in the buffer.
- **Admin Visibility:** Rendered on the Admin Dashboard with category pills (`server_error`, `database_error`, `socket_error`, `ai_error`, `auth_error`).

---

## 7. Incident Response Runbooks

### Runbook 1: Database Unavailable (`database_error`)
1. **Symptoms:** Readiness probe (`GET /api/health/ready`) returns HTTP 503; incident buffer logs Mongoose connection errors.
2. **Impact:** Match persistence fails; users cannot log in or register. In-memory multiplayer games continue temporarily until round persistence.
3. **Action:**
   - Verify MongoDB Atlas cluster status or local Mongo service (`systemctl status mongod` or Docker container).
   - Verify connection URI IP allowlist in Atlas.
   - Restart backend once connectivity is verified.

### Runbook 2: Socket Disconnection Surge (`socket_error`)
1. **Symptoms:** `OperationalMetrics.socketDisconnects` spikes; `reconnectRate` drops below 50%.
2. **Impact:** Players drop from games simultaneously; room state diverges.
3. **Action:**
   - Check reverse proxy WebSocket upgrade headers (`Upgrade: websocket`, `Connection: Upgrade`).
   - Verify client ping intervals (default: `10000ms`, timeout `5000ms`).
   - Check container memory usage for OOM thrashing.

### Runbook 3: Suspected Secret-Word Leak (`security_incident`)
1. **Symptoms:** Player reports seeing secret word before round ends, or suspicious guesses on first second of drawing.
2. **Impact:** Destroys game fairness and integrity.
3. **Action:**
   - Inspect recent Git commits affecting `Game.ts` or `socket.ts`.
   - Verify that socket event `game:turn_start` emits masked words to guessers and only sends unmasked text to the designated drawer socket ID.
   - Run integration suite `npm --workspace=server run test` to verify secret-word isolation tests.

### Runbook 4: Match Persistence Stalls
1. **Symptoms:** `persistenceFailures` metric increments; match completion records missing in history.
2. **Impact:** Leaderboard points not awarded; player match history incomplete.
3. **Action:**
   - Inspect MongoDB write latency and disk I/O.
   - Verify `MatchResult` unique index constraints on `gameId`.
   - Check server error logs for unhandled Mongoose validation errors.
