import React from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'primary' | 'white' | 'muted' | 'accent' | 'danger';

export interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  label?: string;
}

const SIZE_MAP: Record<SpinnerSize, { dim: string; stroke: number }> = {
  xs: { dim: 'w-3.5 h-3.5', stroke: 3 },
  sm: { dim: 'w-4 h-4', stroke: 3 },
  md: { dim: 'w-6 h-6', stroke: 3.5 },
  lg: { dim: 'w-9 h-9', stroke: 4 },
  xl: { dim: 'w-12 h-12', stroke: 4.5 },
};

const VARIANT_MAP: Record<SpinnerVariant, { track: string; head: string }> = {
  primary: {
    track: 'text-indigo-200/50 dark:text-indigo-950/60',
    head: 'text-indigo-600 dark:text-indigo-400',
  },
  white: {
    track: 'text-white/20',
    head: 'text-white',
  },
  muted: {
    track: 'text-slate-200 dark:text-slate-800',
    head: 'text-slate-500 dark:text-slate-400',
  },
  accent: {
    track: 'text-amber-200/40 dark:text-amber-950/50',
    head: 'text-amber-500 dark:text-amber-400',
  },
  danger: {
    track: 'text-rose-200/40 dark:text-rose-950/50',
    head: 'text-rose-600 dark:text-rose-400',
  },
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className = '',
  label,
}) => {
  const { dim, stroke } = SIZE_MAP[size];
  const { track, head } = VARIANT_MAP[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      <svg
        className={`animate-spin ${dim} shrink-0`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className={track}
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={stroke}
        />
        <path
          className={head}
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && (
        <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>
      )}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );
};

export const LoadingOverlay: React.FC<{
  title?: string;
  description?: string;
  className?: string;
  fullScreen?: boolean;
}> = ({
  title = 'Loading DrawMate...',
  description = 'Connecting to real-time servers',
  className = '',
  fullScreen = false,
}) => {
  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm'
    : 'relative min-h-[220px] w-full rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm';

  return (
    <div className={`flex flex-col items-center justify-center p-6 text-center ${containerClass} ${className}`}>
      <div className="relative mb-4">
        <Spinner size="xl" variant="primary" />
      </div>
      {title && (
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
      )}
      {description && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
          {description}
        </p>
      )}
    </div>
  );
};

export const CircularProgress: React.FC<{
  progress: number; // 0 - 100
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
}> = ({
  progress,
  size = 48,
  strokeWidth = 4,
  className = '',
  showPercentage = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const offset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-indigo-600 dark:text-indigo-400 transition-all duration-300 ease-out"
        />
      </svg>
      {showPercentage && (
        <span className="absolute text-[11px] font-bold text-slate-700 dark:text-slate-200">
          {Math.round(clampedProgress)}%
        </span>
      )}
    </div>
  );
};
