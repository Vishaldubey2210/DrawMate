# DrawMate — Phase 8: Controlled Beta Launch Plan

**Date:** October 13, 2026  
**Document Version:** 1.0.0-beta  
**Status:** Approved for Controlled Staging Beta (`READY_WITH_DOCUMENTED_LIMITATIONS`)  

---

## 1. Executive Summary & Launch-Readiness Gate

Before enabling external participant access, DrawMate evaluated its operational, security, and game-engine posture against strict launch criteria.

### 1.1 Gate Evaluation Results

| Audit Criteria | Status | Evidence & Verification |
| :--- | :---: | :--- |
| **No Unresolved Critical Security Issues** | **PASS** | Strict CORS enforcement, timing-safe auth comparisons, Helmet HTTP headers, JWT signature validation, and timing attack protections verified across 170 backend tests. |
| **No Secret-Word or Role Leaks** | **PASS** | Word masking (`word.replace(/./g, '_')`) enforced on backend; Imposter role delivered solely via private socket message (`game:role_assigned`) with no role data in public room snapshots. Privacy filter strictly drops secret words and guesses from telemetry. |
| **Scoring & Match Persistence Integrity** | **PASS** | Atomic `$inc` operations in `MatchResult` persistence; idempotency checks prevent duplicate score records. Reconnection restores score state without double-awarding points. |
| **Authentication & Authorization** | **PASS** | Express middleware enforces JWT access token and session validation; administrative endpoints (`/api/admin/*`) require server-verified `role: 'admin'`. Frontend UI hides buttons, but server strictly authorizes every request. |
| **Core Multiplayer Integration** | **PASS** | Full multiplayer lifecycle passing: room creation, joining, turn rotation, drawing broadcast, real-time guessing, AFK timeouts, score calculation, and final leaderboard. |
| **Production Configuration Validated** | **PASS** | Single authoritative backend instance enforced (`numInstances: 1` in `render.yaml`); `NODE_ENV=production` validated; connection string masking in logs; cookie flags configured (`HttpOnly`, `Secure`, `SameSite`). |
| **Database Backup & Recovery** | **PASS** | MongoDB Atlas continuous snapshot recovery documented; 14 collections synchronized with explicit production indexes (`initIndexes.ts`). |
| **Deployment Rollback Instructions** | **PASS** | Git commit revert rollback and dynamic runtime feature-flag killswitches operational without service restarts. |
| **External Providers & Fallbacks** | **PASS** | Gemini GenAI falls back gracefully to deterministic heuristics if unset; Python FastAPI Sketch Recognizer microservice reports real-time availability; AI provider failure does not degrade core multiplayer gameplay. |
| **Automated Smoke Test Verification** | **PASS** | 11/11 automated staging/production smoke tests passing (including health probes, auth boundaries, SPA fallback, Socket.IO polling, feature flags discovery, and admin access control). |

### 1.2 Official Readiness Classification

**Classification:** `READY_WITH_DOCUMENTED_LIMITATIONS`

#### Documented Limitations:
1. **Live Cloud Hosting:** Cloud deployment to public URLs (e.g., Render/Railway and MongoDB Atlas production replica sets) requires human-provided production cloud credentials and Atlas connection URIs.
2. **Single Authoritative Instance Architecture:** The real-time in-memory game state (`RoomManager`, `GameManager`, `DrawingSessionManager`) requires a single authoritative backend process. Horizontal scaling across multiple processes without Redis-backed distributed state engines is restricted to 500–1,000 concurrent players per instance.
3. **Controlled Cohort Rollout:** Access is limited to internal testers and allowlisted beta participants during Stage 1.

---

## 2. Beta Rollout Strategy & Staged Deployment

DrawMate employs a staged, phased rollout to minimize blast radius and validate multiplayer stability under incremental load.

### 2.1 Rollout Stages

