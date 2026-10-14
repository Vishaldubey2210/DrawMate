import mongoose, { Schema, Document } from 'mongoose';

export interface IRoundTelemetry extends Document {
  gameId: string;
  roomCode: string;
  roundNumber: number;
  word: string;
  category: string;
  language: string;
  declaredDifficulty: 'easy' | 'medium' | 'hard';
  roundDurationSeconds: number;
  timeToFirstCorrectGuessSeconds?: number | null;
  totalGuessesCount: number;
  correctGuessersCount: number;
  incorrectGuessesCount: number;
  timedOut: boolean;
  solved: boolean;
  eligiblePlayersCount: number;
  isAfkSkip: boolean;
  isCancelled: boolean;
  createdAt: Date;
}

const RoundTelemetrySchema = new Schema<IRoundTelemetry>(
  {
    gameId: {
      type: String,
      required: true,
      index: true,
    },
    roomCode: {
      type: String,
      required: true,
      index: true,
    },
    roundNumber: {
      type: Number,
      required: true,
    },
    word: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      required: true,
      default: 'general',
      index: true,
    },
    language: {
      type: String,
      required: true,
      default: 'en',
      index: true,
    },
    declaredDifficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    roundDurationSeconds: {
      type: Number,
      required: true,
      default: 0,
    },
    timeToFirstCorrectGuessSeconds: {
      type: Number,
      default: null,
    },
    totalGuessesCount: {
      type: Number,
      required: true,
      default: 0,
    },
    correctGuessersCount: {
      type: Number,
      required: true,
      default: 0,
    },
    incorrectGuessesCount: {
      type: Number,
      required: true,
      default: 0,
    },
    timedOut: {
      type: Boolean,
      default: false,
    },
    solved: {
      type: Boolean,
      default: false,
      index: true,
    },
    eligiblePlayersCount: {
      type: Number,
      required: true,
      default: 2,
    },
    isAfkSkip: {
      type: Boolean,
      default: false,
    },
    isCancelled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

RoundTelemetrySchema.index({ word: 1, language: 1 });
RoundTelemetrySchema.index({ createdAt: -1 });

export const RoundTelemetry = mongoose.model<IRoundTelemetry>('RoundTelemetry', RoundTelemetrySchema);
