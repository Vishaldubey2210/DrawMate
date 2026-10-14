# Phase 3 Implementation Plan — Production-Quality Real-Time Drawing Canvas & Socket.IO Synchronization Engine

## 1. Audit Assessment of Phase 1 & 2 Foundations
- **Phase 1 Foundations:** Reusable design system (`Button`, `Modal`, `ConfirmDialog`, `Badge`, `Toast`), theme provider (dark/light mode), and authenticated session context.
- **Phase 2 Real-Time Foundations:** Authoritative Socket.IO server with JWT handshake authentication, `RoomManager` tracking player presence and room lifecycle, normalized room codes, and event channels (`room:${roomCode}`).
- **Phase 3 Scope Boundaries:**
  - Build the HTML5 canvas, pointer capture, tool state (brush, color palette, brush sizes, eraser, undo, clear).
  - Authoritative server-side drawing session manager (`DrawingSessionManager`) with Zod payload validation, permission enforcement (only authorized drawer can draw/undo/clear), and monotonically increasing revisions.
  - Normalized coordinate system ([0, 1]) independent of client viewport dimensions or device pixel ratios.
  - Efficient vector stroke transport with point batching and incremental canvas rendering.
  - Full state recovery for late joiners and reconnecting clients via snapshots.
  - **Non-goals:** Word selection, guessing chat, timers, and scoring belong strictly to Phase 4.

---

## 2. Architecture & File Structure

```
server/src/
├── realtime/
│   ├── socket.ts                     # Registers drawing socket handlers
│   ├── drawing/
│   │   ├── drawing.types.ts          # Server-side stroke & session type definitions
│   │   ├── drawing.schemas.ts        # Zod payload schemas for drawing events
│   │   └── drawingHandlers.ts        # Socket.IO drawing event dispatchers
│   └── socketHandlers.ts             # Room & lobby event integration
├── services/
│   └── DrawingSessionManager.ts      # Authoritative drawing session & stroke manager

client/src/
├── features/
│   └── drawing/
│       ├── drawing.types.ts          # Shared client drawing types & interfaces
│       ├── drawing.utils.ts          # Bezier smoothing, coordinate normalization, DPI helper
│       ├── useDrawingCanvas.ts       # Canvas ref, pointer events, DPI & resize observer
│       ├── useDrawingSession.ts      # Socket.IO drawing sync, point batching, snapshot handling
│       ├── DrawingCanvas.tsx         # Responsive HTML5 canvas component
│       ├── DrawingToolbar.tsx        # Container for tools, palette, sizes, undo & clear
│       ├── ColorPalette.tsx          # 12-color curated accessible palette
│       ├── BrushSizeSelector.tsx     # Thin, Medium, Thick size options
│       ├── DrawingStatus.tsx         # Drawer vs Observer indicator & revision status
│       └── DrawingStudio.tsx         # Integrated drawing workspace with dev-harness controls
├── test/
│   └── drawing.test.tsx              # Frontend drawing canvas & tool unit tests
server/tests/
└── drawing_realtime.test.ts          # Multi-client drawing sync integration tests
```

---

## 3. Authoritative Coordinate & Stroke Data Model

### 3.1 Normalized Coordinates
- Normalized points: `{ x: number, y: number }` where `0.0 <= x <= 1.0` and `0.0 <= y <= 1.0`.
- Clamped and validated with finite number assertions (rejection of NaN/Infinity).
- Viewport independence: Canvas renders vector points scaled by `ctx.scale(canvasWidth, canvasHeight)` or multiplied during path construction.
- Device Pixel Ratio (DPR): Backing buffer dimensions set to `rect.width * window.devicePixelRatio`, while CSS dimensions set to `rect.width`. Context is scaled by DPR so lines render sharp on Retina/High-DPI screens without altering logical coordinates.

### 3.2 Stroke Schema
```typescript
interface Stroke {
  strokeId: string;       // Unique UUID/cryptographic string
  drawerId: string;       // Authoritative user ID of artist
  tool: 'brush' | 'eraser';
  color: string;          // Hex color (e.g. #000000), ignored for eraser
  width: number;          // Normalized brush width fraction (0.002 to 0.05)
  points: Array<{ x: number; y: number }>;
  createdAt: number;      // Epoch timestamp
}
```

### 3.3 Drawing Session State
```typescript
interface DrawingSession {
  sessionId: string;
  roomCode: string;
  drawerId: string;       // Authoritative active drawer
  status: 'active' | 'paused' | 'ended';
  revision: number;       // Monotonically increasing revision counter
  strokes: Stroke[];      // Ordered completed strokes
  activeStroke: Stroke | null; // Currently accumulating stroke
  updatedAt: number;
}
```

---

## 4. Socket.IO Real-Time Event Contracts

- `draw:session_init`: Host or game engine activates drawing session in room.
- `draw:stroke_start`: Drawer initiates a new stroke (`strokeId`, `tool`, `color`, `width`, initial `point`).
- `draw:stroke_points`: Drawer batches points (`strokeId`, `points: Point[]`).
- `draw:stroke_end`: Drawer completes stroke (`strokeId`, final `points`).
- `draw:undo`: Drawer undoes last completed stroke.
- `draw:clear`: Drawer clears all strokes.
- `draw:get_state`: Observer or reconnecting client requests full canvas snapshot.

---

## 5. Acceptance Criteria
- [x] Responsive HTML5 canvas with High-DPI support and `ResizeObserver`.
- [x] Normalized vector coordinates preventing aspect ratio distortion.
- [x] Genuine eraser using `globalCompositeOperation = 'destination-out'`.
- [x] Color palette with 12 accessible curated colors and active indicators.
- [x] Brush size selector (Thin: 0.006, Medium: 0.015, Thick: 0.035).
- [x] Server-side authorization: only authorized `drawerId` can draw, undo, or clear.
- [x] Real-time point batching and low-latency incremental rendering.
- [x] Authoritative undo: removes last completed stroke from canonical history and syncs.
- [x] Authoritative clear: resets canonical strokes with revision advancement and syncs.
- [x] Reconnection & late-join snapshot recovery: reconstructs full canvas without duplicates.
- [x] Server payload validation: Zod schemas rejecting NaN, out-of-bounds, and oversized payloads.
- [x] Multi-client Socket.IO integration tests verifying drawer permissions and observer sync.
- [x] Documentation updated in `docs/PHASE_3_PLAN.md`, `docs/PHASE_3_ARCHITECTURE.md`, `docs/SOCKET_EVENTS.md`, and `README.md`.
