import mongoose, { Schema, Document } from 'mongoose';

export interface IReplayEvent {
  type: 'stroke_start' | 'stroke_points' | 'stroke_end' | 'stroke_undo' | 'stroke_clear';
  offsetMs: number;
  data: any;
}

export interface IDrawingReplay extends Document {
  gameId: string;
  roomCode: string;
  roundNumber: number;
  drawerId: string;
  drawerDisplayName: string;
  secretWord: string;
  category: string;
  language: string;
  durationMs: number;
  events: IReplayEvent[];
  createdAt: Date;
}

const DrawingReplaySchema = new Schema<IDrawingReplay>(
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
    drawerId: {
      type: String,
      required: true,
      index: true,
    },
    drawerDisplayName: {
      type: String,
      required: true,
    },
    secretWord: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: 'general',
    },
    language: {
      type: String,
      default: 'en',
    },
    durationMs: {
      type: Number,
      required: true,
    },
    events: [
      {
        type: {
          type: String,
          required: true,
          enum: ['stroke_start', 'stroke_points', 'stroke_end', 'stroke_undo', 'stroke_clear'],
        },
        offsetMs: {
          type: Number,
          required: true,
        },
        data: {
          type: Schema.Types.Mixed,
        },
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

DrawingReplaySchema.index({ gameId: 1, roundNumber: 1 }, { unique: true });

export const DrawingReplay = mongoose.model<IDrawingReplay>('DrawingReplay', DrawingReplaySchema);
