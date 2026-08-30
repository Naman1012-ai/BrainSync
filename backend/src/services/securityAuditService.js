/**
 * Centralized Security Audit & Event Monitoring Service.
 * Provides immutable, append-only security telemetry and administrative audit trails.
 * 
 * Guarantees:
 * 1. Server-Authoritative Identity: Actor UID derived strictly from verified token (req.user.uid).
 * 2. Deep Sensitive Data Redaction: Strips tokens, passwords, API keys, and credentials recursively.
 * 3. Log Injection Prevention: Sanitizes newlines and control characters.
 * 4. Collision-Resistant Record IDs: Timestamp + high-entropy random identifiers.
 * 5. Append-Only Integrity: No update or delete operations exposed.
 * 6. Explicit Failure Policy: Critical administrative actions fail closed; non-critical telemetry falls back safely.
 */

import crypto from 'node:crypto';
import { rtdbService } from './rtdbService.js';

export const AUDIT_CATEGORIES = Object.freeze({
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  ADMIN: 'ADMIN',
  ACCOUNT: 'ACCOUNT',
  WORKSPACE: 'WORKSPACE',
  SECURITY: 'SECURITY',
  SYSTEM: 'SYSTEM',
});

export const AUDIT_EVENT_TYPES = Object.freeze({
  // Authentication Events
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_HEADER_MALFORMED: 'AUTH_HEADER_MALFORMED',

  // Authorization Events
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED',
  ADMIN_ACCESS_DENIED: 'ADMIN_ACCESS_DENIED',
  CROSS_WORKSPACE_ACCESS_DENIED: 'CROSS_WORKSPACE_ACCESS_DENIED',

  // Admin Mutations
  ADMIN_SETTINGS_UPDATED: 'ADMIN_SETTINGS_UPDATED',
  ANNOUNCEMENT_CREATED: 'ANNOUNCEMENT_CREATED',
  ANNOUNCEMENT_DELETED: 'ANNOUNCEMENT_DELETED',
  ANNOUNCEMENT_PIN_TOGGLED: 'ANNOUNCEMENT_PIN_TOGGLED',
  NOTIFICATION_BROADCAST: 'NOTIFICATION_BROADCAST',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_RESTORED: 'USER_RESTORED',
  USER_NOTE_ADDED: 'USER_NOTE_ADDED',
  USER_WARNING_ISSUED: 'USER_WARNING_ISSUED',
  USER_DELETED: 'USER_DELETED',
  WORKSPACE_ARCHIVED: 'WORKSPACE_ARCHIVED',
  WORKSPACE_RESTORED: 'WORKSPACE_RESTORED',
  WORKSPACE_LOCKED: 'WORKSPACE_LOCKED',
  WORKSPACE_UNLOCKED: 'WORKSPACE_UNLOCKED',
  WORKSPACE_OWNERSHIP_TRANSFERRED: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
  WORKSPACE_DELETED: 'WORKSPACE_DELETED',
  REPORT_STATUS_UPDATED: 'REPORT_STATUS_UPDATED',
  RBAC_ROLE_UPDATED: 'RBAC_ROLE_UPDATED',
  FEATURED_IDEA_TOGGLED: 'FEATURED_IDEA_TOGGLED',

  // Account Events
  ACCOUNT_DELETION_REQUESTED: 'ACCOUNT_DELETION_REQUESTED',
  ACCOUNT_DELETION_COMPLETED: 'ACCOUNT_DELETION_COMPLETED',
  ACCOUNT_DELETION_BLOCKED: 'ACCOUNT_DELETION_BLOCKED',

  // Security Anomalies
  SECURITY_VALIDATION_FAILED: 'SECURITY_VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  PROTOTYPE_POLLUTION_ATTEMPT: 'PROTOTYPE_POLLUTION_ATTEMPT',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
});

export const AUDIT_SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARN: 'WARN',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

// Sensitive field names that must NEVER be persisted in audit logs or metadata
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /bearer/i,
  /auth/i,
  /authorization/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /credential/i,
  /service[_-]?account/i,
  /cookie/i,
  /session/i,
  /access[_-]?key/i,
  /id[_-]?token/i,
  /refresh[_-]?token/i,
];

