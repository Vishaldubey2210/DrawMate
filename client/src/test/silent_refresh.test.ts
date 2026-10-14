import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, refreshClient } from '../services/api.js';

describe('SE-01: Silent Access-Token Refresh & Request Queueing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    api.defaults.adapter = undefined;
    refreshClient.defaults.adapter = undefined;
  });

  it('1. Normal successful API request succeeds without refresh', async () => {
    localStorage.setItem('drawmate_token', 'valid-token-123');

    api.defaults.adapter = async (config: any) => {
      return {
        status: 200,
        statusText: 'OK',
        data: { success: true, message: 'profile data' },
        headers: {},
        config,
      };
    };

    const res = await api.get('/profile/me');
    expect(res.data.success).toBe(true);
    expect(res.data.message).toBe('profile data');
  });

  it('2. Automatically refreshes on 401 and replays the original request', async () => {
    localStorage.setItem('drawmate_token', 'expired-token');

    let requestCount = 0;
    api.defaults.adapter = async (config: any) => {
      if (requestCount === 0) {
        requestCount++;
        const error: any = new Error('Unauthorized');
        error.config = config;
        error.response = {
          status: 401,
          statusText: 'Unauthorized',
          data: { error: 'jwt expired' },
          headers: {},
          config,
        };
        throw error;
      }

      // Replayed request with new token
      return {
        status: 200,
        statusText: 'OK',
        data: { success: true, profile: 'verified' },
        headers: {},
        config,
      };
    };

    refreshClient.defaults.adapter = async (config: any) => {
      return {
        status: 200,
        statusText: 'OK',
        data: {
          success: true,
          accessToken: 'fresh-new-token-456',
          user: { id: 'u1', username: 'tester' },
        },
        headers: {},
        config,
      };
    };

    const res = await api.get('/profile/me');
    expect(res.data.success).toBe(true);
    expect(res.data.profile).toBe('verified');
    expect(localStorage.getItem('drawmate_token')).toBe('fresh-new-token-456');
  });

  it('3. Multiple simultaneous 401 responses trigger exactly ONE refresh call and resolve all', async () => {
    localStorage.setItem('drawmate_token', 'expired-token');

    let refreshCallCount = 0;
    const initialCallMap = new Map<string, number>();

    api.defaults.adapter = async (config: any) => {
      const count = initialCallMap.get(config.url) || 0;
      initialCallMap.set(config.url, count + 1);

      if (count === 0) {
        const error: any = new Error('Unauthorized');
        error.config = config;
        error.response = {
          status: 401,
          statusText: 'Unauthorized',
          data: { error: 'Token expired' },
          headers: {},
          config,
        };
        throw error;
      }

      return {
        status: 200,
        statusText: 'OK',
        data: { success: true, endpoint: config.url },
        headers: {},
        config,
      };
    };

    refreshClient.defaults.adapter = async (config: any) => {
      refreshCallCount++;
      // Small simulated latency for concurrency queueing
      await new Promise((r) => setTimeout(r, 20));
      return {
        status: 200,
        statusText: 'OK',
        data: {
          success: true,
          accessToken: 'shared-fresh-token-789',
          user: { id: 'u1' },
        },
        headers: {},
        config,
      };
    };

    // Launch 3 simultaneous requests
    const [res1, res2, res3] = await Promise.all([
      api.get('/rooms'),
      api.get('/notifications'),
      api.get('/friends'),
    ]);

    expect(res1.data.endpoint).toBe('/rooms');
    expect(res2.data.endpoint).toBe('/notifications');
    expect(res3.data.endpoint).toBe('/friends');

    // Exactly one refresh call must have occurred
    expect(refreshCallCount).toBe(1);
    expect(localStorage.getItem('drawmate_token')).toBe('shared-fresh-token-789');
  });

  it('4. Refresh failure rejects all queued requests and clears local storage', async () => {
    localStorage.setItem('drawmate_token', 'stale-token');

    api.defaults.adapter = async (config: any) => {
      const error: any = new Error('Unauthorized');
      error.config = config;
      error.response = {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'Invalid token' },
        headers: {},
        config,
      };
      throw error;
    };

    refreshClient.defaults.adapter = async (config: any) => {
      const error: any = new Error('Session Expired');
      error.config = config;
      error.response = {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'Refresh token expired' },
        headers: {},
        config,
      };
      throw error;
    };

    await expect(Promise.all([api.get('/rooms'), api.get('/history')])).rejects.toThrow();

    // Stale token must be evicted on failed refresh
    expect(localStorage.getItem('drawmate_token')).toBeNull();
  });

  it('5. Auth endpoints (login/register) failure do not trigger silent refresh', async () => {
    let refreshTriggered = false;

    api.defaults.adapter = async (config: any) => {
      const error: any = new Error('Invalid credentials');
      error.config = config;
      error.response = {
        status: 401,
        statusText: 'Unauthorized',
        data: { error: 'Invalid username or password' },
        headers: {},
        config,
      };
      throw error;
    };

    refreshClient.defaults.adapter = async (config: any) => {
      refreshTriggered = true;
      return {
        status: 200,
        statusText: 'OK',
        data: { success: true },
        headers: {},
        config,
      };
    };

    await expect(api.post('/auth/login', { identifier: 'bad', password: 'bad' })).rejects.toThrow(
      'Invalid username or password'
    );

    expect(refreshTriggered).toBe(false);
  });
});
