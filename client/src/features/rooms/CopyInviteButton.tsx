import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.js';
import { Copy, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext.js';

export const CopyInviteButton: React.FC<{ roomCode: string }> = ({ roomCode }) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = async () => {
    const inviteUrl = `${window.location.origin}/rooms/${roomCode}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = inviteUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('Invite link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(`Could not copy automatically. URL: ${inviteUrl}`);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      leftIcon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    >
      {copied ? 'Copied Link' : 'Copy Invite Link'}
    </Button>
  );
};
