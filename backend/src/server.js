import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeFirebaseAdmin } from './config/firebaseAdmin.js';
import healthRoutes from './routes/healthRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';



// Load Environment Variables from single backend/.env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize Server-Side Firebase Admin SDK
initializeFirebaseAdmin();

// Middleware Pipeline
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' || origin === FRONTEND_URL) {
        return callback(null, true);
      }
      return callback(new Error('CORS Policy Error: Origin not allowed by BrainSync backend.'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// API Base Routes
app.use('/api', healthRoutes);

// 404 Handler for Unknown Routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested endpoint ${req.originalUrl} was not found on BrainSync API server.`,
    },
  });
});

// Centralized Express Error Handler
app.use(errorHandler);

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`🚀 [BrainSync Backend Server Started] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Listening on Port: ${PORT} | Allowed Frontend: ${FRONTEND_URL}`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
});

// Handle Port Conflicts Gracefully
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`🚨 [Port Conflict Error]: Port ${PORT} is already in use by another process.`);
    console.error(`👉 Solution: Terminate the process on port ${PORT} or change PORT in backend/.env.`);
    process.exit(1);
  } else {
    console.error('🚨 [Server Startup Error]:', err);
  }
});

export default app;
