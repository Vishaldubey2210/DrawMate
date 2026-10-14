# Phase 6 System Architecture — Advanced Gameplay, Customization & Spectator Systems

## 1. Architectural Overview & Design Principles

Phase 6 introduces advanced gameplay systems on top of the established multiplayer engine:
1. **Server-Enforced Role Separation**: Spectators receive strictly sanitized observer snapshots. The server strictly forbids spectators from emitting drawing operations, submitting scored guesses, or modifying match settings.
2. **Canonical Drawing Event Log**: Replays are stored as sequential delta operations (`stroke_start`, `stroke_points`, `stroke_end`, `stroke_undo`, `stroke_clear`) tied to relative offsets in milliseconds from turn launch.
3. **Word Bank Snapshotting**: When a game commences, eligible words (built-in, custom packs, or combined) are frozen in an immutable game snapshot, decoupling active gameplay from subsequent user edits.
4. **Multilingual Unicode Normalization**: Language-aware normalization handles Devanagari (Hindi), accented characters (Spanish), and multi-word phrases (English, Hindi, Spanish) accurately.

---

## 2. Component Architecture & Data Flow

```
                      +-----------------------------+
                      |       Room Settings         |
                      |-----------------------------|
                      | spectatorsAllowed, maxSpec  |
                      | wordLanguage: en | hi | es  |
                      | wordSource: builtin|custom  |
                      | wordMode: normal|hidden|comb|
                      +--------------+--------------+
                                     |
                +--------------------+--------------------+
                |                                         |
                v                                         v
   +-------------------------+               +-------------------------+
   |   Spectator Sessions    |               |  Immutable Word Engine  |
   |-------------------------|               |-------------------------|
   | Read-only snapshot feed |               | Word choices -> Drawer  |
   | Observer socket channel |               | Masked hints -> Guesser |
   | Disallowed guessing     |               | Language matching rules |
   +-------------------------+               +-------------------------+
                |                                         |
                +--------------------+--------------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Drawing Replay Engine     |
                      |-----------------------------|
                      | Recorded during round       |
                      | Persisted upon round end    |
                      | Timeline scrubbing & speeds |
                      +-----------------------------+
```

---

## 3. Subsystem Specifications

### 3.1 Spectator Mode
- **Membership**: Tracked in `RoomSession.spectators` Map.
- **Capacity**: Enforced separately from active players (`maxSpectators`, default 10).
- **Socket Channels**: Spectators join `roomCode` and receive `game:state` snapshots where `isDrawer: false`, `isSpectator: true`, `secretWord: undefined`, `choices: undefined`.
- **Chat**: Emitted as `chat:spectator_message` with non-gameplay styling, completely bypassing scoring logic.

### 3.2 Chronological Drawing Replay
- **Data Model**: `DrawingReplay`
  - `gameId`, `roomCode`, `roundNumber`, `drawerId`, `drawerDisplayName`, `secretWord`, `category`, `language`, `durationMs`
  - `events`: Array of `{ type: 'start' | 'points' | 'end' | 'undo' | 'clear', offsetMs: number, data: any }`
- **Playback**: Deterministic canvas reconstruction via `redrawAllStrokes` with animated interpolation, pause, resume, and variable playback rates (`0.5x`, `1x`, `2x`, `4x`).
- **Access Control**: Active round replays return 403 Forbidden to prevent secret-word or stroke cheating.

### 3.3 Custom Word Packs
- **Model**: `CustomWordPack`
  - `ownerId`, `name`, `description`, `language`, `category`, `words: string[]`, `isPublic: boolean`
- **Validation**: 2–60 characters per word, 5–500 words per pack, max 20 packs per user, duplicate rejection.
- **Game Engine Integration**: When `wordSource` includes `custom`, words from `customWordPackId` are merged into the session pool. Full pack is never sent to clients.

### 3.4 Multilingual Word Banks & Normalization
- **Languages**:
  - `en`: English word bank (Animals, Food, Objects, Verbs, Phrases)
  - `hi`: Hindi Devanagari word bank (जानवर, खाना, वस्तुएं, मुहावरे)
  - `es`: Spanish word bank (Animales, Comida, Objetos, Naturaleza)
- **Matching**: Language-aware `WordService.isMatch(guess, secretWord, language)`.

### 3.5 Game Modes
- **Normal**: Standard letter hints and masked character length.
- **Hidden**: Secret word length is masked with `* * *`, no hints revealed, guessing allowed.
- **Combination**: Two words combined into a single phrase (e.g. "ice cream", "fire truck"); hints reveal characters across the phrase; both words must be guessed together.
