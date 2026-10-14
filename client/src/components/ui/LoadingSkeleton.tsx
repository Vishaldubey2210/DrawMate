import React from 'react';
export * from './Skeleton.js';

export const LoadingSkeleton: React.FC<{
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}> = ({ className = 'h-4 w-full', variant = 'rectangular' }) => {
  const rounded =
    variant === 'circular'
      ? 'rounded-full'
      : variant === 'text'
      ? 'rounded-md'
      : 'rounded-xl';

  return (
    <div
      className={`animate-pulse bg-slate-200/80 dark:bg-slate-800 ${rounded} ${className}`}
    />
  );
};
