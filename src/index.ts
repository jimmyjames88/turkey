import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Server } from 'http';
import path from 'path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { config } from './config';
import authRoutes from './routes/auth';
import wellKnownRoutes from './routes/wellKnown';
import userRoutes from './routes/users';
import { initializeKeyManagement } from './services/keyService';
import { testDatabaseConnection, closeDatabaseConnection, db } from './db';
import { generalRateLimit } from './middleware/rateLimiting';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandling';
import { validateContentType, validateRequestSize } from './middleware/validation';
import { requestLoggingMiddleware, errorLoggingMiddleware, logger } from './middleware/logging';

const app = express();

// Logging middleware - should be early in the chain
app.use(requestLoggingMiddleware);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// General rate limiting for all routes
app.use(generalRateLimit);

// Request validation middleware
app.use(validateContentType);
app.use(validateRequestSize()); // Note: calling as function to get middleware

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/users', userRoutes);
app.use('/.well-known', wellKnownRoutes);

// 404 handler
app.use(notFoundHandler);

// Error logging middleware - before global error handler
app.use(errorLoggingMiddleware);

// Global error handler
app.use(globalErrorHandler);

const PORT = config.port;

// Initialize key management
async function startServer() {
  try {
    // Test database connection first
    logger.info('Testing database connection...');
    await testDatabaseConnection();
    
    // Run database migrations
    logger.info('Running database migrations...');
    const migrationsPath = path.join(process.cwd(), 'migrations');
    await migrate(db, { 
      migrationsFolder: migrationsPath
    });
    logger.info('Database migrations completed successfully!');
    
    // Initialize key management
    logger.info('Initializing key management...');
    await initializeKeyManagement();
    
    const server = app.listen(PORT, () => {
      logger.info(`🦃 TurKey Auth API running on port ${PORT}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Log level: ${config.logging.level}`);
      logger.info(`Database connections: ${config.database.minConnections}-${config.database.maxConnections}`);
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown...');
      gracefulShutdown(server);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown...');
      gracefulShutdown(server);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error as Error);
    process.exit(1);
  }
}

// Graceful shutdown function
async function gracefulShutdown(server: Server) {
  logger.info('Starting graceful shutdown...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close database connections
    try {
      await closeDatabaseConnection();
    } catch (error) {
      logger.error('Error closing database connection:', error as Error);
    }
    
    setTimeout(() => {
      logger.info('Graceful shutdown completed');
      process.exit(0);
    }, 1000); // Brief delay to ensure logs are flushed
  });

  // Force shutdown if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Force shutdown due to timeout');
    process.exit(1);
  }, config.shutdown.timeout + 5000);
}

startServer();

export default app;