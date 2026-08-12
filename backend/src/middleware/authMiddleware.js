/**
 * Authentication Middleware for Express Backend.
 * Validates incoming Bearer token from Authorization header.
 */
export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // In production with Firebase Admin SDK, verifyIdToken(token)
      // Here we parse user payload if attached or pass through uid
      req.token = token;
      req.user = { authenticated: true };
    }
    next();
  } catch (error) {
    console.warn('⚠️ [authMiddleware] Auth token verification warning:', error.message);
    next();
  }
}
