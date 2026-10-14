import React, { useState, useRef, useEffect } from 'react';
import { GuessMessage } from './game.types.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Send, CheckCircle2, MessageSquare, Eye } from 'lucide-react';

interface GameChatProps {
  messages: GuessMessage[];
  isDrawer: boolean;
  hasGuessedCorrectly: boolean;
  isSpectator?: boolean;
  onSendGuess: (text: string) => Promise<boolean>;
}

export const GameChat: React.FC<GameChatProps> = ({
  messages,
  isDrawer,
  hasGuessedCorrectly,
  isSpectator = false,
  onSendGuess,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to latest guess
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSubmitting || isDrawer || hasGuessedCorrectly || isSpectator) return;

    try {
      setIsSubmitting(true);
      await onSendGuess(trimmed);
      setInputText('');
    } catch {
      // Error handled in toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInputDisabled = isDrawer || hasGuessedCorrectly || isSpectator;
  const inputPlaceholder = isSpectator
    ? 'Spectators cannot submit gameplay guesses.'
    : isDrawer
    ? 'You are drawing — players are guessing!'
    : hasGuessedCorrectly
    ? 'You guessed the word! Relax and watch.'
    : 'Type your guess here...';

  return (
    <div className="flex flex-col h-[400px] lg:h-[540px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Live Guess Chat
          </span>
        </div>
        {isSpectator && (
          <Badge variant="neutral" size="sm">
            <Eye className="w-3 h-3 mr-1 inline text-indigo-400" /> Spectator
          </Badge>
        )}
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 space-y-2 overflow-y-auto text-xs sm:text-sm"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
            <span>No guesses yet. Be the first to crack the sketch!</span>
          </div>
        ) : (
          messages.map((m) =>
            m.isCorrect ? (
              <div
                key={m.id}
                className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-semibold"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{m.displayName}</strong> guessed the word!
                </span>
              </div>
            ) : (
              <div
                key={m.id}
                className="flex items-baseline gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {m.displayName}:
                </span>
                <span className="text-slate-600 dark:text-slate-400 break-words">
                  {m.text}
                </span>
              </div>
            )
          )
        )}
      </div>

      {/* Chat Input Bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={inputPlaceholder}
          disabled={isInputDisabled}
          maxLength={100}
          className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isInputDisabled || !inputText.trim() || isSubmitting}
          className="rounded-xl px-3"
          aria-label="Send guess"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
};
