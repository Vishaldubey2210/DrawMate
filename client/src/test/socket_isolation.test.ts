import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as socketService from '../services/socket.js';
import { api } from '../services/api.js';

describe('SE-02: Socket Identity Isolation & Disconnection Across Auth Lifecycles', () => {
  beforeEach(() => {
    localStorage.clear();
    socketService.disconnectSocket();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    socketService.disconnectSocket();
    vi.restoreAllMocks();
  });

  it('1. disconnectSocket cleanly unbinds listeners, disconnects socket, and resets instance', () => {
    localStorage.setItem('drawmate_token', 'token-user-a');
    const socket = socketService.getSocket();
    expect(socket).toBeDefined();

    const disconnectSpy = vi.spyOn(socket, 'disconnect');
    const removeListenersSpy = vi.spyOn(socket, 'removeAllListeners');

    socketService.disconnectSocket();

    expect(removeListenersSpy).toHaveBeenCalled();
    expect(disconnectSpy).toHaveBeenCalled();

    // Next getSocket must create a fresh socket instance
    localStorage.setItem('drawmate_token', 'token-user-b');
    const freshSocket = socketService.getSocket();
    expect(freshSocket).not.toBe(socket);
  });

  it('2. resetSocket disconnects existing socket and creates a fresh instance immediately', () => {
    localStorage.setItem('drawmate_token', 'initial-token');
    const initialSocket = socketService.getSocket();

    const disconnectSpy = vi.spyOn(initialSocket, 'disconnect');
    const newSocket = socketService.resetSocket();

    expect(disconnectSpy).toHaveBeenCalled();
    expect(newSocket).not.toBe(initialSocket);
  });

  it('3. Stale token in socket is not reused when user switches accounts', () => {
    // User A session
    localStorage.setItem('drawmate_token', 'jwt-user-A');
    const socketA = socketService.getSocket();
    expect((socketA.auth as any).token).toBe('jwt-user-A');

    // User A logs out
    socketService.disconnectSocket();
    localStorage.removeItem('drawmate_token');

    // User B logs in
    localStorage.setItem('drawmate_token', 'jwt-user-B');
    const socketB = socketService.getSocket();
    expect((socketB.auth as any).token).toBe('jwt-user-B');
    expect(socketB).not.toBe(socketA);
  });
});
