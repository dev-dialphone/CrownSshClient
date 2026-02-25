/**
 * local server entry file, for local development
 */
import './config/loadEnv.js';
import app from './app.js';
import { initWebSocket } from './services/socketService.js';
import connectDB from './config/db.js';
import mongoose from 'mongoose';
import { connection as redisConnection } from './config/redis.js';
import './workers/executionWorker.js';
import './workers/emailWorker.js';
import logger from './utils/logger.js';

/**
 * start server with port
 */
const PORT = process.env.PORT;

// Connect to Database
connectDB();

const server = app.listen(PORT, () => {
  logger.info(`Server ready on port ${PORT}`);
});

initWebSocket(server);

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received. Closing HTTP server...`);

  server.close(async () => {
    logger.info('HTTP server closed. Closing connections...');

    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed.');

      await redisConnection.quit();
      logger.info('Redis connection closed.');

      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown:', err);
      process.exit(1);
    }
  });

  // Force shutdown if taking too long
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;