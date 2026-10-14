# DrawMate Real-Time Game Event Contracts (Phase 4)

This document specifies the authoritative Socket.IO real-time event contracts for Phase 4 multiplayer gameplay.

---

## 1. Client-to-Server Events

### 1.1 `game:start`
- **Description:** Requests initiation of the multiplayer match from the room lobby.
- **Direction:** Client $\rightarrow$ Server
- **Auth:** Required (JWT Handshake).
- **Permissions:** Room Host only.
- **Payload Schema:**
  ```typescript
  {
    roomCode: string; // Length 4–10 alphanumeric
  }
  ```
- **Acknowledgment / Response:**
  ```typescript
  { success: true } | { success: false, error: string }
  ```
- **Preconditions:**
  - Room status must be `waiting`.
  - At least 2 players connected and not disconnected.
  - All connected players must be marked `isReady: true`.

---

### 1.2 `game:word_select`
- **Description:** Active drawer submits their chosen secret word from the offered options.
- **Direction:** Client $\rightarrow$ Server
- **Auth:** Required.
- **Permissions:** Designated drawer of the current turn only.
- **Payload Schema:**
  ```typescript
  {
    roomCode: string;
    word: string; // 1–50 characters
  }
  ```
- **Acknowledgment / Response:**
  ```typescript
  { success: true } | { success: false, error: string }
  ```
- **Preconditions:**
  - Game phase must be `word_selection`.
  - Sender must match `game.drawerId`.
  - Word must match one of the offered `word.choices`.

---

### 1.3 `game:guess`
- **Description:** Player submits a guess text during active drawing.
- **Direction:** Client $\rightarrow$ Server
- **Auth:** Required.
- **Permissions:** Guessing players only (Drawer cannot guess).
- **Payload Schema:**
  ```typescript
  {
    roomCode: string;
    text: string; // 1–100 characters
  }
  ```
- **Acknowledgment / Response:**
  ```typescript
  {
    success: boolean;
    isCorrect?: boolean;
    error?: string;
  }
  ```
- **Preconditions:**
  - Game phase must be `drawing`.
  - Sender must NOT be the active drawer.
  - Sender has not already guessed correctly in the current round.

---

### 1.4 `game:get_state`
- **Description:** Requests a sanitized, role-specific snapshot of the active game session (used on load or reconnect).
- **Direction:** Client $\rightarrow$ Server
- **Auth:** Required.
- **Permissions:** Any verified room participant.
- **Payload Schema:**
  ```typescript
  {
    roomCode: string;
  }
  ```
- **Acknowledgment / Response:**
  ```typescript
  {
    success: true;
    game: SanitizedGameSnapshot;
  }
  ```

---

## 2. Server-to-Client Events

### 2.1 `game:state`
- **Description:** Delivers viewer-specific sanitized game state snapshot.
- **Direction:** Server $\rightarrow$ Client (Individual Socket / User Room)
- **Privacy Classification:** Role-specific.
- **Payload Shape:**
  ```typescript
  {
    gameId: string;
    roomCode: string;
    phase: 'waiting' | 'word_selection' | 'drawing' | 'round_ending' | 'game_over' | 'cancelled';
    currentRound: number;
    totalRounds: number;
    drawerId: string;
    drawerName: string;
    turnIndex: number;
    totalTurnsInRound: number;
    timer: {
      durationSeconds: number;
      startedAt: number;
      deadline: number;
    };
    word: {
      secret?: string;           // Provided ONLY to drawer during selection/drawing, or all during round_ending/game_over
      choices?: string[];        // Provided ONLY to drawer during word_selection
      masked: string;            // e.g. "_ _ _ _ _"
      revealedIndices: number[]; // Indices of letters exposed via hints
      length: number;
    };
    scores: Array<{
      userId: string;
      username: string;
      displayName: string;
      avatar: string;
      score: number;
      roundScore: number;
      correctGuesses: number;
      drawingTurns: number;
    }>;
    recentGuesses: Array<{
      id: string;
      userId: string;
      displayName: string;
      text: string;
      isCorrect: boolean;
      timestamp: number;
    }>;
    lastRoundSummary?: RoundSummary;
    winner?: {
      userId: string;
      displayName: string;
      score: number;
      isTie?: boolean;
    };
    revision: number;
  }
  ```

---

### 2.2 `game:started`
- **Description:** Broadcast to room notifying that the match has commenced.
- **Direction:** Server $\rightarrow$ Room Broadcast
- **Payload:**
  ```typescript
  {
    gameId: string;
    roomCode: string;
  }
  ```

---

### 2.3 `game:guess_result`
- **Description:** Broadcast to room when an incorrect guess is submitted to display in chat.
- **Direction:** Server $\rightarrow$ Room Broadcast
- **Payload:**
  ```typescript
  {
    id: string;
    userId: string;
    displayName: string;
    text: string;
    isCorrect: false;
    timestamp: number;
  }
  ```

---

### 2.4 `game:player_guessed`
- **Description:** Broadcast to room when a player correctly identifies the secret word.
- **Direction:** Server $\rightarrow$ Room Broadcast
- **Payload:**
  ```typescript
  {
    userId: string;
    displayName: string;
    points: number;
    drawerBonus: number;
  }
  ```

---

### 2.5 `game:round_ended`
- **Description:** Broadcast when turn completes (via correct guess or timeout) revealing secret word and round points.
- **Direction:** Server $\rightarrow$ Room Broadcast
- **Payload:**
  ```typescript
  {
    roundNumber: number;
    drawerId: string;
    drawerName: string;
    secretWord: string;
    winnerId?: string;
    winnerName?: string;
    reason: 'guessed' | 'timeout' | 'cancelled';
    pointsAwarded: Record<string, number>;
  }
  ```

---

### 2.6 `game:over`
- **Description:** Broadcast when all rounds have completed with final standings and persisted winner.
- **Direction:** Server $\rightarrow$ Room Broadcast
- **Payload:**
  ```typescript
  {
    gameId: string;
    winner: {
      userId: string;
      displayName: string;
      score: number;
      isTie?: boolean;
    };
    finalLeaderboard: Array<{
      userId: string;
      displayName: string;
      score: number;
      rank: number;
    }>;
  }
  ```

---

### 2.7 `game:cancelled`
- **Description:** Broadcast if game is cancelled due to room closure or insufficient active players.
- **Direction:** Server $\rightarrow$ Room Broadcast
- **Payload:**
  ```typescript
  {
    reason: string;
  }
  ```

---

### 2.8 `game:error`
- **Description:** Emitted to specific socket on validation or permission failures.
- **Direction:** Server $\rightarrow$ Socket Emit
- **Payload:**
  ```typescript
  {
    success: false;
    error: string;
  }
  ```
