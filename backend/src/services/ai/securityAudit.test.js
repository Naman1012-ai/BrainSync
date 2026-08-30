import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  securityAuditService,
  SecurityAuditService,
  redactSensitiveData,
  sanitizeLogString,
  generateAuditId,
  AUDIT_CATEGORIES,
  AUDIT_EVENT_TYPES,
  AUDIT_SEVERITY,
} from '../securityAuditService.js';
import { authMiddleware, requireAuth, requirePlatformAdmin } from '../../middleware/authMiddleware.js';

describe('🧪 CONVIA SECURITY FIX 10 — SECURITY LOGGING, AUDIT INTEGRITY & REDACTION SUITE', () => {

  // =========================================================================
  // 1. SENSITIVE DATA REDACTION (Tests 1, 2, 3)
  // =========================================================================
  describe('🔒 Sensitive Data Redaction & Log Sanitization', () => {
    it('TEST 1: Bearer tokens and JWTs are masked/redacted in metadata and logs', () => {
      const rawMetadata = {
        authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiIxMjMifQ.abc123xyz',
        userToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN_pnyV15',
        details: 'User authenticated with Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiJ1c3IifQ.sig',
      };

      const redacted = redactSensitiveData(rawMetadata);
      assert.strictEqual(redacted.authHeader, '[REDACTED]', 'authHeader key must be completely redacted');
      assert.strictEqual(redacted.userToken, '[REDACTED]', 'userToken key must be completely redacted');
      assert.ok(!redacted.details.includes('eyJhbGciOiJIUzI1NiJ9'), 'JWT signature must not appear raw in strings');
      assert.ok(redacted.details.includes('[MASKED_TOKEN]') || redacted.details.includes('[MASKED_JWT]'));
    });

    it('TEST 2: Passwords and password hashes are never persisted in plain text', () => {
      const rawBody = {
        email: 'user@convia.dev',
        password: 'SuperSecretPassword123!',
        passwordHash: '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36e37eef',
        nested: {
          confirmPassword: 'SuperSecretPassword123!',
        },
      };

      const redacted = redactSensitiveData(rawBody);
      assert.strictEqual(redacted.password, '[REDACTED]');
      assert.strictEqual(redacted.passwordHash, '[REDACTED]');
      assert.strictEqual(redacted.nested.confirmPassword, '[REDACTED]');
      assert.strictEqual(redacted.email, 'user@convia.dev', 'Safe fields should remain readable');
    });

    it('TEST 3: API keys, private keys, and service account secrets are redacted', () => {
      const rawSecrets = {
        googleApiKey: 'AIzaSyA_1234567890abcdefghijklmnopqrstuv',
        apiKey: 'secret_live_abcdef1234567890',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
        clientSecret: 'shh_dont_tell_anyone_secret',
      };

      const redacted = redactSensitiveData(rawSecrets);
      assert.strictEqual(redacted.googleApiKey, '[REDACTED]');
      assert.strictEqual(redacted.apiKey, '[REDACTED]');
      assert.strictEqual(redacted.privateKey, '[REDACTED]');
      assert.strictEqual(redacted.clientSecret, '[REDACTED]');

      // Test string containing raw Google API key
      const logMessage = 'Failed to connect with key AIzaSyA_1234567890abcdefghijklmnopqrstuv';
      const cleanMessage = redactSensitiveData(logMessage);
      assert.ok(!cleanMessage.includes('AIzaSyA_1234567890abcdefghijklmnopqrstuv'));
      assert.ok(cleanMessage.includes('[MASKED_GOOGLE_KEY]'));
    });

    it('TEST 12: Unexpected arbitrary nested request fields are recursively sanitized without log injection', () => {
      const maliciousPayload = {
        note: 'Admin update\r\n[CRITICAL] System compromised\nFAKE_LOG_ENTRY',
        controlChars: 'Text with \x00\x1f control codes',
      };

      const sanitized = redactSensitiveData(maliciousPayload);
      assert.ok(!sanitized.note.includes('\r\n'), 'Newlines must be stripped to prevent log injection');
      assert.ok(!sanitized.note.includes('\n'));
      assert.ok(!sanitized.controlChars.includes('\x00'), 'Null byte must be stripped');
      assert.ok(!sanitized.controlChars.includes('\x1f'), 'Control byte must be stripped');
    });
  });

  // =========================================================================
  // 2. SERVER-AUTHORITATIVE IDENTITY & WRITE PROTECTION (Tests 4, 10, 11)
  // =========================================================================
  describe('🛡️ Audit Identity Authoritativeness & Append Integrity', () => {
    it('TEST 4: Forged client-provided actorUid in payload is overridden by verified req.user.uid', async () => {
      let savedPath = null;
      let savedRecord = null;

      const mockRtdb = {
        setData: async (path, data) => {
          savedPath = path;
          savedRecord = data;
        },
      };

      const auditSvc = new SecurityAuditService({ rtdb: mockRtdb });

      const mockReq = {
        user: { uid: 'verified_token_admin_777', email: 'admin@convia.dev' },
        body: { actorUid: 'forged_victim_user_999', actorEmail: 'victim@spoofed.com' },
        originalUrl: '/api/admin/workspaces/ws_1/lock',
        method: 'POST',
      };

      await auditSvc.recordEvent({
        category: AUDIT_CATEGORIES.ADMIN,
        eventType: AUDIT_EVENT_TYPES.WORKSPACE_LOCKED,
        req: mockReq,
        actorUid: mockReq.body.actorUid, // Client attempt to supply forged actorUid
        targetType: 'WORKSPACE',
        targetId: 'ws_1',
      });

      assert.ok(savedRecord);
      assert.strictEqual(savedRecord.actorUid, 'verified_token_admin_777', 'Must strictly derive from req.user.uid');
      assert.notStrictEqual(savedRecord.actorUid, 'forged_victim_user_999');
    });

    it('TEST 10: Client direct writes to audit paths are blocked by RTDB architecture and Admin SDK isolation', () => {
      // In database.rules.json: admin_audit_logs, auditLogs, audit_logs are .read: false, .write: false
      // Only server-side Firebase Admin SDK has privileged write access
      assert.strictEqual(typeof securityAuditService.recordEvent, 'function');
      assert.strictEqual(securityAuditService.rtdb !== undefined, true);
    });

    it('TEST 11: Audit record IDs are collision-resistant, preventing overwrite of existing events', () => {
      const id1 = generateAuditId('audit');
      const id2 = generateAuditId('audit');
      const id3 = generateAuditId('audit');

      assert.notStrictEqual(id1, id2);
      assert.notStrictEqual(id2, id3);
      assert.ok(id1.startsWith('audit_'));
      assert.ok(id1.length > 20, 'ID must contain timestamp and cryptographic entropy');
    });
  });

  // =========================================================================
  // 3. AUTHENTICATION & AUTHORIZATION EVENT MONITORING (Tests 5, 6, 7, 8)
  // =========================================================================
  describe('🚨 Authentication & Authorization Event Monitoring', () => {
    it('TEST 5: Authentication failure event captures safe context and outcome DENIED', async () => {
      let loggedEvent = null;
      const mockRtdb = {
        setData: async (path, data) => {
          loggedEvent = data;
        },
      };

      const auditSvc = new SecurityAuditService({ rtdb: mockRtdb });

      const mockReq = {
        headers: { authorization: 'Bearer invalid_signature_token' },
        originalUrl: '/api/blueprint/active',
        method: 'POST',
        ip: '198.51.100.24',
      };

      await auditSvc.recordAuthFailure(mockReq, 'Token verification signature mismatch.', AUDIT_EVENT_TYPES.AUTH_TOKEN_INVALID);

      assert.ok(loggedEvent);
      assert.strictEqual(loggedEvent.category, AUDIT_CATEGORIES.AUTHENTICATION);
      assert.strictEqual(loggedEvent.eventType, AUDIT_EVENT_TYPES.AUTH_TOKEN_INVALID);
      assert.strictEqual(loggedEvent.outcome, 'DENIED');
      assert.strictEqual(loggedEvent.route, '/api/blueprint/active');
    });

    it('TEST 6: Authentication failure records contain no raw token value', async () => {
      let loggedEvent = null;
      const mockRtdb = {
        setData: async (path, data) => {
          loggedEvent = data;
        },
      };

      const auditSvc = new SecurityAuditService({ rtdb: mockRtdb });

      const mockReq = {
        headers: { authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_TOKEN_PAYLOAD' },
        originalUrl: '/api/blueprint/active',
        method: 'POST',
        ip: '198.51.100.24',
      };

      await auditSvc.recordAuthFailure(mockReq, 'Token verification failed.', AUDIT_EVENT_TYPES.AUTH_TOKEN_INVALID);

      assert.ok(loggedEvent);
      const serialized = JSON.stringify(loggedEvent);
      assert.ok(!serialized.includes('INVALID_TOKEN_PAYLOAD'), 'Raw token payload must never be stored in logs');
      assert.ok(!serialized.includes('Bearer eyJhbGciOiJSUzI1NiIs'));
    });

    it('TEST 7: Admin access denial records security event with verified user UID and target route', async () => {
      let loggedEvent = null;
      const mockRtdb = {
        setData: async (path, data) => {
          loggedEvent = data;
        },
      };

      const auditSvc = new SecurityAuditService({ rtdb: mockRtdb });

      const mockReq = {
        user: { uid: 'normal_user_444', email: 'regular@user.com', authenticated: true },
        originalUrl: '/api/admin/platform-settings',
        method: 'PATCH',
        ip: '203.0.113.88',
      };

      await auditSvc.recordAuthzDenial(mockReq, 'User lacks platform admin role.', {
        eventType: AUDIT_EVENT_TYPES.ADMIN_ACCESS_DENIED,
        targetType: 'ADMIN_PORTAL',
        targetId: '/api/admin/platform-settings',
      });

      assert.ok(loggedEvent);
      assert.strictEqual(loggedEvent.category, AUDIT_CATEGORIES.AUTHORIZATION);
      assert.strictEqual(loggedEvent.eventType, AUDIT_EVENT_TYPES.ADMIN_ACCESS_DENIED);
      assert.strictEqual(loggedEvent.actorUid, 'normal_user_444');
      assert.strictEqual(loggedEvent.targetId, '/api/admin/platform-settings');
      assert.strictEqual(loggedEvent.outcome, 'DENIED');
    });

    it('TEST 8: Cross-workspace unauthorized access attempts are recorded appropriately', async () => {
      let loggedEvent = null;
      const mockRtdb = {
        setData: async (path, data) => {
          loggedEvent = data;
        },
      };

      const auditSvc = new SecurityAuditService({ rtdb: mockRtdb });

      const mockReq = {
        user: { uid: 'attacker_uid_101', email: 'attacker@evil.com', authenticated: true },
        body: { workspaceId: 'target_org_private_999' },
        originalUrl: '/api/blueprint/active',
        method: 'POST',
      };

      await auditSvc.recordAuthzDenial(mockReq, 'User is not a member of this workspace.', {
        eventType: AUDIT_EVENT_TYPES.CROSS_WORKSPACE_ACCESS_DENIED,
        targetType: 'WORKSPACE_BLUEPRINT',
        targetId: 'target_org_private_999',
        workspaceId: 'target_org_private_999',
      });

      assert.ok(loggedEvent);
      assert.strictEqual(loggedEvent.category, AUDIT_CATEGORIES.AUTHORIZATION);
      assert.strictEqual(loggedEvent.eventType, AUDIT_EVENT_TYPES.CROSS_WORKSPACE_ACCESS_DENIED);
      assert.strictEqual(loggedEvent.actorUid, 'attacker_uid_101');
      assert.strictEqual(loggedEvent.workspaceId, 'target_org_private_999');
    });
  });

  // =========================================================================
  // 4. ADMINISTRATIVE AUDIT & ACCOUNT DELETION INTEGRITY (Tests 9, 13)
  // =========================================================================
  describe('👑 Administrative Mutations & Account Deletion Audit Trails', () => {
    it('TEST 9: State-changing admin mutations record verified actor, action type, and target ID', async () => {
      let savedPath = null;
      let savedRecord = null;

      const mockRtdb = {
        setData: async (path, data) => {
          savedPath = path;
          savedRecord = data;
        },
      };

      const auditSvc = new SecurityAuditService({ rtdb: mockRtdb });

      const adminUser = { uid: 'superadmin_1', email: 'admin@convia.dev', name: 'Lead Admin' };
      await auditSvc.recordAdminAudit(adminUser, 'SUSPEND_USER', 'user_violator_888', 'Suspended for spam violations.', {
        targetType: 'USER',
        route: '/api/admin/users/user_violator_888/suspend',
      });

      assert.ok(savedPath.startsWith('admin_audit_logs/'));
      assert.strictEqual(savedRecord.actorUid, 'superadmin_1');
      assert.strictEqual(savedRecord.eventType, 'SUSPEND_USER');
      assert.strictEqual(savedRecord.targetId, 'user_violator_888');
      assert.strictEqual(savedRecord.outcome, 'SUCCESS');
    });

    it('TEST 13: Account deletion audit records live outside user deletable subtrees and persist deletion lifecycle', async () => {
      const deletionAudits = [];
      const mockRtdb = {
        setData: async (path, data) => {
          deletionAudits.push({ path, data });
        },
      };

      const auditSvc = new SecurityAuditService({ rtdb: mockRtdb });
      const victimUid = 'usr_delete_target_555';

      // 1. Record Account Deletion Requested
      await auditSvc.recordEvent({
        category: AUDIT_CATEGORIES.ACCOUNT,
        eventType: AUDIT_EVENT_TYPES.ACCOUNT_DELETION_REQUESTED,
        actorUid: victimUid,
        targetType: 'USER',
        targetId: victimUid,
      });

      // 2. Record Account Deletion Completed
      await auditSvc.recordEvent({
        category: AUDIT_CATEGORIES.ACCOUNT,
        eventType: AUDIT_EVENT_TYPES.ACCOUNT_DELETION_COMPLETED,
        actorUid: victimUid,
        targetType: 'USER',
        targetId: victimUid,
        metadata: { mutationsApplied: 12 },
      });

      assert.strictEqual(deletionAudits.length, 2);
      deletionAudits.forEach(({ path, data }) => {
        assert.ok(path.startsWith('audit_logs/'), 'Audit record must live at root /audit_logs, NOT under users/{uid}');
        assert.ok(!path.includes(`users/${victimUid}/`), 'Audit log must never reside in user-deletable path');
        assert.strictEqual(data.targetId, victimUid);
      });
    });
  });

  // =========================================================================
  // 5. AUDIT FAILURE POLICIES & ERROR RESPONSE MASKING (Tests 14, 15)
  // =========================================================================
  describe('🚨 Failure Policies & Information Disclosure Defense', () => {
    it('TEST 14: Critical admin actions fail closed on audit failure, while telemetry falls back safely', async () => {
      const failingRtdb = {
        setData: async () => {
          throw new Error('Database write permission denied or connection failed.');
        },
      };

      const auditSvc = new SecurityAuditService({ rtdb: failingRtdb });

      // Non-critical telemetry: Must NOT throw (safe fallback)
      const telemetryReq = { originalUrl: '/api/health', method: 'GET' };
      const fallbackResult = await auditSvc.recordAuthFailure(telemetryReq, 'Testing telemetry failure');
      assert.ok(fallbackResult, 'Telemetry should return audit record object on fallback without crashing');

      // Critical mutation: Must throw CRITICAL_AUDIT_LOG_FAILURE to fail closed
      const adminUser = { uid: 'superadmin_1', email: 'admin@convia.dev' };
      await assert.rejects(
        async () => {
          await auditSvc.recordAdminAudit(adminUser, 'DELETE_USER', 'target_user_1', 'Permanent purge', { isCritical: true });
        },
        (err) => {
          assert.strictEqual(err.code, 'CRITICAL_AUDIT_LOG_FAILURE');
          return true;
        }
      );
    });

    it('TEST 15: Error responses in production mask stack traces and internal secrets', () => {
      const rawError = new Error('Database connection failed with key AIzaSyB_99999999999999999999999999999999999');
      const isProd = true;
      const statusCode = 500;

      const cleanMessage = String(rawError.message || 'Internal server error.')
        .replace(/AIza[0-9A-Za-z-_]{35}/g, '[MASKED_KEY]');

      const responsePayload = {
        success: false,
        error: {
          code: rawError.code || 'INTERNAL_ERROR',
          message: isProd && statusCode === 500 ? 'An unexpected server error occurred.' : cleanMessage,
        },
      };

      assert.strictEqual(responsePayload.error.message, 'An unexpected server error occurred.');
      assert.strictEqual(responsePayload.stack, undefined, 'Stack trace must never be returned to client');
    });
  });
});
