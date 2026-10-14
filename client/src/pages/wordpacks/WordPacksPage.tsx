import React, { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { wordPackService } from '../../services/wordPackService.js';
import { CustomWordPack } from '../../types/index.js';
import { useToast } from '../../context/ToastContext.js';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Globe,
  Lock,
  Loader2,
  X,
  Languages,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { GenAIWordPackModal } from '../../features/wordpacks/GenAIWordPackModal.js';

export const WordPacksPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'mine' | 'public'>('mine');
  const [packs, setPacks] = useState<CustomWordPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<CustomWordPack | null>(null);
  const [packName, setPackName] = useState('');
  const [packDesc, setPackDesc] = useState('');
  const [packLang, setPackLang] = useState<'en' | 'hi' | 'es'>('en');
  const [packWordsText, setPackWordsText] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchPacks = async () => {
    try {
      setIsLoading(true);
      if (activeTab === 'mine') {
        const data = await wordPackService.getMyWordPacks();
        if (isMountedRef.current) setPacks(data);
      } else {
        const data = await wordPackService.getPublicWordPacks();
        if (isMountedRef.current) setPacks(data);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        toast.error(err.message || 'Failed to load word packs');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchPacks();
    return () => {
      isMountedRef.current = false;
    };
  }, [activeTab]);

  const openCreateModal = () => {
    setEditingPack(null);
    setPackName('');
    setPackDesc('');
    setPackLang('en');
    setPackWordsText('');
    setIsPublic(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (pack: CustomWordPack) => {
    setEditingPack(pack);
    setPackName(pack.name);
    setPackDesc(pack.description || '');
    setPackLang(pack.language);
    setPackWordsText(pack.words.join('\n'));
    setIsPublic(pack.isPublic);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSavePack = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = packName.trim();
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 50) {
      setFormError('Pack name must be between 2 and 50 characters.');
      return;
    }

    // Split words by commas or newlines
    const rawWords = packWordsText
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    const uniqueWords = Array.from(new Set(rawWords.map((w) => w.toLowerCase()))).map((lower) => {
      return rawWords.find((orig) => orig.toLowerCase() === lower)!;
    });

    if (uniqueWords.length < 5) {
      setFormError(`Please provide at least 5 unique words (currently have ${uniqueWords.length}).`);
      return;
    }

    if (uniqueWords.length > 500) {
      setFormError(`Cannot exceed 500 words per pack (currently have ${uniqueWords.length}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingPack) {
        await wordPackService.updateWordPack(editingPack._id, {
          name: trimmedName,
          description: packDesc.trim(),
          language: packLang,
          words: uniqueWords,
          isPublic,
        });
        toast.success('Word pack updated successfully!');
      } else {
        await wordPackService.createWordPack({
          name: trimmedName,
          description: packDesc.trim(),
          language: packLang,
          words: uniqueWords,
          isPublic,
        });
        toast.success('Word pack created successfully!');
      }

      setIsModalOpen(false);
      fetchPacks();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save word pack.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePack = async (packId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await wordPackService.deleteWordPack(packId);
      toast.info('Word pack deleted.');
      fetchPacks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete pack.');
    }
  };

  const getLanguageLabel = (code: string) => {
    switch (code) {
      case 'hi':
        return 'Hindi (हिंदी)';
      case 'es':
        return 'Spanish (Español)';
      default:
        return 'English';
    }
  };

  const parsedWordsCount = packWordsText
    .split(/[\n,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0).length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Custom Word Packs"
          subtitle="Create, curate, and play drawing battles with custom words in multiple languages."
        />
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setIsAIModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-fuchsia-600/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate with AI</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Word Pack</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('mine')}
          className={`pb-3 font-semibold text-sm transition-colors relative ${
            activeTab === 'mine'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          My Word Packs
          {activeTab === 'mine' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('public')}
          className={`pb-3 font-semibold text-sm transition-colors relative ${
            activeTab === 'public'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Community Packs
          {activeTab === 'public' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>
      </div>

      {/* List content */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm">Loading word packs...</p>
        </div>
      ) : packs.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={activeTab === 'mine' ? 'No custom word packs yet' : 'No public word packs found'}
          description={
            activeTab === 'mine'
              ? 'Create a custom vocabulary pack to play themed matches with your friends.'
              : 'Be the first to publish a public word pack to the community.'
          }
          actionText={activeTab === 'mine' ? 'Create Your First Pack' : undefined}
          onAction={activeTab === 'mine' ? openCreateModal : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {packs.map((pack) => (
            <div
              key={pack._id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1">
                    {pack.name}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={pack.isPublic ? 'success' : 'neutral'}>
                      {pack.isPublic ? (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Public
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Private
                        </span>
                      )}
                    </Badge>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                  {pack.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {getLanguageLabel(pack.language)}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                    {pack.words.length} words
                  </span>
                </div>

                {/* Sample words preview */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-4">
                  <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 line-clamp-2">
                    {pack.words.slice(0, 8).join(', ')}
                    {pack.words.length > 8 ? '...' : ''}
                  </p>
                </div>
              </div>

              {activeTab === 'mine' && (
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => openEditModal(pack)}
                    className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Edit Word Pack"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePack(pack._id, pack.name)}
                    className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Delete Word Pack"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingPack ? 'Edit Word Pack' : 'Create Custom Word Pack'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePack} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pack Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={packName}
                  onChange={(e) => setPackName(e.target.value)}
                  placeholder="e.g. Science & Space, Superheroes"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={packDesc}
                  onChange={(e) => setPackDesc(e.target.value)}
                  placeholder="Short description for other players"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Language
                  </label>
                  <select
                    value={packLang}
                    onChange={(e) => setPackLang(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="es">Spanish (Español)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Visibility
                  </label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Public to all players
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Words List * (Minimum 5, up to 500)
                  </label>
                  <span className="text-xs text-slate-400 font-mono">
                    {parsedWordsCount} / 500
                  </span>
                </div>
                <textarea
                  required
                  rows={6}
                  value={packWordsText}
                  onChange={(e) => setPackWordsText(e.target.value)}
                  placeholder="Enter words separated by commas or line breaks:&#10;satellite, telescope, galaxy, astronaut, rover"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingPack ? 'Update Pack' : 'Create Pack'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* GenAI Word Pack Generator Modal */}
      <GenAIWordPackModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSuccess={fetchPacks}
      />
    </div>
  );
};
