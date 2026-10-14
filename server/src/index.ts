import { createServer } from 'http';
import { app } from './app.js';
import { setupRealtimeServer } from './realtime/socket.js';
import { connectDB } from './config/db.js';
import { ENV, validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { seedDemoAccounts } from './services/seedService.js';
import { incidentDiagnosticService } from './services/IncidentDiagnosticService.js';

async function startServer() {
  try {
    validateEnv();
    await connectDB();
    await seedDemoAccounts();

    const httpServer = createServer(app);
    const io = setupRealtimeServer(httpServer);

    const server = httpServer.listen(ENV.PORT, () => {
      logger.info(
        `DrawMate API & Socket.IO server running on port ${ENV.PORT} [${ENV.NODE_ENV}]`,
        undefined,
        'Server'
      );
      logger.info(`Health check available at http://localhost:${ENV.PORT}/api/health`, undefined, 'Server');
    });

    let isShuttingDown = false;

    const handleGracefulShutdown = (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`Received ${signal}. Gracefully stopping server...`, undefined, 'Server');

      // Hard safety deadline: force exit after 5000ms if connections remain unclosed
      const forceExitTimer = setTimeout(() => {
        process.stderr.write(`[Server] Graceful shutdown deadline exceeded (5000ms). Forcing exit.\n`);
        process.exit(1);
      }, 5000);
      forceExitTimer.unref();

      try {
        io.close();
      } catch {}

      server.close(async () => {
        try {
          const { disconnectDB } = await import('./config/db.js');
          await disconnectDB();
        } catch (err) {
          process.stderr.write(`[Server] Error disconnecting DB during shutdown: ${err}\n`);
        }
        clearTimeout(forceExitTimer);
        process.exit(0);
      });
    };

    const handleFatalException = (error: Error, origin = 'uncaughtException') => {
      if (isShuttingDown) {
        process.stderr.write(`[FATAL] Secondary exception during shutdown: ${error?.stack || error}\n`);
        process.exit(1);
      }
      isShuttingDown = true;

      // Synchronous emergency diagnostic output
      const errorMessage = error?.message || String(error);
      const errorStack = error?.stack || '';
      process.stderr.write(`[FATAL] Uncaught Exception (${origin}): ${errorMessage}\n${errorStack}\n`);

      try {
        logger.error(`Fatal Uncaught Exception (${origin}): ${errorMessage}`, error, 'Process');
        incidentDiagnosticService.recordIncident('internal', errorMessage);
      } catch (logErr) {
        process.stderr.write(`[FATAL] Emergency logger failed: ${logErr}\n`);
      }

      // Immediately stop accepting new HTTP or WebSocket connections
      try {
        server.close();
        io.close();
      } catch {}

      // Hard bounded exit timeout (3000ms)
      const forceExitTimer = setTimeout(() => {
        process.stderr.write(`[FATAL] Fatal shutdown deadline reached (3000ms). Terminating process.\n`);
        process.exit(1);
      }, 3000);
      forceExitTimer.unref();

      // Attempt rapid non-blocking DB disconnect before exiting with nonzero status
      (async () => {
        try {
          const { disconnectDB } = await import('./config/db.js');
          await disconnectDB();
        } catch {}
        clearTimeout(forceExitTimer);
        process.exit(1);
      })();
    };

    process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Promise Rejection detected', reason, 'Process');
      incidentDiagnosticService.recordIncident('internal', String(reason?.message || reason));
    });

    process.on('uncaughtException', (error: Error, origin: string) => {
      handleFatalException(error, origin);
    });
  } catch (error) {
    process.stderr.write(`[FATAL] Failed to start server: ${error}\n`);
    logger.error('Fatal: Failed to start server', error, 'Server');
    process.exit(1);
  }
}

startServer();
