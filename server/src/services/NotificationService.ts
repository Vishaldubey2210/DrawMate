import { Notification, INotification, NotificationType } from '../models/Notification.js';
import { User } from '../models/User.js';
import { getIO } from '../realtime/socket.js';

export interface CreateNotificationParams {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export class NotificationService {
  /**
   * Persists a notification to MongoDB and emits it in real-time over Socket.IO if recipient is connected
   */
  public static async createNotification(
    params: CreateNotificationParams
  ): Promise<INotification | null> {
    try {
      const recipient = await User.findById(params.recipientId);
      if (!recipient) {
        return null;
      }

      // Check notification preferences
      if (params.type === 'game_invite' && !recipient.notificationPreferences.gameInvites) {
        return null;
      }

      const notification = await Notification.create({
        recipientId: params.recipientId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data || {},
        isRead: false,
      });

      // Dispatch real-time socket event if server is active
      const io = getIO();
      if (io) {
        io.to(`user:${params.recipientId}`).emit('notification:new', {
          id: notification._id.toString(),
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        });
      }

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      return null;
    }
  }

  /**
   * Retrieves notifications for a user with pagination and unread counts
   */
  public static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    notifications: INotification[];
    total: number;
    unreadCount: number;
    page: number;
    totalPages: number;
  }> {
    const pageNum = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const skip = (pageNum - 1) * safeLimit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipientId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      Notification.countDocuments({ recipientId: userId }),
      Notification.countDocuments({ recipientId: userId, isRead: false }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page: pageNum,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Marks a single notification as read
   */
  public static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await Notification.updateOne(
      { _id: notificationId, recipientId: userId },
      { $set: { isRead: true } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Marks all unread notifications for a user as read
   */
  public static async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { recipientId: userId, isRead: false },
      { $set: { isRead: true } }
    );
    return result.modifiedCount;
  }
}
