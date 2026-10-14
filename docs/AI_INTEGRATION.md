# DrawMate AI Integration Architecture

This document details the configuration, network contracts, and security boundaries for the four AI features integrated into DrawMate:

---

## 1. Architecture Overview

```
                                  +------------------------------------+
                                  |     DrawMate Frontend (React)      |
                                  +-----------------+------------------+
                                                    |
                    REST (/api/practice, /api/wordpacks) | WebSocket (Socket.IO)
                                                    v
                                  +------------------------------------+
                                  |     Express / Socket.IO Server     |
                                  +----+------------+------------+-----+
                                       |            |            |
                +----------------------+            |            +----------------------+
                |                                   |                                   |
                v                                   v                                   v
   +-----------------------+           +-----------------------+           +-----------------------+
   |   FastAPI ML Service  |           |     Google Gemini     |           |   OpenAI Moderation   |
   | (Sketch Recognizer)   |           | (GenAI Word Generator)|           |  (AI Chat Moderation) |
   | Port 8000 (Internal)  |           | Server-to-Cloud REST  |           |  Server-to-Cloud REST |
   +-----------------------+           +-----------------------+           +-----------------------+
```

---

## 2. Environment Variables & Credentials

AI provider credentials are stored strictly in server-side environment variables and are **never transmitted to the client browser**:

| Variable | Description | Default / Fallback |
| :--- | :--- | :--- |
| `SKETCH_RECOGNIZER_URL` | Internal URL for the Python FastAPI inference service | `http://localhost:8000` |
| `GEMINI_API_KEY` | Google Gemini API key for structured word generation | Built-in high-quality word generator fallback |
| `OPENAI_API_KEY` | OpenAI API key for real-time text moderation | Heuristic keyword and regex profanity filter fallback |

---

## 3. Feature Breakdown

### A. Deep Learning Sketch Recognizer
- **Service**: FastAPI running `ml.sketch_recognizer.service.app:app`
- **Internal Endpoints**:
  - `GET /health`: Model status, loaded classes count, device info
  - `POST /predict`: Expects base64 encoded sketch image, returns top 3 predictions with confidences
- **Client Integration**: Mounted at `/api/practice/health` and `/api/practice/predict` via `SketchRecognizerClient.ts`
- **Isolation Guarantee**: Model predictions are available **only in AI Practice Mode**. They are never broadcast over Socket.IO and never grant points in competitive matches.

### B. GenAI Word-Pack Generator
- **Service**: `server/src/services/GenAIProviderService.ts`
- **Endpoint**: `POST /api/wordpacks/generate-ai`
- **Structured Output**: Enforces strict JSON schema validation for word list, categories, difficulties, and hints.
- **Resilience**: If the Gemini API is unreachable, times out, or quota is exceeded, the server falls back to category-tuned thematic pools without dropping the request.

### C. AI-Assisted Moderation
- **Service**: `server/src/services/AIModerationService.ts`
- **Real-Time Guard**: Intercepts chat and guess messages before broadcast.
- **Fail-Safe Offline Mode**: If external AI providers are slow or offline, deterministic heuristics (`FLAGGED_KEYWORDS`) and message rate limiters (max 5 msgs / 4s) protect lobbies continuously.

### D. Imposter Game Mode
- **Engine**: Fully server-authoritative state machine in `server/src/game/Game.ts`.
- **Requires**: $\ge 4$ active players.
- **Role Privacy**:
  - Server randomly selects 1 Imposter.
  - Non-imposters receive the target word; Imposter receives only the category clue.
  - Client state serialization masks the imposter identity until the voting phase concludes.
