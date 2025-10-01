import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import wellKnownRoutes from './routes/wellKnown';
import { initializeKeyManagement } from './services/keyService';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

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
app.use('/.well-known', wellKnownRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'internal_server_error', 
    message: 'Something went wrong' 
  });
});

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