# Advanced Gameplay Manual — DrawMate Platform

This document describes the advanced gameplay capabilities introduced in Phase 6: Spectator Mode, Drawing Replay, Custom Word Packs, Multilingual Word Banks, and Word Modes.

---

## 1. Spectator Mode

### 1.1 Overview
Spectator mode allows users to watch active multiplayer matches in real time without competing for points or occupying active player slots.

### 1.2 Configuration & Limits
- **Spectators Allowed**: Configurable per room by host.
- **Max Spectators**: Configurable between 0 and 50 (default: 10).
- **Late Spectators**: Option to allow or disallow joining after a match has started.

### 1.3 Permitted vs. Restricted Actions
| Action | Active Player | Spectator |
|---|---|---|
| View Canvas & Public Hints | Yes | Yes |
| Send Non-Gameplay Chat | Yes | Yes (tagged as Spectator) |
| Choose Words to Draw | Yes (when drawer) | No |
| Draw on Canvas | Yes (when drawer) | No (Read-only surface) |
| Submit Scored Guesses | Yes | No |
| Earn Match Points | Yes | No |

---

## 2. Drawing Replay System

### 2.1 Chronological Replay
Every completed round records all accepted server drawing operations (`start`, `points`, `end`, `undo`, `clear`) with millisecond timestamps.

### 2.2 Playback Controls
- **Play / Pause / Resume**: Control live stroke animation.
- **Scrubber / Seek**: Scrub to any timestamp in the round; canvas state is deterministically reconstructed.
- **Playback Speed**: `0.5x`, `1.0x`, `2.0x`, `4.0x`.
- **Security**: Replay data for an ongoing round cannot be retrieved until the round concludes.

---

## 3. Custom Word Packs

### 3.1 Managing Word Packs
Users can create personal or public word packs:
- **Pack Name & Description**: 2–50 characters.
- **Supported Languages**: English (`en`), Hindi (`hi`), Spanish (`es`).
- **Word Limits**: 5–500 words per pack, 2–60 characters per word.

### 3.2 In-Game Usage
Room hosts can set:
- **Built-in Words**: Standard curated word bank.
- **Custom Word Pack**: User's chosen custom pack.
- **Combined**: Blends built-in and custom words.

---

## 4. Multilingual Word Banks

### 4.1 Supported Languages
1. **English (`en`)**: General vocabulary, animals, foods, objects, phrases.
2. **Hindi (`hi`)**: Devanagari vocabulary with Unicode NFC normalization and transliteration aliases.
3. **Spanish (`es`)**: Latin American and Iberian vocabulary with accent tolerance.

---

## 5. Game Modes

### 5.1 Normal Mode
Standard guessing gameplay. Progressive character reveals reveal letters at configured intervals.

### 5.2 Hidden Mode
Word length is masked with `* * *` or `???`. No progressive hints are given. Guessers must deduce the word solely from the drawing.

### 5.3 Combination Mode
Two distinct concepts are paired into a compound phrase (e.g., "Fire Truck", "Ice Cream", "Tea Cup"). Drawer receives the complete phrase; guessers must provide the full compound answer to score.
