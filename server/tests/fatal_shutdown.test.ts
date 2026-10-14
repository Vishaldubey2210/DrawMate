import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

describe('SE-06: Fatal-Exception & Bounded Shutdown Lifecycle Tests', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/shutdown_fixture.ts');

  it('1. Fatal uncaught exception terminates process with nonzero exit code (1) and logs diagnostic details', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx/esm', fixturePath, 'fatal_exception']);

    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('close', (code) => resolve(code));
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain('[FATAL] Uncaught Exception');
    expect(stderr).toContain('Simulated fatal uncaught error');
  });

  it('2. Normal SIGTERM signal performs graceful shutdown and exits with status 0', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx/esm', fixturePath, 'graceful_sigterm']);

    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.includes('[TEST] Ready for SIGTERM')) {
        child.kill('SIGTERM');
      }
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('close', (code) => resolve(code));
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('[TEST] Graceful shutdown started: SIGTERM');
    expect(stdout).toContain('[TEST] Clean shutdown complete');
  });

  it('3. Repeated fatal exceptions do not start competing shutdowns and exit with status 1', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx/esm', fixturePath, 'repeated_fatal']);

    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('close', (code) => resolve(code));
    });

    expect(exitCode).toBe(1);
    expect(stderr).toContain('[FATAL] Uncaught Exception');
    expect(stderr).toContain('First fatal error');
    expect(stderr).toContain('Secondary exception: Second fatal error');
  });
});
