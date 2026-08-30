import { stripPrototypePollution } from '../utils/blueprintPathBuilder.js';

/**
 * Prototype Pollution & Payload Sanitization Middleware.
 * Automatically sanitizes incoming req.body, req.query, and req.params against
 * dangerous object prototype pollution vectors (__proto__, constructor, prototype).
 */
export function sanitizationMiddleware(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = stripPrototypePollution(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = stripPrototypePollution(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = stripPrototypePollution(req.params);
    }
    next();
  } catch (error) {
    console.error('🚨 [sanitizationMiddleware] Error sanitizing request payload:', error.message);
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_PAYLOAD_STRUCTURE',
        message: 'Malformed or prohibited object structure in request.',
      },
    });
  }
}
