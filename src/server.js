const app = require('./app');
const { PORT } = require('./config/env');
const { connectDatabase } = require('./config/database');
const OutboxService = require('./services/outbox.service');
const mongoose = require('mongoose');

const startServer = async () => {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 BEE Property Service API running on port ${PORT}`);
    console.log(`📚 Interactive Swagger Docs: http://localhost:${PORT}/docs`);
    console.log(`🩺 Health check: http://localhost:${PORT}/health/ready`);
    console.log(`====================================================`);
  });

  // Outbox background processor (every 10 seconds)
  const outboxInterval = setInterval(async () => {
    await OutboxService.processPendingEvents(20);
  }, 10000);

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
    clearInterval(outboxInterval);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await mongoose.connection.close(false);
      console.log('[Database] MongoDB connection closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = { startServer };

