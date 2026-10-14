# DrawMate — Real-Time Multiplayer Drawing & Guessing Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8+-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)

**DrawMate** is a modern, production-grade social gaming SaaS platform inspired by classic multiplayer drawing and guessing games. It features server-authoritative game loops, vector drawing synchronization, social deduction modes (Imposter Mode), deep learning sketch recognition, and social hub features.

---

## Key Features

### 🎨 Real-Time Collaborative Canvas
- **Sub-15ms Vector Synchronization**: Point batching and normalized coordinate mapping $[0, 1]$ across varying device aspect ratios.
- **Mobile-First Touch Engine**: Native Pointer Events with pointer capture, cancellation, and `touch-action: none` gesture isolation.
- **Server-Authoritative Undo & Redo**: Stack-based history tracking with automatic branch invalidation on new brushstrokes.
- **Lossless Canvas Resize**: High-DPI buffer preservation using offscreen canvas caching.

### 🕹️ Diverse Game Modes
- **Classic Mode**: Rotating drawer turns, secret word selection from dynamic 3-word offers, timed guessing, progressive hints, and bonus scoring.
- **Imposter Mode**: Social deduction with secret imposter assignment, masked clues, individual turn-based canvas contributions, and post-round voting.
- **AI Practice Studio**: Solo practice canvas integrated with a custom-trained Quick, Draw! convolutional neural network providing real-time top-5 predictions.

### 🛡️ Smart Resilience & Fair Play
- **30-Second Reconnection Grace Period**: Generation token protection prevents transient connection drops from kicking active players.
- **Anti-Spam & AFK Protection**: Server-enforced guess rate limits (5 guesses/5s), duplicate guess suppression, and inactivity drawer warning/skips.
- **Host Moderation**: Host privileges for updating game settings, kicking disruptive players, and transfer of host controls upon departure.

### 🌐 Social Gaming Ecosystem
- **Player Profiles & Stats**: Win rates, game history, high scores, streaks, and custom avatar customization.
- **Friends Hub**: User search, friend requests, real-time online presence, and direct room invitations.
- **Achievements & Leaderboards**: Global leaderboards for highest score, win rate, and total wins with progression badges.
- **Persistent Notifications**: WebSocket-delivered alerts for invites, match completions, and achievements with unread counts.

---

## 🏗️ Architecture

```
                      ┌──────────────────────┐
                      │   Client Browser     │
                      │  (React 18 + Vite)   │
                      └──────────┬───────────┘
                                 │ HTTPS / WSS
                                 ▼
                      ┌──────────────────────┐
                      │   DrawMate Server    │
                      │ (Node.js/Express/IO) │
                      └────┬────────────┬────┘
           MongoDB Wire    │            │ HTTP (Port 8000)
                           ▼            ▼
             ┌───────────────┐        ┌───────────────────────┐
             │ MongoDB Atlas │        │  Sketch Recognizer    │
             │   (v6.0+)     │        │  (FastAPI + PyTorch)  │
             └───────────────┘        └───────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v20.x or v22.x LTS
- **npm**: v10.x+
- **MongoDB**: v6.0+ (Local instance or MongoDB Atlas)
- **Python**: v3.10+ (Optional, for sketch recognizer ML service)

### 1. Clone the Repository
```bash
git clone https://github.com/Vishaldubey2210/DrawMate.git
cd DrawMate
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env
```
Update `.env` with your MongoDB connection string and secret keys:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/drawmate
JWT_SECRET=your_jwt_access_secret_key_minimum_32_characters
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_minimum_32_characters
COOKIE_SECRET=your_secure_cookie_signing_secret_key
```

### 4. Run Development Servers
```bash
# Starts both frontend (port 5173) and backend (port 5000) concurrently
npm run dev
```
- **Web App**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api`

---

## 🧪 Testing & Verification

The codebase includes comprehensive automated regression suites:

```bash
# Run all tests (Server + Client)
npm test

# Run backend test suites only (221 tests)
npm run test:server

# Run frontend test suites only (69 tests)
npm run test:client

# Typecheck and linting
npm run lint

# Production build bundle
npm run build
```

---

## 🚢 Deployment

### Docker Compose
Run the entire stack (Node.js backend, React frontend, and Python ML service) with one command:
```bash
docker compose up -d --build
```

### Render.com / Cloud PaaS
The repository includes an authoritative [`render.yaml`](render.yaml) blueprint for deploying the API service and frontend static site.

---

## 📚 Technical Documentation

- **System Architecture**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **REST API Reference**: [`docs/API.md`](docs/API.md)
- **WebSocket Event Specifications**: [`docs/SOCKET_EVENTS.md`](docs/SOCKET_EVENTS.md)
- **Security & Authorization Model**: [`docs/SECURITY.md`](docs/SECURITY.md)
- **Game Engine Mechanics**: [`docs/GAME_ENGINE_ARCHITECTURE.md`](docs/GAME_ENGINE_ARCHITECTURE.md)
- **Operations & Runbook**: [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md)
- **Production Deployment Guide**: [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
