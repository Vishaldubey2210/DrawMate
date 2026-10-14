import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { AppLogo } from '../../components/ui/AppLogo.js';
import { Input } from '../../components/ui/Input.js';
import { PasswordInput } from '../../components/ui/PasswordInput.js';
import { Button } from '../../components/ui/Button.js';
import { Spinner } from '../../components/ui/Spinner.js';
import { User, AlertCircle, ArrowRight, ShieldCheck, UserCheck, Zap, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oneClickTarget, setOneClickTarget] = useState<'admin' | 'player' | null>(null);

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    try {
      setIsLoading(true);
      await login(identifier.trim(), password);
      toast.success('Welcome back! Logged in successfully.');
      navigate(redirectTarget);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillCredentials = (type: 'admin' | 'player') => {
    setError(null);
    if (type === 'admin') {
      setIdentifier('admin@drawmate.app');
      setPassword('Admin@1234');
      toast.info('Admin credentials auto-filled.');
    } else {
      setIdentifier('player@drawmate.app');
      setPassword('Player@1234');
      toast.info('Player credentials auto-filled.');
    }
  };

  const handleOneClickLogin = async (type: 'admin' | 'player') => {
    setError(null);
    const targetEmail = type === 'admin' ? 'admin@drawmate.app' : 'player@drawmate.app';
    const targetPassword = type === 'admin' ? 'Admin@1234' : 'Player@1234';

    setIdentifier(targetEmail);
    setPassword(targetPassword);

    try {
      setOneClickTarget(type);
      await login(targetEmail, targetPassword);
      toast.success(`Logged in successfully as ${type === 'admin' ? 'Admin' : 'Player'}!`);
      navigate(redirectTarget);
    } catch (err: any) {
      setError(err.message || `1-Click ${type} login failed.`);
    } finally {
      setOneClickTarget(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0B0F19]">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-block">
            <AppLogo />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Welcome back, Sketcher!
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Sign in to continue your drawing adventures
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl space-y-6">
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1-Click Demo Accounts Section */}
          <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 to-slate-50 dark:from-indigo-950/30 dark:to-slate-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Quick Demo Access
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">1-Click Fast Login</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Admin Card */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Admin</span>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <button
                    type="button"
                    disabled={oneClickTarget !== null || isLoading}
                    onClick={() => handleOneClickLogin('admin')}
                    className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {oneClickTarget === 'admin' ? (
                      <Spinner size="xs" variant="muted" />
                    ) : (
                      <>
                        <Zap className="w-3 h-3" />
                        1-Click Login
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFillCredentials('admin')}
                    className="w-full text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors py-0.5 cursor-pointer font-medium"
                  >
                    Fill Creds
                  </button>
                </div>
              </div>

              {/* Player Card */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Player</span>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <button
                    type="button"
                    disabled={oneClickTarget !== null || isLoading}
                    onClick={() => handleOneClickLogin('player')}
                    className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {oneClickTarget === 'player' ? (
                      <Spinner size="xs" variant="white" />
                    ) : (
                      <>
                        <Zap className="w-3 h-3" />
                        1-Click Login
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFillCredentials('player')}
                    className="w-full text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors py-0.5 cursor-pointer font-medium"
                  >
                    Fill Creds
                  </button>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username or Email"
              id="login-identifier"
              type="text"
              placeholder="alex or alex@example.com"
              leftIcon={<User className="w-4 h-4" />}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />

            <div>
              <div className="flex items-center justify-between pb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-400 select-none cursor-pointer"
              >
                Remember me on this browser
              </label>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Don't have a DrawMate account?{' '}
              <Link
                to={redirectTarget !== '/dashboard' ? `/register?redirect=${encodeURIComponent(redirectTarget)}` : '/register'}
                className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
