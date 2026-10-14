import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text' | 'rounded';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animate = true,
}) => {
  const roundedClass =
    variant === 'circular'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded-md'
      : variant === 'rounded'
      ? 'rounded-2xl'
      : 'rounded-xl';

  const style: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
  };

  return (
    <div
      style={style}
      className={`relative overflow-hidden bg-slate-200/80 dark:bg-slate-800/80 ${
        animate ? 'animate-pulse' : ''
      } ${roundedClass} ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
    </div>
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string; lastLineWidth?: string }> = ({
  lines = 3,
  className = '',
  lastLineWidth = 'w-3/4',
}) => {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          variant="text"
          className={`h-3.5 ${idx === lines - 1 ? lastLineWidth : 'w-full'}`}
        />
      ))}
    </div>
  );
};

export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClass =
    size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-10 h-10' : size === 'lg' ? 'w-14 h-14' : 'w-20 h-20';

  return <Skeleton variant="circular" className={`${sizeClass} shrink-0 ${className}`} />;
};

export const SkeletonCard: React.FC<{ className?: string; lines?: number }> = ({
  className = '',
  lines = 2,
}) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-5 space-y-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="md" />
        <div className="space-y-1.5 flex-1">
          <Skeleton variant="text" className="h-4 w-1/2" />
          <Skeleton variant="text" className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={lines} />
      <div className="pt-2 flex items-center justify-between">
        <Skeleton variant="rounded" className="h-8 w-24" />
        <Skeleton variant="rounded" className="h-8 w-20" />
      </div>
    </div>
  );
};

export const SkeletonTableRow: React.FC<{ cols?: number; className?: string }> = ({
  cols = 4,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center gap-4 p-4 border-b border-slate-100 dark:border-slate-800/60 ${className}`}
    >
      <SkeletonAvatar size="sm" />
      {Array.from({ length: cols - 1 }).map((_, idx) => (
        <div key={idx} className="flex-1">
          <Skeleton variant="text" className="h-3.5 w-4/5" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonMetric: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="h-3.5 w-24" />
        <Skeleton variant="circular" className="w-7 h-7" />
      </div>
      <Skeleton variant="rounded" className="h-7 w-20" />
      <Skeleton variant="text" className="h-2.5 w-32" />
    </div>
  );
};
