import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  normalizedUsername: string;
  displayName: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  avatar: string;
  bio: string;
  preferredLanguage: string;
  theme: 'light' | 'dark' | 'system';
  role: 'user' | 'moderator' | 'admin';
  notificationPreferences: {
    productUpdates: boolean;
    gameInvites: boolean;
    emailNotifications: boolean;
  };
  profileVisibility: 'public' | 'friends_only' | 'private';
  isOnboarded: boolean;
  isEmailVerified: boolean;
  status: 'active' | 'suspended';
  suspendedUntil?: Date;
  blockedUserIds: string[];
  lastLoginAt?: Date;
  stats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    totalScore: number;
    highestScore: number;
    correctGuesses: number;
    drawingTurns: number;
    currentStreak: number;
    bestStreak: number;
  };
  processedMatchIds: string[];
  createdAt: Date;
  updatedAt: Date;
  toSafeObject(): Record<string, any>;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    normalizedUsername: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: 'avatar-1',
    },
    bio: {
      type: String,
      default: '',
      maxlength: 250,
    },
    preferredLanguage: {
      type: String,
      default: 'en',
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
    },
    notificationPreferences: {
      productUpdates: { type: Boolean, default: true },
      gameInvites: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
    },
    profileVisibility: {
      type: String,
      enum: ['public', 'friends_only', 'private'],
      default: 'public',
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    suspendedUntil: {
      type: Date,
    },
    blockedUserIds: {
      type: [String],
      default: [],
    },
    lastLoginAt: {
      type: Date,
    },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
      totalScore: { type: Number, default: 0 },
      highestScore: { type: Number, default: 0 },
      correctGuesses: { type: Number, default: 0 },
      drawingTurns: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
      bestStreak: { type: Number, default: 0 },
    },
    processedMatchIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ processedMatchIds: 1 });
UserSchema.index({ status: 1, 'stats.totalScore': -1 });
UserSchema.index({ status: 1, 'stats.wins': -1 });
UserSchema.index({ status: 1, 'stats.winRate': -1 });

// Method to strip sensitive fields
UserSchema.methods.toSafeObject = function (): Record<string, any> {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model<IUser>('User', UserSchema);
