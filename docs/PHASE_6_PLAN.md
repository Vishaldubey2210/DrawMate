# Phase 6 Implementation Plan — Advanced Gameplay, Spectators, Drawing Replay, Custom Word Packs & Multilingual Support

## 1. Objectives & Executive Summary

Phase 6 extends the DrawMate multiplayer gaming platform with advanced gameplay capabilities, customization, and spectator support:
1. **Authoritative Spectator Mode**:
   - Independent spectator capacity limits on rooms.
   - Separation of active players vs. spectators.
   - Spectator permissions: cannot draw, cannot select words, cannot guess for points, cannot modify room/game timers or settings.
   - Live observation of drawing strokes, public hints, scores, and round results.
   - Sanitized spectator game snapshots that never leak secret words or drawer choices.
   - Non-gameplay spectator chat.
2. **Chronological Drawing Replay Engine**:
   - Server recording of canonical drawing events (`stroke_start`, `stroke_points`, `stroke_end`, `stroke_undo`, `stroke_clear`) per round.
   - Bounded persistence model in MongoDB (`DrawingReplay`).
   - Interactive replay player: Play, Pause, Resume, Restart, Seek/Scrub, Playback speed (0.5x, 1x, 2x, 4x), duration display.
   - Strict privacy: replays inaccessible while a round is active; no secret words leaked during active play.
3. **Custom Word Packs**:
   - User-managed word packs (`CustomWordPack` model): Create, Edit, Delete, Add/Remove words.
   - Validation: 2–60 characters per word, 5–500 words per pack, max 20 packs per user, duplicate rejection, safe normalization.
   - Room setting integration: Built-in, Custom pack, or Both.
   - Game-start snapshotting: Word list frozen at game launch so later edits do not disrupt ongoing matches.
   - Confidentiality: Full word list is never broadcast to guessers or spectators.
4. **Multilingual Word Banks**:
   - Language-specific word banks: English (`en`), Hindi (`hi`), Spanish (`es`).
   - Separation of UI interface language from gameplay word language.
   - Language-aware normalization: Devanagari Unicode preservation, Spanish diacritics/accents, multi-word spacing, case handling.
   - Unicode-safe masking and hint reveals.
5. **Clearly Defined Game Modes**:
   - `normal`: Standard skribbl.io mode with progressive letter hints and masked character counts.
   - `hidden`: Word is completely hidden from guessers (masked as `???` or `* * *`), no letter hints, character length pattern obscured.
   - `combination`: Multi-word challenge (e.g. 2 words combined into a phrase); guessers must guess the combined phrase; hints respect phrase structure.
6. **Advanced Room Configuration**:
   - Settings for spectator permissions, capacity, late-joining, word language, word source, custom pack selection, word mode.
   - Server-authoritative validation for all settings.
7. **Comprehensive Testing, Accessibility & Deployment**:
   - Automated unit and integration tests covering spectator mode, replay engine, custom word packs, multilingual word banks, and game modes.
   - Multi-client verification with separate sessions.
   - Updated documentation and production builds.

---

## 2. Architecture & Data Model Enhancements

### 2.1 Database Models
- **`Room` (Enhanced)**:
  - Add settings: `spectatorsAllowed: boolean`, `maxSpectators: number`, `allowLateSpectators: boolean`, `wordLanguage: string`, `wordSource: 'builtin' | 'custom' | 'both'`, `customWordPackId: string | null`.
  - Add `currentSpectatorsCount: number`.
- **`CustomWordPack` (New)**:
  - `ownerId: ObjectId`, `name: string`, `description: string`, `language: string`, `category: string`, `words: string[]`, `isPublic: boolean`, timestamps.
- **`DrawingReplay` (New)**:
  - `gameId: string`, `roomCode: string`, `roundNumber: number`, `drawerId: string`, `drawerDisplayName: string`, `secretWord: string`, `category: string`, `language: string`, `durationMs: number`, `events: ReplayEvent[]`, `createdAt: Date`.

---

## 3. Implementation Steps & Acceptance Criteria

### Step 1: Audit & Preservation
- Audit existing codebase, verify that all Phase 1–5 features remain intact.
- Document baseline test results.

### Step 2: Multilingual Word Banks & Language-Aware Normalization
- Expand `words.data.ts` to include curated word banks for English (`en`), Hindi (`hi`), and Spanish (`es`).
- Update `WordService.ts` for language-aware guess matching, Unicode NFC normalization, alias matching, and Unicode-safe masking.

### Step 3: Game Modes Implementation (Normal, Hidden, Combination)
- Implement `hidden` mode masking and hint suppression.
- Implement `combination` mode multi-word phrase selection, hints, and guess matching.
- Verify secret-word confidentiality across all modes.

### Step 4: Custom Word Packs Subsystem
- Create `CustomWordPack` model, `WordPackService`, and REST endpoints (`/api/word-packs`).
- Implement room snapshotting of custom words at game initialization.

### Step 5: Spectator Mode
- Update `RoomManager` with spectator sessions, capacity checks, and late-joining logic.
- Update `Game.ts` to broadcast sanitized observer snapshots to spectators without secret words.
- Enforce spectator restrictions on server: reject drawing, word selection, and guess attempts from spectators.
- Update client `RoomLobbyPage` and `GameArena` to support Spectator role.

### Step 6: Drawing Replay Engine
- Create `ReplayRecorderService` to log canonical drawing events from `DrawingSessionManager`.
- Persist `DrawingReplay` records upon round conclusion.
- Build REST endpoint `GET /api/replays/:gameId/:roundNumber` with authorization and active-round confidentiality.
- Build interactive `ReplayViewer` on client with Play/Pause, Seek, Speed selector (0.5x, 1x, 2x, 4x), and Timeline scrubber.

### Step 7: Advanced Room Configuration & UI
- Update `RoomSettingsCard` and `CreateRoomModal` with spectator toggles, word language, word source, and game mode.
- Add Word Pack Manager page (`/word-packs`) and Replay viewer page/modal.

### Step 8: Automated Testing & Verification
- Unit & integration tests for Spectators, Replays, Custom Word Packs, Multilingual Matching, and Game Modes.
- Regression tests for Phases 1–5.
- Multi-client verification and production build verification.
