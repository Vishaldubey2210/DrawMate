import mongoose, { Schema, Document } from 'mongoose';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface IFriendship extends Document {
  requesterId: string;
  recipientId: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    requesterId: {
      type: String,
      required: true,
      index: true,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
      default: 'pending',
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

FriendshipSchema.index({ requesterId: 1, recipientId: 1 });

export const Friendship = mongoose.model<IFriendship>('Friendship', FriendshipSchema);
