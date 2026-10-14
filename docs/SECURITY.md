# DrawMate Security & Privacy Policy

This document defines the security controls, data retention rules, and privacy safeguards implemented across DrawMate.

---

## 1. Authentication & Session Security
- **JWT Tokens**: Signed using `HS256` with strong secrets (`JWT_SECRET`). Expiration enforced.
- **Password Hashing**: Passwords hashed using `bcryptjs` with salt rounds $\ge 10$.
- **Timing-Safe Auth**: Constant-time comparison ensures resistant against timing attacks.

---

## 2. Real-Time Socket.IO Security
- **Connection Handshake Authentication**: Socket connections must supply valid JWT credentials in `auth.token`.
- **Room Authorization**: Every incoming socket event (`game:start`, `game:guess`, `drawing:stroke`, `imposter:vote`) verifies room membership and user identity server-side.
- **Client Sanitization**: All outbound state snapshots pass through role-specific filters (`getViewerSnapshot`). Secret words, answers, and hidden roles are never broadcast blindly.

---

## 3. AI & ML Security Guardrails
- **Server-Side API Key Storage**: Provider keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`) reside exclusively in server environment variables.
- **Rate Limiting**:
  - Chat/Guesses: Max 5-6 messages per 4-5 seconds.
  - Practice Predictions: 1 request per 1.2 seconds per user.
- **Strict Payload Bounds**: Base64 drawing payloads are limited to 5 MB. Payloads exceeding bounds are rejected before image decoding.
- **No Training On User Data**: User practice sketches are processed in volatile memory and not saved to disk or persistent external storage without explicit consent.

---

## 4. Fair Play & Anti-Abuse
- **Authoritative Game State**: Game phase, timers, turn advancement, and scores are managed strictly by the server.
- **Duplicate & Flood Suppression**: Identical guesses in rapid succession are ignored.
- **Audit Logging**: Flagged chat messages, abuse violations, and administrative actions are logged to the MongoDB `AuditLog` collection for moderation review.
