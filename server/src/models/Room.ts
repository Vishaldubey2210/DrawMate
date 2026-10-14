import mongoose, { Schema, Document } from 'mongoose';

export interface IRoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTimeSeconds: number;
  wordCount: number;
  hints: number;
  wordMode: 'normal' | 'hidden' | 'combination';
  category: string;
  spectatorsAllowed: boolean;
  maxSpectators: number;
  allowLateSpectators: boolean;
  gameMode: 'classic' | 'imposter';
  wordLanguage: 'en' | 'hi' | 'es';
  wordSource: 'builtin' | 'custom' | 'both';
  customWordPackId?: string | null;
}

export interface IRoom extends Document {
  _id: mongoose.Types.ObjectId;
  roomId: string;
  roomCode: string;
  name: string;
  visibility: 'public' | 'private';
  hostId: mongoose.Types.ObjectId;
  status: 'waiting' | 'starting' | 'in_game' | 'closed';
  settings: IRoomSettings;
  currentPlayersCount: number;
  currentSpectatorsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      default: 'Art Battle Room',
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'private',
      index: true,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'starting', 'in_game', 'closed'],
      default: 'waiting',
      index: true,
    },
    settings: {
      maxPlayers: { type: Number, default: 8, min: 2, max: 20 },
      rounds: { type: Number, default: 3, min: 2, max: 10 },
      drawTimeSeconds: { type: Number, default: 80, min: 15, max: 240 },
      wordCount: { type: Number, default: 3, min: 1, max: 5 },
      hints: { type: Number, default: 2, min: 0, max: 5 },
      wordMode: {
        type: String,
        enum: ['normal', 'hidden', 'combination'],
        default: 'normal',
      },
      category: { type: String, default: 'general' },
      spectatorsAllowed: { type: Boolean, default: true },
      maxSpectators: { type: Number, default: 10, min: 0, max: 50 },
      gameMode: {
        type: String,
        enum: ['classic', 'imposter'],
        default: 'classic',
      },
      wordLanguage: {
        type: String,
        enum: ['en', 'hi', 'es'],
        default: 'en',
      },
      wordSource: {
        type: String,
        enum: ['builtin', 'custom', 'both'],
        default: 'builtin',
      },
      customWordPackId: {
        type: String,
        default: null,
      },
    },
    currentPlayersCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    currentSpectatorsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for public room discovery queries
RoomSchema.index({ visibility: 1, status: 1, currentPlayersCount: 1 });

export const Room = mongoose.model<IRoom>('Room', RoomSchema);
