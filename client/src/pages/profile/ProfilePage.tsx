import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { api } from '../../services/api.js';
import { getMyAchievements } from '../../services/achievementService.js';
import { getMyMatches } from '../../services/matchService.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Avatar, AVATAR_PRESETS } from '../../components/ui/Avatar.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Badge } from '../../components/ui/Badge.js';
import { Modal } from '../../components/ui/Modal.js';
import { AchievementItem, MatchResultRecord } from '../../types/index.js';
import {
  User as UserIcon,
  Calendar,
  Shield,
  Edit3,
  CheckCircle2,
  Trophy,
  Globe,
  Lock,
  Flame,
  Zap,
  Target,
  Palette,
  ArrowRight,
  Loader2,
  RotateCcw,
  Users,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { username: paramUsername } = useParams<{ username?: string }>();
  const { user: currentUser, updateUser, refreshUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const isOwnProfile = !paramUsername || paramUsername.toLowerCase() === currentUser?.normalizedUsername;

  // Viewing other user profile state
  const [viewedProfile, setViewedProfile] = useState<any>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(!isOwnProfile);
  const [profilePrivacyState, setProfilePrivacyState] = useState<{ isPrivate: boolean; message?: string }>({ isPrivate: false });

  // Achievements & Recent Matches
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchResultRecord[]>([]);

  // Edit profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('avatar-1');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!isOwnProfile && paramUsername) {
      setIsProfileLoading(true);
      api.get(`/users/${paramUsername.toLowerCase()}`)
        .then((res: any) => {
          if (!isMounted) return;
          if (res.data?.isPrivate) {
            setProfilePrivacyState({ isPrivate: true, message: res.data.profile?.message });
            setViewedProfile(res.data.profile);
          } else {
            setProfilePrivacyState({ isPrivate: false });
            setViewedProfile(res.data.profile);
          }
        })
        .catch(() => {
          if (isMounted) {
            toast.error('Failed to load player profile.');
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsProfileLoading(false);
          }
        });
    } else {
      setViewedProfile(currentUser);
      setIsProfileLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [paramUsername, currentUser, isOwnProfile]);

  useEffect(() => {
    let isMounted = true;
    if (isOwnProfile) {
      getMyAchievements().then((data) => {
        if (isMounted) setAchievements(data.achievements);
      }).catch(() => {});
      getMyMatches({ limit: 4 }).then((data) => {
        if (isMounted) setRecentMatches(data.matches);
      }).catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [isOwnProfile]);

  const activeUser = isOwnProfile ? currentUser : viewedProfile;

  const stats = activeUser?.stats || {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalScore: 0,
    highestScore: 0,
    correctGuesses: 0,
    currentStreak: 0,
    bestStreak: 0,
  };

  const winRate = stats.gamesPlayed > 0 ? (stats.winRate ?? Math.round((stats.wins / stats.gamesPlayed) * 100)) : 0;

  const openEditModal = () => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
      setUsername(currentUser.username);
      setBio(currentUser.bio || '');
      setAvatar(currentUser.avatar || 'avatar-1');
      setEditError(null);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (displayName.trim().length < 2) {
      setEditError('Display name must be at least 2 characters.');
      return;
    }

    try {
      setIsSaving(true);
      if (username.trim().toLowerCase() !== currentUser?.normalizedUsername) {
        await api.patch('/profile/username', { username: username.trim() });
      }

      const res = await api.patch('/profile/me', {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatar,
      });

      if (res.data?.success) {
        updateUser(res.data.user);
        await refreshUser();
        toast.success('Player profile updated successfully!');
        setIsEditModalOpen(false);
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRebuildStats = async () => {
    try {
      const res = await api.post('/users/stats/rebuild');
      if (res.data?.success) {
        toast.success('Statistics recalculated from match history.');
        await refreshUser();
      }
    } catch {
      toast.error('Failed to rebuild statistics.');
    }
  };

  if (isProfileLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
        <span className="text-xs">Loading player profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title={isOwnProfile ? 'Player Profile & Analytics' : `${activeUser?.displayName}'s Profile`}
        subtitle="Comprehensive player stats, competitive streaks, and milestone achievements."
        actions={
          isOwnProfile ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={handleRebuildStats}
              >
                Sync Stats
              </Button>
              <Button
                size="sm"
                leftIcon={<Edit3 className="w-4 h-4" />}
                onClick={openEditModal}
              >
                Edit Profile
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Main Profile Header Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D121F] p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-5">
            <Avatar avatarId={activeUser?.avatar} size="2xl" className="ring-4 ring-indigo-500/20" />
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {activeUser?.displayName}
                </h2>
                <Badge variant="brand" size="sm">
                  @{activeUser?.username}
                </Badge>
                {activeUser?.role && activeUser.role !== 'user' && (
                  <Badge variant="danger" size="sm">
                    {activeUser.role.toUpperCase()}
                  </Badge>
                )}
                {activeUser?.profileVisibility === 'friends_only' ? (
                  <Badge variant="neutral" size="sm">
                    <Users className="w-3 h-3 mr-1 inline" /> Friends Only
                  </Badge>
                ) : activeUser?.profileVisibility === 'private' ? (
                  <Badge variant="neutral" size="sm">
                    <Lock className="w-3 h-3 mr-1 inline" /> Private
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    <Globe className="w-3 h-3 mr-1 inline" /> Public
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl">
                {activeUser?.bio || 'No biography written yet.'}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Joined {new Date(activeUser?.createdAt || Date.now()).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  Status: Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Private Profile Notice */}
        {profilePrivacyState.isPrivate ? (
          <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
            <Lock className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Profile Details Restricted
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {profilePrivacyState.message || 'This player has chosen to keep their statistics and game history private.'}
            </p>
          </div>
        ) : (
          <>
            {/* Lifetime Game Statistics Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-indigo-500" />
                  <span>Authoritative Statistics</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-xs text-slate-400">Total Matches</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {stats.gamesPlayed}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-xs text-slate-400">Victories</p>
                  <p className="text-2xl font-black text-emerald-500 mt-1">{stats.wins}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-xs text-slate-400">Win Rate</p>
                  <p className="text-2xl font-black text-indigo-500 mt-1">{winRate}%</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-xs text-slate-400">Highest Score</p>
                  <p className="text-2xl font-black text-amber-500 mt-1">{stats.highestScore}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-xs text-slate-400">Win Streak (Best)</p>
                  <p className="text-2xl font-black text-violet-500 mt-1">
                    {stats.currentStreak} <span className="text-xs text-slate-400 font-normal">({stats.bestStreak || stats.currentStreak})</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Achievements Showcase (for Own Profile) */}
            {isOwnProfile && achievements.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Unlocked Achievements ({achievements.filter((a) => a.unlocked).length} / {achievements.length})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {achievements.map((ach) => (
                    <div
                      key={ach.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                        ach.unlocked
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div
                        className={`p-2 rounded-xl shrink-0 ${
                          ach.unlocked ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                        }`}
                      >
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {ach.name}
                          </p>
                          {ach.unlocked && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              Unlocked
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                          {ach.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Match History Section */}
            {isOwnProfile && (
              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-indigo-500" />
                    <span>Recent Matches</span>
                  </h3>
                  <Link
                    to="/history"
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <span>View all matches</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {recentMatches.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No matches recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentMatches.map((m) => {
                      const myP = m.players.find((p) => p.userId === currentUser?._id);
                      return (
                        <div
                          key={m.gameId}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs border border-slate-100 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2.5">
                            <Badge variant={myP?.rank === 1 ? 'success' : 'neutral'} size="sm">
                              {myP?.rank === 1 ? 'Victory' : `Rank #${myP?.rank || 2}`}
                            </Badge>
                            <span className="font-bold">Room {m.roomCode}</span>
                            <span className="text-slate-400">• {new Date(m.completedAt).toLocaleDateString()}</span>
                          </div>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {myP?.score || 0} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Profile Modal Dialog */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Player Profile"
        description="Update your display identity and choose a customized avatar."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProfile} className="space-y-5">
          {editError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {editError}
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Choose Avatar
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
              {AVATAR_PRESETS.map((p) => {
                const isSelected = avatar === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAvatar(p.id)}
                    className={`relative p-2 rounded-xl flex flex-col items-center border transition-all ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/50'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <Avatar avatarId={p.id} size="md" />
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            helperText="2-50 characters"
            required
          />

          <Input
            label="Unique Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            helperText="3-30 letters, numbers, and underscores"
            required
          />

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Bio
              </label>
              <span className="text-[11px] text-slate-400">{bio.length} / 250</span>
            </div>
            <textarea
              rows={3}
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
