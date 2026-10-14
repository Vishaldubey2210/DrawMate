import mongoose, { Schema, Document } from 'mongoose';

export type FeedbackCategory =
  | 'gameplay_bug'
  | 'drawing_touch'
  | 'connection'
  | 'scoring'
  | 'imposter_mode'
  | 'word_pack'
  | 'ai_practice'
  | 'performance'
  | 'general_suggestion';

export interface IFeedback extends Document {
  userId?: mongoose.Types.ObjectId | null;
  username?: string;
  category: FeedbackCategory;
  description: string;
  appVersion: string;
  gameId?: string;
  roomCode?: string;
  clientDiagnostics?: {
    userAgent?: string;
    screenResolution?: string;
    latencyEstimateMs?: number;
  };
  status: 'new' | 'reviewed' | 'resolved';
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    username: {
      type: String,
      default: 'Anonymous',
    },
    category: {
      type: String,
      required: true,
      enum: [
        'gameplay_bug',
        'drawing_touch',
        'connection',
        'scoring',
        'imposter_mode',
        'word_pack',
        'ai_practice',
        'performance',
        'general_suggestion',
      ],
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 2000,
    },
    appVersion: {
      type: String,
      default: '1.0.0-beta',
    },
    gameId: {
      type: String,
      default: null,
    },
    roomCode: {
      type: String,
      default: null,
    },
    clientDiagnostics: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'resolved'],
      default: 'new',
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

FeedbackSchema.index({ status: 1, createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>('Feedback', FeedbackSchema);
