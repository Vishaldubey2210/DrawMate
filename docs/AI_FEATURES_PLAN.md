# AI Features Implementation Plan
**GenAI Word Generator + Deep Learning Sketch Recognizer + AI Moderation + Imposter Mode**

---

## 1. Executive Summary & Existing Foundation Audit
The DrawMate codebase currently contains:
- Complete SaaS foundation: auth, profiles, settings, MongoDB models (`User`, `Room`, `MatchResult`, `CustomWordPack`, `RoundTelemetry`, `AuditLog`).
- Real-time room and lobby management with Socket.IO.
- HTML5 canvas engine with normalized $[0, 1]$ coordinates, high-DPI scaling, and authoritative undo/redo.
- Server-authoritative multiplayer game engine with timers, scoring, and role-specific masked snapshots.
- GenAI word-pack generator backend service (`GenAIProviderService`) with Gemini, OpenAI, and heuristic mock fallbacks.
- Comprehensive test suites passing (125 server tests + 44 client tests = 169 tests total).

---

## 2. Feature Workstreams

### Workstream 1: Quick, Draw! Dataset Discovery & Automated Downloader
- **Source**: Official Google Quick, Draw! Dataset (`https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap/{category}.npy`).
- **20 Candidate Classes**:
  1. `airplane`
  2. `apple`
  3. `banana`
  4. `bicycle`
  5. `bird`
  6. `car`
  7. `cat`
  8. `chair`
  9. `clock`
  10. `cloud`
  11. `dog`
  12. `fish`
  13. `flower`
  14. `house`
  15. `key`
  16. `moon`
  17. `mountain`
  18. `pizza`
  19. `tree`
  20. `umbrella`
- **Storage Budget**: Hard maximum 10 GB decimal. Download only needed .npy files sequentially with streaming and SHA-256 verification. Target footprint $\approx 1.5 - 2.5$ GB.
- **Location**: `scripts/download_quickdraw_subset.py` saving to `data/quickdraw/numpy_bitmap/` with manifest and license attribution.

### Workstream 2: Deep Learning Sketch Recognizer (Jupyter Notebook)
- **Executed Notebook**: `ml/sketch_recognizer/notebooks/01_quickdraw_cnn_experiments.ipynb`.
- **Workflow**: Iterative Markdown $\rightarrow$ code $\rightarrow$ real execution $\rightarrow$ output analysis $\rightarrow$ next experiment.
- **Hardware Profile**: PyTorch 2.14.1 CPU on Linux.
- **Experiments**:
  - Baseline CNN vs. Improved CNN with Batch Normalization & Dropout.
  - Evaluation: Top-1, Top-3, per-class precision/recall, confusion matrix, uncertainty thresholding for out-of-scope / blank sketches.
- **Artifacts Saved**: `ml/sketch_recognizer/artifacts/` (`sketch_recognizer.pt`, `class_names.json`, `preprocessing.json`, `evaluation_metrics.json`, `training_config.json`, `training_history.json`, `confusion_matrix.png`).

### Workstream 3: Prediction Service & Practice Mode UI
- **Inference Service**: Python FastAPI service (`ml/sketch_recognizer/service/app.py`) on port 8000 with `GET /health` and `POST /predict`.
- **Client Practice Canvas**: Dedicated AI Practice Studio route `/practice` allowing players to sketch freely and test model predictions without affecting competitive multiplayer games.
- **Competitive Isolation**: Model predictions are strictly isolated to practice mode; never leaked or used to auto-score competitive games.

### Workstream 4: AI-Assisted Moderation
- **Chat Moderation**: Real-time filtering against toxicity, hate speech, and harassment via `ModerationService`.
- **Drawing Moderation**: User-initiated report endpoint (`POST /api/moderation/report-drawing`) storing flagged snapshots in `Report` / `AuditLog`.
- **Abuse Protection**: Preserves deterministic rate limits (max 6 guesses / 5s, chat rate limits) even if moderation APIs are unreachable.

### Workstream 5: Complete Imposter Mode
- **Mode Setting**: Host can select `gameMode: 'imposter'` in room settings.
- **Roster Condition**: Requires $\ge 4$ players.
- **Roles**: Exactly 1 secret Imposter, remaining Non-Imposters.
  - Non-imposters receive target word (e.g., *"Elephant"*).
  - Imposter receives category clue only (e.g., *"Category: Animals"*).
- **Sequential Private Turns**: Players take turns drawing on isolated canvases. Drawings remain hidden from opponents until the reveal phase.
- **Reveal Phase**: Drawings displayed in turn order with creator attribution.
- **Voting Phase**: 25-second timed voting phase where players vote for the suspected imposter.
- **Scoring**: Points awarded to voters who correctly identify the imposter; bonus awarded to imposter if they evade detection.
- **Role Privacy**: Imposter identity strictly masked in all client snapshots until voting concludes.

---

## 3. Actual Implementation & Verification Results

### Dataset Status
- **Official Source**: Google Quick, Draw! (`https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap/`)
- **Classes**: 20 verified classes downloaded to `data/quickdraw/numpy_bitmap/`
- **Total Storage**: **2.36 GB** (3,010,742 total drawing samples), strictly below 10 GB limit.

### Model Metrics (Held-Out Test Set: 4,500 Unseen Sketches)
- **Top-1 Accuracy**: **88.38%**
- **Top-3 Accuracy**: **95.84%**
- **Macro-F1 Score**: **88.30%**
- **Executed Notebook**: `ml/sketch_recognizer/notebooks/01_quickdraw_cnn_experiments.ipynb` (12 stages executed end-to-end)
- **Artifacts Generated**: `sketch_recognizer.pt`, `best_model.pt`, `class_names.json`, `preprocessing.json`, `evaluation_metrics.json`, `training_config.json`, `training_history.json`, `experiment_results.json`, `confusion_matrix.png`, `sample_classes.png`.

### Test Suites
- **Server Vitest Tests**: **133 / 133 tests passing** (8 test suites, 0 failures).
- **ML Pytest Tests**: **5 / 5 tests passing** (health check, edge-case rejection, top-3 format).
- **TypeScript & Build**: Both server (`tsc`) and client (`tsc && vite build`) compile with 0 errors.
