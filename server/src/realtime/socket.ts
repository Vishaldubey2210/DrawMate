import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware } from './socketAuth.js';
import { registerRoomSocketHandlers } from './socketHandlers.js';
import { registerDrawingSocketHandlers } from './drawing/drawingHandlers.js';
import { registerGameSocketHandlers } from './game/gameHandlers.js';
import { ENV } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { operationalMetrics } from '../services/OperationalMetrics.js';

let activeIO: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return activeIO;
}

export function setupRealtimeServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (ENV.NODE_ENV === 'production') {
          if (origin === ENV.CLIENT_URL) {
            return callback(null, true);
          }
          return callback(new Error('CORS blocked: Origin not permitted in production'), false);
        }
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === ENV.CLIENT_URL) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  activeIO = io;

  // Attach handshake authentication
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    operationalMetrics.recordSocketConnect();
    const userId = socket.data.user?.userId;
    const username = socket.data.user?.username || 'Guest';

    logger.debug(`Socket connected: ${socket.id} (user: ${username} [${userId || 'anon'}])`, undefined, 'Socket');

    if (userId) {
      socket.join(userId);
      socket.join(`user:${userId}`);
    }

    socket.on('disconnect', (reason) => {
      operationalMetrics.recordSocketDisconnect(reason);
      logger.debug(`Socket disconnected: ${socket.id} (${reason})`, undefined, 'Socket');
    });

    registerRoomSocketHandlers(io, socket);
    registerDrawingSocketHandlers(io, socket);
    registerGameSocketHandlers(io, socket);
  });

  return io;
}
