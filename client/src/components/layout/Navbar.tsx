import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLogo } from '../ui/AppLogo.js';
import { ThemeToggle } from '../ui/ThemeToggle.js';
import { Button } from '../ui/Button.js';
import { Avatar } from '../ui/Avatar.js';
import { useAuth } from '../../context/AuthContext.js';
import { Menu, X, ArrowRight, LayoutDashboard } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <AppLogo linkTo="/" />
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Features
            </a>
            <a href="#how-to-play" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              How to Play
            </a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              FAQ
            </a>
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <ThemeToggle compact />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<LayoutDashboard className="w-4 h-4" />}
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </Button>
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar avatarId={user.avatar} size="sm" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {user.displayName}
                </span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Log In
              </Button>
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => navigate('/register')}
              >
                Get Started
              </Button>
            </div>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle compact />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F19] px-4 pt-3 pb-6 space-y-4">
          <nav className="flex flex-col space-y-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Features
            </a>
            <a
              href="#how-to-play"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              How to Play
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              FAQ
            </a>
          </nav>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            {isAuthenticated ? (
              <Button
                variant="primary"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                >
                  Log In
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/register');
                  }}
                >
                  Get Started Free
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
