import mongoose, { Schema, Document } from 'mongoose';

export interface IProductAnalyticsEvent extends Document {
  eventName: string;
  timestamp: Date;
  schemaVersion: number;
  userId?: string | null;
  sessionId?: string;
  gameId?: string;
  platform: string;
  appVersion: string;
  properties: Record<string, any>;
  expiresAt: Date;
}

const ProductAnalyticsEventSchema = new Schema<IProductAnalyticsEvent>(
  {
    eventName: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    schemaVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
    },
    gameId: {
      type: String,
      default: null,
      index: true,
    },
    platform: {
      type: String,
      default: 'web',
    },
    appVersion: {
      type: String,
      default: '1.0.0-beta',
    },
    properties: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    expiresAt: {
      type: Date,
      required: true,
      // 30 days TTL retention
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

ProductAnalyticsEventSchema.index({ eventName: 1, timestamp: -1 });

export const ProductAnalyticsEvent = mongoose.model<IProductAnalyticsEvent>(
  'ProductAnalyticsEvent',
  ProductAnalyticsEventSchema
);
