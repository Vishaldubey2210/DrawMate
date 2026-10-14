import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { SkeletonTableRow, Skeleton } from '../../components/ui/Skeleton.js';
import { getLeaderboard } from '../../services/leaderboardService.js';
import { LeaderboardEntry } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Trophy,
  Medal,
  Flame,
  Percent,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Crown,
  Sparkles,
} from 'lucide-react';

export const LeaderboardsPage: React.FC = () => {
  const { user } = useAuth();
  const [category, setCategory] = useState<'score' | 'wins' | 'winRate'>('score');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<LeaderboardEntry | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRankings = async () => {
    try {
      setIsLoading(true);
      const data = await getLeaderboard(category, page, 25);
      setEntries(data.entries);
      setTotalPages(data.totalPages);
      setTotalPlayers(data.total);
      setCurrentUserRank(data.currentUserRank || null);
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [category, page]);

  const getMetricLabel = () => {
    if (category === 'wins') return 'Victories';
    if (category === 'winRate') return 'Win Rate %';
    return 'Total Score';
  };

  const formatValue = (entry: LeaderboardEntry) => {
    if (category === 'wins') return `${entry.wins} wins`;
    if (category === 'winRate') return `${entry.winRate}%`;
    return `${entry.totalScore.toLocaleString()} pts`;
  };

  const topThree = entries.slice(0, 3);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Competitive Leaderboards"
        subtitle="Global rankings computed authoritatively from completed multiplayer match results."
        badge={
          <Badge variant="warning" size="sm">
            <Trophy className="w-3 h-3 text-amber-500 mr-1" />
            Competitive Season 1
          </Badge>
        }
      />

      {/* Category Selection Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        {[
          { id: 'score', label: 'Total Points', icon: Flame },
          { id: 'wins', label: 'Most Victories', icon: Trophy },
          { id: 'winRate', label: 'Highest Win Rate (Min. 3 Matches)', icon: Percent },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = category === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setCategory(tab.id as any);
                setPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Signed-in Player Rank Banner */}
      {currentUserRank && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-indigo-500/10 border border-indigo-200 dark:border-indigo-900/50 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm">
              #{currentUserRank.rank}
            </div>
            <div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                Your Standing
              </p>
              <p className="font-extrabold text-slate-900 dark:text-white text-sm">
                {currentUserRank.displayName} (@{currentUserRank.username})
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="font-black text-sm text-indigo-600 dark:text-indigo-400">
              {formatValue(currentUserRank)}
            </span>
            <p className="text-[10px] text-slate-500">
              {currentUserRank.gamesPlayed} games played
            </p>
          </div>
        </div>
      )}

      {/* Top 3 Podium (Only on page 1) */}
      {page === 1 && topThree.length >= 3 && !isLoading && (
        <div className="grid grid-cols-3 gap-3 pt-2 pb-4">
          {/* 2nd Place */}
          <div className="flex flex-col items-center justify-end p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 text-center space-y-2 order-1">
            <div className="relative">
              <Avatar avatarId={topThree[1].avatar} size="lg" />
              <span className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xs shadow-md">
                2
              </span>
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[120px]">
                {topThree[1].displayName}
              </p>
              <p className="text-[10px] text-slate-400">@{topThree[1].username}</p>
            </div>
            <div className="text-xs font-black text-slate-700 dark:text-slate-300">
              {formatValue(topThree[1])}
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center justify-end p-4 rounded-2xl bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-[#0D121F] border-2 border-amber-400 dark:border-amber-500/50 text-center space-y-2 order-2 -translate-y-2 shadow-lg shadow-amber-500/10">
            <div className="flex items-center gap-1 text-amber-500 font-black text-xs">
              <Crown className="w-4 h-4 fill-amber-500" />
              <span>CHAMPION</span>
            </div>
            <div className="relative">
              <Avatar avatarId={topThree[0].avatar} size="lg" />
              <span className="absolute -top-2 -right-2 flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white font-black text-xs shadow-lg">
                1
              </span>
            </div>
            <div>
              <p className="font-black text-sm text-slate-900 dark:text-white truncate max-w-[120px]">
                {topThree[0].displayName}
              </p>
              <p className="text-[10px] text-slate-400">@{topThree[0].username}</p>
            </div>
            <div className="text-sm font-black text-amber-600 dark:text-amber-400">
              {formatValue(topThree[0])}
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center justify-end p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 text-center space-y-2 order-3">
            <div className="relative">
              <Avatar avatarId={topThree[2].avatar} size="lg" />
              <span className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/60 text-white font-black text-xs shadow-md">
                3
              </span>
            </div>
            <div>
              <p className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[120px]">
                {topThree[2].displayName}
              </p>
              <p className="text-[10px] text-slate-400">@{topThree[2].username}</p>
            </div>
            <div className="text-xs font-black text-slate-700 dark:text-slate-300">
              {formatValue(topThree[2])}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0D121F] overflow-hidden shadow-sm p-2">
          {Array.from({ length: 7 }).map((_, idx) => (
            <SkeletonTableRow key={idx} cols={6} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800">
          <EmptyState
            icon={Trophy}
            title="No Ranked Players Yet"
            description="Play matches in rooms to record scores and establish leaderboard rankings."
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0D121F] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold">
                <tr>
                  <th className="py-3.5 px-4 w-16">Rank</th>
                  <th className="py-3.5 px-4">Player</th>
                  <th className="py-3.5 px-4 text-center">Matches</th>
                  <th className="py-3.5 px-4 text-center">Wins</th>
                  <th className="py-3.5 px-4 text-center">Win Rate</th>
                  <th className="py-3.5 px-4 text-right">{getMetricLabel()}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {entries.map((player) => {
                  const isCurrent = player.userId === user?._id;
                  return (
                    <tr
                      key={player.userId}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                        isCurrent ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-black ${
                            player.rank === 1
                              ? 'text-amber-500'
                              : player.rank === 2
                              ? 'text-slate-400'
                              : player.rank === 3
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          #{player.rank}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar avatarId={player.avatar} size="sm" />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {player.displayName}{' '}
                              {isCurrent && (
                                <span className="text-[10px] text-indigo-500 font-bold">(You)</span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400">@{player.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300">
                        {player.gamesPlayed}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300">
                        {player.wins}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-300 font-semibold">
                        {player.winRate}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-indigo-600 dark:text-indigo-400">
                        {formatValue(player)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
