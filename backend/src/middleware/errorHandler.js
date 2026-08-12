import { errorResponse } from '../utils/apiResponse.js';

/**
 * Centralized Express Error Handling Middleware.
 * Prevents stack traces, Firebase internal errors, or API keys from leaking to users.
 */
export function errorHandler(err, req, res, _next) {
  console.error(`🚨 [Express Error Handler] Path: ${req.originalUrl} | Method: ${req.method} | Error:`, err.message || err);

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  const errorMessage = err.isPublic ? err.message : 'An unexpected server error occurred. Please try again later.';

  return errorResponse(res, errorCode, errorMessage, statusCode);
}