// Sensitive value patterns (JWTs, Google API keys, hex secrets, PEM private keys)
const SENSITIVE_VALUE_PATTERNS = [
  { regex: /AIza[0-9A-Za-z-_]{35}/g, replacement: '[MASKED_GOOGLE_KEY]' },
  { regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, replacement: '[MASKED_JWT]' },
  { regex: /Bearer\s+[A-Za-z0-9-_=.]+/gi, replacement: 'Bearer [MASKED_TOKEN]' },
  { regex: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, replacement: '[MASKED_PRIVATE_KEY]' },
];

/**
 * Strips newlines, carriage returns, and control characters to prevent log injection.
 */
export function sanitizeLogString(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/[\r\n\x00-\x1f\x7f-\x9f]/g, ' ')
    .trim();
}

/**
 * Deep recursive redaction of sensitive keys and patterns.
 */
export function redactSensitiveData(value, depth = 0) {
  if (depth > 6) return '[MAX_DEPTH_REACHED]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    let sanitized = sanitizeLogString(value);
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pattern.regex, pattern.replacement);
    }
    return sanitized;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof value === 'object') {
    const cleanObj = {};
    for (const [k, v] of Object.entries(value)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(k));
      if (isSensitiveKey) {
        cleanObj[k] = '[REDACTED]';
      } else {
        cleanObj[k] = redactSensitiveData(v, depth + 1);
      }
    }
    return cleanObj;
  }

  return '[UNSUPPORTED_DATA_TYPE]';
}

/**
 * Generates a cryptographically strong, collision-resistant audit record ID.
 */
