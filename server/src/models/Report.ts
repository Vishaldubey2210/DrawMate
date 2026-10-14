import mongoose, { Schema, Document } from 'mongoose';

export type ReportTargetType = 'user' | 'match' | 'room';
export type ReportCategory = 'inappropriate_content' | 'cheating' | 'harassment' | 'spam' | 'other';
export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export interface IReport extends Document {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  explanation: string;
  status: ReportStatus;
  moderatorNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: {
      type: String,
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      enum: ['user', 'match', 'room'],
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['inappropriate_content', 'cheating', 'harassment', 'spam', 'other'],
      index: true,
    },
    explanation: {
      type: String,
      required: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },
    moderatorNotes: {
      type: String,
      default: '',
    },
    resolvedBy: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

ReportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
