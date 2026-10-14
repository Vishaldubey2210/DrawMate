import React, { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Badge } from '../../components/ui/Badge.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { SkeletonCard } from '../../components/ui/Skeleton.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.js';
import { ReportModal } from '../../components/moderation/ReportModal.js';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  inviteFriend,
  searchUsers,
} from '../../services/socialService.js';
import { FriendUser, PendingFriendRequest } from '../../types/index.js';
import { useToast } from '../../context/ToastContext.js';
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  UserX,
  Gamepad2,
  ShieldAlert,
  Loader2,
  Circle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const FriendsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingFriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PendingFriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Invite Dialog State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedFriendToInvite, setSelectedFriendToInvite] = useState<FriendUser | null>(null);
  const [inviteRoomCode, setInviteRoomCode] = useState('');

  // Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  // Remove Friend Dialog State
  const [friendToRemove, setFriendToRemove] = useState<FriendUser | null>(null);

  const toast = useToast();

  const isMountedRef = useRef(true);

  const loadSocialData = async () => {
    try {
      setIsLoading(true);
      const [friendsList, reqs] = await Promise.all([
        getFriends(),
        getFriendRequests(),
      ]);
      if (isMountedRef.current) {
        setFriends(friendsList);
        setIncomingRequests(reqs.incoming);
        setOutgoingRequests(reqs.outgoing);
      }
    } catch {
      // Ignored
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadSocialData();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!isMountedRef.current) return;
        setIsSearching(true);
        const data = await searchUsers(searchQuery);
        if (isMountedRef.current) {
          setSearchResults(data.users || []);
        }
      } catch {
        // Ignored
      } finally {
        if (isMountedRef.current) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSendRequest = async (recipientId: string) => {
    try {
      const res = await sendFriendRequest(recipientId);
      if (res.success) {
        toast.success(res.message);
        // Update local search results state
        setSearchResults((prev) =>
          prev.map((u) => (u.id === recipientId ? { ...u, friendshipStatus: 'pending_sent' } : u))
        );
        loadSocialData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send friend request.');
    }
  };

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      const res = await respondFriendRequest(requestId, action);
      if (res.success) {
        toast.success(res.message);
        loadSocialData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process request.');
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const res = await cancelFriendRequest(requestId);
      if (res.success) {
        toast.success(res.message);
        loadSocialData();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel request.');
    }
  };

  const handleRemoveFriend = async () => {
    if (!friendToRemove) return;
    try {
      const res = await removeFriend(friendToRemove.id);
      if (res.success) {
        toast.success('Friend removed.');
        setFriends((prev) => prev.filter((f) => f.id !== friendToRemove.id));
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove friend.');
    } finally {
      setFriendToRemove(null);
    }
  };

  const handleBlockUser = async (targetId: string) => {
    try {
      const res = await blockUser(targetId);
      if (res.success) {
        toast.success('User blocked.');
        loadSocialData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to block user.');
    }
  };

  const handleSendRoomInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendToInvite || !inviteRoomCode.trim()) return;

    try {
      const res = await inviteFriend(selectedFriendToInvite.id, inviteRoomCode.trim().toUpperCase());
      if (res.success) {
        toast.success(res.message || 'Invitation sent!');
        setInviteModalOpen(false);
        setInviteRoomCode('');
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send room invite.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Friends & Social Squad"
        subtitle="Connect with other players, view online presence, and invite friends to private matches."
        badge={
          <Badge variant="brand" size="sm">
            {friends.length} Friends
          </Badge>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'friends'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>My Friends ({friends.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'requests'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Requests</span>
          {incomingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
              {incomingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('search')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'search'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Find Players</span>
        </button>
      </div>

      {/* TAB 1: FRIENDS LIST */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <SkeletonCard key={idx} lines={2} />
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800">
              <EmptyState
                icon={Users}
                title="Your Squad is Empty"
                description="Search for players by username and send friend requests to team up for games."
                actionText="Find Players"
                onAction={() => setActiveTab('search')}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar avatarId={friend.avatar} size="md" />
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                            friend.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                          title={friend.isOnline ? 'Online' : 'Offline'}
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                          {friend.displayName}
                        </h4>
                        <p className="text-xs text-slate-400">@{friend.username}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {friend.stats.wins} wins • {friend.stats.totalScore} pts
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        friend.isOnline
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {friend.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <button
                      onClick={() => {
                        setSelectedFriendToInvite(friend);
                        setInviteModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>Invite</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        title="Report Player"
                        onClick={() => {
                          setReportTarget({ id: friend.id, name: friend.displayName });
                          setReportModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>

                      <button
                        title="Remove Friend"
                        onClick={() => setFriendToRemove(friend)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Incoming */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Incoming Friend Requests ({incomingRequests.length})
            </h3>
            {incomingRequests.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No incoming requests at the moment.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar avatarId={req.sender?.avatar} size="md" />
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-white">
                          {req.sender?.displayName}
                        </p>
                        <p className="text-[11px] text-slate-400">@{req.sender?.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRespondRequest(req.requestId, 'accept')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRespondRequest(req.requestId, 'decline')}
                        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Sent Requests ({outgoingRequests.length})
            </h3>
            {outgoingRequests.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No outgoing pending requests.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200/80 dark:border-slate-800/80 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar avatarId={req.recipient?.avatar} size="md" />
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-white">
                          {req.recipient?.displayName}
                        </p>
                        <p className="text-[11px] text-slate-400">@{req.recipient?.username}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelRequest(req.requestId)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FIND PLAYERS */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or display name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D121F] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {isSearching && (
              <Loader2 className="absolute right-3.5 top-3 w-4 h-4 animate-spin text-indigo-500" />
            )}
          </div>

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No players found matching "{searchQuery}".
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Avatar avatarId={user.avatar} size="md" />
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                      {user.displayName}
                    </h4>
                    <p className="text-[11px] text-slate-400">@{user.username}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {user.stats.wins} wins • {user.stats.totalScore} pts
                    </p>
                  </div>
                </div>

                <div>
                  {user.friendshipStatus === 'accepted' ? (
                    <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Friends
                    </span>
                  ) : user.friendshipStatus === 'pending_sent' ? (
                    <span className="text-[11px] font-medium text-slate-400">Requested</span>
                  ) : user.friendshipStatus === 'pending_received' ? (
                    <button
                      onClick={() => setActiveTab('requests')}
                      className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                    >
                      Respond
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(user.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Friend Modal */}
      {inviteModalOpen && selectedFriendToInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#0D121F] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-900 dark:text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-indigo-500" />
                <span>Invite to Match</span>
              </h3>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Send an instant game invitation to{' '}
              <strong className="text-slate-900 dark:text-white">
                {selectedFriendToInvite.displayName}
              </strong>
              .
            </p>

            <form onSubmit={handleSendRoomInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Room Code (6 Letters)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={inviteRoomCode}
                  onChange={(e) => setInviteRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. DRAW42"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold tracking-widest text-center text-sm uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inviteRoomCode.trim()}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Friend Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!friendToRemove}
        title="Remove Friend"
        message={`Are you sure you want to remove ${friendToRemove?.displayName} (@${friendToRemove?.username}) from your friends squad?`}
        confirmText="Remove Friend"
        isDestructive
        onConfirm={handleRemoveFriend}
        onClose={() => setFriendToRemove(null)}
      />

      {/* Report Modal */}
      {reportModalOpen && reportTarget && (
        <ReportModal
          isOpen={reportModalOpen}
          targetType="user"
          targetId={reportTarget.id}
          targetName={reportTarget.name}
          onClose={() => {
            setReportModalOpen(false);
            setReportTarget(null);
          }}
        />
      )}
    </div>
  );
};
