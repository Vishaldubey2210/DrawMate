import { z } from 'zod';
import { ENV } from '../config/env.js';

export const genAIInputSchema = z.object({
  theme: z.string().min(2).max(150),
  language: z.enum(['en', 'hi', 'es']).default('en'),
  count: z.number().int().min(5).max(100).default(20),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  category: z.string().max(50).default('custom'),
  instructions: z.string().max(200).optional(),
});

export type GenAIInput = z.infer<typeof genAIInputSchema>;

export interface GeneratedWordItem {
  word: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GenAIResponse {
  theme: string;
  packName: string;
  description: string;
  language: 'en' | 'hi' | 'es';
  category: string;
  words: string[];
  wordDetails: GeneratedWordItem[];
  providerUsed: 'gemini' | 'openai' | 'mock';
}

// Built-in thematic dictionaries for high-quality mock/offline fallback
const THEMATIC_VOCABULARY: Record<string, Record<string, string[]>> = {
  movies: {
    en: [
      'Inception', 'Titanic', 'Avatar', 'Gladiator', 'Matrix', 'Jaws', 'Interstellar',
      'Casablanca', 'Psycho', 'Godfather', 'Rocky', 'Alien', 'Memento', 'Up', 'Coco'
    ],
    hi: [
      'Sholay', 'Lagaan', 'Dangal', 'Dilwale', 'Queen', 'Barfi', 'Gully Boy',
      'Swades', 'Don', 'Krrish', 'Pk', 'Raazi', 'Taare Zameen Par', 'Devdas', 'Andhadhun'
    ],
    es: [
      'Coco', 'Roma', 'El Laberinto', 'Volver', 'Mar Adentro', 'Amores Perros', 'Relatos Salvajes'
    ],
  },
  animals: {
    en: [
      'Elephant', 'Giraffe', 'Penguin', 'Kangaroo', 'Cheetah', 'Chameleon', 'Octopus',
      'Flamingo', 'Hedgehog', 'Platypus', 'Dolphin', 'Peacock', 'Koala', 'Squirrel', 'Walrus'
    ],
    hi: [
      'Hathi', 'Sher', 'Bandar', 'Mor', 'Ghora', 'Kutta', 'Billi', 'Khargosh', 'Bhalu', 'Oont'
    ],
    es: [
      'Elefante', 'Jirafa', 'Pinguino', 'Canguro', 'Guepardo', 'Camaleon', 'Pulpo', 'Flamenco', 'Delfin'
    ],
  },
  food: {
    en: [
      'Pizza', 'Sushi', 'Burger', 'Taco', 'Pancake', 'Croissant', 'Burrito', 'Waffle',
      'Donut', 'Noodles', 'Sandwich', 'Lasagna', 'Dumpling', 'Pretzel', 'Bagel'
    ],
    hi: [
      'Samosa', 'Jalebi', 'Biryani', 'Dosa', 'Gol Gappa', 'Paneer Tikka', 'Gulab Jamun',
      'Chole Bhature', 'Pav Bhaji', 'Kachori', 'Lassi', 'Rasgulla'
    ],
    es: [
      'Paella', 'Tacos', 'Empanada', 'Churros', 'Gazpacho', 'Tortilla', 'Guacamole', 'Ceviche'
    ],
  },
  gaming: {
    en: [
      'Minecraft', 'Pacman', 'Mario', 'Zelda', 'Tetris', 'Fortnite', 'Sonic', 'Pokemon',
      'Portal', 'Doom', 'Skyrim', 'Roblox', 'Warcraft', 'Overwatch', 'Halo'
    ],
    hi: ['Ludo', 'Carrom', 'Shatranj', 'Kabbadi', 'Kho Kho', 'Gilli Danda', 'Pithu'],
    es: ['Ajedrez', 'Videojuego', 'Consola', 'Palanca', 'Cartas', 'Laberinto'],
  },
  space: {
    en: [
      'Astronaut', 'Telescope', 'Asteroid', 'Supernova', 'Galaxy', 'Satellite', 'Meteor',
      'Spaceship', 'Black Hole', 'Nebula', 'Comet', 'Planet', 'Eclipse', 'Rocket', 'Cosmos'
    ],
    hi: ['Chandrayaan', 'Mangalyaan', 'Tara', 'Suraj', 'Grah', 'Dhoomketu', 'Antariksh'],
    es: ['Astronauta', 'Telescopio', 'Asteroide', 'Galaxia', 'Satelite', 'Meteoro', 'Cohete'],
  },
};

export class GenAIProviderService {
  /**
   * Generates, validates, and normalizes a custom word pack
   */
  public static async generateWordPack(rawInput: unknown): Promise<GenAIResponse> {
    const input = genAIInputSchema.parse(rawInput);
    const provider = this.resolveProvider();

    let rawResult: {
      packName?: string;
      description?: string;
      category?: string;
      words?: Array<{ word: string; difficulty?: string }>;
    } | null = null;
    let providerUsed: 'gemini' | 'openai' | 'mock' = 'mock';

    if (provider === 'gemini') {
      try {
        rawResult = await this.callGemini(input);
        providerUsed = 'gemini';
      } catch (err) {
        console.warn('Gemini generation failed, falling back to mock heuristic:', err);
      }
    } else if (provider === 'openai') {
      try {
        rawResult = await this.callOpenAI(input);
        providerUsed = 'openai';
      } catch (err) {
        console.warn('OpenAI generation failed, falling back to mock heuristic:', err);
      }
    }

    // Heuristic fallback if provider unavailable or failed
    const finalPack =
      !rawResult || !Array.isArray(rawResult.words) || rawResult.words.length < 5
        ? this.generateMockPack(input)
        : rawResult;

    if (!rawResult || rawResult !== finalPack) {
      providerUsed = 'mock';
    }

    // Sanitize and validate every word output strictly server-side
    const sanitized = this.validateAndSanitize(finalPack, input);

    return {
      theme: input.theme,
      packName: (finalPack.packName || `${input.theme} Pack`).trim().slice(0, 50),
      description: (finalPack.description || `AI-generated word pack based on "${input.theme}"`).trim().slice(0, 200),
      language: input.language,
      category: (finalPack.category || input.category || 'custom').trim().slice(0, 50),
      words: sanitized.map((item) => item.word),
      wordDetails: sanitized,
      providerUsed,
    };
  }

