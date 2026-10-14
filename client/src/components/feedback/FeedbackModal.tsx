import React, { useState } from 'react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { submitFeedback } from '../../services/observabilityService.js';
import { useToast } from '../../context/ToastContext.js';
import { MessageSquare, Bug, Sparkles, Send, Info } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRoomCode?: string;
  defaultGameId?: string;
}

const CATEGORIES = [
  { value: 'gameplay_bug', label: 'Gameplay Bug' },
  { value: 'drawing_touch', label: 'Drawing or Touch Problem' },
  { value: 'connection', label: 'Connection or Disconnect Issue' },
  { value: 'scoring', label: 'Scoring or Guessing Problem' },
  { value: 'imposter_mode', label: 'Imposter Mode Issue' },
  { value: 'word_pack', label: 'Word Pack or Vocabulary Problem' },
  { value: 'ai_practice', label: 'AI Practice Mode Problem' },
  { value: 'performance', label: 'Performance or Lag' },
  { value: 'general_suggestion', label: 'General Suggestion / Idea' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  defaultRoomCode,
  defaultGameId,
}) => {
  const toast = useToast();
  const [category, setCategory] = useState<string>('gameplay_bug');
  const [description, setDescription] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>(defaultRoomCode || '');
  const [includeDiagnostics, setIncludeDiagnostics] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (description.trim().length < 5) {
      toast.error('Please provide at least 5 characters of description.');
      return;
    }

    try {
      setIsSubmitting(true);

      const clientDiagnostics = includeDiagnostics
        ? {
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            latencyEstimateMs: 0,
          }
        : undefined;

      await submitFeedback({
        category,
        description: description.trim(),
        roomCode: roomCode.trim() || undefined,
        gameId: defaultGameId || undefined,
        clientDiagnostics,
      });

      toast.success('Thank you! Your beta feedback has been delivered to the team.');
      setDescription('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Beta Feedback & Bug Report"
      description="Help us harden DrawMate for launch! Submit bugs, UI glitches, or suggestions."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Description
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what occurred, steps to reproduce, or your improvement idea..."
            className="w-full text-xs px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            required
            maxLength={2000}
          />
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
            <span>Minimum 5 characters</span>
            <span>{description.length} / 2000</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
            Room Code (Optional)
          </label>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12CD34"
            maxLength={8}
            className="w-full text-xs font-mono uppercase px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
              />
              <span>Attach browser and screen diagnostics</span>
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Zero private chat transcripts, secret words, or drawing contents are ever captured.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            rightIcon={<Send className="w-3.5 h-3.5" />}
          >
            Submit Feedback
          </Button>
        </div>
      </form>
    </Modal>
  );
};
