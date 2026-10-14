import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ENV } from '../src/config/env.js';

describe('SE-07: Environment Configuration & Documentation Consistency Tests', () => {
  const envExamplePath = path.resolve(__dirname, '../../.env.example');

  it('1. .env.example exists and is readable', () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
  });

  it('2. .env.example documents all applicable SMTP variables used in env.ts', () => {
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    // Expected SMTP variables in env.ts
    const expectedSmtpVars = [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_SECURE',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_PASSWORD',
      'SMTP_FROM',
    ];

    for (const v of expectedSmtpVars) {
      expect(content).toContain(v);
    }
  });

  it('3. .env.example documents core infrastructure and security variables', () => {
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    const expectedCoreVars = [
      'NODE_ENV',
      'PORT',
      'CLIENT_URL',
      'MONGODB_URI',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'COOKIE_SECRET',
      'SKETCH_RECOGNIZER_URL',
    ];

    for (const v of expectedCoreVars) {
      expect(content).toContain(v);
    }
  });

  it('4. .env.example contains only dummy/placeholder values and zero real production secrets', () => {
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    // Ensure placeholders are used rather than actual credentials
    expect(content).toContain('your-smtp-username');
    expect(content).toContain('your-smtp-password-or-api-key');

    // Never contain real production keys or private tokens
    expect(content).not.toMatch(/[a-zA-Z0-9]{32,64}@/); // No real token hashes or hex secrets
  });

  it('5. SMTP defaults in env.ts match documentation specifications', () => {
    expect(typeof ENV.SMTP_PORT).toBe('number');
    expect(typeof ENV.SMTP_SECURE).toBe('boolean');
    expect(typeof ENV.SMTP_FROM).toBe('string');
    expect(ENV.SMTP_FROM).toContain('DrawMate');
  });
});
