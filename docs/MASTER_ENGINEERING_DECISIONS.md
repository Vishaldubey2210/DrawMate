# DrawMate — Master Architecture Decision Records (ADRs)

## 1. Overview
This document records the critical architectural decisions, engineering trade-offs, evaluated alternatives, and binding rationales established during the DrawMate Master Engineering Program.

---

## 2. Architecture Decision Records

### ADR-01: Modular Monolith vs Distributed Microservices
- **Status**: Accepted
- **Context**: Multiplayer gaming engines require sub-millisecond drawing stroke propagation, atomic turn-timer progression, and low operational overhead. A microservice decomposition (e.g., separating Rooms, Game Engine, Chat, and Persistence into discrete services communicating via gRPC or Kafka) was evaluated.
- **Decision**: Adopt a clean, modular monolith for the backend application while maintaining the AI sketch recognizer as an isolated Python FastAPI microservice.
- **Rationale**:
  - Distributing stroke broadcasting across network hops introduces 10-30ms serialization and network latency per point, causing noticeable input lag for drawing and guessing.
  - The modular monolith achieves 0.5ms average stroke synchronization latency and 1.3ms guess processing latency under load.
  - Minimizes DevOps failure modes and operational costs.
- **Consequences**: Internal domain boundaries (services, controllers, models) must remain strictly decoupled to facilitate future extraction if traffic dictates.

---

### ADR-02: Single Authoritative Runtime vs Premature Redis Distributed Mutexes
- **Status**: Accepted
- **Context**: Scaling real-time Socket.IO game engines horizontally across multiple Node.js instances requires distributed timer coordination and cross-instance canvas state synchronization.
- **Decision**: Deploy the application on a Single Authoritative Runtime topology for current production requirements (0 - 1,000 CCU) with process-local state singletons (`RoomManager`, `GameManager`, `DrawingSessionManager`). Defer multi-instance Redis sharding until concurrency exceeds 1,000 CCU.
- **Rationale**:
  - In a multiplayer drawing game, attempting to synchronize each stroke and turn timer using distributed Redis mutexes adds network hops and timer drift.
  - The single authoritative runtime supports 300-500 CCU on a small 2-vCPU node and 1,000+ CCU on a 4-vCPU node with negligible memory overhead (136MB RSS under benchmark load).
  - A clear horizontal scaling roadmap using sticky-session room sharding is defined in `docs/SCALABILITY_ARCHITECTURE.md`.
- **Consequences**: Horizontal auto-scaling of backend game worker containers must follow room-affinity routing rather than round-robin load balancing.

---

### ADR-03: Vector Coordinate Normalization `[0, 1]` vs Fixed Pixel Canvas
- **Status**: Accepted
- **Context**: Players draw and guess across heterogeneous client form factors: desktop 4K monitors, laptops, tablets, and mobile smartphones.
- **Decision**: Enforce normalized floating-point coordinate vectors `(x, y)` in `[0.0, 1.0]` across all socket payloads, drawing buffers, and stored replay files.
- **Rationale**:
  - Fixed pixel dimensions (e.g. 800x600) distort drawings on high-DPI retina displays and truncate strokes on mobile screens.
  - Normalized vectors render with pixel-perfect aspect ratio scaling across any canvas viewport.
  - Significantly reduces payload size compared to rasterized PNG/JPEG data streams.
- **Consequences**: Frontend must scale incoming coordinates by local canvas bounding client rectangles; backend validates strict boundary ranges with Zod.

---

### ADR-04: Server-Authoritative Secret Word & Role Sanitization
- **Status**: Accepted
- **Context**: In multiplayer guessing games and Imposter deduction games, sensitive data (secret words, word candidate choices, Imposter identities) must never be accessible to unauthorized players via browser dev tools or WebSocket packet inspection.
- **Decision**: Perform all role masking, word choice filtration, and clue redaction strictly on the server within `Game.getViewerSnapshot(viewerUserId)` prior to network emission.
- **Rationale**:
  - Relying on client-side React UI to hide secret words allows malicious players to inspect raw WebSocket frames and cheat.
  - The server emits `snapshot.word.choices` strictly to the active drawer during `word_selection`.
  - In Imposter Mode, Innocents receive secret words while the Imposter receives only category hints.
- **Consequences**: Verified by automated test suites (`multiplayer_simulation.test.ts`, `ai_and_imposter_features.test.ts`).

---

### ADR-05: In-Memory Bounded Map Eviction vs External Redis Rate Limiting
- **Status**: Accepted
- **Context**: In-memory rate limiting registries (`guessRateLimits` in `gameHandlers.ts` and `userPredictionLimits` in `practiceController.ts`) could grow unbounded if thousands of unique users connected over time.
- **Decision**: Implement capacity bounding (max 2,000 keys) with automated timestamp-based eviction sweeps whenever map size exceeds threshold.
- **Rationale**:
  - Eviction sweeps ensure memory footprint remains strictly bounded (< 5MB) without introducing an external Redis dependency for ephemeral spam suppression.
  - Ensures reliable rate limiting (max 6 guesses per 5 seconds) without memory leakage.
- **Consequences**: If capacity exceeds 2,000 active concurrent guessers, expired keys are purged instantly during lookup.

---

### ADR-06: Frontend Rollup Manual Chunk Splitting
- **Status**: Accepted
- **Context**: Vite 6 bundle compilation produced a single monolithic JavaScript bundle (`index.js` > 650kB), triggering production chunk size warnings and slowing initial page load times.
- **Decision**: Configure Rollup `output.manualChunks` in `client/vite.config.ts` to cleanly separate vendor libraries:
  - `vendor-react`: `react`, `react-dom`, `react-router-dom` (165kB)
  - `vendor-icons`: `lucide-react` (39kB)
  - `vendor-network`: `socket.io-client`, `axios` (93kB)
  - App bundle: `index.js` (353kB, gzip 75kB)
- **Rationale**:
  - No chunk exceeds the 500kB warning threshold.
  - Allows browsers to cache third-party libraries across application updates, improving repeat page load times.
- **Consequences**: Verified clean production build via `npm run build` with zero chunk warnings.

---

### ADR-07: Deferral of Stripe Billing & Commercial Subscriptions
- **Status**: Accepted
- **Context**: Evaluating whether DrawMate requires immediate implementation of paid tiers, credit card billing, and subscription webhooks.
- **Decision**: Defer commercial billing integrations. Maintain the application as an open community competitive platform for current phase.
- **Rationale**:
  - No business model or pricing matrix has been established or authorized.
  - Prematurely introducing payment webhooks, PCI-compliance overhead, and third-party dependencies adds fragility without commercial value.
- **Consequences**: Tagged as `NOT_APPLICABLE` in `MASTER_GAP_REGISTER.md`.

---

### ADR-08: Preservation of Quick, Draw! ML Dataset Under 10GB Hard Storage Constraint
- **Status**: Accepted
- **Context**: The project includes a trained sketch-recognition model based on Google's Quick, Draw! dataset. A strict 10GB workspace limit is in place.
- **Decision**: Preserve existing trained model weights (`ml_service/model/sketch_model.pth` and `.onnx`) and avoid re-downloading or re-extracting the multi-gigabyte raw Quick, Draw! dataset.
- **Rationale**:
  - The model is already trained and validated with 5 unit tests passing.
  - Re-downloading the raw dataset risks exceeding disk quotas and wastes network resources.
- **Consequences**: Training scripts are documented and preserved, but automated CI pipelines execute inference validation tests only.
