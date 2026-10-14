import mongoose, { Schema, Document } from 'mongoose';

export interface IMatchPlayer {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  score: number;
  rank: number;
  correctGuesses: number;
  drawingTurns: number;
}

export interface IMatchResult extends Document {
  gameId: string;
  roomCode: string;
  rounds: number;
  category: string;
  players: IMatchPlayer[];
  winner: {
    userId: string;
    displayName: string;
    score: number;
  };
  startedAt: Date;
  completedAt: Date;
  status: 'completed' | 'cancelled';
  statsApplied?: boolean;
  appliedPlayerIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const MatchResultSchema = new Schema<IMatchResult>(
  {
    gameId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    roomCode: {
      type: String,
      required: true,
      index: true,
    },
    rounds: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      default: 'general',
    },
    players: [
      {
        userId: { type: String, required: true },
        username: { type: String, required: true },
        displayName: { type: String, required: true },
        avatar: { type: String, default: 'avatar-1' },
        score: { type: Number, default: 0 },
        rank: { type: Number, default: 1 },
        correctGuesses: { type: Number, default: 0 },
        drawingTurns: { type: Number, default: 0 },
      },
    ],
    winner: {
      userId: { type: String, default: 'none' },
      displayName: { type: String, default: 'None' },
      score: { type: Number, default: 0 },
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled'],
      default: 'completed',
      index: true,
    },
    statsApplied: {
      type: Boolean,
      default: false,
      index: true,
    },
    appliedPlayerIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

MatchResultSchema.index({ 'players.userId': 1, completedAt: -1 });
MatchResultSchema.index({ status: 1, completedAt: -1 });

export const MatchResult = mongoose.model<IMatchResult>('MatchResult', MatchResultSchema);