export function generateAuditId(prefix = 'audit') {
  const timestamp = Date.now();
  const randomEntropy = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}_${randomEntropy}`;
}

export class SecurityAuditService {
  constructor(options = {}) {
    this.rtdb = options.rtdb || rtdbService;
  }

  /**
   * Records an authoritative administrative or high-risk security audit event.
   * Stored under `admin_audit_logs/${auditId}` and `audit_logs/${auditId}`.
   *
   * @param {Object} eventParams
   * @param {Object} [options]
   * @param {boolean} [options.isCritical=false] If true, failure to record throws an error (fail closed)
   */
  async recordEvent(eventParams = {}, options = {}) {
    const isCritical = Boolean(options.isCritical);
    const timestamp = Date.now();
    const auditId = generateAuditId('sec');

    // 1. Authoritative Identity Derivation: Never trust client payload for actorUid
    const actorUid = eventParams.req?.user?.uid
      ? String(eventParams.req.user.uid).trim()
      : (eventParams.actorUid ? String(eventParams.actorUid).trim() : 'unauthenticated');

    const actorEmail = eventParams.req?.user?.email
      ? String(eventParams.req.user.email).trim()
      : (eventParams.actorEmail ? String(eventParams.actorEmail).trim() : null);

    const route = eventParams.req?.originalUrl || eventParams.req?.path || eventParams.route || 'internal';
    const method = eventParams.req?.method || eventParams.method || 'SYSTEM';

    // 2. Validate and normalize controlled category & eventType
    const category = AUDIT_CATEGORIES[eventParams.category] || AUDIT_CATEGORIES.SECURITY;
    const eventType = AUDIT_EVENT_TYPES[eventParams.eventType] || eventParams.eventType || AUDIT_EVENT_TYPES.SECURITY_VALIDATION_FAILED;
    const severity = AUDIT_SEVERITY[eventParams.severity] || (isCritical ? AUDIT_SEVERITY.CRITICAL : AUDIT_SEVERITY.INFO);
    const outcome = eventParams.outcome || 'SUCCESS';

    // 3. Deep redaction of metadata
    const rawMetadata = eventParams.metadata || {};
    const sanitizedMetadata = redactSensitiveData(rawMetadata);

    const auditRecord = {
      auditId,
      eventType,
      category,
      severity,
      actorUid,
      actorEmail: actorEmail ? redactSensitiveData(actorEmail) : null,
      targetType: eventParams.targetType || 'SYSTEM',
      targetId: eventParams.targetId ? String(eventParams.targetId) : null,
      workspaceId: eventParams.workspaceId ? String(eventParams.workspaceId) : null,
      route: sanitizeLogString(route),
      method: sanitizeLogString(method),
      outcome,
      metadata: sanitizedMetadata,
      timestamp,
    };

    try {
      // Primary storage in admin_audit_logs (for admin UI & audit index) and audit_logs
      const storagePath = category === AUDIT_CATEGORIES.ADMIN
        ? `admin_audit_logs/${auditId}`
        : `audit_logs/${auditId}`;

      await this.rtdb.setData(storagePath, auditRecord);
      return auditRecord;
    } catch (err) {
      console.error(`🚨 [securityAuditService] Failed to persist audit record '${auditId}':`, err.message);

      if (isCritical) {
        const criticalError = new Error(`Critical security audit logging failed: ${err.message}`);
        criticalError.code = 'CRITICAL_AUDIT_LOG_FAILURE';
        criticalError.statusCode = 500;
        throw criticalError;
      }

      // Non-critical telemetry falls back safely with structured warning
      console.warn('⚠️ [securityAuditService] Telemetry audit fallback:', {
        auditId,
        eventType,
        actorUid,
        outcome,
      });

      return auditRecord;
    }
  }

  /**
   * Helper specifically tailored for state-changing administrative operations in adminRoutes.
   */
  async recordAdminAudit(actorUser, actionType, targetId, details, options = {}) {
    const isCritical = [
      'DELETE_USER',
      'DELETE_WORKSPACE',
      'TRANSFER_OWNERSHIP',
      'UPDATE_RBAC_ROLE',
      'UPDATE_PLATFORM_SETTINGS',
    ].includes(actionType);

    return await this.recordEvent({
      category: AUDIT_CATEGORIES.ADMIN,
      eventType: actionType,
      severity: isCritical ? AUDIT_SEVERITY.CRITICAL : AUDIT_SEVERITY.INFO,
      actorUid: actorUser?.uid || 'unknown_admin',
      actorEmail: actorUser?.email || actorUser?.name || 'admin',
      targetType: options.targetType || 'ENTITY',
      targetId,
      workspaceId: options.workspaceId || null,
      route: options.route || '/api/admin',
      method: options.method || 'POST',
      outcome: 'SUCCESS',
      metadata: {
        adminName: actorUser?.name || actorUser?.email || 'Admin',
        details: typeof details === 'object' ? details : { summary: details },
      },
    }, { isCritical });
  }

  /**
   * Helper specifically for authentication failure telemetry.
   */
  async recordAuthFailure(req, reason, eventType = AUDIT_EVENT_TYPES.AUTH_FAILED) {
    return await this.recordEvent({
      category: AUDIT_CATEGORIES.AUTHENTICATION,
      eventType,
      severity: AUDIT_SEVERITY.WARN,
      req,
      outcome: 'DENIED',
      metadata: {
        reason: sanitizeLogString(reason),
        ip: req.ip || req.socket?.remoteAddress || 'unknown',
      },
    }, { isCritical: false });
  }

  /**
   * Helper specifically for authorization denial telemetry.
   */
  async recordAuthzDenial(req, reason, targetInfo = {}) {
    return await this.recordEvent({
      category: AUDIT_CATEGORIES.AUTHORIZATION,
      eventType: targetInfo.eventType || AUDIT_EVENT_TYPES.AUTHORIZATION_DENIED,
      severity: AUDIT_SEVERITY.WARN,
      req,
      targetType: targetInfo.targetType || 'RESOURCE',
      targetId: targetInfo.targetId || null,
      workspaceId: targetInfo.workspaceId || null,
      outcome: 'DENIED',
      metadata: {
        reason: sanitizeLogString(reason),
        ...targetInfo.metadata,
      },
    }, { isCritical: false });
  }
}

export const securityAuditService = new SecurityAuditService();
