/**
 * Authentication Middleware for Express Backend.
 * Strictly verifies incoming Firebase ID tokens using the Firebase Admin SDK.
 * Establishes the authoritative req.user identity from verified token claims.
 * Safely audits authentication and authorization failures without exposing token values.
 */

import { getAdminAuth, rtdbService } from '../services/rtdbService.js';
import { securityAuditService, AUDIT_EVENT_TYPES } from '../services/securityAuditService.js';

/**
 * Parses and verifies the Firebase ID token in Authorization header.
 * Attaches verified user claims to req.user.
 */
export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      req.user = null;
      return next();
    }

    if (!authHeader.startsWith('Bearer ')) {
      req.user = null;
      securityAuditService.recordAuthFailure(
        req,
        'Authorization header format is invalid (missing Bearer prefix).',
        AUDIT_EVENT_TYPES.AUTH_HEADER_MALFORMED
      ).catch(() => {});
      return next();
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      req.user = null;
      securityAuditService.recordAuthFailure(
        req,
        'Bearer token is empty.',
        AUDIT_EVENT_TYPES.AUTH_HEADER_MALFORMED
      ).catch(() => {});
      return next();
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.warn('⚠️ [authMiddleware] Firebase Admin Auth instance not available. Cannot verify token.');
      req.user = null;
      return next();
    }

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || '',
        emailVerified: Boolean(decodedToken.email_verified),
        token: decodedToken,
        authenticated: true,
      };
    } catch (verifyError) {
      const isExpired = verifyError.code === 'auth/id-token-expired' || verifyError.message?.includes('expired');
      const eventType = isExpired ? AUDIT_EVENT_TYPES.AUTH_TOKEN_EXPIRED : AUDIT_EVENT_TYPES.AUTH_TOKEN_INVALID;

      securityAuditService.recordAuthFailure(
        req,
        isExpired ? 'Token has expired.' : 'Token verification failed.',
        eventType
      ).catch(() => {});

      req.user = null;
    }

    next();
  } catch (error) {
    console.error('🚨 [authMiddleware] Unexpected authentication middleware error:', error.message);
    req.user = null;
    next();
  }
}

/**
 * Strict Route Guard Middleware.
 * Requires a verified, authenticated Firebase user identity.
 * Rejects unauthenticated, expired, or invalid token requests with HTTP 401 Unauthorized.
 */
export function requireAuth(req, res, next) {
  if (!req.user || !req.user.uid || !req.user.authenticated) {
    securityAuditService.recordAuthFailure(
      req,
      'Unauthenticated request to protected route.',
      AUDIT_EVENT_TYPES.AUTH_FAILED
    ).catch(() => {});

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. A valid, unexpired Firebase ID token must be provided in the Authorization header.',
      },
    });
  }
  next();
}

/**
 * Strict Platform Administrator Authorization Middleware.
 * Rejects non-admin users with HTTP 403 Forbidden.
 * Authoritative checks:
 *   1. Verified token email matches server ADMIN_EMAIL environment variable.
 *   2. Server-side RTDB record at users/{uid} has isAdmin: true or role: superadmin/admin.
 */
export async function requirePlatformAdmin(req, res, next) {
  if (!req.user || !req.user.uid || !req.user.authenticated) {
    securityAuditService.recordAuthFailure(
      req,
      'Unauthenticated request to admin route.',
      AUDIT_EVENT_TYPES.AUTH_FAILED
    ).catch(() => {});

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
  }

  try {
    const rawAdminEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL;
    const configuredAdminEmail = rawAdminEmail ? rawAdminEmail.toLowerCase().trim() : null;
    const userEmail = (req.user.email || '').toLowerCase().trim();
    const isEmailVerified = Boolean(req.user.emailVerified);

    // Check 1: Server-side configured admin email (requires verified email)
    if (configuredAdminEmail && userEmail && userEmail === configuredAdminEmail && isEmailVerified) {
      req.user.isPlatformAdmin = true;
      return next();
    }

    // Check 2: Authoritative server-side RTDB profile
    const userProfile = await rtdbService.getData(`users/${req.user.uid}`);
    if (userProfile && (userProfile.isAdmin === true || userProfile.role === 'superadmin' || userProfile.role === 'admin')) {
      req.user.isPlatformAdmin = true;
      return next();
    }

    // Record Security Event: Non-admin attempted privileged admin route
    securityAuditService.recordAuthzDenial(
      req,
      'Authenticated user lacks platform administrator privileges.',
      {
        eventType: AUDIT_EVENT_TYPES.ADMIN_ACCESS_DENIED,
        targetType: 'ADMIN_PORTAL',
        targetId: req.path,
        metadata: {
          attemptedUserUid: req.user.uid,
          attemptedUserEmail: req.user.email,
        },
      }
    ).catch(() => {});

    // Failed closed
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Platform administrator privileges required to perform this action.',
      },
    });
  } catch (error) {
    console.error('🚨 [requirePlatformAdmin] Error checking admin status:', error.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal authorization error.',
      },
    });
  }
}
