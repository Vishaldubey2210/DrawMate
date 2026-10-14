import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomWordPack extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  language: 'en' | 'hi' | 'es';
  category: string;
  words: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomWordPackSchema = new Schema<ICustomWordPack>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'es'],
      default: 'en',
      index: true,
    },
    category: {
      type: String,
      default: 'custom',
    },
    words: {
      type: [String],
      required: true,
      validate: {
        validator: function (v: string[]) {
          return Array.isArray(v) && v.length >= 5 && v.length <= 500;
        },
        message: 'Word pack must contain between 5 and 500 words.',
      },
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CustomWordPackSchema.index({ ownerId: 1, name: 1 });

export const CustomWordPack = mongoose.model<ICustomWordPack>('CustomWordPack', CustomWordPackSchema);
