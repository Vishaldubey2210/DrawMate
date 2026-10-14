import React, { useState } from 'react';
import { wordPackService } from '../../services/wordPackService.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  Plus,
  RefreshCw,
  Wand2,
  Layers,
  Languages,
  Sliders,
  AlertCircle,
} from 'lucide-react';

interface GenAIWordPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GeneratedWordItem {
  word: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const GenAIWordPackModal: React.FC<GenAIWordPackModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();

  // Generator inputs
  const [theme, setTheme] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi' | 'es'>('en');
  const [count, setCount] = useState<number>(20);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [category, setCategory] = useState('custom');
  const [instructions, setInstructions] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview & edit state
  const [previewResult, setPreviewResult] = useState<{
    packName: string;
    description: string;
    words: GeneratedWordItem[];
    providerUsed: string;
  } | null>(null);

  const [newWordInput, setNewWordInput] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim()) {
      setError('Please provide a theme or topic for word generation.');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const res = await wordPackService.generateWithAI({
        theme: theme.trim(),
        language,
        count,
        difficulty,
        category: category.trim() || 'custom',
        instructions: instructions.trim() || undefined,
      });

      setPreviewResult({
        packName: res.packName,
        description: res.description,
        words: res.wordDetails || res.words.map((w) => ({ word: w, difficulty: 'medium' })),
        providerUsed: res.providerUsed,
      });
      toast.success(`Generated ${res.words.length} prompts using ${res.providerUsed.toUpperCase()}!`);
    } catch (err: any) {
      setError(err.message || 'Word generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveWord = (index: number) => {
    if (!previewResult) return;
    const updated = [...previewResult.words];
    updated.splice(index, 1);
    setPreviewResult({ ...previewResult, words: updated });
  };

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWordInput.trim();
    if (!trimmed || !previewResult) return;

    if (previewResult.words.some((w) => w.word.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This word is already in the pack.');
      return;
    }

    setPreviewResult({
      ...previewResult,
      words: [...previewResult.words, { word: trimmed, difficulty: 'medium' }],
    });
    setNewWordInput('');
  };

  const handleSave = async () => {
    if (!previewResult) return;
    if (previewResult.words.length < 5) {
      setError('A pack must contain at least 5 words to be saved.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await wordPackService.createWordPack({
        name: previewResult.packName,
        description: previewResult.description,
        language,
        category: category || 'custom',
        words: previewResult.words.map((w) => w.word),
        isPublic: false,
      });

      toast.success(`Word pack "${previewResult.packName}" saved successfully!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save generated word pack.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setPreviewResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                GenAI Word Pack Generator
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transform any theme into a validated multiplayer drawing deck
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!previewResult ? (
            /* Generator Form */
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Theme or Topic <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="e.g. Hindi Bollywood Blockbuster Movies, Outer Space, Anime Characters"
                  maxLength={120}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5" /> Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="en">English (Global)</option>
                    <option value="hi">Hindi (हिन्दी / Bollywood)</option>
                    <option value="es">Spanish (Español)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" /> Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                  >
                    <option value="mixed">Balanced / Mixed</option>
                    <option value="easy">Easy (Simple Sketches)</option>
                    <option value="medium">Medium (Standard)</option>
                    <option value="hard">Hard (Challenging)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Word Count ({count} words)
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>10 words</span>
                    <span>30 words</span>
                    <span>60 words</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Category Tag
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. movies, animals, food, gaming"
                    maxLength={30}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Optional Instructions
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Only 90s classic family movies; short 1-2 word answers only."
                  rows={2}
                  maxLength={150}
                  className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isGenerating || !theme.trim()}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Prompts...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>Generate Word Pack</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Preview and Edit Step */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  Provider: <strong>{previewResult.providerUsed.toUpperCase()}</strong>
                </span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {previewResult.words.length} Accepted Words
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Pack Title
                  </label>
                  <input
                    type="text"
                    value={previewResult.packName}
                    onChange={(e) =>
                      setPreviewResult({ ...previewResult, packName: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={previewResult.description}
                    onChange={(e) =>
                      setPreviewResult({ ...previewResult, description: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Add Extra Word Input */}
              <form onSubmit={handleAddWord} className="flex gap-2">
                <input
                  type="text"
                  value={newWordInput}
                  onChange={(e) => setNewWordInput(e.target.value)}
                  placeholder="Add another custom word..."
                  className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newWordInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </form>

              {/* Words Chip Cloud */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-2xl max-h-60 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {previewResult.words.map((item, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 shadow-sm"
                    >
                      <span className="font-semibold">{item.word}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                          item.difficulty === 'easy'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : item.difficulty === 'hard'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {item.difficulty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveWord(index)}
                        className="text-slate-400 hover:text-rose-500 transition-colors ml-0.5"
                        aria-label={`Remove ${item.word}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {previewResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reconfigure Theme
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || previewResult.words.length < 5}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Pack...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save to My Packs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
