import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { AppLogo } from '../components/ui/AppLogo.js';
import { Compass, ArrowLeft, Home, Gamepad2, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-[#0B0F19] text-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <AppLogo />
        </div>

        <div className="relative mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-500/10 via-indigo-500/20 to-purple-500/10 border border-indigo-200/80 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xl shadow-indigo-500/5">
          <Compass className="w-12 h-12 stroke-[1.75]" />
          <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-rose-500 text-[10px] font-extrabold text-white tracking-widest uppercase shadow">
            404
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Lost in the Canvas?
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            The page, room, or drawing match you were trying to access does not exist or may have been concluded.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="md"
            className="w-full sm:w-auto"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/dashboard');
              }
            }}
          >
            Go Back
          </Button>

          <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            leftIcon={<Home className="w-4 h-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="w-full sm:w-auto"
            leftIcon={<Gamepad2 className="w-4 h-4" />}
            onClick={() => navigate('/rooms')}
          >
            Find Rooms
          </Button>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span>Double check your room invitation link or room code.</span>
        </div>
      </div>
    </div>
  );
};
