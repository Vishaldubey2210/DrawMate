# DrawMate Phase 3 — System Architecture Specification: Drawing Canvas & Real-Time Synchronization Engine

## 1. Executive Summary & Architectural Scope

Phase 3 establishes the complete, production-grade real-time drawing canvas, stroke capture engine, Socket.IO synchronization protocol, and authoritative state management for **DrawMate**.

This phase delivers:
- **Authoritative Real-Time Architecture:** Sockets are authenticated via Phase 1 JWT sessions, with stroke permissions enforced server-side. Only the designated `drawerId` can draw, append points, undo, or clear. Observers receive real-time streams and snapshots.
- **Normalized Coordinate System ([0, 1]):** All stroke points are represented as floating-point fractions clamped between 0 and 1, ensuring drawing fidelity across mobile screens, tablets, and 4K desktop monitors without stretching or distortion.
- **High-DPI / Retina Crisp Rendering:** Canvas backing buffer scales dynamically with `window.devicePixelRatio`, while CSS logical bounds are tracked via `ResizeObserver`.
- **Low-Latency Vector Transport:** Local strokes render with 0ms delay; intermediate points are batched at 50Hz and broadcasted to peers for incremental rendering without repainting the entire canvas.
- **Genuine Eraser Semantics:** Uses HTML5 canvas `globalCompositeOperation = 'destination-out'` to erase strokes down to the canvas background without painting white paint.
- **Durable Snapshot & Reconnection Recovery:** Canonical stroke history is versioned with monotonically increasing revisions (`revision`). Reconnecting users and late joiners fetch a complete snapshot reconstructing the exact drawing state.
- **Clean Boundary for Phase 4:** The drawing engine is modularized to be controlled by the upcoming Phase 4 game engine (which will rotate drawers and manage round timers).

---

## 2. Canvas Rendering Engine & Coordinate Model

### 2.1 Logical Coordinate Model
Clients use distinct screen sizes, aspect ratios, and orientations. To prevent stroke distortion, authoritative drawing data is completely decoupled from pixel dimensions:
- **Normalized Point Definition:**
  ```typescript
  interface Point {
    x: number; // 0.0 <= x <= 1.0 (clamped & rounded to 4 decimals)
    y: number; // 0.0 <= y <= 1.0 (clamped & rounded to 4 decimals)
  }
  ```
- **Coordinate Conversion:**
  ```typescript
  x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  ```
- **Rendering Projection:** When rendering to an active canvas with dimensions `(W, H)`, physical coordinates are calculated as `(x * W, y * H)`. Brush thickness is similarly normalized: `pixelWidth = stroke.width * W`.

### 2.2 High-DPI / Retina Resolution
On high-density displays (e.g., Apple Retina displays with DPR = 2 or 3), standard canvases look blurry if buffer size equals CSS size.
- **Backing Store Resizing:**
  ```typescript
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(containerWidth * dpr);
  canvas.height = Math.floor(containerHeight * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ```
- **Result:** Lines are rendered at native device resolution while logical math remains in CSS pixels.

### 2.3 Responsive Resizing via `ResizeObserver`
A `ResizeObserver` monitors the canvas container:
- When viewport or layout changes, the backing store updates with DPR scaling.
- `redrawAllStrokes(ctx, canonicalStrokes, activeStroke, width, height)` immediately redraws all vector paths from normalized coordinates.
- No bitmap distortion occurs regardless of window resizing or device rotation.

---

## 3. Stroke Data Model & Smoothing

### 3.1 Stroke Representation
```typescript
interface Stroke {
  strokeId: string;       // Unique UUID/identifier
  drawerId: string;       // Authoritative user ID of artist
  tool: 'brush' | 'eraser';
  color: string;          // Hex color (e.g. #000000)
  width: number;          // Normalized width fraction (0.006, 0.015, 0.035)
  points: Point[];        // Ordered points
  createdAt: number;      // Epoch timestamp
}
```

### 3.2 Smooth Curve Interpolation
Rather than connecting discrete points with jagged straight lines, the rendering engine uses quadratic Bezier interpolation with midpoints:
```typescript
for (let i = 1; i < pts.length - 1; i++) {
  const midX = ((pts[i].x + pts[i + 1].x) / 2) * canvasWidth;
  const midY = ((pts[i].y + pts[i + 1].y) / 2) * canvasHeight;
  ctx.quadraticCurveTo(pts[i].x * canvasWidth, pts[i].y * canvasHeight, midX, midY);
}
```
Line caps and joins are configured to `'round'`, producing organic brush strokes.

---

## 4. Drawing Tools & Eraser Semantics

### 4.1 Brush Tool
- Selected color is applied: `ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color`.
- `ctx.globalCompositeOperation = 'source-over'`.

