# DrawMate — Remaining Work Register (Post-Audit Roadmap)

This register tracks enhancements, infrastructure upgrades, and operational recommendations beyond the scope of Phase SE-3 and the core SaaS launch.

No P0 (Critical) or P1 (High) defects remain unresolved in the codebase. All items listed below are non-blocking operational improvements or future scalability enhancements.

---

## Priority Classifications
- **P2 (Medium)**: Operational enhancements recommended for high-volume enterprise traffic.
- **P3 (Low)**: Minor performance polish, optional dependencies, or developer experience.

---

## Open Roadmap Items

### 1. Horizontal Multi-Instance Scalability Architecture
- **ID**: `RW-01` | **Priority**: `P2` | **Status**: Backlog (Future Scale)
- **Description**:
  The current authoritative room and game state (`RoomManager`, `GameManager`) is stored in-process in the Node.js memory space. For single-server deployments (up to ~500 concurrent players), this provides zero-overhead, sub-millisecond game state updates.
- **Future Enhancement**:
  When scaling beyond a single server instance, evaluate either:
  1. L4/L7 Sticky Session Routing (trafficking each room code to its designated Node.js worker instance via consistent hashing).
  2. Redis adapter with distributed state checkpoints (requires external Redis cluster).

### 2. Dependency Minor Updates for Dev Build Tools
- **ID**: `RW-02` | **Priority**: `P3` | **Status**: Backlog (Maintenance)
- **Description**:
  `npm audit` reports moderate advisories on `tinypool` (Vitest worker dependency), `chokidar` (Tailwind CSS v3 watcher), and `react-router-dom` v6 SSR hydration. None of these affect the client-side SPA or backend runtime in production.
- **Future Enhancement**:
  Upgrade to Tailwind CSS v4 and React Router v7 when upstream ecosystem migrations stabilize.

### 3. Production Sketch Recognition Model Distribution
- **ID**: `RW-03` | **Priority**: `P3` | **Status**: Backlog (Deployment)
- **Description**:
  The Python sketch recognition service functions in both PyTorch model mode and mock/heuristic mode. The pretrained Quick, Draw! model checkpoint is bundled in `ml/sketch_recognizer/artifacts/`.
- **Future Enhancement**:
  Package the model service into a standalone Docker image published to a container registry (e.g. Docker Hub, AWS ECR) for automated cloud deployment.

### 4. Advanced Push Notifications for Native Mobile
- **ID**: `RW-04` | **Priority**: `P3` | **Status**: Backlog (Feature Expansion)
- **Description**:
  Real-time in-app notifications and email dispatch are fully functional. Native Web Push (Service Workers + VAPID) could be integrated for offline friend invitations and tournament announcements.
