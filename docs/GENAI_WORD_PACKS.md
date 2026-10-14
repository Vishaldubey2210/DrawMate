# GenAI-Powered Word-Pack Generator

## 1. Overview
The GenAI Word-Pack Generator allows users to describe any theme in natural language (e.g., *"Hindi Bollywood Blockbuster Movies"*, *"Outer Space & Astronomers"*, *"Classic Anime Characters"*) and generate validated, draw-ready multiplayer word decks.

---

## 2. Architectural Design
- **Pre-Game Deck Generation**: Model generation occurs during word-pack creation or in the custom deck studio, **never during live turn timers**.
- **Server-Side Key Isolation**: External API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) remain strictly on the backend.
- **Graceful Fallback**: When external AI providers are unconfigured or reach quota limits, `GenAIProviderService` seamlessly falls back to a curated multi-language thematic heuristic dictionary without interrupting gameplay.

---

## 3. Provider Resolution
Configured via `AI_PROVIDER` (`gemini` | `openai` | `mock` | `auto`):
1. **Gemini (`gemini-1.5-flash`)**: Invoked with structured JSON prompt and `responseMimeType: "application/json"`.
2. **OpenAI (`gpt-4o-mini`)**: Invoked with `response_format: { type: "json_object" }`.
3. **Mock Heuristic**: Thematic pattern matching across built-in vocabularies for English, Hindi, and Spanish.

---

## 4. Server-Side Validation Rules
Before any pack is displayed or persisted:
- **Length Constraint**: Each word or phrase must be between 2 and 50 characters.
- **Whitespace & Formatting**: Multiple spaces are collapsed; strings are trimmed.
- **Deduplication**: Case-insensitive deduplication ensures distinct prompts.
- **Pack Size**: Enforces between 5 and 500 words per pack.
- **Difficulty Normalization**: Assigns `easy`, `medium`, or `hard` tags based on word length and phrase complexity.
- **Interactive Review**: The user can preview, remove unwanted words, add custom words, and adjust pack names prior to final saving.
