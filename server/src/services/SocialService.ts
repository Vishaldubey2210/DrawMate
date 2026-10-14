import { Friendship, IFriendship } from '../models/Friendship.js';
import { User, IUser } from '../models/User.js';
import { NotificationService } from './NotificationService.js';
import { getIO } from '../realtime/socket.js';

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'blocked';
  stats: {
    gamesPlayed: number;
    wins: number;
    totalScore: number;
  };
}

export class SocialService {
  /**
   * Search for other players safely with pagination and exclusion of blocked accounts
   */
  public static async searchUsers(
    queryStr: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ users: UserSearchResult[]; total: number }> {
    const trimmed = (queryStr || '').trim();
    if (!trimmed) {
      return { users: [], total: 0 };
    }

    const currentUser = await User.findById(currentUserId);
    const blockedList = currentUser?.blockedUserIds || [];

    // Escape regex characters
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const filter: any = {
      _id: { $ne: currentUserId, $nin: blockedList },
      status: 'active',
      blockedUserIds: { $ne: currentUserId },
      $or: [{ username: regex }, { displayName: regex }],
    };

    const skip = (page - 1) * limit;

    const [rawUsers, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    // Query active friendships for these users to determine status
    const targetUserIds = rawUsers.map((u) => u._id.toString());
    const friendships = await Friendship.find({
      $or: [
        { requesterId: currentUserId, recipientId: { $in: targetUserIds } },
        { recipientId: currentUserId, requesterId: { $in: targetUserIds } },
      ],
      status: { $in: ['pending', 'accepted'] },
    });

    const friendshipMap = new Map<string, IFriendship>();
    friendships.forEach((f) => {
      const otherId = f.requesterId === currentUserId ? f.recipientId : f.requesterId;
      friendshipMap.set(otherId, f);
    });

    const results: UserSearchResult[] = rawUsers.map((u) => {
      const uId = u._id.toString();
      let status: UserSearchResult['friendshipStatus'] = 'none';

      const f = friendshipMap.get(uId);
      if (f) {
        if (f.status === 'accepted') {
          status = 'accepted';
        } else if (f.requesterId === currentUserId) {
          status = 'pending_sent';
        } else {
          status = 'pending_received';
        }
      }

      return {
        id: uId,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        bio: u.bio,
        friendshipStatus: status,
        stats: {
          gamesPlayed: u.stats.gamesPlayed || 0,
          wins: u.stats.wins || 0,
          totalScore: u.stats.totalScore || 0,
        },
      };
    });

    return { users: results, total };
  }

  /**
   * Initiates a friend request to a target user
   */
  public static async sendFriendRequest(
    requesterId: string,
    recipientId: string
  ): Promise<{ success: boolean; message: string; friendship?: IFriendship }> {
    if (requesterId === recipientId) {
      return { success: false, message: 'You cannot send a friend request to yourself.' };
    }

    const [requester, recipient] = await Promise.all([
      User.findById(requesterId),
      User.findById(recipientId),
    ]);

    if (!recipient || recipient.status !== 'active') {
      return { success: false, message: 'User does not exist or is inactive.' };
    }

    // Check mutual blocking
    if (
      requester?.blockedUserIds?.includes(recipientId) ||
      recipient?.blockedUserIds?.includes(requesterId)
    ) {
      return { success: false, message: 'Unable to send friend request due to user privacy settings.' };
    }

    // Check existing friendship
    const existing = await Friendship.findOne({
      $or: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requester },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return { success: false, message: 'You are already friends with this player.' };
      }
      if (existing.status === 'pending') {
        if (existing.requesterId === requesterId) {
          return { success: false, message: 'Friend request is already pending.' };
        } else {
          // Cross-request: auto-accept!
          existing.status = 'accepted';
          existing.resolvedAt = new Date();
          await existing.save();

          await NotificationService.createNotification({
            recipientId,
            type: 'friend_accepted',
            title: 'Friend Request Accepted',
            message: `${requester?.displayName} accepted your friend request!`,
            data: { friendId: requesterId },
          });

          return { success: true, message: 'Cross-request detected: Friend request accepted!', friendship: existing };
        }
      }

      // Re-use existing declined/cancelled record
      existing.requesterId = requesterId;
      existing.recipientId = recipientId;
      existing.status = 'pending';
      existing.resolvedAt = undefined;
      await existing.save();

      await NotificationService.createNotification({
        recipientId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${requester?.displayName} (@${requester?.username}) sent you a friend request.`,
        data: { requesterId, requestId: existing._id.toString() },
      });

      return { success: true, message: 'Friend request sent.', friendship: existing };
    }

    const newFriendship = await Friendship.create({
      requesterId,
      recipientId,
      status: 'pending',
    });

    await NotificationService.createNotification({
      recipientId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${requester?.displayName} (@${requester?.username}) sent you a friend request.`,
      data: { requesterId, requestId: newFriendship._id.toString() },
    });

    return { success: true, message: 'Friend request sent.', friendship: newFriendship };
  }

  /**
   * Responds to an incoming pending friend request
   */
  public static async respondToFriendRequest(
    userId: string,
    requestId: string,
    action: 'accept' | 'decline'
  ): Promise<{ success: boolean; message: string }> {
    const friendship = await Friendship.findOne({
      _id: requestId,
      recipientId: userId,
      status: 'pending',
    });

    if (!friendship) {
      return { success: false, message: 'Pending friend request not found or already processed.' };
    }

    if (action === 'accept') {
      friendship.status = 'accepted';
      friendship.resolvedAt = new Date();
      await friendship.save();

      const user = await User.findById(userId);
      await NotificationService.createNotification({
        recipientId: friendship.requesterId,
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${user?.displayName || 'A player'} accepted your friend request!`,
        data: { friendId: userId },
      });

      return { success: true, message: 'Friend request accepted.' };
    } else {
      friendship.status = 'declined';
      friendship.resolvedAt = new Date();
      await friendship.save();
      return { success: true, message: 'Friend request declined.' };
    }
  }

  /**
   * Cancels an outgoing pending friend request
   */
  public static async cancelFriendRequest(
    userId: string,
    requestId: string
  ): Promise<{ success: boolean; message: string }> {
    const friendship = await Friendship.findOne({
      _id: requestId,
      requesterId: userId,
      status: 'pending',
    });

    if (!friendship) {
      return { success: false, message: 'Pending request not found.' };
    }

    friendship.status = 'cancelled';
    friendship.resolvedAt = new Date();
    await friendship.save();

    return { success: true, message: 'Friend request cancelled.' };
  }

  /**
   * Removes an existing mutual friendship
   */
  public static async removeFriend(
    userId: string,
    targetUserId: string
  ): Promise<{ success: boolean; message: string }> {
    const result = await Friendship.findOneAndDelete({
      $or: [
        { requesterId: userId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: userId },
      ],
      status: 'accepted',
    });

    if (!result) {
      return { success: false, message: 'Friendship record not found.' };
    }

    return { success: true, message: 'Friend removed successfully.' };
  }

  /**
   * Returns list of friends with presence indicators
   */
  public static async getFriends(userId: string): Promise<
    Array<{
      id: string;
      username: string;
      displayName: string;
      avatar: string;
      bio: string;
      isOnline: boolean;
      friendshipId: string;
      stats: {
        gamesPlayed: number;
        wins: number;
        totalScore: number;
      };
    }>
  > {
    const friendships = await Friendship.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: 'accepted',
    });

    const friendIds = friendships.map((f) =>
      f.requesterId === userId ? f.recipientId : f.requesterId
    );

    const users = await User.find({ _id: { $in: friendIds }, status: 'active' });

    const io = getIO();

    return users.map((u) => {
      const uId = u._id.toString();
      const f = friendships.find(
        (rec) => rec.requesterId === uId || rec.recipientId === uId
      );

      // Check online presence via Socket.IO room membership
      let isOnline = false;
      if (io) {
        const room = io.sockets.adapter.rooms.get(uId);
        isOnline = !!(room && room.size > 0);
      }

      return {
        id: uId,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        bio: u.bio,
        isOnline,
        friendshipId: f?._id.toString() || '',
        stats: {
          gamesPlayed: u.stats.gamesPlayed || 0,
          wins: u.stats.wins || 0,
          totalScore: u.stats.totalScore || 0,
        },
      };
    });
  }

  /**
   * Returns incoming and outgoing pending friend requests
   */
  public static async getPendingRequests(userId: string): Promise<{
    incoming: Array<{
      requestId: string;
      sender: {
        id: string;
        username: string;
        displayName: string;
        avatar: string;
      };
      createdAt: Date;
    }>;
    outgoing: Array<{
      requestId: string;
      recipient: {
        id: string;
        username: string;
        displayName: string;
        avatar: string;
      };
      createdAt: Date;
    }>;
  }> {
    const [incomingRecs, outgoingRecs] = await Promise.all([
      Friendship.find({ recipientId: userId, status: 'pending' }).sort({ createdAt: -1 }),
      Friendship.find({ requesterId: userId, status: 'pending' }).sort({ createdAt: -1 }),
    ]);

    const senderIds = incomingRecs.map((r) => r.requesterId);
    const recipientIds = outgoingRecs.map((r) => r.recipientId);

    const [senders, recipients] = await Promise.all([
      User.find({ _id: { $in: senderIds } }),
      User.find({ _id: { $in: recipientIds } }),
    ]);

    const senderMap = new Map(senders.map((s) => [s._id.toString(), s]));
    const recipientMap = new Map(recipients.map((r) => [r._id.toString(), r]));

    const incoming = incomingRecs.map((rec) => {
      const sender = senderMap.get(rec.requesterId);
      return {
        requestId: rec._id.toString(),
        sender: {
          id: rec.requesterId,
          username: sender?.username || 'Unknown',
          displayName: sender?.displayName || 'Unknown',
          avatar: sender?.avatar || 'avatar-1',
        },
        createdAt: rec.createdAt,
      };
    });

    const outgoing = outgoingRecs.map((rec) => {
      const recipient = recipientMap.get(rec.recipientId);
      return {
        requestId: rec._id.toString(),
        recipient: {
          id: rec.recipientId,
          username: recipient?.username || 'Unknown',
          displayName: recipient?.displayName || 'Unknown',
          avatar: recipient?.avatar || 'avatar-1',
        },
        createdAt: rec.createdAt,
      };
    });

    return { incoming, outgoing };
  }

  /**
   * Blocks another user, clearing any mutual friendships and pending requests
   */
  public static async blockUser(
    userId: string,
    targetUserId: string
  ): Promise<{ success: boolean; message: string }> {
    if (userId === targetUserId) {
      return { success: false, message: 'You cannot block yourself.' };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    if (!user.blockedUserIds.includes(targetUserId)) {
      user.blockedUserIds.push(targetUserId);
      await user.save();
    }

    // Delete or cancel any existing friendship or pending requests
    await Friendship.deleteMany({
      $or: [
        { requesterId: userId, recipientId: targetUserId },
        { requesterId: targetUserId, recipientId: userId },
      ],
    });

    return { success: true, message: 'User has been blocked.' };
  }

  /**
   * Unblocks a previously blocked user
   */
  public static async unblockUser(
    userId: string,
    targetUserId: string
  ): Promise<{ success: boolean; message: string }> {
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    user.blockedUserIds = user.blockedUserIds.filter((id) => id !== targetUserId);
    await user.save();

    return { success: true, message: 'User has been unblocked.' };
  }

  /**
   * Invites a verified friend to a game room
   */
  public static async inviteFriendToRoom(
    inviterId: string,
    friendId: string,
    roomCode: string
  ): Promise<{ success: boolean; message: string }> {
    const areFriends = await Friendship.findOne({
      $or: [
        { requesterId: inviterId, recipientId: friendId },
        { requesterId: friendId, recipientId: inviterId },
      ],
      status: 'accepted',
    });

    if (!areFriends) {
      return { success: false, message: 'You can only invite mutual friends.' };
    }

    const inviter = await User.findById(inviterId);

    const notification = await NotificationService.createNotification({
      recipientId: friendId,
      type: 'game_invite',
      title: 'Game Invitation!',
      message: `${inviter?.displayName || 'Your friend'} invited you to join room ${roomCode}!`,
      data: { roomCode, inviterId },
    });

    if (!notification) {
      return { success: false, message: 'Friend has disabled game invitations.' };
    }

    return { success: true, message: 'Invitation sent to friend!' };
  }
}
