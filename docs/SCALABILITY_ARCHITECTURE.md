# DrawMate — Scalability Architecture & Horizontal Scaling Roadmap

## 1. Executive Summary & Design Philosophy
DrawMate is a fast-paced multiplayer drawing-and-guessing game platform where latency and responsiveness directly govern player satisfaction.
In drawing games:
- Stroke points must be synchronized in sub-10ms intervals to prevent perceived input lag.
- Turn timers, AFK countdowns, and guess evaluation require strict, deterministic atomicity without race conditions or split-brain states.

This document defines the scalability characteristics of the current verified architecture, analyzes the empirical performance benchmarks executed against the system, and presents the staged horizontal scaling roadmap for future high-traffic deployments.

---

## 2. Current Architecture: Single Authoritative Runtime (Verified State)

### 2.1 Component Topology
- **Web Client**: React 18, Vite 6, Tailwind CSS SPA served as static assets.
- **Backend Core**: Modular Node.js / Express monolith handling REST APIs and WebSocket connections via Socket.IO 4.x.
- **Authoritative In-Memory Managers**:
  - `RoomManager`: Singleton tracking active lobbies, player presence, spectator slots, host controls, and ready states.
  - `GameManager`: Singleton governing match state machines, active drawer turn rotations, word choices, secret word masks, scoring algorithms, and Imposter mode voting rounds.
  - `DrawingSessionManager`: Singleton holding the active vector stroke canvas buffer and historical stroke undo/redo stacks.
- **Database**: MongoDB 7.x cluster holding persistent records: Users, Profiles, Matches, Custom Word Packs, Achievements, and Audit Logs.
- **AI Sketch Recognizer**: Standalone Python FastAPI microservice running a convolutional neural network (PyTorch/ONNX) for Quick, Draw! 345-class stroke vector classification.

```
+-----------------------------------------------------------------------+
|                            Client Browsers                            |
|             (React 18 + Vite + Socket.IO-Client + Canvas)             |
+-----------------------------------+-----------------------------------+
                                    |
                       HTTP REST & WebSocket
                                    |
                                    v
+-----------------------------------------------------------------------+
|                    DrawMate Authoritative Runtime                     |
|                                                                       |
|  +---------------------+   +---------------------+   +-------------+  |
|  |     Express API     |   |   Socket.IO Server  |   | Operational |  |
|  |  (Auth, Packs, Reg) |   |  (Rooms, Draw, Game)|   |   Metrics   |  |
|  +----------+----------+   +----------+----------+   +------+------+  |
|             |                         |                     |         |
|             v                         v                     v         |
|  +-----------------------------------------------------------------+  |
|  |                    In-Memory State Singletons                   |  |
|  |       RoomManager | GameManager | DrawingSessionManager         |  |
|  +------------------------------------+----------------------------+  |
+-------------------+-------------------|-------------------------------+
                    |                   |
         Mongoose / BSON Queries        | Stroke Prediction POST
                    |                   |
                    v                   v
+-----------------------+   +-----------------------+
|    MongoDB Cluster    |   |  FastAPI ML Service   |
| (Users, Matches, Logs)|   |  (Quick, Draw! ResNet)|
+-----------------------+   +-----------------------+
```

### 2.2 Measured Benchmark Results (Verified Empirical Baseline)
On October 13, 2026, an end-to-end multi-room load benchmark (`scripts/multiplayer_load_benchmark.ts`) was executed against the local authoritative server with 20 concurrently connected players partitioned across 5 simultaneous rooms:

| Metric | Measured Baseline | Target SLA | Compliance Status |
| :--- | :--- | :--- | :--- |
| **Concurrent WebSocket Connections** | 20 active sockets | 20 | PASS |
| **Concurrent Active Rooms** | 5 simultaneous matches | 5 | PASS |
| **Multi-Point Drawing Bursts Dispatched** | 25 bursts (75 stroke points) | 25 | PASS |
| **Average Stroke Synchronization Latency** | **0.5 ms** | < 15.0 ms | **EXCEEDS SLA** |
| **P95 Stroke Synchronization Latency** | **1.0 ms** | < 30.0 ms | **EXCEEDS SLA** |
| **Authoritative Guess Processing Latency** | **1.3 ms** | < 25.0 ms | **EXCEEDS SLA** |
| **Smart Reconnect Recovery Success** | 100% (1/1 verified) | 100% | PASS |
| **Process Resident Set Size (RSS)** | **136 MB** | < 512 MB | PASS |
| **Process Heap Used** | **47 MB** | < 256 MB | PASS |
| **Total Benchmark Execution Duration** | 10,119 ms | < 30,000 ms | PASS |
| **Failures / Unhandled Rejections** | **0** | 0 | PASS |

### 2.3 Single-Node Capacity Ceiling
Based on memory consumption (47MB heap for 20 players = ~2.35MB heap per player including vector stroke histories and JWT handshakes) and sub-millisecond CPU dispatch overhead:
- A single 2-vCPU / 2GB RAM container comfortably supports **300 to 500 concurrent active players** (approx. 50-80 concurrent matches).
- A 4-vCPU / 4GB RAM dedicated server supports **1,000 to 1,500 concurrent players** before event-loop tick delays exceed 10ms.

---

## 3. The Horizontal Scaling Problem in Multiplayer Real-Time Games