  /**
   * Resolves configured AI provider
   */
  private static resolveProvider(): 'gemini' | 'openai' | 'mock' {
    const configured = (process.env.AI_PROVIDER || 'auto').toLowerCase();
    if (configured === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
    if (configured === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
    if (configured === 'mock') return 'mock';

    // Auto resolution: prefer Gemini, then OpenAI, fallback to Mock
    if (process.env.GEMINI_API_KEY) return 'gemini';
    if (process.env.OPENAI_API_KEY) return 'openai';
    return 'mock';
  }

  /**
   * Google Gemini generateContent integration
   */
  private static async callGemini(input: GenAIInput): Promise<any> {
    const apiKey = ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const model = ENV.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `You are an expert game designer creating drawing prompts for a multiplayer drawing and guessing game (like skribbl.io).
Generate a custom word pack with exactly ${input.count} words.
Theme: "${input.theme}"
Language: "${input.language}" (use valid natural words/phrases in this language)
Target Difficulty: "${input.difficulty}"
Category: "${input.category}"
${input.instructions ? `Special user instructions: "${input.instructions}"` : ''}

CRITICAL RULES:
1. Every word or phrase must be fun, recognizable, and draw-able on a canvas!
2. Answer phrases must be between 2 and 40 characters.
3. Family-friendly content only.
4. Output MUST be valid JSON with this exact structure:
{
  "packName": "Short descriptive name (max 40 chars)",
  "description": "Engaging description (max 150 chars)",
  "category": "${input.category}",
  "words": [
    { "word": "Word or Phrase", "difficulty": "easy|medium|hard" }
  ]
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data: any = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty Gemini response content');

      return JSON.parse(text);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * OpenAI chat completions integration
   */
  private static async callOpenAI(input: GenAIInput): Promise<any> {
    const apiKey = process.env.OPENAI_API_KEY;
    const url = 'https://api.openai.com/v1/chat/completions';

    const systemPrompt = `You are a multiplayer drawing game content creator. Return only valid JSON for word packs.`;
    const userPrompt = `Create a word pack of ${input.count} words for theme: "${input.theme}".
Language: "${input.language}". Target difficulty: "${input.difficulty}".
JSON Schema:
{
  "packName": "Title",
  "description": "Description",
  "category": "${input.category}",
  "words": [
    { "word": "Item", "difficulty": "easy|medium|hard" }
  ]
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status ${response.status}`);
      }

      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty OpenAI response');

      return JSON.parse(content);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Intelligent heuristic mock generation for offline/testing scenarios
   */
  private static generateMockPack(input: GenAIInput): any {
    const themeLower = input.theme.toLowerCase();
    const lang = input.language || 'en';

    // Match thematic vocabulary category
    let matchedCategory = 'general';
    for (const key of Object.keys(THEMATIC_VOCABULARY)) {
      if (themeLower.includes(key)) {
        matchedCategory = key;
        break;
      }
    }

    const vocabPool =
      THEMATIC_VOCABULARY[matchedCategory]?.[lang] ||
      THEMATIC_VOCABULARY[matchedCategory]?.['en'] ||
      THEMATIC_VOCABULARY.food.en;

    const words: Array<{ word: string; difficulty: 'easy' | 'medium' | 'hard' }> = [];
    const seen = new Set<string>();

    // 1. Add matching vocabulary words
    for (const item of vocabPool) {
      if (words.length >= input.count) break;
      if (!seen.has(item.toLowerCase())) {
        seen.add(item.toLowerCase());
        words.push({
          word: item,
          difficulty: item.length > 8 ? 'hard' : item.length > 5 ? 'medium' : 'easy',
        });
      }
    }

    // 2. Synthesize thematic extensions if more words requested
    let counter = 1;
    while (words.length < input.count) {
      const candidate = `${input.theme.trim()} ${counter}`;
      if (!seen.has(candidate.toLowerCase())) {
        seen.add(candidate.toLowerCase());
        words.push({
          word: candidate,
          difficulty: 'medium',
        });
      }
      counter++;
    }

    return {
      packName: `${input.theme} Custom Pack`,
      description: `Curated words and drawing challenges for "${input.theme}".`,
      category: matchedCategory !== 'general' ? matchedCategory : input.category || 'custom',
      words,
    };
  }

  /**
   * Server-side schema validation and deduplication
   */
  private static validateAndSanitize(
    rawResult: any,
    input: GenAIInput
  ): GeneratedWordItem[] {
    const rawWords = Array.isArray(rawResult?.words) ? rawResult.words : [];
    const seen = new Set<string>();
    const sanitized: GeneratedWordItem[] = [];

    for (const item of rawWords) {
      const wordStr = typeof item === 'string' ? item : item?.word;
      if (typeof wordStr !== 'string') continue;

      const trimmed = wordStr.trim().replace(/\s+/g, ' ');
      if (!trimmed || trimmed.length < 2 || trimmed.length > 50) continue;

      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);

      let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
      if (item?.difficulty === 'easy' || item?.difficulty === 'hard') {
        difficulty = item.difficulty;
      } else if (trimmed.length <= 4) {
        difficulty = 'easy';
      } else if (trimmed.length >= 10 || trimmed.includes(' ')) {
        difficulty = 'hard';
      }

      sanitized.push({ word: trimmed, difficulty });
      if (sanitized.length >= input.count) break;
    }

    return sanitized;
  }
}