```
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 1: Internal Dogfooding (Days 1–3)                          │
│ • Audience: Core engineering & design team (5–15 users)          │
│ • Scope: End-to-end match stability, drawing latency, admin tools │
│ • Features: Classic Mode, Imposter Mode, AI Practice             │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Pass Gate 1 (0 Critical Crashes)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 2: Closed Beta Cohort (Days 4–10)                          │
│ • Audience: 50–100 allowlisted players & community testers       │
│ • Scope: Real user latency, mobile canvas, feedback collection   │
│ • Feature Flags: Beta Feedback Modal enabled, GenAI Pack enabled │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Pass Gate 2 (Match Completion > 90%)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 3: Controlled Public Beta (Days 11+)                       │
│ • Audience: Public access via room links & invite codes          │
│ • Scope: Peak concurrency testing, automated telemetry tracking  │
│ • Rate Limits: Strict room-creation & guess rate limiting active │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Server-Enforced Feature Flags

All experimental or resource-intensive capabilities are protected by runtime server-enforced feature flags (`server/src/config/featureFlags.ts`), discoverable publicly via `GET /api/features` and dynamically toggled by administrators via `PATCH /api/admin/features`:

| Flag Key | Default | Description & Rollout Purpose |
| :--- | :---: | :--- |
| `betaFeedbackEnabled` | `true` | Enables player bug reporting and suggestion submission modal. |
| `telemetryEnabled` | `true` | Controls privacy-sanitized product analytics recording. |
| `imposterModeEnabled` | `true` | Allows creating rooms with Imposter role deception gameplay. |
| `aiPracticeEnabled` | `true` | Controls solo sketch recognition game mode with ML backend. |
| `genAiWordPacksEnabled` | `true` | Controls AI-assisted custom word pack generation. |
| `sketchRecognizerEnabled` | `true` | Enables real-time stroke inference against Python microservice. |
| `drawingReplayEnabled` | `true` | Allows storing and replaying full drawing histories. |

**Server-Side Enforcement Rule:** Disabling a feature flag immediately rejects corresponding API and socket actions on the backend with HTTP 403 / socket error. Frontend UI components also reflect flag state via `useFeatureFlags()`.

---

## 3. Privacy, Consent & Data Governance

DrawMate treats player privacy as an immutable launch requirement.

### 3.1 Data Minimization Principles
1. **Zero Secret-Word Logging:** Active secret words, round word candidates, and guessed words are strictly excluded from all application logs, telemetry events, and admin metrics.
2. **Zero Chat Transcript Storage in Telemetry:** User chat messages are processed ephemerally in memory for guess evaluation and broadcast; they are never persisted to analytics collections.
3. **Zero Raw Drawing Stroke Harvesting:** Telemetry events record only stroke count (`strokes.length`), never raw canvas coordinates or vector paths.
4. **Token & Credential Scrubbing:** Passwords, JWT secrets, refresh tokens, auth headers, and session cookies are scrubbed by `sanitizeTelemetryProperties` before saving.
5. **Pseudonymization:** Telemetry records map to internal user IDs or anonymous session UUIDs; emails, IP addresses, and physical locations are never recorded in analytics.

### 3.2 Data Retention Policy
- **Product Analytics (`ProductAnalyticsEvent`):** Automatic MongoDB TTL index expires and deletes all events after **30 days** (`expireAfterSeconds: 2,592,000`).
- **Player Feedback (`Feedback`):** Retained for 90 days for issue resolution, after which resolved tickets are archived or purged.
- **Incident Diagnostics:** Stored in a bounded in-memory ring buffer (maximum 100 entries); flushed upon process restart.
- **Audit Logs (`AuditLog`):** Retained for 180 days for security traceability.

---

## 4. Key Performance Indicators (KPIs)

### 4.1 Acquisition & Onboarding
- **Registration Success Rate:** Target > 98%
- **Time to First Room Join:** Target < 45 seconds from login
- **First-Match Completion Rate:** Target > 85% of users who enter a lobby

### 4.2 Multiplayer Reliability
- **Room Join Success Rate:** Target > 99.5%
- **Match Completion Rate:** Target > 90% (excluding voluntary host quits)
- **Unexpected Disconnect Rate:** Target < 2% of active socket connections
- **Reconnect Recovery Rate:** Target > 80% within the 30-second grace window
- **Drawing Stroke Broadcast Latency (p95):** Target < 50ms locally, < 120ms regionally

### 4.3 External AI & ML Services
- **Sketch Recognizer Availability:** Target > 99% (fallback to heuristic scoring if down)
- **GenAI Word Pack Generation Latency (p95):** Target < 2,500ms (fallback to curated packs if timeout)

---

## 5. Rollout Risks & Mitigation Strategies

| Risk Category | Potential Failure | Automated Mitigation | Manual Intervention |
| :--- | :--- | :--- | :--- |
| **Realtime Overload** | Socket connection surge degrades drawing sync. | Rate limits on socket events (max 50 strokes/sec, 10 guesses/sec). Ping timeout purges dead sockets in 15s. | Toggle `DRAWING_BUFFER_MS` up or reduce room size limit via admin settings. |
| **External AI Outage** | Google Gemini or FastAPI Recognizer unresponsive. | Circuit breaker returns curated fallback word packs or offline heuristic scoring; core game stays 100% online. | Disable `genAiWordPacksEnabled` flag via Admin Dashboard without restarting backend. |
| **Data Leak Concern** | Suspected secret-word or Imposter role leak. | Server-authoritative engine verifies role recipients; telemetry sanitizer drops forbidden keys. | Pause beta rooms; audit `docs/SECURITY.md` checklist and review socket event listeners. |
| **Persistence Stalls** | High match volume causes MongoDB write latency. | Telemetry and analytics writes run asynchronously with suppressed exceptions; critical match persistence is retried. | Scale MongoDB Atlas compute tier; verify index coverage. |

---

## 6. Launch & Rollback Criteria

### 6.1 Proceed Criteria (Green Light)
- All 170 backend unit and integration tests passing.
- All 44 frontend component and workflow tests passing.
- All 11 production smoke tests passing.
- Database index initialization confirmed across 14 collections.
- Admin dashboard operational with real-time operational health metrics.
- Beta feedback submission pipeline active and rate-limited.

### 6.2 Rollback / Pause Triggers (Red Light)
The beta rollout must be immediately paused or rolled back if:
1. **Critical Security Defect:** Any report of secret-word exposure before round completion or unauthenticated access to admin endpoints.
2. **Data Corruption:** Match score persistence corruption or duplicate credit awards.
3. **Systemic Disconnections:** Socket disconnect rate exceeds 15% over a 15-minute rolling window.
4. **Unhandled Server Crashes:** Unhandled exceptions causing repeated container process restarts.

### 6.3 Rollback Execution Protocol
1. **Instant Feature Disable:** Use Admin Dashboard Feature Flags tab to disable the affected feature (e.g., `genAiWordPacksEnabled: false` or `imposterModeEnabled: false`). Takes effect in < 1 second.
2. **Code Rollback:** Revert Git commit on deployment branch; trigger automated redeploy.
3. **Database Restore:** If schema corruption occurs, execute point-in-time snapshot recovery from MongoDB Atlas.