### 4.2 Color Palette
- 12 curated, accessible hex colors:
  - Black (`#000000`), Slate (`#475569`), White (`#ffffff`), Red (`#dc2626`)
  - Orange (`#ea580c`), Yellow (`#eab308`), Green (`#16a34a`), Cyan (`#06b6d4`)
  - Blue (`#2563eb`), Purple (`#7c3aed`), Pink (`#db2777`), Brown (`#78350f`)
- Full keyboard focus and active indicator ring.

### 4.3 Brush Sizes
- **Thin:** `0.006` normalized width (~4px on 800px width).
- **Medium:** `0.015` normalized width (~10px on 800px width).
- **Thick:** `0.035` normalized width (~24px on 800px width).

### 4.4 Genuine Eraser
- When `tool === 'eraser'`:
  - `ctx.globalCompositeOperation = 'destination-out'`.
  - Content beneath the stroke is removed down to the transparent canvas surface, overlaid on the white drawing container.
  - Does NOT paint white pixels, preserving background transparency and layer fidelity.
- Replaying strokes from canonical history preserves the exact composite sequence.

---

## 5. Authoritative Server State & Authorization

### 5.1 Drawing Session State
Managed by singleton `DrawingSessionManager`:
```typescript
interface DrawingSession {
  sessionId: string;
  roomCode: string;
  drawerId: string;       // Authoritative active drawer ID
  status: 'active' | 'paused' | 'ended';
  revision: number;       // Monotonically increasing counter
  strokes: Stroke[];      // Ordered completed strokes
  activeStroke: Stroke | null;
  updatedAt: number;
}
```

### 5.2 Server-Side Authorization
Every drawing event checks:
1. Socket authenticated with verified user (`socket.data.user`).
2. User is an active participant in `roomCode` via `RoomManager`.
3. Drawing session is `'active'`.
4. `session.drawerId === user.userId`.
If an observer attempts to start a stroke, append points, undo, or clear, the server rejects the request with `{ success: false, error: 'Unauthorized: Only the current drawer can modify the canvas.' }`.

---

## 6. Undo, Clear & Monotonic Revisions

### 6.1 Authoritative Undo
- Pops the last completed stroke from `session.strokes`.
- Clears any pending `session.activeStroke`.
- Advances `session.revision++`.
- Broadcasts `draw:undo_applied` with `{ removedStrokeId, revision }` to all clients.
- If canvas has 0 strokes, rejects with `'Nothing to undo'`.

### 6.2 Authoritative Clear
- Empties `session.strokes = []`.
- Clears `session.activeStroke = null`.
- Advances `session.revision++`.
- Broadcasts `draw:canvas_cleared` with `{ revision }` to all clients.
- Client shows `ConfirmDialog` before emitting destructive clear.

---

## 7. Socket.IO Synchronization & Reconnection

```
[Drawer Client]               [Server]                 [Observer Client]
      │                          │                             │
      ├── draw:stroke_start ────►│                             │
      │   (init dot)             ├── draw:stroke_started ─────►│
      │                          │                             │
      ├── draw:stroke_points ───►│                             │
      │   (batched points)       ├── draw:stroke_update ──────►│
      │                          │   (incremental render)      │
      ├── draw:stroke_end ──────►│                             │
      │   (commit stroke)        ├── draw:stroke_completed ───►│
      │                          │   (commit to history)       │
```

### 7.1 Late Joiner & Reconnection Recovery
When an observer joins mid-session or a disconnected user reconnects:
1. Client emits `draw:get_state` with `{ roomCode }`.
2. Server returns sanitized `CanvasSnapshot` with complete `strokes` array, current `activeStroke`, `drawerId`, and `revision`.
3. Client re-renders full canvas from canonical strokes without missing or duplicated lines.

---

## 8. Payload Limits & Abuse Protection

Validated with Zod schemas (`drawing.schemas.ts`):
- **Coordinates:** Must be finite numbers in `[0, 1]`. NaN/Infinity rejected.
- **Points per Batch:** Maximum 200 points per update.
- **Points per Stroke:** Capped at 5,000 points.
- **Strokes per Session:** Capped at 1,000 strokes (oldest pruned to keep memory bounded).
- **Batch Throttling:** Client batches points and dispatches at 50Hz (every 20ms) or when buffer reaches 12 points.

---

## 9. Development Test Harness & Phase 4 Integration

- In `RoomLobbyPage.tsx`, the tab switcher provides access to **Drawing Canvas Studio**.
- Clearly labeled `[Phase 3 Real-Time Canvas Test Environment]`.
- Controls allow switching/claiming drawer status between participants for testing.
- **Phase 4 Integration Boundary:** In Phase 4, the game turn engine will call `DrawingSessionManager.getInstance().setDrawer(roomCode, currentArtistId)` when a round begins, and clear the canvas between turns.
