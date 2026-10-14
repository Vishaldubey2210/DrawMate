<div align="center">

# 🎨 DrawMate

### *Next-Generation Real-Time Multiplayer Drawing & Social Gaming SaaS*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8+-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![Tests](https://img.shields.io/badge/Tests-295%20Passed%20(100%25)-brightgreen?style=for-the-badge)](https://github.com/Vishaldubey2210/DrawMate)

<p align="center">
  <b>DrawMate</b> is an enterprise-grade, high-performance multiplayer social gaming platform inspired by classic drawing-and-guessing games. Built from the ground up with a <b>server-authoritative game engine</b>, sub-15ms vector stroke synchronization, a dedicated <b>Deep Learning Quick, Draw! CNN sketch recognition service</b>, interactive <b>Imposter social deduction mode</b>, and a full-featured <b>social gaming ecosystem</b>.
</p>

[Key Features](#-key-features) • [System Architecture](#-system-architecture) • [Tech Stack](#-tech-stack) • [Game Modes](#-game-modes) • [Quick Start](#-quick-start) • [Verification & Testing](#-verification--testing) • [Deployment](#-deployment) • [API & Sockets](#-api--websocket-contracts)

---

</div>

## 📑 Table of Contents
- [🌟 Key Features](#-key-features)
- [🕹️ Game Modes](#-game-modes)
- [🏗️ System Architecture](#-system-architecture)
- [⚡ Tech Stack](#-tech-stack)
- [🔒 Security & Data Integrity](#-security--data-integrity)
- [🚀 Quick Start](#-quick-start)
- [🧪 Verification & Testing](#-verification--testing)
- [🚢 Deployment & DevOps](#-deployment--devops)
- [📡 API & WebSocket Contracts](#-api--websocket-contracts)
- [📄 License](#-license)

---

## 🌟 Key Features

### 🎨 Low-Latency Collaborative Vector Canvas
- **Sub-15ms Synchronization**: Instant vector stroke relays with point batching and normalized $[0, 1]$ logical coordinate mapping across varying screen ratios.
- **Mobile-First Touch Engine**: Native Pointer Events supporting stylus pressure, touch gesture isolation (`touch-action: none`), and pointer capture release.
- **Authoritative Undo & Redo**: Server-validated stack tracking with automatic branch invalidation upon new brushstrokes.
- **Lossless Canvas Resize**: High-DPI bitmap buffer preservation through offscreen canvas caching on browser resize or mobile keyboard popups.

### 🛡️ Resilience & Fair Play
- **30-Second Smart Reconnect**: Generation token protection prevents transient connection drops from evicting active players; state recovery conceals secret words from observers.
- **Anti-Spam Rate Limiting**: Sliding window rate limits (max 5 guesses/5s) with consecutive duplicate text suppression.
- **Authoritative AFK Detection**: Live canvas stroke tracking warns inactive drawers with a 10s countdown before automatically skipping turns.
- **Host Moderation**: Real-time room configuration, player kick capabilities with rejoin blacklists, and automatic host handover.

### 🌐 Social Gaming Hub
- **Player Profiles & Deep Analytics**: Real-time tracking of win rate, match history, high scores, accuracy, and win streaks.
- **Social Friends Squad**: Player discovery, real-time presence indicators, friend requests, and direct lobby invitations.
- **Global Competitive Leaderboards**: Real-time rankings for Highest Score, Total Wins, and Best Win Rate.
- **Progression & Achievements**: Automated milestone evaluations awarding unlockable profile badges upon match completion.
- **Live Notifications**: Persistent WebSocket alerts with instant in-app badge updates and email dispatch integration.

---

## 🕹️ Game Modes

| Mode | Description | Key Mechanics |
| :--- | :--- | :--- |
| **Classic Mode** | Traditional rotating drawer turns with live guessing | 3-word selection choices, progressive hint unlocks, speed-based bonus scoring, spectator support. |
| **Imposter Mode** | Multiplayer social deduction game | 1 secret imposter, masked category clues, sequential private drawing turns, and post-round voting phase. |
| **AI Practice Studio** | Solo canvas practice with instant neural feedback | Canvas drawing categorized live by custom Quick, Draw! CNN model with top-5 confidence outputs. |
| **Custom Word Packs** | User-created and GenAI-generated word decks | Community decks, multilingual banks (EN, HI, ES), and Google Gemini / OpenAI prompt-based generation with offline heuristic fallback. |

---

## 🏗️ System Architecture

DrawMate enforces a **server-authoritative** architecture where client interactions (drawing, guessing, lobby readiness) are validated by the centralized game engine before state mutation.

```
                              ┌─────────────────────────────────────────┐
                              │            Client Browser               │
                              │   React 18 • TypeScript • Tailwind CSS  │
                              └────────────────────┬────────────────────┘
                                                   │ HTTPS / WSS
                                                   ▼
                              ┌─────────────────────────────────────────┐
                              │          DrawMate Game Server           │
                              │    Node.js • Express • Socket.IO        │
                              ├────────────────────┬────────────────────┤
                              │ Authoritative Room │ Authoritative Game │
                              │      Manager       │       Engine       │
                              └─────────┬──────────────────┬────────────┘
                MongoDB Wire Protocol   │                  │ HTTP Internal (Port 8000)
                                        ▼                  ▼
                         ┌────────────────────┐   ┌─────────────────────┐
                         │   MongoDB Atlas    │   │  Sketch Recognizer  │
                         │    (v6.0+ Wire)    │   │  FastAPI + PyTorch  │
                         └────────────────────┘   └─────────────────────┘
```

### In-Memory State Isolation
- **`RoomManager`**: Authoritative lobby discovery, generation token disconnect grace periods, and host delegation.
- **`GameManager` & `Game`**: Isolated round timers, turn rotations, hint dispatchers, scoring matrices, and state sync.
- **`DrawingSessionManager`**: Vector stroke ledgers, undo/redo stacks, and active drawer permission validation.

---

## ⚡ Tech Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | React | `^18.3.1` | Declarative, component-driven UI architecture |
| **Language** | TypeScript | `^5.6.3` | End-to-end type safety across client and server |
| **Styling** | Tailwind CSS | `^3.4.14` | Modern responsive styling with custom glassmorphism design system |
| **Bundler** | Vite | `^6.4.4` | Ultra-fast HMR and optimized production asset chunking |
| **Backend** | Node.js / Express | `^20.x` / `^4.21.1` | REST API routes, validation, and middleware |
| **Real-Time** | Socket.IO | `^4.8.1` | Bidirectional low-latency WebSocket communication |
| **Database** | MongoDB / Mongoose | `^6.0+` / `^8.7.1` | Document persistence, atomic updates, and compound/TTL indexes |
| **Machine Learning** | PyTorch / FastAPI | `^2.0` / `^0.110` | Real-time convolutional sketch recognition inference |
| **Validation** | Zod | `^3.23.8` | Runtime schema validation for requests and socket payloads |
| **Testing** | Vitest / Pytest | `^2.1.3` / `^9.0.3` | Unit, integration, concurrency, and fault-injection testing |

---

## 🔒 Security & Data Integrity

- **Crash-Proof Match Idempotency**: Match statistics employ single-document atomic operations (`{ _id: userId, processedMatchIds: { $ne: gameId } }`), guaranteeing that process crashes, network timeouts, or out-of-order retries never double-count scores or skip player updates.
- **Cryptographic Refresh Token Rotation**: Strict Compare-And-Swap (CAS) token updates with a 10-second concurrency grace window allowing parallel browser tabs to refresh smoothly while instantly revoking compromised session families on replay.
- **Strict Role-Based Access Control (RBAC)**: Server-side route authorization (`user`, `moderator`, `admin`) prevents client tampering.
- **Timing-Safe Authentication**: Constant-time password verification via `bcrypt` to prevent timing attacks.
- **Security Headers & Cookie Policies**: Enforces `Helmet`, strict CORS whitelisting, `httpOnly`, `secure`, and `sameSite: 'lax'` signed cookies.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20.x or v22.x LTS
- **npm**: v10.x+
- **MongoDB**: v6.0+ (Local instance or MongoDB Atlas)
- **Python**: v3.10+ (Optional, for sketch recognition ML service)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Vishaldubey2210/DrawMate.git
cd DrawMate

# Install root, client, and server dependencies
npm install
```

### 3. Environment Setup
Create your local environment file:
```bash
cp .env.example .env
```
Configure your core environment variables in `.env`:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/drawmate

# Cryptographic Keys (minimum 32 characters)
JWT_SECRET=super_secret_jwt_access_token_signing_key_32_chars
JWT_REFRESH_SECRET=super_secret_jwt_refresh_token_signing_key_32_chars
COOKIE_SECRET=super_secret_cookie_signing_key_32_chars

# Outbound Email (for verification & password resets)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=DrawMate <no-reply@drawmate.app>
```

### 4. Run Development Servers
```bash
# Concurrently starts frontend (port 5173) and backend (port 5000)
npm run dev
```
- **Web App**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api`
- **Health Check**: `http://localhost:5000/api/health`

---

## 🧪 Verification & Testing

DrawMate maintains a **100% automated test pass rate** across 30 test suites:

```bash
# Run all automated tests (Server + Client)
npm test

# Run backend integration & concurrency tests (221 tests)
npm run test:server

# Run frontend UI & lifecycle hook tests (69 tests)
npm run test:client

# Run Python ML sketch recognition tests (5 tests)
python3 -m pytest ml/sketch_recognizer/tests

# Static typecheck across all workspaces
npm run lint

# Production build bundle
npm run build
```

---

## 🚢 Deployment & DevOps

### Option A: Docker Compose (All-in-One)
Deploy the full platform (Node.js API, React Client, and Python ML Recognizer) with a single command:
```bash
docker compose up -d --build
```

### Option B: Render.com PaaS Blueprint
DrawMate includes an automated deployment blueprint in [`render.yaml`](render.yaml):
1. Connect your GitHub repository to [Render.com](https://render.com).
2. Choose **New Blueprints Instance**.
3. Supply your `MONGODB_URI` and SMTP secrets. Render will automatically provision the Node.js API and static SPA.

---

## 📡 API & WebSocket Contracts

### Core REST Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate and issue JWT + Refresh cookie | No |
| `POST` | `/api/auth/refresh` | Single-use refresh token rotation | Cookie |
| `POST` | `/api/auth/logout` | Revoke session and clear cookies | Yes |
| `GET` | `/api/rooms/public` | Discover active public game rooms | Yes |
| `GET` | `/api/users/profile/:id` | Fetch public player profile & stats | Yes |
| `GET` | `/api/leaderboard` | Global rankings (wins, scores, streaks) | Yes |
| `POST` | `/api/word-packs/generate` | GenAI / heuristic word deck generator | Yes |

### Core WebSocket Events

| Event Name | Direction | Payload Summary |
| :--- | :---: | :--- |
| `room:create` | C ➔ S | `{ name, settings }` — Creates authoritative lobby |
| `room:join` | C ➔ S | `{ roomCode }` — Joins player or reconnects existing participant |
| `draw:start` | C ➔ S | `{ x, y, color, width }` — Initiates stroke (active drawer only) |
| `draw:points` | C ➔ S | `{ strokeId, points }` — Batched stroke vector coordinates |
| `draw:state` | S ➔ C | Complete canvas snapshot relay for reconnecting observers |
| `game:guess` | C ➔ S | `{ roomCode, text }` — Rate-limited live answer submission |
| `game:over` | S ➔ C | Final match rankings, winner announcement, and scorecards |

Full WebSocket event specifications are documented in [`docs/SOCKET_EVENTS.md`](docs/SOCKET_EVENTS.md).

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).

<div align="center">
  <sub>Built with ❤️ for real-time multiplayer gaming.</sub>
</div>
