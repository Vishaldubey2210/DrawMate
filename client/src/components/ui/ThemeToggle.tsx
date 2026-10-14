import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.js';

export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  if (compact) {
    return (
      <button
        onClick={cycleTheme}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={`Current theme: ${theme} (Click to toggle)`}
      >
        {theme === 'light' && <Sun className="w-5 h-5 text-amber-500" />}
        {theme === 'dark' && <Moon className="w-5 h-5 text-indigo-400" />}
        {theme === 'system' && <Monitor className="w-5 h-5 text-slate-400" />}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center rounded-xl p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
      <button
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
          theme === 'light'
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
        }`}
      >
        <Sun className="w-3.5 h-3.5 text-amber-500" />
        <span>Light</span>
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
          theme === 'dark'
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
        }`}
      >
        <Moon className="w-3.5 h-3.5 text-indigo-400" />
        <span>Dark</span>
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
          theme === 'system'
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
        }`}
      >
        <Monitor className="w-3.5 h-3.5" />
        <span>System</span>
      </button>
    </div>
  );
};
