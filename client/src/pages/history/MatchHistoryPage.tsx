import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { SkeletonCard } from '../../components/ui/Skeleton.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { getMyMatches } from '../../services/matchService.js';
import { MatchResultRecord, MatchPlayer } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  History,
  Trophy,
  Calendar,
  Layers,
  Users,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Award,
  Sparkles,
} from 'lucide-react';
import { ReplayViewerModal } from '../../features/replay/ReplayViewerModal.js';

export const MatchHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchResultRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'win' | 'loss' | 'cancelled'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<MatchResultRecord | null>(null);
  const [activeReplayRound, setActiveReplayRound] = useState<number | null>(null);

  const fetchMatches = async () => {
    try {
      setIsLoading(true);
      const params: any = { page, limit: 8 };
      if (activeTab === 'cancelled') {
        params.status = 'cancelled';
      } else if (activeTab === 'win' || activeTab === 'loss') {
        params.status = 'completed';
        params.outcome = activeTab;
      }
      const data = await getMyMatches(params);
      setMatches(data.matches);
      setTotalPages(data.totalPages);
      setTotalMatches(data.total);
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [page, activeTab]);

  const getPlacementBadge = (match: MatchResultRecord) => {
    if (match.status === 'cancelled') {
      return <Badge variant="neutral">Cancelled</Badge>;
    }
    const myRank = match.players.find((p) => p.userId === user?._id)?.rank || 1;
    if (myRank === 1) {
      return (
        <Badge variant="success" className="flex items-center gap-1 font-bold">
          <Trophy className="w-3 h-3 text-amber-500" />
          <span>Victory (1st)</span>
        </Badge>
      );
    }
    return <Badge variant="neutral">Rank #{myRank}</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Match History & Logs"
        subtitle="Authoritative completed match records and performance summaries."
        badge={
          <Badge variant="brand" size="sm">
            {totalMatches} Matches Recorded
          </Badge>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {(['all', 'win', 'loss', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab === 'all' ? 'All Matches' : tab === 'win' ? 'Victories' : tab === 'loss' ? 'Defeats' : 'Cancelled'}
            </button>
          ))}
        </div>
      </div>

      {/* Matches Grid */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonCard key={idx} lines={1} className="py-4" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800">
          <EmptyState
            icon={History}
            title="No Matches Found"
            description="Play games in multiplayer rooms to see your completed match histories recorded here."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => {
            const myPlayer = match.players.find((p) => p.userId === user?._id);
            return (
              <div
                key={match.gameId}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                    <Trophy className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getPlacementBadge(match)}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Room {match.roomCode}
                      </span>
                      <span className="text-[11px] text-slate-400">• {match.category}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(match.completedAt).toLocaleDateString()} {new Date(match.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        {match.rounds} Rounds
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {match.players.length} Players
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {myPlayer && (
                    <div className="text-right">
                      <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                        {myPlayer.score} pts
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {myPlayer.correctGuesses} correct
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedMatch(match)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Details</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0D121F] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>Match Details</span>
                  <Badge variant="brand" size="sm">Room {selectedMatch.roomCode}</Badge>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Completed on {new Date(selectedMatch.completedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Final Player Standings
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                {selectedMatch.players.map((p: MatchPlayer) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-black w-4 text-slate-400">#{p.rank}</span>
                      <Avatar avatarId={p.avatar} size="sm" />
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {p.displayName} {p.userId === user?._id && <span className="text-[10px] text-indigo-500">(You)</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">@{p.username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{p.score} pts</span>
                      <p className="text-[10px] text-slate-400">
                        {p.correctGuesses} guesses • {p.drawingTurns} sketches
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drawing Replays Section */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Drawing Replays</span>
                <span className="text-[10px] text-slate-400 font-normal">Chronological stroke replay</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: selectedMatch.rounds }).map((_, idx) => (
                  <button
                    key={idx + 1}
                    onClick={() => setActiveReplayRound(idx + 1)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Watch Round {idx + 1} Replay</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMatch(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replay Viewer Modal */}
      {activeReplayRound !== null && selectedMatch && (
        <ReplayViewerModal
          gameId={selectedMatch.gameId}
          roundNumber={activeReplayRound}
          onClose={() => setActiveReplayRound(null)}
        />
      )}
    </div>
  );
};
