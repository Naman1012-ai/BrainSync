import { Router } from 'express';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

/**
 * Health Check Endpoint
 * GET /api/health
 */
router.get('/health', (req, res) => {
  return successResponse(res, {
    service: 'brainsync-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;
