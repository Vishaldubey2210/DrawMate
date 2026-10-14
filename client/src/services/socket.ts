import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  const getStoredToken = () =>
    typeof window !== 'undefined' && window.localStorage
      ? localStorage.getItem('drawmate_token') || ''
      : '';

  if (!socketInstance) {
    const token = getStoredToken();
    const socketUrl = (import.meta as any).env?.VITE_SOCKET_URL || '/';

    socketInstance = io(socketUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected with ID:', socketInstance?.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });
  }

  // If token changed, update handshake auth
  const currentToken = getStoredToken();
  if (socketInstance.auth && (socketInstance.auth as any).token !== currentToken) {
    (socketInstance.auth as any).token = currentToken;
  }

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    try {
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    } catch (e) {
      console.warn('[Socket.IO] Error during socket disconnection:', e);
    } finally {
      socketInstance = null;
    }
  }
}

export function resetSocket(): Socket {
  disconnectSocket();
  return getSocket();
}
