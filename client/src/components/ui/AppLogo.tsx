import React from 'react';
import { Link } from 'react-router-dom';
import { Paintbrush } from 'lucide-react';

interface AppLogoProps {
  className?: string;
  showText?: boolean;
  linkTo?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = '',
  showText = true,
  linkTo = '/',
}) => {
  const content = (
    <div className={`flex items-center gap-2.5 font-extrabold select-none ${className}`}>
      <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20">
        <Paintbrush className="w-5 h-5 drop-shadow-sm" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white dark:border-slate-900" />
      </div>
      {showText && (
        <span className="text-xl tracking-tight font-extrabold bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400">
          Draw<span className="text-slate-900 dark:text-white">Mate</span>
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return content;
};
