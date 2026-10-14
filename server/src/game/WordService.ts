import { WORD_BANK, WordItem } from './words.data.js';

export interface WordChoiceOptions {
  category?: string;
  count?: number;
  excludeWords?: string[];
  language?: string;
  customWords?: string[];
  wordSource?: 'builtin' | 'custom' | 'both';
  wordMode?: 'normal' | 'hidden' | 'combination';
  difficulty?: 'easy' | 'medium' | 'hard' | 'all';
}

export class WordService {
  /**
   * Selects random distinct word options matching category, language, mode, and settings
   */
  public static getWordChoices(
    categoryOrOptions: string | WordChoiceOptions = 'general',
    count: number = 3,
    excludeWords: string[] = []
  ): string[] {
    let options: WordChoiceOptions;

    if (typeof categoryOrOptions === 'object' && categoryOrOptions !== null) {
      options = categoryOrOptions;
    } else {
      options = {
        category: categoryOrOptions,
        count,
        excludeWords,
        language: 'en',
        wordMode: 'normal',
      };
    }

    const targetCategory = (options.category || 'general').toLowerCase().trim();
    const targetCount = options.count || 3;
    const targetLang = (options.language || 'en').toLowerCase().trim();
    const targetMode = options.wordMode || 'normal';
    const targetDifficulty = options.difficulty || 'all';
    const excluded = (options.excludeWords || []).map((w) => w.toLowerCase().trim());

    // 1. Determine candidate words
    let candidates: WordItem[] = [];

    if (options.wordSource !== 'custom') {
      // Filter built-in bank by language
      const langFiltered = WORD_BANK.filter((w) => (w.language || 'en') === targetLang);
      const bank = langFiltered.length > 0 ? langFiltered : WORD_BANK;

      if (targetCategory !== 'general') {
        const catFiltered = bank.filter((w) => w.category === targetCategory);
        candidates = catFiltered.length >= targetCount ? catFiltered : bank;
      } else {
        candidates = bank;
      }
    }

    // 2. Blend or use custom words if configured
    if (options.customWords && options.customWords.length > 0) {
      const customItems: WordItem[] = options.customWords.map((cw) => ({
        word: cw.trim(),
        category: 'custom',
        difficulty: 'medium',
        language: targetLang as any,
      }));

      if (options.wordSource === 'custom') {
        candidates = customItems;
      } else if (options.wordSource === 'both') {
        candidates = [...candidates, ...customItems];
      }
    }

    // 3. Filter excluded words (recent word avoidance)
    let unused = candidates.filter((w) => !excluded.includes(w.word.toLowerCase()));
    if (unused.length < targetCount) {
      unused = candidates; // Fallback if entire pool has been exhausted
    }

    // 4. Filter by difficulty if host specifically chose one
    let pool = unused;
    if (targetDifficulty !== 'all') {
      const diffFiltered = unused.filter((w) => w.difficulty === targetDifficulty);
      if (diffFiltered.length >= targetCount) {
        pool = diffFiltered;
      }
    }

    // 5. Handle Combination Mode: generate pairs if selected
    if (targetMode === 'combination') {
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      const combinationChoices: string[] = [];

      for (let i = 0; i < targetCount; i++) {
        const first = shuffled[(i * 2) % shuffled.length]?.word || 'ice';
        const second = shuffled[(i * 2 + 1) % shuffled.length]?.word || 'cream';
        if (first.includes(' ')) {
          combinationChoices.push(first);
        } else if (second.includes(' ')) {
          combinationChoices.push(second);
        } else {
          combinationChoices.push(`${first} ${second}`);
        }
      }

      return combinationChoices;
    }

    // 6. Balanced difficulty selection when targetDifficulty is 'all'
    if (targetDifficulty === 'all' && targetCount === 3) {
      const easyPool = pool.filter((w) => w.difficulty === 'easy').sort(() => 0.5 - Math.random());
      const medPool = pool.filter((w) => w.difficulty === 'medium').sort(() => 0.5 - Math.random());
      const hardPool = pool.filter((w) => w.difficulty === 'hard').sort(() => 0.5 - Math.random());

      if (easyPool.length > 0 && medPool.length > 0 && hardPool.length > 0) {
        return [easyPool[0].word, medPool[0].word, hardPool[0].word];
      }
    }

    // Standard randomized selection
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(targetCount, shuffled.length)).map((w) => w.word);
  }

  /**
   * Normalizes player guess text for language-aware matching
   */
  public static normalizeGuess(text: string, language: string = 'en'): string {
    if (!text) return '';
    const trimmed = text.trim();

    if (language === 'hi') {
      // Devanagari Unicode NFC normalization, preserve matras, lowercase (ASCII parts)
      return trimmed
        .normalize('NFC')
        .toLowerCase()
        .replace(/\s+/g, ' ');
    }

    // English / Spanish / Latin scripts: Unicode NFD strip diacritics, lowercase
    return trimmed
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Strip accents
      .replace(/\s+/g, ' '); // Normalize internal spaces
  }

  /**
   * Checks if player guess matches canonical secret word or any approved aliases
   */
  public static isMatch(
    guess: string,
    secretWord: string,
    aliases: string[] = [],
    language: string = 'en'
  ): boolean {
    const normGuess = this.normalizeGuess(guess, language);
    if (!normGuess) return false;

    // Check canonical word
    const normSecret = this.normalizeGuess(secretWord, language);
    if (normGuess === normSecret) return true;

    // Check word without diacritics/accents directly
    const directSecret = secretWord.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normGuess === directSecret) return true;

    // Check aliases
    for (const alias of aliases) {
      if (this.normalizeGuess(alias, language) === normGuess) {
        return true;
      }
    }

    // Also look up in built-in WORD_BANK for registered aliases if not explicitly passed
    const foundItem = WORD_BANK.find(
      (w) => w.word.toLowerCase() === secretWord.toLowerCase().trim()
    );
    if (foundItem?.aliases) {
      for (const alias of foundItem.aliases) {
        if (this.normalizeGuess(alias, language) === normGuess) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Alias for normalizeGuess
   */
  public static normalizeWord(text: string, language: string = 'en'): string {
    return this.normalizeGuess(text, language);
  }

  /**
   * Returns word choices wrapped in object format for backward compatibility
   */
  public static getRandomChoices(category: string = 'general', count: number = 3): { word: string }[] {
    return this.getWordChoices(category, count).map((w) => ({ word: w }));
  }

  /**
   * Formats a masked representation for observers: reveals letters at specified indices
   * Handles Unicode graphemes (Devanagari matras, accents) and word modes
   */
  public static generateMask(
    word: string,
    revealedIndices: number[] = [],
    wordMode: string = 'normal'
  ): string {
    if (!word) return '';

    if (wordMode === 'hidden') {
      // In Hidden Mode, letter hints and character length pattern are completely obscured from guessers
      return '? ? ? ? ?';
    }

    // Split using Array.from to preserve Unicode grapheme codepoints
    const chars = Array.from(word);
    const safeRevealed = Array.isArray(revealedIndices) ? revealedIndices : [];

    const maskedChars = chars.map((char, index) => {
      if (char === ' ') return ' ';
      if (char === '-' || char === "'") return char;
      if (safeRevealed.includes(index)) {
        return char.toUpperCase();
      }
      return '_';
    });

    return maskedChars.join(' ');
  }
}
