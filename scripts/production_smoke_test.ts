/**
 * DrawMate Production & Staging Smoke Test Suite
 *
 * Can execute against local, staging, or production deployments:
 * Usage:
 *   TARGET_URL=http://localhost:5000 npx tsx scripts/production_smoke_test.ts
 */

const TARGET_URL = (process.env.TARGET_URL || 'http://localhost:5000').replace(/\/$/, '');
const SKETCH_URL = (process.env.SKETCH_RECOGNIZER_URL || 'http://localhost:8000').replace(/\/$/, '');

interface SmokeTestResult {
  name: string;
  category: 'Frontend' | 'Backend' | 'Database' | 'Security' | 'AI';
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: SmokeTestResult[] = [];

async function runCheck(
  name: string,
  category: 'Frontend' | 'Backend' | 'Database' | 'Security' | 'AI',
  fn: () => Promise<string | void>
) {
  const start = Date.now();
  try {
    const details = await fn();
    results.push({
      name,
      category,
      passed: true,
      durationMs: Date.now() - start,
      details: details || undefined,
    });
    console.log(`  [PASS] ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    results.push({
      name,
      category,
      passed: false,
      durationMs: Date.now() - start,
      details: err.message,
    });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

export async function runSmokeTests(): Promise<boolean> {
  console.log(`\n======================================================`);
  console.log(`[Suite] DrawMate Production Smoke Test Suite`);
  console.log(`[Target] Target API Base: ${TARGET_URL}`);
  console.log(`[Target] Target ML Base:  ${SKETCH_URL}`);
  console.log(`======================================================\n`);

  // 1. BACKEND HEALTH & READINESS
  console.log(`[1/5] Backend Health & Readiness Checks:`);
  await runCheck('Liveness Probe (/api/health)', 'Backend', async () => {
    const res = await fetch(`${TARGET_URL}/api/health`);
    if (!res.ok) throw new Error(`Liveness returned HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'healthy') throw new Error(`Unexpected status: ${data.status}`);
    return `Uptime: ${data.uptimeSeconds}s, Memory: ${data.memory?.rssMb}MB`;
  });

  await runCheck('Readiness Probe (/api/health/ready)', 'Database', async () => {
    const res = await fetch(`${TARGET_URL}/api/health/ready`);
    if (!res.ok) throw new Error(`Readiness returned HTTP ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ready' || data.database !== 'connected') {
      throw new Error(`Database not ready: ${JSON.stringify(data)}`);
    }
    return `Database status: ${data.database}`;
  });

  // 2. SECURITY & AUTHENTICATION BOUNDARIES
  console.log(`\n[2/5] Security & Access Control Boundaries:`);
  await runCheck('Protected Resource Rejects Unauthenticated Request', 'Security', async () => {
    const res = await fetch(`${TARGET_URL}/api/profile/me`);
    if (res.status !== 401) throw new Error(`Expected HTTP 401 Unauthorized, received ${res.status}`);
  });

  await runCheck('Invalid Login Handled with Safe Error', 'Security', async () => {
    const res = await fetch(`${TARGET_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'nonexistent@example.com', password: 'wrongpassword123' }),
    });
    if (res.status !== 401) throw new Error(`Expected HTTP 401, received ${res.status}`);
    const data = await res.json();
    if (data.success !== false) throw new Error('Expected success: false');
  });

  await runCheck('Malformed API Route Returns Safe 404', 'Backend', async () => {
    const res = await fetch(`${TARGET_URL}/api/non_existent_endpoint_xyz`);
    if (res.status !== 404) throw new Error(`Expected HTTP 404, received ${res.status}`);
  });

  // 3. FRONTEND SPA ASSET DELIVERY
  console.log(`\n[3/5] Frontend Static Asset Delivery & SPA Routing:`);
  await runCheck('Root HTML Document Loads Successfully', 'Frontend', async () => {
    const res = await fetch(`${TARGET_URL}/`);
    if (!res.ok) throw new Error(`Root URL returned HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
      throw new Error('Response did not contain valid HTML document markup');
    }
  });

  await runCheck('Direct SPA Route Navigation Resolves index.html', 'Frontend', async () => {
    const res = await fetch(`${TARGET_URL}/practice`);
    if (!res.ok) throw new Error(`Direct route returned HTTP ${res.status}`);
    const html = await res.text();
    if (!html.includes('<div id="root">') && !html.includes('<html')) {
      throw new Error('SPA fallback rewrite did not return root template');
    }
  });

  // 4. REALTIME SOCKET.IO HANDSHAKE
  console.log(`\n[4/5] Realtime Socket.IO Handshake:`);
  await runCheck('Socket.IO Polling Handshake Accessible', 'Backend', async () => {
    const res = await fetch(`${TARGET_URL}/socket.io/?EIO=4&transport=polling`);
    if (!res.ok) throw new Error(`Socket.IO handshake returned HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('0{') && !text.includes('sid')) {
      throw new Error('Unexpected Socket.IO handshake response format');
    }
  });

  // 5. OPTIONAL ML / AI SERVICE
  console.log(`\n[5/6] AI & ML Microservice Availability:`);
  await runCheck('Sketch Recognizer Service Health (If Deployed)', 'AI', async () => {
    try {
      const res = await fetch(`${SKETCH_URL}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        return `ML Service Healthy (${data.classesCount || 100} classes)`;
      }
      return `ML Service returned HTTP ${res.status} (Optional service)`;
    } catch {
      return 'ML Service uncontacted (Stand-alone service is optional in minimal deployment)';
    }
  });

  // 6. PHASE 8 OBSERVABILITY & BETA FEATURE FLAGS
  console.log(`\n[6/6] Phase 8 Observability & Beta Rollout Flags:`);
  await runCheck('Public Feature Flags Discovery (/api/features)', 'Backend', async () => {
    const res = await fetch(`${TARGET_URL}/api/features`);
    if (!res.ok) throw new Error(`Features endpoint returned HTTP ${res.status}`);
    const data = await res.json();
    if (!data.flags || typeof data.flags !== 'object') throw new Error('Missing flags object in response');
    return `Beta Flags active: ${Object.keys(data.flags).join(', ')}`;
  });

  await runCheck('Privileged Observability Metrics Rejects Unauthenticated Access', 'Security', async () => {
    const res = await fetch(`${TARGET_URL}/api/admin/metrics/operational`);
    if (res.status !== 401) throw new Error(`Expected HTTP 401 Unauthorized, received ${res.status}`);
  });

  console.log(`\n======================================================`);
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`[Summary] Smoke Test Summary: ${passed}/${total} Passed (${failed} Failed)`);
  console.log(`======================================================\n`);

  return failed === 0;
}

// Standalone execution
if (process.argv[1]?.endsWith('production_smoke_test.ts') || process.argv[1]?.endsWith('production_smoke_test.js')) {
  runSmokeTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal smoke test runner error:', err);
      process.exit(1);
    });
}
