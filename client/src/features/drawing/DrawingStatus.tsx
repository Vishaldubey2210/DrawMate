import React from 'react';
import { Badge } from '../../components/ui/Badge.js';
import { Pencil, Eye, Layers } from 'lucide-react';

interface DrawingStatusProps {
  isDrawer: boolean;
  drawerName?: string;
  revision: number;
  strokeCount: number;
}

export const DrawingStatus: React.FC<DrawingStatusProps> = ({
  isDrawer,
  drawerName,
  revision,
  strokeCount,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 text-xs sm:text-sm">
      <div className="flex items-center gap-2">
        {isDrawer ? (
          <Badge variant="success" className="flex items-center gap-1.5 px-3 py-1 font-bold">
            <Pencil className="w-3.5 h-3.5 animate-bounce" />
            <span>You are drawing</span>
          </Badge>
        ) : drawerName ? (
          <Badge variant="brand" className="flex items-center gap-1.5 px-3 py-1 font-medium">
            <Eye className="w-3.5 h-3.5" />
            <span>Observer Mode — {drawerName} is drawing</span>
          </Badge>
        ) : (
          <Badge variant="neutral" className="flex items-center gap-1.5 px-3 py-1 font-medium">
            <Eye className="w-3.5 h-3.5" />
            <span>Observer Mode</span>
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
        <span className="flex items-center gap-1" title="Completed Strokes">
          <Layers className="w-3.5 h-3.5" />
          <span>{strokeCount} strokes</span>
        </span>
        <span className="hidden sm:inline" title="Authoritative Canvas Revision">
          rev {revision}
        </span>
      </div>
    </div>
  );
};
