import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { initDatabaseIndexes, INDEX_MODELS_INVENTORY } from '../src/scripts/initIndexes.js';
import { EmailVerificationToken } from '../src/models/EmailVerificationToken.js';

describe('SE-05: Database Index Initialization & Integrity Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('1. Model inventory contains exactly 16 required collections including EmailVerificationToken', () => {
    expect(INDEX_MODELS_INVENTORY.length).toBe(16);

    const modelNames = INDEX_MODELS_INVENTORY.map((m) => m.name);
    expect(modelNames).toContain('EmailVerificationToken');
    expect(modelNames).toContain('User');
    expect(modelNames).toContain('MatchResult');
    expect(modelNames).toContain('Room');
    expect(modelNames).toContain('Session');
    expect(modelNames).toContain('PasswordResetToken');
  });

  it('2. initDatabaseIndexes executes successfully across all 16 models on isolated database', async () => {
    await expect(initDatabaseIndexes()).resolves.not.toThrow();
  });

  it('3. EmailVerificationToken has correct TTL index and lookup indexes configured', async () => {
    const indexes = await EmailVerificationToken.collection.indexes();
    const indexNames = indexes.map((i) => i.name);

    // Verify tokenHash lookup index
    expect(indexNames).toContain('tokenHash_1');

    // Verify otpCode lookup index
    expect(indexNames).toContain('otpCode_1');

    // Verify userId lookup index
    expect(indexNames).toContain('userId_1');

    // Verify TTL index on expiresAt with expireAfterSeconds: 0
    const ttlIndex = indexes.find((i) => i.name === 'expiresAt_1');
    expect(ttlIndex).toBeDefined();
    expect(ttlIndex?.expireAfterSeconds).toBe(0);
  });

  it('4. Safe non-destructive behavior: createIndexes does not drop unmodeled/custom indexes', async () => {
    // Create an ad-hoc custom index on collection
    await EmailVerificationToken.collection.createIndex({ used: 1 }, { name: 'custom_dba_used_idx' });
    let indexesBefore = await EmailVerificationToken.collection.indexes();
    expect(indexesBefore.map((i) => i.name)).toContain('custom_dba_used_idx');

    // Re-run initDatabaseIndexes() (which uses model.createIndexes(), not model.syncIndexes())
    await initDatabaseIndexes();

    // Verify custom index was NOT dropped
    let indexesAfter = await EmailVerificationToken.collection.indexes();
    expect(indexesAfter.map((i) => i.name)).toContain('custom_dba_used_idx');

    // Clean up custom index
    await EmailVerificationToken.collection.dropIndex('custom_dba_used_idx');
  });
});
