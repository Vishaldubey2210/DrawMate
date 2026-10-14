import { api } from './api.js';
import { FriendUser, PendingFriendRequest } from '../types/index.js';

export async function getFriends(): Promise<FriendUser[]> {
  const res = await api.get('/friends');
  return res.data.friends || [];
}

export async function getFriendRequests(): Promise<{
  incoming: PendingFriendRequest[];
  outgoing: PendingFriendRequest[];
}> {
  const res = await api.get('/friends/requests');
  return {
    incoming: res.data.incoming || [],
    outgoing: res.data.outgoing || [],
  };
}

export async function sendFriendRequest(recipientId: string): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/friends/request', { recipientId });
  return res.data;
}

export async function respondFriendRequest(
  requestId: string,
  action: 'accept' | 'decline'
): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/friends/respond', { requestId, action });
  return res.data;
}

export async function cancelFriendRequest(requestId: string): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/friends/cancel', { requestId });
  return res.data;
}

export async function removeFriend(id: string): Promise<{ success: boolean; message: string }> {
  const res = await api.delete(`/friends/${id}`);
  return res.data;
}

export async function blockUser(targetUserId: string): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/friends/block', { targetUserId });
  return res.data;
}

export async function unblockUser(targetUserId: string): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/friends/unblock', { targetUserId });
  return res.data;
}

export async function inviteFriend(friendId: string, roomCode: string): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/friends/invite', { friendId, roomCode });
  return res.data;
}

export async function searchUsers(query: string, page = 1): Promise<{
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    bio: string;
    friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
    stats: { gamesPlayed: number; wins: number; totalScore: number };
  }>;
  total: number;
}> {
  const res = await api.get('/friends/search', { params: { q: query, page } });
  return res.data;
}
