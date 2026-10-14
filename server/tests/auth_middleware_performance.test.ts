import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/utils/password.js';

describe('SE-09: Authentication Middleware Performance Evaluation & Measurement', () => {
  let testUser: any;

  beforeAll(async () => {
    await connectDB();
    const pwd = await hashPassword('BenchTest123!');
    testUser = await User.create({
      displayName: 'Bench User',
      username: 'bench_user',
      normalizedUsername: 'bench_user',
      email: 'bench@test.com',
      normalizedEmail: 'bench@test.com',
      passwordHash: pwd,
      status: 'active',
      role: 'user',
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'bench@test.com' });
    await disconnectDB();
  });

  it('1. Measures baseline User.findById() latency (full document hydration)', async () => {
    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await User.findById(testUser._id);
    }

    const totalTimeMs = performance.now() - start;
    const avgLatencyMs = totalTimeMs / iterations;

    console.log(`[Measurement] User.findById() Avg Latency: ${avgLatencyMs.toFixed(3)}ms (Total: ${totalTimeMs.toFixed(2)}ms for ${iterations} lookups)`);
    expect(avgLatencyMs).toBeLessThan(50); // In-memory/local Mongo should be well under 50ms
  });

  it('2. Measures optimized lean query latency with projection', async () => {
    const iterations = 50;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await User.findById(testUser._id)
        .select('_id username email displayName role status suspendedUntil')
        .lean();
    }

    const totalTimeMs = performance.now() - start;
    const avgLatencyMs = totalTimeMs / iterations;

    console.log(`[Measurement] Lean projected query Avg Latency: ${avgLatencyMs.toFixed(3)}ms (Total: ${totalTimeMs.toFixed(2)}ms for ${iterations} lookups)`);
    expect(avgLatencyMs).toBeLessThan(50);
  });

  it('3. Measures concurrent throughput under 100 simultaneous lookups', async () => {
    const concurrentCount = 100;
    const start = performance.now();

    const promises = Array.from({ length: concurrentCount }, () => User.findById(testUser._id).lean());
    const results = await Promise.all(promises);

    const totalTimeMs = performance.now() - start;
    console.log(`[Measurement] 100 concurrent lookups completed in ${totalTimeMs.toFixed(2)}ms (${(totalTimeMs / concurrentCount).toFixed(3)}ms / request)`);

    expect(results.length).toBe(100);
    expect(results[0]?._id).toBeDefined();
  });
});
