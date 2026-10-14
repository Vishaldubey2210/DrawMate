import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { useToast } from '../../context/ToastContext.js';
import { api } from '../../services/api.js';
import { AppLogo } from '../../components/ui/AppLogo.js';
import { Input } from '../../components/ui/Input.js';
import { Button } from '../../components/ui/Button.js';
import { Avatar, AVATAR_PRESETS } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import {
  User,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Sun,
  Moon,
  Monitor,
  Trophy,
} from 'lucide-react';

export const OnboardingPage: React.FC = () => {
  const { user, updateUser, refreshUser } = useAuth();
  const { setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage || 'en');
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'system'>(
    user?.theme || 'system'
  );
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'avatar-1');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio || '');
      setSelectedAvatar(user.avatar || 'avatar-1');
      setSelectedTheme(user.theme || 'system');
      setPreferredLanguage(user.preferredLanguage || 'en');
    }
  }, [user]);

  const handleNextStep = async () => {
    if (step < 4) {
      // Autosave current step progress to DB
      try {
        await api.patch('/profile/me', {
          displayName,
          bio,
          avatar: selectedAvatar,
          theme: selectedTheme,
          preferredLanguage,
        });
        updateUser({
          displayName,
          bio,
          avatar: selectedAvatar,
          theme: selectedTheme,
          preferredLanguage,
        });
      } catch (e) {
        console.warn('Autosave error', e);
      }
      setStep(step + 1);
    }
  };

  const handleFinish = async () => {
    try {
      setIsSaving(true);
      const res = await api.patch('/profile/me', {
        displayName,
        bio,
        avatar: selectedAvatar,
        theme: selectedTheme,
        preferredLanguage,
        isOnboarded: true,
      });

      if (res.data?.success) {
        updateUser(res.data.user);
        await refreshUser();
        toast.success("Welcome aboard! You're ready to play.");
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize profile setup.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6">
        <AppLogo linkTo="" />
        <Badge variant="brand" size="md">
          Step {step} of 4
        </Badge>
      </div>

      {/* Main Wizard Card */}
      <div className="max-w-2xl w-full mx-auto my-auto">
        {/* Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-8">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 shadow-2xl space-y-8">
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Step 1: Your Player Identity
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  How should other artists and guessers recognize you in game rooms?
                </p>
              </div>

              <div className="space-y-4">
                <Input
                  label="Display Name"
                  placeholder="e.g. Picasso 2.0"
                  leftIcon={<User className="w-4 h-4" />}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  helperText="Visible to everyone during matches and chat."
                  required
                />

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Short Bio
                    </label>
                    <span className="text-[11px] text-slate-400">{bio.length} / 250</span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={250}
                    placeholder="Tell other players a bit about your drawing style or passions..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREFERENCES */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Step 2: Platform Preferences
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Select your interface theme and preferred language.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-2">
                    Interface Theme
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'System', icon: Monitor },
                    ].map((t) => {
                      const IconComp = t.icon;
                      const active = selectedTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTheme(t.id as any);
                            setTheme(t.id as any);
                          }}
                          className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${
                            active
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-sm ring-2 ring-indigo-500/30'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <IconComp className="w-5 h-5" />
                          <span className="text-xs font-bold">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 pb-2">
                    Interface Language
                  </label>
                  <div className="relative">
                    <select
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="en">English (US / Global)</option>
                      <option value="es">Español (Spanish)</option>
                      <option value="fr">Français (French)</option>
                      <option value="de">Deutsch (German)</option>
                      <option value="ja">日本語 (Japanese)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PERSONALIZATION (AVATAR SELECTION) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Step 3: Choose Your Avatar
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Select a distinctive gaming badge for your profile and in-game canvas.
                </p>
              </div>

              {/* Live Preview Display */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <Avatar avatarId={selectedAvatar} size="lg" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Current Selection</p>
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {AVATAR_PRESETS.find((p) => p.id === selectedAvatar)?.name}
                  </h4>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    {displayName || user?.username}
                  </p>
                </div>
              </div>

              {/* Grid of Presets */}
              <div className="grid grid-cols-4 gap-3 sm:gap-4">
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = selectedAvatar === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedAvatar(preset.id)}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-indigo-600 ring-2 ring-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <Avatar avatarId={preset.id} size="md" />
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-2 truncate w-full text-center">
                        {preset.name.split(' ')[0]}
                      </span>
                      {isSelected && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETION */}
          {step === 4 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-8 ring-indigo-50/50 dark:ring-indigo-950/20">
                <Trophy className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  You're all set, {displayName || user?.displayName}!
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Your profile and preferences have been tailored. Enter your dashboard to view player stats or customize your settings.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 max-w-sm mx-auto flex items-center gap-3 text-left">
                <Avatar avatarId={selectedAvatar} size="md" />
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    @{user?.username} • {selectedTheme.toUpperCase()} mode
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Action Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            {step > 1 && step < 4 ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={handleNextStep}
              >
                Continue
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                rightIcon={<Sparkles className="w-4 h-4" />}
                onClick={handleFinish}
                isLoading={isSaving}
              >
                Enter DrawMate Dashboard
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 py-4">
        Need assistance? DrawMate onboarding can be edited anytime in Settings.
      </div>
    </div>
  );
};
