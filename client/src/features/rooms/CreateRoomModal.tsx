import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from '../../context/RoomContext.js';
import { Modal } from '../../components/ui/Modal.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { RoomSettings, CustomWordPack } from '../../types/index.js';
import { wordPackService } from '../../services/wordPackService.js';
import { Users, Clock, Hash, Globe, Lock, Sparkles, Layers, Eye, BookOpen, Languages } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const { createRoom, isLoading } = useRoom();
  const navigate = useNavigate();

  const [name, setName] = useState('Friday Game Night');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [rounds, setRounds] = useState(3);
  const [drawTimeSeconds, setDrawTimeSeconds] = useState(80);
  const [wordCount, setWordCount] = useState(3);
  const [hints, setHints] = useState(2);
  const [wordMode, setWordMode] = useState<'normal' | 'hidden' | 'combination'>('normal');
  const [gameMode, setGameMode] = useState<'classic' | 'imposter'>('classic');

  // Phase 6 Advanced Configuration
  const [spectatorsAllowed, setSpectatorsAllowed] = useState(true);
  const [maxSpectators, setMaxSpectators] = useState(10);
  const [allowLateSpectators, setAllowLateSpectators] = useState(true);
  const [wordLanguage, setWordLanguage] = useState<'en' | 'hi' | 'es'>('en');
  const [wordSource, setWordSource] = useState<'builtin' | 'custom' | 'both'>('builtin');
  const [customWordPackId, setCustomWordPackId] = useState<string>('');
  const [userPacks, setUserPacks] = useState<CustomWordPack[]>([]);

  useEffect(() => {
    if (isOpen) {
      wordPackService.getMyWordPacks().then((packs) => {
        setUserPacks(packs);
        if (packs.length > 0 && !customWordPackId) {
          setCustomWordPackId(packs[0]._id);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const roomCode = await createRoom({
        name: name.trim(),
        visibility,
        settings: {
          maxPlayers,
          rounds,
          drawTimeSeconds,
          wordCount,
          hints,
          wordMode,
          gameMode,
          spectatorsAllowed,
          maxSpectators,
          allowLateSpectators,
          wordLanguage,
          wordSource,
          customWordPackId: (wordSource === 'custom' || wordSource === 'both') ? customWordPackId : undefined,
        },
      });

      onClose();
      navigate(`/rooms/${roomCode}`);
    } catch {
      // Error handled by Toast in context
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Multiplayer Game Room"
      description="Configure your lobby rules, player limit, and privacy settings."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Room Display Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Master Sketchers"
          required
        />

        {/* Visibility toggle */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Room Visibility
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                visibility === 'public'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/20 text-indigo-900 dark:text-indigo-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <p className="text-xs font-bold">Public Lobby</p>
                <p className="text-[10px] text-slate-500">Visible in room browser</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                visibility === 'private'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/20 text-indigo-900 dark:text-indigo-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Lock className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-bold">Private Room</p>
                <p className="text-[10px] text-slate-500">Invite code only</p>
              </div>
            </button>
          </div>
        </div>

        {/* Game Mode Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Game Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setGameMode('classic')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                gameMode === 'classic'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/20 text-indigo-900 dark:text-indigo-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <p className="text-xs font-bold">Classic Mode</p>
                <p className="text-[10px] text-slate-500">Draw & Guess (2+ players)</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setGameMode('imposter');
                if (maxPlayers < 4) setMaxPlayers(4);
              }}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                gameMode === 'imposter'
                  ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/60 ring-2 ring-rose-500/20 text-rose-900 dark:text-rose-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <p className="text-xs font-bold">Imposter Mode</p>
                <p className="text-[10px] text-slate-500">Find the saboteur (4+ players)</p>
              </div>
            </button>
          </div>
        </div>

        {/* Settings grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Max players */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Max Players
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{maxPlayers} players</span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* Rounds */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Rounds
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{rounds} rounds</span>
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

          {/* Draw time */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Draw Duration
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{drawTimeSeconds} seconds</span>
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

          {/* Word Choices */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> Word Choices
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{wordCount} options</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Word Mode selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Word Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'normal', label: 'Normal' },
              { id: 'hidden', label: 'Hidden' },
              { id: 'combination', label: 'Combination' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setWordMode(m.id as any)}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  wordMode === m.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Word Language selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-indigo-500" /> Word Bank Language
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'en', label: 'English (EN)' },
              { id: 'hi', label: 'Hindi (हिंदी)' },
              { id: 'es', label: 'Spanish (ES)' },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setWordLanguage(lang.id as any)}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  wordLanguage === lang.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Word Source selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Word Source
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'builtin', label: 'Built-in Bank' },
              { id: 'custom', label: 'Custom Pack Only' },
              { id: 'both', label: 'Built-in + Custom' },
            ].map((src) => (
              <button
                key={src.id}
                type="button"
                onClick={() => setWordSource(src.id as any)}
                className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                  wordSource === src.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>

          {(wordSource === 'custom' || wordSource === 'both') && (
            <div className="pt-1">
              {userPacks.length === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300">
                  You haven't created any custom word packs yet. Create one in the Word Packs tab to use custom words!
                </div>
              ) : (
                <select
                  value={customWordPackId}
                  onChange={(e) => setCustomWordPackId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {userPacks.map((pack) => (
                    <option key={pack._id} value={pack._id}>
                      {pack.name} ({pack.words.length} words • {pack.language.toUpperCase()})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Spectator Controls */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-500" /> Allow Spectators
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={spectatorsAllowed}
                onChange={(e) => setSpectatorsAllowed(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {spectatorsAllowed && (
            <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Max Spectator Capacity</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{maxSpectators} spectators</span>
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

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-600 dark:text-slate-400">Allow Late Spectator Joining</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowLateSpectators}
                    onChange={(e) => setAllowLateSpectators(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button size="sm" type="submit" isLoading={isLoading} rightIcon={<Sparkles className="w-4 h-4" />}>
            Create & Launch Lobby
          </Button>
        </div>
      </form>
    </Modal>
  );
};