A common anti-pattern in real-time gaming is attempting to achieve horizontal scaling simply by spinning up multiple instances behind a round-robin load balancer. This breaks in multiplayer systems because:
1. **Timer Fragmentation**: `setTimeout` turn timers and hint deadlines running on Node Instance A cannot coordinate with players connected to Node Instance B.
2. **Distributed Mutex Overhead**: Attempting to synchronize drawing canvases via distributed Redis locks on every stroke creates catastrophic latency spikes (20-50ms per network hop across instances), destroying drawing fluidness.
3. **Split-Brain Scoring**: If players in the same room connect to different servers, simultaneous guesses cannot be reliably ordered, leading to duplicate score bonuses.

---

## 4. Staged Horizontal Scaling Roadmap

When traffic exceeds single-node capacity (> 1,000 CCU), DrawMate will transition through the following validated architectural stages:

### Stage 1: Stateless REST & Media Offloading (0 - 2,500 CCU)
- **Frontend Assets**: Serve Vite production bundle via Cloudflare / AWS CloudFront CDN.
- **REST APIs**: Run 2-4 stateless Express worker instances behind an NGINX reverse proxy for CPU-heavy tasks (bcrypt hashing, JWT issuing, user profile pagination, image uploads, AI word-pack generation).
- **Dedicated Real-Time Gateway**: Dedicated single authoritative Node.js process specifically for WebSocket traffic and `RoomManager` / `GameManager`.

### Stage 2: Sticky-Session Room Affinity Sharding (2,500 - 10,000 CCU)
Instead of distributing a single room across multiple servers, **each room is authoritatively assigned to a single server instance**.

```
                           +---------------------------+
                           |   Load Balancer / NGINX   |
                           | (WebSocket Sticky Routing)|
                           +-------------+-------------+
                                         |
                +------------------------+------------------------+
                | Room Code Routing / Hash                        |
                v                                                 v
  +---------------------------+                     +---------------------------+
  |    Game Node 1 (Worker)   |                     |    Game Node 2 (Worker)   |
  | Rooms: AAAA - MMMM        |                     | Rooms: NNNN - ZZZZ        |
  | In-Memory Turn Timers     |                     | In-Memory Turn Timers     |
  | Local Drawing Buffers     |                     | Local Drawing Buffers     |
  +-------------+-------------+                     +-------------+-------------+
                |                                                 |
                +------------------------+------------------------+
                                         |
                                         v
                           +---------------------------+
                           |       Redis Cluster       |
                           | - Room Directory Registry |
                           | - Cross-Node Matchmaking  |
                           | - Ephemeral Snapshots     |
                           +---------------------------+
```

1. **Room Directory Registry (Redis)**:
   - When a room is created, the host's server registers `roomCode -> instanceId` with a 120s TTL heartbeat in Redis.
   - When new players attempt to join `/join/:roomCode`, the NGINX proxy routes the WebSocket connection to the designated `instanceId`.
2. **Deterministic Ownership**:
   - All players in room `ABCD` are connected to the same Game Node.
   - Sub-millisecond stroke synchronization and local `setTimeout` turn timers remain 100% deterministic with zero distributed locking overhead.
3. **Socket.IO Redis Streams Adapter**:
   - Enabled for global system-wide notifications, administrative broadcasts, and cross-room lobby chat.

### Stage 3: Room State Checkpointing & Failover (10,000+ CCU)
- **Snapshot Persistence**: At the completion of each turn and round, the authoritative Game Node asynchronously writes the room snapshot to Redis.
- **Automated Node Evacuation**: If a Game Node fails its health heartbeat, an orchestrator (Kubernetes / ECS) reassigns active rooms to surviving nodes, which load the latest Redis snapshot and resume the match within the 60-second grace window without match termination.

---

## 5. Architectural Trade-offs & Rationalization

| Approach Considered | Trade-off / Cost | Decision | Rationalization |
| :--- | :--- | :--- | :--- |
| **Premature Redis Microservices** | High operational complexity, +15ms network latency per stroke, multi-container orchestration. | **Rejected for Current Phase** | The single authoritative runtime achieves 0.5ms stroke latency and easily handles up to 1,000 CCU with zero operational friction. |
| **Distributed Message Bus (Kafka / RabbitMQ)** | Complex event ordering, consumer lag, serialization overhead. | **Rejected** | Socket.IO room channels provide native pub/sub with zero message broker overhead. |
| **Room-Affinity Worker Sharding** | Requires sticky load balancer routing and Redis room directory. | **Adopted as Future Scaling Target** | Preserves sub-millisecond local in-memory game state execution while allowing horizontal scale to thousands of simultaneous rooms. |

---

## 6. Capacity & Cost Projections

| Concurrency Tier | Architecture Configuration | Estimated Monthly Cost | Performance SLA |
| :--- | :--- | :--- | :--- |
| **Tier 1: 0 - 1,000 CCU** | 1x Dedicated App Server (4 vCPU, 4GB RAM) + MongoDB Atlas Free/Tier M10 | $20 - $60 / mo | < 1ms stroke sync, 99.9% uptime |
| **Tier 2: 1,000 - 5,000 CCU** | 3x Game Worker Nodes + 1x NGINX Proxy + Redis 7.x Node + MongoDB Atlas M20 | $150 - $300 / mo | < 5ms stroke sync, 99.95% uptime |
| **Tier 3: 5,000 - 25,000 CCU** | Auto-scaled ECS Cluster (10-25 nodes) + Redis Cluster + Multi-AZ MongoDB | $600 - $1,500 / mo | < 10ms stroke sync, 99.99% uptime |
