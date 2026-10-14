import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';
import { useToast } from '../../context/ToastContext.js';
import { api } from '../../services/api.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { PasswordInput } from '../../components/ui/PasswordInput.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
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
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    'general' | 'notifications' | 'privacy' | 'security' | 'danger'
  >('general');

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
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>(
    user?.profileVisibility === 'private' ? 'private' : 'public'
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

  // Handlers
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
        toast.success('Password successfully changed!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);

    if (deletePhrase !== 'delete my account') {
      setDeleteError('Please type "delete my account" exactly.');
      return;
    }

    if (!deletePassword) {
      setDeleteError('Password is required to confirm deletion.');
      return;
    }

    try {
      setIsDeletingAccount(true);
      const res = await api.delete('/settings/account', {
        data: {
          password: deletePassword,
          confirmationPhrase: deletePhrase,
        },
      });

      if (res.data?.success) {
        toast.success('Your account has been deleted permanently.');
        await logout();
        navigate('/');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General & Appearance', icon: Sliders },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'danger', label: 'Danger Zone', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Account Settings"
        subtitle="Manage appearance, notifications, privacy controls, and security credentials."
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Settings Navigation Sidebar */}
        <div className="md:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 space-y-1">
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
          {/* TAB 1: GENERAL & APPEARANCE */}
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
                  ].map((t) => {
                    const IconComp = t.icon;
                    const active = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id as any)}
                        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${
                          active
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-sm ring-2 ring-indigo-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                        <span className="text-xs font-bold">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Interface Language
                </label>
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

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button size="sm" onClick={handleSaveGeneral} isLoading={isSavingGeneral}>
                  Save Preferences
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Notification Preferences
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Choose what alerts and emails you want to receive.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Product Updates & Announcements
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Notifications regarding new platform features, game modes, and new word packs.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.productUpdates}
                    onChange={(e) =>
                      setNotifications({ ...notifications, productUpdates: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Game Room Invitations
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Alerts when friends invite you to join their drawing lobby.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.gameInvites}
                    onChange={(e) =>
                      setNotifications({ ...notifications, gameInvites: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Email Security & Login Notices
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Dispatched when password changes or unusual logins occur.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.emailNotifications}
                    onChange={(e) =>
                      setNotifications({ ...notifications, emailNotifications: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Button size="sm" onClick={handleSaveNotifications} isLoading={isSavingNotifications}>
                  Save Notification Settings
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Profile Visibility & Privacy
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enforced server-side. Control who can inspect your statistics and match history.
                </p>
              </div>

              <div className="space-y-3">
                <div
                  onClick={() => setProfileVisibility('public')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    profileVisibility === 'public'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Public Profile (Recommended)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Other players can view your display name, bio, and match achievements.
                      </p>
                    </div>
                    {profileVisibility === 'public' && (
                      <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                    )}
                  </div>
                </div>

                <div
                  onClick={() => setProfileVisibility('private')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    profileVisibility === 'private'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Private Profile
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Hides your statistics, bio, and win rate from public search and leaderboards.
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

          {/* TAB 4: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Security & Password
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Update your authentication credentials. Hashing is performed securely on the server.
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

                <div className="pt-2 flex justify-end">
                  <Button size="sm" type="submit" isLoading={isChangingPassword}>
                    Update Password
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 5: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-rose-100 dark:border-rose-950/60">
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Danger Zone: Account Deletion</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Permanent removal of your player record, custom avatars, and credentials.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-slate-600 dark:text-slate-300 space-y-3">
                <p>
                  Deleting your DrawMate account cannot be reversed. All data associated with{' '}
                  <strong className="text-slate-900 dark:text-white">@{user?.username}</strong> will be erased immediately and your username will be recycled.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  Delete Account...
                </Button>
              </div>

              {/* Account Deletion Dialog */}
              <ConfirmDialog
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteAccount}
                title="Permanently Delete Account?"
                message="Please confirm that you want to delete your DrawMate profile and credentials."
                requiredPhrase="delete my account"
                confirmText="Permanently Delete"
                isDestructive
                isLoading={isDeletingAccount}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
