import React from 'react';
import { AppLogo } from '../ui/AppLogo.js';
import { Heart, Github, Twitter, MessageCircle } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 space-y-3">
            <AppLogo />
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              The modern multiplayer drawing and guessing game built for speed, fun, and community.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
              Platform
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  Game Rooms
                </a>
              </li>
              <li>
                <a href="#how-to-play" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  How It Works
                </a>
              </li>
              <li>
                <a href="/leaderboards" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  Global Leaderboards
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
              Resources
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  FAQ & Support
                </a>
              </li>
              <li>
                <span className="text-slate-400 dark:text-slate-500 cursor-not-allowed">
                  Community Discord (Coming soon)
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
              System Status
            </h4>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Phase 1 Foundation Operational</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Crafted for competitive and casual web multiplayer play.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} DrawMate Gaming SaaS. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer">
              Privacy Policy
            </span>
            <span className="hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer">
              Terms of Service
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
