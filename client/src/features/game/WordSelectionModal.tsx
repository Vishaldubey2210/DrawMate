import React from 'react';
import { Modal } from '../../components/ui/Modal.js';
import { Badge } from '../../components/ui/Badge.js';
import { Clock, Sparkles, Palette } from 'lucide-react';

interface WordSelectionModalProps {
  isOpen: boolean;
  isDrawer: boolean;
  drawerName: string;
  choices?: string[];
  countdownSeconds: number;
  onSelectWord: (word: string) => void;
}

export const WordSelectionModal: React.FC<WordSelectionModalProps> = ({
  isOpen,
  isDrawer,
  drawerName,
  choices = [],
  countdownSeconds,
  onSelectWord,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title={isDrawer ? 'Choose Your Word' : 'Artist Choosing Word'}
      maxWidth="md"
    >
      <div className="space-y-6 text-center py-2">
        {/* Countdown Timer Badge */}
        <div className="flex items-center justify-center gap-2">
          <Badge variant="warning" className="px-3 py-1 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 mr-1 inline" />
            Selection time: {countdownSeconds}s
          </Badge>
        </div>

        {isDrawer ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Pick one secret word to sketch. Your fellow players will try to guess it!
            </p>

            {/* Word Choices Grid */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {choices.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => onSelectWord(word)}
                  className="group relative flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 hover:bg-primary-50 dark:hover:bg-primary-950/40 border-2 border-slate-200 dark:border-slate-700 hover:border-primary-500 rounded-2xl transition-all duration-200 text-left cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-lg font-black uppercase text-slate-900 dark:text-white tracking-wider">
                      {word}
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Select &rarr;
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
              <Palette className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {drawerName} is selecting a word
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sharpen your pencils and keep your eyes on the canvas!
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
