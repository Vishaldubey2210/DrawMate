import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { useToast } from '../../context/ToastContext.js';
import { api } from '../../services/api.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { PasswordInput } from '../../components/ui/PasswordInput.js';
import { Modal } from '../../components/ui/Modal.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import {
  Sun,
  Moon,
  Monitor,
  Bell,
  Lock,
  ShieldAlert,
  Sliders,
  Check,
  AlertTriangle,
  Globe,
  Mail,
  User as UserIcon,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    'account' | 'general' | 'notifications' | 'privacy' | 'security' | 'danger'
  >('account');

  // Account & Email state
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // General state
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage || 'en');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState({
    productUpdates: user?.notificationPreferences?.productUpdates ?? true,
    gameInvites: user?.notificationPreferences?.gameInvites ?? true,
    emailNotifications: user?.notificationPreferences?.emailNotifications ?? true,
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Privacy state
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'friends_only' | 'private'>(
    (user?.profileVisibility as any) || 'public'
  );
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Security state (password change)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Danger zone state (account deletion)
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handlers
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    if (newEmail.toLowerCase().trim() === user?.email.toLowerCase()) {
      setEmailError('New email cannot be the same as your current email.');
      return;
    }

    if (!emailPassword) {
      setEmailError('Current password is required to update your email.');
      return;
    }

    try {
      setIsUpdatingEmail(true);
      const res = await api.patch('/settings/email', {
        newEmail: newEmail.trim(),
        password: emailPassword,
      });

      if (res.data?.success) {
        toast.success(
          'Email updated! A verification link and code have been sent to your new email.'
        );
        updateUser({
          email: res.data.email || newEmail.trim(),
          isEmailVerified: false,
        });
        setNewEmail('');
        setEmailPassword('');
      }
    } catch (err: any) {
      setEmailError(err.response?.data?.error || err.message || 'Failed to update email.');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || isResendingVerification) return;
    try {
      setIsResendingVerification(true);
      const res = await api.post('/auth/resend-verification', {
        email: user?.email,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Verification email dispatched!');
        setResendCooldown(60);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to resend verification email.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleSaveGeneral = async () => {
    try {
      setIsSavingGeneral(true);
      const res = await api.patch('/settings/preferences', {
        theme,
        preferredLanguage,
      });
      if (res.data?.success) {
        updateUser({ theme, preferredLanguage });
        toast.success('General preferences saved.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save general preferences.');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setIsSavingNotifications(true);
      const res = await api.patch('/settings/notifications', notifications);
      if (res.data?.success) {
        updateUser({ notificationPreferences: notifications });
        toast.success('Notification preferences updated.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notification preferences.');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleSavePrivacy = async () => {
    try {
      setIsSavingPrivacy(true);
      const res = await api.patch('/settings/privacy', { profileVisibility });
      if (res.data?.success) {
        updateUser({ profileVisibility });
        toast.success('Privacy settings saved.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save privacy settings.');
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await api.post('/settings/change-password', {
        currentPassword,
        newPassword,
      });

      if (res.data?.success) {
        toast.success('Password successfully changed! Other active sessions were invalidated.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || err.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (deletePhrase.trim().toLowerCase() !== 'delete my account') {
      setDeleteError('Please type "delete my account" exactly to confirm.');
      return;
    }

    if (!deletePassword) {
      setDeleteError('Your current password is required to delete your account.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      const res = await api.delete('/settings/account', {
        data: {
          password: deletePassword,
          confirmationPhrase: deletePhrase.trim().toLowerCase(),
        },
      });

      if (res.data?.success) {
        toast.success('Your account has been permanently deleted.');
        setIsDeleteModalOpen(false);
        await logout();
        navigate('/');
      }
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || err.message || 'Failed to delete account.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'Account & Email', icon: UserIcon },
    { id: 'general', label: 'General & Appearance', icon: Sliders },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Social', icon: Lock },
    { id: 'security', label: 'Security & Password', icon: ShieldCheck },
    { id: 'danger', label: 'Danger Zone', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Account Settings"
        subtitle="Manage your email, appearance, notifications, privacy controls, and security credentials."
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Settings Navigation Sidebar */}
        <div className="md:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 space-y-1 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    tab.id === 'danger' ? 'text-rose-500' : ''
                  }`}
                />
                <span className={tab.id === 'danger' ? 'text-rose-600 dark:text-rose-400' : ''}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Settings Main Content Area */}
        <div className="md:col-span-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          {/* TAB 1: ACCOUNT & EMAIL */}
          {activeTab === 'account' && (
            <div className="space-y-8">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Account & Primary Email
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Manage your player profile summary and associated email address.
                </p>
              </div>

              {/* Profile Overview Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar avatarId={user?.avatar} size="lg" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {user?.displayName || user?.username}
                      </h4>
                      <Badge variant="brand" size="sm">
                        {user?.role || 'player'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">@{user?.username}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Member since{' '}
                        {user?.createdAt
                          ? new Date(user.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'DrawMate Beta'}
                      </span>
                    </p>
                  </div>
                </div>

                <Link to="/profile">
                  <Button variant="outline" size="sm" className="gap-2">
                    <span>Edit Profile Bio & Avatar</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

              {/* Current Email Status Card */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Primary Email Address
                    </label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 font-mono">
                        {user?.email}
                      </span>
                    </div>
                  </div>

                  <div>
                    {user?.isEmailVerified ? (
                      <Badge variant="success" size="md" className="gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified Account</span>
                      </Badge>
                    ) : (
                      <Badge variant="warning" size="md" className="gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Email Not Verified</span>
                      </Badge>
                    )}
                  </div>
                </div>

                {!user?.isEmailVerified && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p>
                      Your email is unverified. Verify your address to secure your account and recover passwords.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResendVerification}
                        isLoading={isResendingVerification}
                        disabled={resendCooldown > 0}
                        className="text-xs bg-white dark:bg-slate-900"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isResendingVerification ? 'animate-spin' : ''}`} />
                        <span>
                          {resendCooldown > 0 ? `Wait ${resendCooldown}s` : 'Resend Email'}
                        </span>
                      </Button>
                      <Link to="/verify-email">
                        <Button size="sm" variant="primary" className="text-xs">
                          Enter Code
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Change Email Form Card */}
              <div className="space-y-4 pt-2">
                <div className="pb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Change Email Address
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Enter your new email and current password to re-authenticate. A fresh verification email will be sent immediately.
                  </p>
                </div>

                {emailError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
                    {emailError}
                  </div>
                )}

                <form onSubmit={handleUpdateEmail} className="space-y-4">
                  <Input
                    label="New Email Address"
                    type="email"
                    placeholder="new.email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />

                  <PasswordInput
                    label="Confirm With Current Password"
                    placeholder="••••••••"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    required
                  />

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      type="submit"
                      isLoading={isUpdatingEmail}
                      disabled={!newEmail || !emailPassword}
                    >
                      Update Email Address
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL & APPEARANCE */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Appearance & General Preferences
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Customize your platform viewing mode and language.
                </p>
              </div>

              {/* Theme selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Interface Theme
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light', label: 'Light Mode', icon: Sun },
                    { id: 'dark', label: 'Dark Mode', icon: Moon },
                    { id: 'system', label: 'System Theme', icon: Monitor },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id as any)}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold ring-2 ring-indigo-500/20'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <Icon className="w-5 h-5 mb-2" />
                        <span className="text-xs">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Interface Language
                </label>
                <div className="relative">
                  <select
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="en">English (US)</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="es">Español (Spanish)</option>
                    <option value="fr">Français (French)</option>
                    <option value="de">Deutsch (German)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button size="sm" onClick={handleSaveGeneral} isLoading={isSavingGeneral}>
                  Save Preferences
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Notification Preferences
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Choose what email alerts and platform notifications you want to receive.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: 'productUpdates',
                    title: 'Product Updates & Announcements',
                    desc: 'Be the first to learn about new game modes, word packs, and AI enhancements.',
                  },
                  {
                    key: 'gameInvites',
                    title: 'Game Invites & Challenges',
                    desc: 'Receive alerts when friends invite you to custom rooms or tournament lobbies.',
                  },
                  {
                    key: 'emailNotifications',
                    title: 'Account & Security Email Notifications',
                    desc: 'Receive security login alerts and password change confirmations.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-start justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.desc}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={(notifications as any)[item.key]}
                        onChange={(e) =>
                          setNotifications({
                            ...notifications,
                            [item.key]: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveNotifications}
                  isLoading={isSavingNotifications}
                >
                  Save Notification Settings
                </Button>
              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Privacy & Profile Visibility
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Control who can inspect your match statistics, trophies, and bio.
                </p>
              </div>

              <div className="space-y-3">
                <div
                  onClick={() => setProfileVisibility('public')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    profileVisibility === 'public'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Public Profile (Recommended)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Other players can view your display name, bio, leaderboard rank, and match achievements.
                      </p>
                    </div>
                    {profileVisibility === 'public' && (
                      <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setProfileVisibility('friends_only')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    profileVisibility === 'friends_only'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Friends Only
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Only players on your accepted friends list can view your profile details and match history.
                      </p>
                    </div>
                    {profileVisibility === 'friends_only' && (
                      <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setProfileVisibility('private')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    profileVisibility === 'private'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Private Profile
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hides your statistics, bio, and win rate completely from public search and leaderboards.
                      </p>
                    </div>
                    {profileVisibility === 'private' && (
                      <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button size="sm" onClick={handleSavePrivacy} isLoading={isSavingPrivacy}>
                  Save Privacy Mode
                </Button>
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Security & Password Credentials
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Update your authentication credentials. Hashing is performed securely on the server with Argon2/Bcrypt.
                </p>
              </div>

              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <PasswordInput
                  label="Current Password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />

                <PasswordInput
                  label="New Password"
                  placeholder="••••••••"
                  showStrengthMeter
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />

                <PasswordInput
                  label="Confirm New Password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  Changing your password will automatically sign out all your other active sessions across devices for enhanced protection.
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    type="submit"
                    isLoading={isChangingPassword}
                    disabled={!currentPassword || !newPassword || !confirmPassword}
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 6: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-rose-100 dark:border-rose-950/60">
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Danger Zone: Permanent Account Deletion</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Irreversible removal of your player record, custom avatars, match records, and credentials.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-slate-600 dark:text-slate-300 space-y-4">
                <div>
                  <h4 className="font-bold text-rose-700 dark:text-rose-300 text-sm mb-1">
                    Delete DrawMate Account
                  </h4>
                  <p className="leading-relaxed">
                    Once deleted, your account cannot be recovered. All statistics, match history,
                    custom avatars, and friend links associated with{' '}
                    <strong className="text-slate-900 dark:text-white font-mono">@{user?.username}</strong> will be
                    erased permanently and your username will be recycled for other players.
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeleteError(null);
                      setDeletePassword('');
                      setDeletePhrase('');
                      setIsDeleteModalOpen(true);
                    }}
                  >
                    Delete My Account...
                  </Button>
                </div>
              </div>

              {/* Dedicated Account Deletion Modal */}
              <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Permanently Delete Account?"
                maxWidth="md"
              >
                <form onSubmit={handleDeleteAccount} className="space-y-4">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-xs">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                    <div>
                      <p className="font-bold">This action is permanent and cannot be undone.</p>
                      <p className="mt-0.5 text-rose-600/90 dark:text-rose-300/90">
                        You are about to delete the DrawMate account for <strong>{user?.email}</strong> (@{user?.username}).
                      </p>
                    </div>
                  </div>

                  {deleteError && (
                    <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 text-xs font-semibold border border-rose-300 dark:border-rose-800">
                      {deleteError}
                    </div>
                  )}

                  <PasswordInput
                    label="Enter Your Current Password"
                    placeholder="••••••••"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                  />

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Type <strong className="text-rose-600 dark:text-rose-400 font-mono">"delete my account"</strong> to proceed:
                    </label>
                    <input
                      type="text"
                      value={deletePhrase}
                      onChange={(e) => setDeletePhrase(e.target.value)}
                      placeholder="delete my account"
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeleteModalOpen(false)}
                      disabled={isDeletingAccount}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="danger"
                      size="sm"
                      isLoading={isDeletingAccount}
                      disabled={
                        deletePhrase.trim().toLowerCase() !== 'delete my account' ||
                        !deletePassword
                      }
                    >
                      Permanently Delete Account
                    </Button>
                  </div>
                </form>
              </Modal>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;
