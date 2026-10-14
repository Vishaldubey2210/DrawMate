let isShuttingDown = false;

const handleGracefulShutdown = (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  process.stdout.write(`[TEST] Graceful shutdown started: ${signal}\n`);

  const forceExitTimer = setTimeout(() => {
    process.stderr.write('[TEST] Deadline reached\n');
    process.exit(1);
  }, 1000);
  forceExitTimer.unref();

  setTimeout(() => {
    clearTimeout(forceExitTimer);
    process.stdout.write('[TEST] Clean shutdown complete\n');
    process.exit(0);
  }, 100);
};

const handleFatalException = (error: any, origin = 'uncaughtException') => {
  if (isShuttingDown) {
    process.stderr.write(`[FATAL] Secondary exception: ${error?.message || error}\n`);
    process.exit(1);
  }
  isShuttingDown = true;

  process.stderr.write(`[FATAL] Uncaught Exception (${origin}): ${error?.message || error}\n`);

  const forceExitTimer = setTimeout(() => {
    process.stderr.write('[FATAL] Fatal shutdown deadline reached\n');
    process.exit(1);
  }, 1000);
  forceExitTimer.unref();

  setTimeout(() => {
    clearTimeout(forceExitTimer);
    process.exit(1);
  }, 50);
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('uncaughtException', (err, origin) => handleFatalException(err, origin));

const mode = process.argv[2];
if (mode === 'fatal_exception') {
  setTimeout(() => {
    throw new Error('Simulated fatal uncaught error');
  }, 50);
} else if (mode === 'graceful_sigterm') {
  // Wait to be killed by parent via SIGTERM
  process.stdout.write('[TEST] Ready for SIGTERM\n');
  setInterval(() => {}, 1000);
} else if (mode === 'repeated_fatal') {
  setTimeout(() => {
    try {
      handleFatalException(new Error('First fatal error'));
    } catch {}
    handleFatalException(new Error('Second fatal error'));
  }, 50);
}
