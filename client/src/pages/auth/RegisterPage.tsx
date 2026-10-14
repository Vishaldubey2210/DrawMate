import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { api } from '../../services/api.js';
import { AppLogo } from '../../components/ui/AppLogo.js';
import { Input } from '../../components/ui/Input.js';
import { PasswordInput } from '../../components/ui/PasswordInput.js';
import { Button } from '../../components/ui/Button.js';
import { User, Mail, AtSign, AlertCircle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Username live availability state
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Debounced username checker
  useEffect(() => {
    let isMounted = true;
    const clean = username.trim();
    if (clean.length < 3) {
      setUsernameStatus({ checking: false });
      return;
    }

    const timer = setTimeout(async () => {
      if (!isMounted) return;
      setUsernameStatus({ checking: true });
      try {
        const res = await api.get(`/profile/check-username?username=${clean}`);
        if (isMounted) {
          setUsernameStatus({
            checking: false,
            available: res.data.available,
            message: res.data.message,
          });
        }
      } catch {
        if (isMounted) {
          setUsernameStatus({ checking: false });
        }
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!termsAccepted) {
      setError('Please accept the Terms of Service to continue.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      await register({
        displayName: displayName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });

      toast.success('Account created! We sent an email verification link and code.');
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your information.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0B0F19] py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-block">
            <AppLogo />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Create Your Player Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Join the game, pick your handle, and start guessing
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl space-y-6">
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Display Name"
              id="register-display-name"
              placeholder="e.g. Alex Painter"
              leftIcon={<User className="w-4 h-4" />}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />

            <div>
              <Input
                label="Unique Username"
                id="register-username"
                placeholder="e.g. alex_draws"
                leftIcon={<AtSign className="w-4 h-4" />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              {username.length >= 3 && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  {usernameStatus.checking ? (
                    <span className="text-slate-400">Checking availability...</span>
                  ) : usernameStatus.available ? (
                    <span className="text-emerald-500 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Username is available!
                    </span>
                  ) : usernameStatus.available === false ? (
                    <span className="text-rose-500 flex items-center gap-1 font-medium">
                      <XCircle className="w-3.5 h-3.5" /> Username is taken
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            <Input
              label="Email Address"
              id="register-email"
              type="email"
              placeholder="alex@example.com"
              leftIcon={<Mail className="w-4 h-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-1.5">
                Password
              </label>
              <PasswordInput
                id="register-password"
                placeholder="••••••••"
                showStrengthMeter
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-1.5">
                Confirm Password
              </label>
              <PasswordInput
                id="register-confirm-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-start pt-1">
              <input
                id="terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-indigo-600 border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                required
              />
              <label
                htmlFor="terms"
                className="ml-2 text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer"
              >
                I agree to the Terms of Service and Privacy Policy
              </label>
            </div>

            <Button
              type="submit"
              className="w-full mt-3"
              size="lg"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create Account
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
