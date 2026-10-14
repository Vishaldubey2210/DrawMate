import { api } from './api.js';
import { CustomWordPack } from '../types/index.js';

export const wordPackService = {
  async getMyWordPacks(): Promise<CustomWordPack[]> {
    const res = await api.get<{ success: boolean; packs: CustomWordPack[] }>('/word-packs/me');
    return res.data.packs;
  },

  async getPublicWordPacks(language?: string): Promise<CustomWordPack[]> {
    const params = language ? { language } : undefined;
    const res = await api.get<{ success: boolean; packs: CustomWordPack[] }>('/word-packs/public', { params });
    return res.data.packs;
  },

  async getWordPack(id: string): Promise<CustomWordPack> {
    const res = await api.get<{ success: boolean; pack: CustomWordPack }>(`/word-packs/${id}`);
    return res.data.pack;
  },

  async createWordPack(payload: {
    name: string;
    description?: string;
    language: 'en' | 'hi' | 'es';
    category?: string;
    words: string[];
    isPublic?: boolean;
  }): Promise<CustomWordPack> {
    const res = await api.post<{ success: boolean; pack: CustomWordPack }>('/word-packs', payload);
    return res.data.pack;
  },

  async updateWordPack(
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      language: 'en' | 'hi' | 'es';
      category: string;
      words: string[];
      isPublic: boolean;
    }>
  ): Promise<CustomWordPack> {
    const res = await api.patch<{ success: boolean; pack: CustomWordPack }>(`/word-packs/${id}`, payload);
    return res.data.pack;
  },

  async deleteWordPack(id: string): Promise<void> {
    await api.delete(`/word-packs/${id}`);
  },

  async generateWithAI(payload: {
    theme: string;
    language?: 'en' | 'hi' | 'es';
    count?: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
    category?: string;
    instructions?: string;
  }): Promise<{
    theme: string;
    packName: string;
    description: string;
    language: 'en' | 'hi' | 'es';
    category: string;
    words: string[];
    wordDetails: Array<{ word: string; difficulty: 'easy' | 'medium' | 'hard' }>;
    providerUsed: string;
  }> {
    const res = await api.post<{
      success: boolean;
      data: {
        theme: string;
        packName: string;
        description: string;
        language: 'en' | 'hi' | 'es';
        category: string;
        words: string[];
        wordDetails: Array<{ word: string; difficulty: 'easy' | 'medium' | 'hard' }>;
        providerUsed: string;
      };
    }>('/word-packs/generate', payload);
    return res.data.data;
  },
};
