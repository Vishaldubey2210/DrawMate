import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { AppLogo } from '../../components/ui/AppLogo.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { CheckCircle2, AlertCircle, Mail, ArrowRight, Loader2, Sparkles, RefreshCw } from 'lucide-react';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const queryEmail = searchParams.get('email') || '';
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState(user?.email || queryEmail);
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoVerifying, setIsAutoVerifying] = useState(!!token);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  // Auto-verify if token is in query params
  useEffect(() => {
    if (token) {
      const verifyToken = async () => {
        try {
          setIsAutoVerifying(true);
          setError(null);
          const res = await api.post('/auth/verify-email', { token });
          if (res.data.success) {
            setIsSuccess(true);
            if (updateUser) updateUser({ isEmailVerified: true });
            toast.success('Your email address has been successfully verified!');
          }
        } catch (err: any) {
          setError(err.message || 'Verification link expired or invalid.');
        } finally {
          setIsAutoVerifying(false);
        }
      };
      verifyToken();
    }
  }, [token]);

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your account email address.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await api.post('/auth/verify-email', {
        email: email.trim(),
        code: otpCode.trim(),
      });

      if (res.data.success) {
        setIsSuccess(true);
        if (updateUser) updateUser({ isEmailVerified: true });
        toast.success('Email verified successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    const targetEmail = email || user?.email;
    if (!targetEmail) {
      setError('Please provide your email address to receive a verification code.');
      return;
    }

    try {
      setResendLoading(true);
      setError(null);
      const res = await api.post('/auth/resend-verification', { email: targetEmail });
      toast.success(res.data.message || 'A new verification code and link were dispatched!');
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-6">
        <div className="flex justify-center">
          <AppLogo linkTo="/" />
        </div>

        {isAutoVerifying ? (
          <div className="text-center py-8 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
            <h3 className="text-base font-bold">Verifying your DrawMate account...</h3>
            <p className="text-xs text-slate-500">Securing your session and confirming email ownership.</p>
          </div>
        ) : isSuccess ? (
          <div className="text-center py-4 space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Email Verified!</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your DrawMate account is now verified and fully active.
              </p>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="w-4 h-4" />
              <span>Full Access Unlocked: Imposter Mode, Custom Packs & AI Practice</span>
            </div>

            <Button
              className="w-full"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => navigate('/dashboard')}
            >
              Continue to Dashboard
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Verify Your Email</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Check your inbox for the link or enter your 6-digit OTP code below.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <Input
                label="Account Email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[8px] font-mono font-bold text-xl py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <Button type="submit" className="w-full" isLoading={isLoading}>
                Verify My Account
              </Button>
            </form>

            <div className="pt-2 text-center space-y-3">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-center gap-1.5 mx-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resendLoading ? 'animate-spin' : ''}`} />
                <span>Resend Verification Email</span>
              </button>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/register');
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium transition-colors"
                >
                  ← Entered wrong email? Sign out & back to register
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
