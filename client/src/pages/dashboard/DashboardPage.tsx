import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Modal } from '../../components/ui/Modal.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { Skeleton, SkeletonMetric, SkeletonCard } from '../../components/ui/Skeleton.js';
import {
  Gamepad2,
  PlusCircle,
  Users,
  Trophy,
  History,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <Skeleton className="h-10 w-64" variant="text" />
        <Skeleton className="h-44 w-full" variant="rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonMetric key={idx} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      </div>
    );
  }

  const stats = user?.stats || {
    gamesPlayed: 0,
    wins: 0,
    totalScore: 0,
    highestScore: 0,
    correctGuesses: 0,
  };

  const winRate =
    stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title={`Welcome back, ${user?.displayName || 'Artist'}!`}
        subtitle="Track your drawing statistics, jump into rooms, and manage your account."
        badge={
          <Badge variant="brand" size="sm">
            Phase 1 Active
          </Badge>
        }
      />

      {/* Hero Welcome Banner */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar avatarId={user?.avatar} size="xl" className="ring-4 ring-white/20" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black">{user?.displayName}</h2>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">
                  @{user?.username}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-100 max-w-md">
                {user?.bio || 'Passionate doodler ready for the next multiplayer battle.'}
              </p>
              <p className="text-[11px] text-indigo-200 pt-1">
                Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Gamepad2 className="w-4 h-4 text-indigo-600" />}
              onClick={() => navigate('/rooms')}
              className="bg-white text-indigo-900 hover:bg-slate-100 font-bold"
            >
              Play Match
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/profile')}
              className="border-white/30 text-white hover:bg-white/10"
            >
              Edit Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/rooms')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <Badge variant="success" size="sm">
              Live
            </Badge>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Match</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Join an open drawing room or lobby.
          </p>
        </div>

        <div
          onClick={() => navigate('/rooms')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PlusCircle className="w-5 h-5" />
            </div>
            <Badge variant="success" size="sm">
              Live
            </Badge>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create Room</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure round timers, word choices, and room codes.
          </p>
        </div>

        <div
          onClick={() => navigate('/friends')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <Badge variant="brand" size="sm">
              Social
            </Badge>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Invite Friends</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your friends list and send game party invites.
          </p>
        </div>

        <div
          onClick={() => navigate('/profile')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <Badge variant="success" size="sm">
              Ready
            </Badge>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Player Profile</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Change avatar, customize bio, and view account info.
          </p>
        </div>
      </div>

      {/* Honest Statistics Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span>Lifetime Performance</span>
          </h3>
          <span className="text-xs text-slate-400">
            Real data from database (zero-states until first game)
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Matches Played</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {stats.gamesPlayed}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Completed rounds</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Victories</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {stats.wins}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">1st place finishes</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Win Ratio</p>
            <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
              {winRate}%
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Based on matches</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Score</p>
            <p className="text-2xl font-extrabold text-amber-500 mt-1">{stats.totalScore}</p>
            <p className="text-[11px] text-slate-400 mt-1">Points accumulated</p>
          </div>
        </div>
      </div>

      {/* Getting Started Checklist & Recent Matches split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Getting Started Checklist */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Getting Started Checklist</span>
            </h4>
            <Badge variant="brand" size="sm">
              3 of 3
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Account Created</p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                  Unique handle @{user?.username} registered in database.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Avatar Customized</p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                  Selected preset badge active on profile.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs text-indigo-800 dark:text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Multiplayer Engine Active</p>
                <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80">
                  Real-time canvas sync and guessing rooms are fully live!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Matches Empty State */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" />
              <span>Recent Match History</span>
            </h4>
            <span className="text-xs text-slate-400">0 matches logged</span>
          </div>

          <EmptyState
            icon={History}
            title="No matches logged yet"
            description="Play matches in public or private rooms. Completed rounds, word guesses, and final scores will be automatically chronicled here."
            actionText="Join or Create a Room"
            onAction={() => navigate('/rooms')}
          />
        </div>
      </div>
    </div>
  );
};
