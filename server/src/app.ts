import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import socialRoutes from './routes/socialRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import achievementRoutes from './routes/achievementRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import wordPackRoutes from './routes/wordPackRoutes.js';
import replayRoutes from './routes/replayRoutes.js';
import practiceRoutes from './routes/practiceRoutes.js';
import observabilityRoutes from './routes/observabilityRoutes.js';
import { requestLogger } from './middleware/requestLogger.js';

export const app = express();

// Security and utility middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, server-to-server)
      if (!origin) return callback(null, true);

      // In production: strictly allow only configured authoritative CLIENT_URL
      if (ENV.NODE_ENV === 'production') {
        if (origin === ENV.CLIENT_URL) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked: Origin not permitted in production`), false);
      }

      // Non-production development: allow localhost and CLIENT_URL
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin === ENV.CLIENT_URL) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(ENV.COOKIE_SECRET));
app.use(requestLogger);

// Mount modular API routers
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', profileRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/friends', socialRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/word-packs', wordPackRoutes);
app.use('/api/wordpacks', wordPackRoutes);
app.use('/api/replays', replayRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api', observabilityRoutes);

// Structured 404 Fallback for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint '${req.method} ${req.baseUrl || req.originalUrl}' does not exist`,
    statusCode: 404,
    path: req.originalUrl,
    method: req.method,
  });
});

// Production SPA static asset serving
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Centralized error handler
app.use(errorHandler);
