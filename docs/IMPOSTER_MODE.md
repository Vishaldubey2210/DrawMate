# Imposter Game Mode Specification

DrawMate Imposter Mode is an alternate social deduction multiplayer mode built directly onto the authoritative DrawMate game engine.

---

## 1. Rules & Lifecycle

### Player Requirement
- Requires **at least 4 active connected players**.
- The server rejects starting an imposter lobby with $<4$ players with an explicit error.

### Roles & Information Distribution
- The server randomly selects **exactly 1 Imposter**. All remaining participants are **Innocents**.
- **Innocent Players**: Receive the secret target word (e.g., *"Airplane"*).
- **The Imposter**: Receives only the high-level category clue (e.g., *"VEHICLES"*), but **does not know the secret word**.
- **Spectators**: Receive sanitized public state with the target word masked.

---

## 2. Round Phases

```
[Start Round]
     |
     v
[Phase 1: Sequential Isolated Drawing Turns]
  - Player 1 draws privately (20-30s) -> Canvas cleared
  - Player 2 draws privately (20-30s) -> Canvas cleared
  - Player 3 draws privately (20-30s) -> Canvas cleared
  - Player 4 draws privately (20-30s) -> Canvas cleared
     |
     v
[Phase 2: Reveal & Voting Phase (25s)]
  - All 4 completed drawings revealed simultaneously in turn order
  - Each drawing displayed alongside creator attribution
  - Secret word and Imposter identity remain hidden
  - Timed voting: Each player casts 1 vote for the suspected Imposter
     |
     v
[Phase 3: Results & Scoring Phase (10s)]
  - Imposter identity revealed to all participants
  - Secret target word revealed
  - Vote tallies and caught status published
  - Server awards points
     |
     v
[Next Round or Game Over]
```

---

## 3. Scoring System

- **Correct Vote Bonus**: Any innocent player who correctly votes for the Imposter receives **+150 points**.
- **Imposter Evasion Bonus**: If the Imposter is **not identified** by majority vote (or in the event of a tie), the Imposter earns **+300 evasion points**.
- **Imposter Caught**: If the Imposter is successfully identified by the majority, the Imposter earns **0 points** for the round.
- **Tie Handling**: If the top vote count is tied between two or more players, or if no votes are cast, the vote is deemed inconclusive, and the Imposter receives the evasion bonus.

---

## 4. Role Privacy & Security Guarantees

1. **Viewer-Specific Snapshot Filtering**:
   - `SanitizedGameSnapshot` dynamically masks `word.secret` and `imposterState.revealedImposterUserId`.
   - The Imposter's identity is **never** transmitted in Socket.IO payloads or stored in client DOM elements prior to the results phase.
2. **Drawing Canvas Isolation**:
   - Real-time drawing strokes emitted by the current drawer during `imposter_drawing` phase are restricted from opponents' canvas views.
   - Opponents receive empty canvas updates until the reveal phase.
3. **Reconnection Safety**:
   - A player who disconnects and reconnects mid-round receives only their own authenticated view based on their JWT session.
