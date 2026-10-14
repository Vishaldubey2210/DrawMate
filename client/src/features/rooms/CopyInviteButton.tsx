import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.js';
import { Copy, Check, Share2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

export const CopyInviteButton: React.FC<{ roomCode: string }> = ({ roomCode }) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopyOrShare = async () => {
    const inviteUrl = `${window.location.origin}/rooms/${roomCode.toUpperCase()}`;

    // Prefer native mobile sharing if available (WhatsApp, Messages, etc.)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join my DrawMate Room (${roomCode.toUpperCase()})`,
          text: `Join my live DrawMate drawing room! Room code: ${roomCode.toUpperCase()}`,
          url: inviteUrl,
        });
        toast.success('Invite shared!');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = inviteUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success(`Invite link copied! Code: ${roomCode.toUpperCase()}`);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(`Could not auto-copy. Room Code: ${roomCode.toUpperCase()}`);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopyOrShare}
      leftIcon={
        copied ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <Share2 className="w-4 h-4 text-indigo-500" />
        )
      }
    >
      {copied ? 'Copied Link' : 'Invite Friends'}
    </Button>
  );
};
