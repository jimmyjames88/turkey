import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import wellKnownRoutes from './routes/wellKnown';
import userRoutes from './routes/users';
import { initializeKeyManagement } from './services/keyService';
import { generalRateLimit } from './middleware/rateLimiting';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandling';
import { validateContentType, validateRequestSize } from './middleware/validation';

const app = express();

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

// Global error handler
app.use(globalErrorHandler);

const PORT = config.port;

// Initialize key management
async function startServer() {
  try {
    await initializeKeyManagement();
    
    app.listen(PORT, () => {
      console.log(`🦃 TurKey Auth API running on port ${PORT}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;