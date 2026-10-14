import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'game_invite'
  | 'match_complete'
  | 'achievement_unlocked'
  | 'security_alert'
  | 'system';

export interface INotification extends Document {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'friend_request',
        'friend_accepted',
        'game_invite',
        'match_complete',
        'achievement_unlocked',
        'security_alert',
        'system',
      ],
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      maxlength: 300,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
