import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { validateEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { MatchResult } from '../models/MatchResult.js';
import { Room } from '../models/Room.js';
import { Session } from '../models/Session.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { Friendship } from '../models/Friendship.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';
import { RoundTelemetry } from '../models/RoundTelemetry.js';
import { CustomWordPack } from '../models/CustomWordPack.js';
import { DrawingReplay } from '../models/DrawingReplay.js';
import { Report } from '../models/Report.js';
import { ProductAnalyticsEvent } from '../models/ProductAnalyticsEvent.js';
import { Feedback } from '../models/Feedback.js';
import { UserAchievement } from '../models/UserAchievement.js';
import { EmailVerificationToken } from '../models/EmailVerificationToken.js';

export const INDEX_MODELS_INVENTORY = [
  { name: 'User', model: User },
  { name: 'MatchResult', model: MatchResult },
  { name: 'Room', model: Room },
  { name: 'Session', model: Session },
  { name: 'PasswordResetToken', model: PasswordResetToken },
  { name: 'EmailVerificationToken', model: EmailVerificationToken },
  { name: 'Friendship', model: Friendship },
  { name: 'Notification', model: Notification },
  { name: 'AuditLog', model: AuditLog },
  { name: 'RoundTelemetry', model: RoundTelemetry },
  { name: 'CustomWordPack', model: CustomWordPack },
  { name: 'DrawingReplay', model: DrawingReplay },
  { name: 'Report', model: Report },
  { name: 'ProductAnalyticsEvent', model: ProductAnalyticsEvent },
  { name: 'Feedback', model: Feedback },
  { name: 'UserAchievement', model: UserAchievement },
];

export async function initDatabaseIndexes(): Promise<void> {
  console.log('[IndexSync] Initializing DrawMate production MongoDB indexes...');

  // Note: We deliberately use model.createIndexes() rather than Model.syncIndexes().
  // syncIndexes() drops existing database indexes that are not declared in the Mongoose schema,
  // which can destructively delete DBA-managed or environment-specific production indexes.
  // createIndexes() is additive and safe.
  for (const { name, model } of INDEX_MODELS_INVENTORY) {
    try {
      await model.createIndexes();
      const indexes = await model.collection.indexes();
      console.log(`[PASS] [${name}] Synchronized ${indexes.length} indexes:`, indexes.map((i) => i.name).join(', '));
    } catch (err: any) {
      console.error(`[FAIL] [${name}] Failed to synchronize indexes:`, err.message);
      throw err;
    }
  }

  console.log('[IndexSync] All production MongoDB indexes verified successfully.');
}

// Run standalone if executed directly
if (process.argv[1]?.endsWith('initIndexes.ts') || process.argv[1]?.endsWith('initIndexes.js')) {
  (async () => {
    try {
      validateEnv();
      await connectDB();
      await initDatabaseIndexes();
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('Fatal index initialization error:', err);
      process.exit(1);
    }
  })();
}
