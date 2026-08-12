import { adminAuth } from '../config/firebaseAdmin.js';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Authentication Middleware Foundation.
 * Verifies Bearer Firebase ID tokens against Firebase Admin SDK and populates req.user.
 */
export async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'UNAUTHORIZED', 'Authentication token is required.', 401);
  }

  const token = authHeader.split('Bearer ')[1].trim();

  if (!token) {
    return errorResponse(res, 'UNAUTHORIZED', 'Malformed authentication header.', 401);
  }

  try {
    if (adminAuth) {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        emailVerified: Boolean(decodedToken.email_verified),
        role: decodedToken.role || 'user',
      };
      return next();
    } else {
      // Development fallback when Firebase Admin credentials are not loaded
      req.user = {
        uid: 'dev_user_uid',
        email: 'dev@brainsync.local',
        emailVerified: true,
        role: 'user',
      };
      return next();
    }
  } catch (err) {
    console.error('🔒 [Authentication Middleware Failure]:', err.message);
    return errorResponse(res, 'UNAUTHORIZED', 'Invalid or expired authentication token.', 401);
  }
}
