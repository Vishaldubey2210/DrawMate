import React, { useState } from 'react';
import { RoomSettings } from '../../types/index.js';
import { useRoom } from '../../context/RoomContext.js';
import { Button } from '../../components/ui/Button.js';
import { Modal } from '../../components/ui/Modal.js';
import { Sliders, Layers, Clock, Hash, HelpCircle, Palette, Edit, Eye, Languages, BookOpen } from 'lucide-react';

interface RoomSettingsCardProps {
  settings: RoomSettings;
  isHost: boolean;
}

export const RoomSettingsCard: React.FC<RoomSettingsCardProps> = ({ settings, isHost }) => {
  const { updateSettings } = useRoom();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [rounds, setRounds] = useState(settings.rounds);
  const [drawTimeSeconds, setDrawTimeSeconds] = useState(settings.drawTimeSeconds);
  const [wordCount, setWordCount] = useState(settings.wordCount);
  const [hints, setHints] = useState(settings.hints);
  const [wordMode, setWordMode] = useState(settings.wordMode);
  const [gameMode, setGameMode] = useState<'classic' | 'imposter'>(settings.gameMode ?? 'classic');
  const [spectatorsAllowed, setSpectatorsAllowed] = useState(settings.spectatorsAllowed ?? true);
  const [maxSpectators, setMaxSpectators] = useState(settings.maxSpectators ?? 10);
  const [wordLanguage, setWordLanguage] = useState(settings.wordLanguage ?? 'en');
  const [wordSource, setWordSource] = useState(settings.wordSource ?? 'builtin');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateSettings({
        rounds,
        drawTimeSeconds,
        wordCount,
        hints,
        wordMode,
        gameMode,
        spectatorsAllowed,
        maxSpectators,
        wordLanguage,
        wordSource,
      });
      setIsEditModalOpen(false);
    } catch {
      // Error handled by Toast
    } finally {
      setIsSaving(false);
    }
  };

  const getLanguageLabel = (lang?: string) => {
    switch (lang) {
      case 'hi':
        return 'Hindi (हिंदी)';
      case 'es':
        return 'Spanish (Español)';
      default:
        return 'English';
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-500" />
          <span>Match Configuration</span>
        </h4>
        {isHost && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit className="w-3.5 h-3.5" />}
            onClick={() => {
              setRounds(settings.rounds);
              setDrawTimeSeconds(settings.drawTimeSeconds);
              setWordCount(settings.wordCount);
              setHints(settings.hints);
              setWordMode(settings.wordMode);
              setGameMode(settings.gameMode ?? 'classic');
              setSpectatorsAllowed(settings.spectatorsAllowed ?? true);
              setMaxSpectators(settings.maxSpectators ?? 10);
              setWordLanguage(settings.wordLanguage ?? 'en');
              setWordSource(settings.wordSource ?? 'builtin');
              setIsEditModalOpen(true);
            }}
          >
            Edit Rules
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 space-y-1">
          <p className="text-slate-400 font-medium flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" /> Mode
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm capitalize">
            {settings.gameMode === 'imposter' ? '🎭 Imposter' : 'Classic'}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 space-y-1">
          <p className="text-slate-400 font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Rounds
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{settings.rounds}</p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 space-y-1">
          <p className="text-slate-400 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Draw Time
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            {settings.drawTimeSeconds}s
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 space-y-1">
          <p className="text-slate-400 font-medium flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5" /> Language
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            {getLanguageLabel(settings.wordLanguage)}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 space-y-1">
          <p className="text-slate-400 font-medium flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Word Mode
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-200 capitalize text-sm">
            {settings.wordMode}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 space-y-1">
          <p className="text-slate-400 font-medium flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Spectators
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            {settings.spectatorsAllowed !== false ? `Max ${settings.maxSpectators ?? 10}` : 'Disabled'}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/70 space-y-1 sm:col-span-2">
          <p className="text-slate-400 font-medium flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Word Source
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-200 capitalize text-sm">
            {settings.wordSource || 'Builtin'}
          </p>
        </div>
      </div>

      {/* Edit Settings Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Modify Room Settings"
        description="Updates apply immediately to all participants."
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Game Mode */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Game Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGameMode('classic')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  gameMode === 'classic'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Classic Mode
              </button>
              <button
                type="button"
                onClick={() => setGameMode('imposter')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  gameMode === 'imposter'
                    ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                🎭 Imposter (Min 4)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Rounds</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{rounds}</span>
            </div>
            <input
              type="range"
              min="2"
              max="10"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Draw Duration
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {drawTimeSeconds}s
              </span>
            </div>
            <input
              type="range"
              min="15"
              max="240"
              step="5"
              value={drawTimeSeconds}
              onChange={(e) => setDrawTimeSeconds(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Word Language
              </label>
              <select
                value={wordLanguage}
                onChange={(e) => setWordLanguage(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="en">English</option>
                <option value="hi">Hindi (हिंदी)</option>
                <option value="es">Spanish (Español)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Word Source
              </label>
              <select
                value={wordSource}
                onChange={(e) => setWordSource(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="builtin">Built-in Words</option>
                <option value="custom">Custom Pack Only</option>
                <option value="both">Built-in + Custom</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Word Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['normal', 'hidden', 'combination'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setWordMode(m as any)}
                  className={`py-1.5 text-xs font-bold rounded-lg border capitalize transition-all ${
                    wordMode === m
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Allow Spectators
              </span>
              <input
                type="checkbox"
                checked={spectatorsAllowed}
                onChange={(e) => setSpectatorsAllowed(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {spectatorsAllowed && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Max Spectator Capacity</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{maxSpectators}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={maxSpectators}
                  onChange={(e) => setMaxSpectators(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isSaving}>
              Apply Settings
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

