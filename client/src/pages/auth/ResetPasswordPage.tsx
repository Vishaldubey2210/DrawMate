import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.js';
import { AppLogo } from '../../components/ui/AppLogo.js';
import { PasswordInput } from '../../components/ui/PasswordInput.js';
import { Button } from '../../components/ui/Button.js';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Missing password reset token in URL.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    try {
      setIsLoading(true);
      await api.post('/auth/reset-password', {
        token,
        newPassword,
        confirmPassword,
      });

      setIsSuccess(true);
      toast.success('Your password has been reset! Please sign in.');
    } catch (err: any) {
      setError(err.message || 'Password reset failed or token expired.');
    } finally {
      setIsLoading(false);
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
            Set New Password
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Choose a strong password for your DrawMate account
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl space-y-6">
          {!token && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs space-y-2">
              <p className="font-semibold">Notice: Invalid Reset Link</p>
              <p>No token was found in the URL. Please request a new password recovery link.</p>
              <Link to="/forgot-password" className="inline-block pt-1 font-bold underline">
                Request new link
              </Link>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Password Updated
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You can now log in securely with your new password.
                </p>
              </div>
              <Button
                size="lg"
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => navigate('/login')}
              >
                Sign In Now
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-1.5">
                    New Password
                  </label>
                  <PasswordInput
                    id="new-password"
                    placeholder="••••••••"
                    showStrengthMeter
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-1.5">
                    Confirm New Password
                  </label>
                  <PasswordInput
                    id="confirm-new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full mt-2"
                  size="lg"
                  isLoading={isLoading}
                  disabled={!token}
                >
                  Save & Update Password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
