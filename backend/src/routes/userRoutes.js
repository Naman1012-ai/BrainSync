/**
 * Express Router for User Account Management & Self-Service Operations.
 * Strictly protected by requireAuth middleware.
 * All mutations are executed via Firebase Admin SDK using verified token identity (req.user.uid).
 */

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { accountDeletionService } from '../services/accountDeletionService.js';
import { highCostRateLimiter } from '../middleware/rateLimitMiddleware.js';
import { securityAuditService, AUDIT_CATEGORIES, AUDIT_EVENT_TYPES, AUDIT_SEVERITY } from '../services/securityAuditService.js';

export const userRouter = express.Router();

userRouter.use(requireAuth);
userRouter.use(highCostRateLimiter);

/**
 * DELETE /api/user/delete
 * Authoritative self-service account deletion cascade.
 * Identity is derived strictly from verified token (req.user.uid).
 */
userRouter.delete('/delete', async (req, res) => {
  const uid = req.user.uid;

  // Record audit event: Account deletion requested
  await securityAuditService.recordEvent({
    category: AUDIT_CATEGORIES.ACCOUNT,
    eventType: AUDIT_EVENT_TYPES.ACCOUNT_DELETION_REQUESTED,
    severity: AUDIT_SEVERITY.WARN,
    req,
    actorUid: uid,
    targetType: 'USER',
    targetId: uid,
    outcome: 'REQUESTED',
    metadata: {
      action: 'SELF_SERVICE_DELETE_REQUEST',
    },
  }, { isCritical: false });

  try {
    const result = await accountDeletionService.executeAccountDeletion(uid);

    if (result.blocked) {
      // Record audit event: Account deletion blocked by ownership
      await securityAuditService.recordEvent({
        category: AUDIT_CATEGORIES.ACCOUNT,
        eventType: AUDIT_EVENT_TYPES.ACCOUNT_DELETION_BLOCKED,
        severity: AUDIT_SEVERITY.WARN,
        req,
        actorUid: uid,
        targetType: 'USER',
        targetId: uid,
        outcome: 'BLOCKED',
        metadata: {
          reason: 'OWNERSHIP_SAFETY_RULE',
          blockingWorkspacesCount: (result.blockingWorkspaces || []).length,
        },
      }, { isCritical: false });

      return res.status(409).json({
        success: false,
        error: {
          code: result.code || 'ACCOUNT_DELETION_BLOCKED_BY_WORKSPACE_OWNERSHIP',
          message: result.message,
          blockingWorkspaces: result.blockingWorkspaces || [],
        },
      });
    }

    // Record audit event: Account deletion completed
    await securityAuditService.recordEvent({
      category: AUDIT_CATEGORIES.ACCOUNT,
      eventType: AUDIT_EVENT_TYPES.ACCOUNT_DELETION_COMPLETED,
      severity: AUDIT_SEVERITY.CRITICAL,
      req,
      actorUid: uid,
      targetType: 'USER',
      targetId: uid,
      outcome: 'SUCCESS',
      metadata: {
        mutationsApplied: result.mutationsApplied || 0,
      },
    }, { isCritical: false });

    return res.json({
      success: true,
      message: result.message || 'Account deleted successfully.',
      mutationsApplied: result.mutationsApplied || 0,
    });
  } catch (error) {
    console.error('🚨 [userRoutes] Account deletion error:', error.message);
    return res.status(500).json({
      success: false,
      error: {
        code: 'ACCOUNT_DELETION_ERROR',
        message: 'Failed to complete account deletion cascade.',
      },
    });
  }
});
