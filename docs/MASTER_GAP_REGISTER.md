# DrawMate — Master Engineering Gap Register

## 1. Overview & Classification Schema
This Master Gap Register documents the evidence-based status of all product components, architectural layers, security perimeters, and SaaS capabilities across the DrawMate repository.

### Status Codes
- `VERIFIED_WORKING`: Code exists, verified via automated unit/integration tests and runtime load execution.
- `PARTIALLY_IMPLEMENTED`: Core logic exists but requires edge-case handling, bound limits, or typing fixes.
- `IMPLEMENTED_BUT_UNVERIFIED`: Code exists in source but lacked dedicated end-to-end verification.
- `BROKEN`: Code threw runtime exceptions, failed validation, or broke core contracts.
- `MISSING`: Required specification not yet implemented in repository.
- `BLOCKED_BY_ENVIRONMENT`: Feature depends on third-party API keys or remote hardware not configured in local environment.
- `NOT_APPLICABLE`: Deliberately deferred or excluded based on verified engineering decisions.

---

## 2. Comprehensive Inventory & Evaluation

| Item ID | Category | Capability / Feature | Evidence / Source Files | Status | Risk Level | Remediation / Verification Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | Frontend | Vite Bundle Split Exceeding 500kB Chunk Limit | `client/vite.config.ts`, `client/src` | `VERIFIED_WORKING` | Low | Configured Rollup `manualChunks` (`vendor-react`, `vendor-icons`, `vendor-network`). Largest chunk reduced to 353kB (gzip 75kB). Verified via `npm run build`. |
| **GAP-02** | Backend API | Match Detail String ID CastError (P1) | `server/src/controllers/matchController.ts` | `VERIFIED_WORKING` | Medium | Fixed `getMatchById` to check `mongoose.isValidObjectId(matchId)` before querying `_id`. Successfully handles custom `gameId` without 500 errors. Verified in `phase5_social_analytics.test.ts`. |
| **GAP-03** | Backend API | Notification Mark-As-Read CastError (P2) | `server/src/controllers/notificationController.ts` | `VERIFIED_WORKING` | Low | Added `isValidObjectId` validation returning HTTP 400 Bad Request on invalid notification IDs. Verified in `phase5_social_analytics.test.ts`. |
| **GAP-04** | Database | MongoDB Schema Index Synchronization | `server/src/scripts/initIndexes.ts`, `server/src/models/*` | `VERIFIED_WORKING` | Low | Added missing `UserAchievement` index sync. All 15 collections synchronize 100% cleanly. |
| **GAP-05** | Real-time Engine | In-Memory Rate Limit Map Unbounded Growth | `server/src/realtime/game/gameHandlers.ts`, `server/src/controllers/practiceController.ts` | `VERIFIED_WORKING` | Medium | Added eviction cycle when map capacity exceeds 2,000 keys. Prevents process memory exhaustion under prolonged multi-room traffic. |
| **GAP-06** | Real-time Engine | Server-Authoritative Stroke Normalization | `server/src/realtime/drawing/drawing.schemas.ts`, `drawingHandlers.ts` | `VERIFIED_WORKING` | High | Strict Zod validation on coordinates `x,y in [0, 1]`, width `[0.001, 0.1]`, tool `brush|eraser`. Rejects out-of-bounds strokes. Verified in `drawing_realtime.test.ts`. |
| **GAP-07** | Real-time Engine | Word Selection Role Privacy & Secret Word Isolation | `server/src/game/Game.ts`, `gameHandlers.ts` | `VERIFIED_WORKING` | Critical | Authoritative `getViewerSnapshot` strictly delivers word choices only to active drawer during `word_selection`. Masked strings delivered to observers. Verified in `multiplayer_simulation.test.ts`. |
| **GAP-08** | Real-time Engine | Imposter Mode Role Privacy | `server/src/game/Game.ts`, `ai_and_imposter_features.test.ts` | `VERIFIED_WORKING` | Critical | Imposter receives only category clue; Innocents receive secret word; Imposter identity sealed until voting round completes. Verified in `ai_and_imposter_features.test.ts`. |
| **GAP-09** | Real-time Engine | Smart Reconnect & Session Recovery | `server/src/services/RoomManager.ts`, `DrawingSessionManager.ts`, `socketHandlers.ts` | `VERIFIED_WORKING` | High | 60s disconnection grace window. Seamless snapshot delivery of game state and drawing strokes upon socket reconnect. Verified in load benchmark (`scripts/multiplayer_load_benchmark.ts`). |
| **GAP-10** | Real-time Engine | AFK Protection & Turn Timeout Handling | `server/src/game/Game.ts` | `VERIFIED_WORKING` | Medium | 20-second warning countdown and automatic turn skip if drawer goes inactive. Prevents stalled games. Verified in `game_realtime.test.ts`. |
| **GAP-11** | Real-time Engine | Concurrency & Multi-Room Load Performance | `scripts/multiplayer_load_benchmark.ts` | `VERIFIED_WORKING` | High | Tested 20 concurrent sockets, 5 rooms, 25 drawing stroke bursts, 15 simultaneous guesses. Measured 0.5ms average stroke broadcast latency, 1.3ms guess processing latency, 136MB RSS memory. Verified clean exit code 0. |
| **GAP-12** | Security | Handshake JWT Authentication & Revocation | `server/src/realtime/socketAuth.ts`, `server/src/middleware/authMiddleware.ts` | `VERIFIED_WORKING` | Critical | Token verification enforced on initial socket connection and HTTP endpoints. Verified in `auth.test.ts` and `rooms_realtime.test.ts`. |
| **GAP-13** | Security | Cross-Site Scripting & AI Moderation Bypass | `server/src/services/AIModerationService.ts`, `server/src/utils/sanitize.ts` | `VERIFIED_WORKING` | High | Sanitizes display names, room names, and chat guesses. Rejects abusive and prompt-injection messages. Verified in smoke tests and test suite. |
| **GAP-14** | AI / ML | Quick, Draw! Neural Sketch Recognizer | `ml_service/app.py`, `server/src/services/MLServiceClient.ts` | `VERIFIED_WORKING` | Medium | ResNet-based CNN serving top-5 classifications over FastAPI. Fallback heuristic recognizer configured when ML service is offline. 5 Pytest unit tests pass cleanly. |
| **GAP-15** | AI / ML | GenAI Word Pack Generator | `server/src/services/GenAIWordPackService.ts`, `client/src/features/wordpacks/GenAIWordPackModal.tsx` | `VERIFIED_WORKING` | Medium | Integration with Google Gemini API (`GEMINI_API_KEY`) with deterministic local procedural word generator fallback when unconfigured. Tested in `wordpacks_genai.test.tsx`. |
| **GAP-16** | Observability | Prometheus Metrics & Operational Telemetry | `server/src/services/OperationalMetrics.ts`, `server/src/routes/observabilityRoutes.ts` | `VERIFIED_WORKING` | Medium | Exposes socket connection counters, active rooms, reconnect rates, and HTTP request metrics at `/api/observability/metrics`. Smoke tested with admin authentication. |
| **GAP-17** | Architecture | Horizontal Multi-Instance Real-time State Ownership | `docs/SCALABILITY_ARCHITECTURE.md`, `server/src/realtime/socket.ts` | `PARTIALLY_IMPLEMENTED` | High | Socket.IO Redis adapter configuration mapped out; currently operating safely on Single Authoritative Instance topology with process-local state managers. Multi-instance topology deferred pending multi-node deployment. |
| **GAP-18** | Commercial | SaaS Payment & Stripe Subscription System | N/A | `NOT_APPLICABLE` | Low | Deliberately excluded; DrawMate operates as an open competitive gaming community platform. No monetization requirement established. |
| **GAP-19** | Architecture | Distributed Kafka/gRPC Microservices | N/A | `NOT_APPLICABLE` | Low | Rejected. Single modular monolith avoids inter-service latency and distributed failure modes for real-time stroke streaming. |

---

## 3. Summary of Resolved Issues in Current Run
1. **Bundle Optimization**: Resolved chunk size warnings in Vite using Rollup manual chunking.
2. **Database CastErrors**: Fixed `matchController.ts` and `notificationController.ts` ObjectId validations.
3. **Index Completeness**: Synchronized `UserAchievement` in index script.
4. **Memory Bounding**: Bounded in-memory guess and prediction rate limit maps to 2,000 max entries with automatic eviction.
5. **Multiplayer Benchmark**: Built and successfully validated end-to-end 20-client load benchmark script proving sub-millisecond drawing broadcast performance.
