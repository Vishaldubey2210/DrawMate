# Smart Word Selection & Adaptive Difficulty Architecture

## 1. Overview
The Word Selection system balances game variety, avoids repetitive prompts, and progressively learns which words are too easy or too frustrating through server-side empirical round telemetry.

---

## 2. Stage 1: Rule-Based & Bayesian Adaptive Selection (Production Active)

### 2.1 Word Pool Categorization & Difficulty
Words in the word bank (`WORD_BANK`) and custom decks have declared difficulties:
- **Easy**: Short, concrete everyday objects (e.g., *cat*, *sun*, *apple*).
- **Medium**: Multi-syllable or moderately abstract words (e.g., *volcano*, *guitar*, *telescope*).
- **Hard**: Complex concepts, idioms, or composite terms (e.g., *constellation*, *labyrinth*, *chameleon*).

When selecting 3 choices for a drawer:
- If host specifies a difficulty (`easy`, `medium`, `hard`), candidate words are filtered by that difficulty.
- If set to `all`, the system balances choices by picking 1 easy, 1 medium, and 1 hard word when available.
- **Recent-Word Avoidance**: Words used in recent rounds within the same match are filtered out to prevent repetition.

### 2.2 Authoritative Round Telemetry
Every completed round records a structured document in `RoundTelemetry`:
- `word`: Normalized lowercase string.
- `category` & `language`: Language context.
- `roundDurationSeconds`: Time elapsed before round completion.
- `timeToFirstCorrectGuessSeconds`: Time to first solve (null if unsolved).
- `totalGuessesCount`, `correctGuessersCount`, `incorrectGuessesCount`.
- `timedOut` & `solved`: Binary round outcomes.
- `isAfkSkip` & `isCancelled`: Quality exclusion flags.

### 2.3 Bayesian Beta-Binomial Smoothing
To avoid extreme volatility with low sample counts (e.g., 1 timeout on 1 round should not permanently label a word as impossible):
$$\text{Smoothed Solve Rate} = \frac{\text{Solves} + 2}{\text{Rounds} + 4}$$
Using a Beta(2, 2) uninformative prior:
- $\ge 0.70$: Empirical **Easy**
- $\ge 0.40$: Empirical **Medium**
- $< 0.40$: Empirical **Hard**

### 2.4 Adaptive Weighting & Timeout Penalty
In `TelemetryService.calculateAdaptiveWeight()`:
- Unobserved words retain weight = 1.0 (encourages exploration).
- Words with chronic timeout rates ($> 65\%$) receive a penalty multiplier (0.3x) to reduce player frustration.

---

## 3. Stage 2: Machine Learning Readiness & Offline Evaluation

### 3.1 ML Readiness Criteria
Direct activation of trained ML models is gated by data sufficiency:
- **Minimum Sample Count**: At least 500 validated, multi-client gameplay rounds.
- **Exclusion Rules**: Discards cancelled rounds and AFK skipped turns.
- **Evaluation Baseline**: Majority-class baseline solve rate and Brier score.

### 3.2 Evaluation Script
The reproducible evaluation script is available at `server/src/scripts/evaluate_difficulty_model.ts` and can be executed via:
```bash
npx tsx src/scripts/evaluate_difficulty_model.ts
```
The script outputs dataset size, class distributions, Brier score, and reports whether the dataset is sufficient for model training or should remain on the Stage 1 Bayesian baseline.
