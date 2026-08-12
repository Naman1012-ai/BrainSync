import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './middleware/authMiddleware.js';
import { blueprintRouter } from './routes/blueprintRoutes.js';
import { uploadthingExpressHandler } from './routes/uploadthingRouter.js';

// Resolve current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allows localhost:3000 and deployment frontends
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BrainSync Express Backend API',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/blueprint', blueprintRouter);
app.use('/api/uploadthing', uploadthingExpressHandler);

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 [BrainSync Backend] Express server running at http://localhost:${PORT}`);
  console.log(`⚡ [BrainSync Backend] Gemini AI Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}`);
});

export default app;
