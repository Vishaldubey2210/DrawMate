import React, { useState } from 'react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  requiredPhrase?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
  requiredPhrase,
}) => {
  const [typedPhrase, setTypedPhrase] = useState('');

  const isConfirmedPhraseValid = !requiredPhrase || typedPhrase === requiredPhrase;

  const handleConfirm = async () => {
    if (!isConfirmedPhraseValid) return;
    await onConfirm();
    setTypedPhrase('');
  };

  const handleClose = () => {
    setTypedPhrase('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        {isDestructive && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-medium">This action cannot be undone.</p>
          </div>
        )}

        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>

        {requiredPhrase && (
          <div className="space-y-1.5 pt-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              Type <strong className="text-slate-800 dark:text-slate-200 font-mono">"{requiredPhrase}"</strong> to proceed:
            </label>
            <input
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={requiredPhrase}
              className="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-4">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? 'danger' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={!isConfirmedPhraseValid}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
