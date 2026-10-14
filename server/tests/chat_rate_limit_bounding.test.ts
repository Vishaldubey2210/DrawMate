import { describe, it, expect, beforeEach } from 'vitest';
import { AIModerationService, MAX_RATE_LIMIT_CAPACITY } from '../src/services/AIModerationService.js';

describe('SE-04: Chat Rate Limit Memory Bounding & Expiry Cleanup', () => {
  beforeEach(() => {
    AIModerationService.resetRateLimits();
  });

  it('1. Normal messaging behavior operates correctly', () => {
    // Single message allowed
    const res1 = AIModerationService.checkChatRateLimit('user1', 'roomA', 'Hello world');
    expect(res1.allowed).toBe(true);

    // Duplicate message rejected
    const res2 = AIModerationService.checkChatRateLimit('user1', 'roomA', 'Hello world');
    expect(res2.allowed).toBe(false);
    expect(res2.error).toContain('Duplicate message ignored');

    // 5 messages limit enforced
    for (let i = 0; i < 4; i++) {
      AIModerationService.checkChatRateLimit('user1', 'roomA', `msg ${i}`);
    }
    const resOver = AIModerationService.checkChatRateLimit('user1', 'roomA', 'excess message');
    expect(resOver.allowed).toBe(false);
    expect(resOver.error).toContain('too quickly');
  });

  it('2. Expired entries are cleaned up and capacity becomes reusable', () => {
    const baseTime = Date.now();

    // Populate 100 entries at baseTime
    for (let i = 0; i < 100; i++) {
      AIModerationService.checkChatRateLimit(`user_${i}`, 'room1', `msg_${i}`);
    }
    expect(AIModerationService.getRateLimitMapSize()).toBe(100);

    // Prune with current time (nothing expired yet, 4s window)
    const prunedEarly = AIModerationService.pruneExpiredRateLimits(baseTime + 1000);
    expect(prunedEarly).toBe(0);
    expect(AIModerationService.getRateLimitMapSize()).toBe(100);

    // Prune with future time (after 4.1s, all 100 expired)
    const prunedLate = AIModerationService.pruneExpiredRateLimits(baseTime + 4100);
    expect(prunedLate).toBe(100);
    expect(AIModerationService.getRateLimitMapSize()).toBe(0);
  });

  it('3. Active entries retain correct counts across prune cycles and cannot be bypassed', () => {
    const now = Date.now();

    // User A sends 5 messages (rate limited)
    for (let i = 0; i < 5; i++) {
      AIModerationService.checkChatRateLimit('userA', 'room1', `msg_${i}`);
    }

    // Active entry exists
    const checkBlockedBefore = AIModerationService.checkChatRateLimit('userA', 'room1', 'more msg');
    expect(checkBlockedBefore.allowed).toBe(false);

    // Simulate cleanup run while User A is still within their 4-second window
    AIModerationService.pruneExpiredRateLimits(now + 1000);

    // User A must STILL be blocked - active entry was NOT evicted
    const checkBlockedAfter = AIModerationService.checkChatRateLimit('userA', 'room1', 'yet another msg');
    expect(checkBlockedAfter.allowed).toBe(false);
    expect(checkBlockedAfter.error).toContain('too quickly');
  });

  it('4. Overflow policy: when map capacity is saturated with active entries, new keys are rejected safely without evicting active users', () => {
    // Fill map up to MAX_RATE_LIMIT_CAPACITY
    for (let i = 0; i < MAX_RATE_LIMIT_CAPACITY; i++) {
      AIModerationService.checkChatRateLimit(`bulk_user_${i}`, 'roomX', `initial_${i}`);
    }
    expect(AIModerationService.getRateLimitMapSize()).toBe(MAX_RATE_LIMIT_CAPACITY);

    // Next brand new user attempting to chat when capacity is full of active unexpired records
    const overflowAttempt = AIModerationService.checkChatRateLimit('overflow_user', 'roomX', 'hello');
    expect(overflowAttempt.allowed).toBe(false);
    expect(overflowAttempt.error).toContain('congested');

    // Existing active user is still tracked and can send messages within their limit
    const existingUserAttempt = AIModerationService.checkChatRateLimit('bulk_user_0', 'roomX', 'second message');
    expect(existingUserAttempt.allowed).toBe(true);

    // Total map size did not exceed MAX_RATE_LIMIT_CAPACITY
    expect(AIModerationService.getRateLimitMapSize()).toBe(MAX_RATE_LIMIT_CAPACITY);
  });

  it('5. Saturated capacity frees up automatically when rate-limit windows expire', () => {
    const baseTime = Date.now();

    // Fill capacity
    for (let i = 0; i < MAX_RATE_LIMIT_CAPACITY; i++) {
      AIModerationService.checkChatRateLimit(`fill_user_${i}`, 'roomY', `msg_${i}`);
    }
    expect(AIModerationService.getRateLimitMapSize()).toBe(MAX_RATE_LIMIT_CAPACITY);

    // Fast forward past expiry window (e.g. 5 seconds later)
    AIModerationService.pruneExpiredRateLimits(baseTime + 5000);
    expect(AIModerationService.getRateLimitMapSize()).toBe(0);

    // New keys are now allowed normally
    const postExpiryUser = AIModerationService.checkChatRateLimit('new_user_post_expiry', 'roomY', 'hello');
    expect(postExpiryUser.allowed).toBe(true);
    expect(AIModerationService.getRateLimitMapSize()).toBe(1);
  });
});
