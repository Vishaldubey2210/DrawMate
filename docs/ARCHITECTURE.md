# DrawMate Architecture & Real-Time Game Engine Integration

## 1. Phase 1 Foundation Architecture

DrawMate is structured with strict separation of concerns, providing a scalable foundation that will easily integrate real-time multiplayer features in future phases.

```
DrawMate Platform
├── client/ (Vite + React + TypeScript + Tailwind CSS)
│   ├── src/components/ui/    # Atomic design system tokens & primitives
│   ├── src/components/layout/# Responsive AppLayout & Navbar
│   ├── src/context/          # Auth, Theme, and Toast global state
│   ├── src/pages/            # Landing, Auth, Onboarding, Dashboard, Profile, Settings
│   └── src/services/api.ts   # Authenticated Axios client with credentials
└── server/ (Node.js + Express + TypeScript + Mongoose)
    ├── src/config/           # Database connector & environment schemas
    ├── src/models/           # User, Session, PasswordResetToken
    ├── src/controllers/      # Auth, Profile, and Settings handlers
    ├── src/middleware/       # Auth validation, Zod validation, rate limiter, error handling
    └── src/utils/            # JWT issuance, bcrypt hashing, crypto tokens
```

---

## 2. Real-Time Game Server Integration Roadmap (Phase 2)

The DPR calls for a full multiplayer drawing and guessing experience (turn-based drawing, stroke synchronization, word selection, round timers, guess chats, and live scoring).

### 2.1 Decoupled Socket.IO Gateway
In Phase 2, a Socket.IO server layer will mount onto the existing HTTP server instance:

```typescript
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ENV.CLIENT_URL,
    credentials: true,
  },
});
```

### 2.2 Reusing Phase 1 Authentication in WebSockets
Because Phase 1 uses signed JWT tokens and HTTP-only session cookies, Socket.IO connections can authenticate without creating an independent authentication system:

```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token || socket.request.headers.cookie;
  // verify JWT payload -> attach userId to socket
  next();
});
```

### 2.3 Object-Oriented Game Engine Architecture
The DPR bonus section highlights structuring the WebSocket server using OOP concepts:
- **`Room` class:** Encapsulates participants, max player capacity, round count, and room privacy state.
- **`Game` class:** Manages round phases (`SELECTING_WORD`, `DRAWING`, `ROUND_END`, `GAME_OVER`), word choices, turn rotation, and countdown timers.
- **`Player` class:** Holds socket connection, active score, round guess status, and links back to the Phase 1 persistent `User` ObjectId.
- **`CanvasSyncManager`:** Buffers and broadcasts draw strokes (`draw_start`, `draw_move`, `draw_end`, `canvas_clear`, `draw_undo`).

### 2.4 Persisting Stats to Phase 1 User Model
When a match concludes (`game_over` event), the room controller dispatches the outcome to update the `User.stats` fields established in Phase 1:
- Increment `gamesPlayed`
- Increment `wins` for the 1st place winner
- Add to `totalScore`
- Update `highestScore`

Because the User schema and profile views already support these fields, Phase 2 needs zero migrations to the user account layer.
