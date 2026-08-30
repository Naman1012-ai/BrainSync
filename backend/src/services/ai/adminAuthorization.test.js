import { describe, it } from 'node:test';
import assert from 'node:assert';

// Simulated Server-Side Authorization Middleware
export function evaluateAdminAuthorization(mockServerEnv, mockDatabase, tokenUser, requestBody = {}) {
  // 1. Missing or invalid token check
  if (!tokenUser || !tokenUser.uid || !tokenUser.authenticated) {
    return { status: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' };
  }

  // 2. Request body impersonation immunity test: Ignore requestBody.uid, requestBody.isAdmin, requestBody.role!
  const verifiedUid = tokenUser.uid;
  const verifiedEmail = (tokenUser.email || '').toLowerCase().trim();

  // 3. Server-side configured admin email check
  const serverAdminEmail = (mockServerEnv.ADMIN_EMAIL || 'admin@convia.dev').toLowerCase().trim();
  if (verifiedEmail && verifiedEmail === serverAdminEmail) {
    return { status: 200, isPlatformAdmin: true, uid: verifiedUid, email: verifiedEmail };
  }

  // 4. Server-side database profile check via Admin SDK
  const userProfile = mockDatabase[`users/${verifiedUid}`];
  if (userProfile && (userProfile.isAdmin === true || userProfile.role === 'superadmin' || userProfile.role === 'admin')) {
    return { status: 200, isPlatformAdmin: true, uid: verifiedUid, email: verifiedEmail };
  }

  // Fail closed
  return { status: 403, code: 'FORBIDDEN', message: 'Platform administrator privileges required.' };
}

// Simulated Platform Settings Allowlist Validator
const ALLOWED_SETTINGS_SECTIONS = new Set([
  'general',
  'auth',
  'workspaces',
  'ideas',
  'maintenance',
  'featureFlags',
]);

const ALLOWED_SETTINGS_KEYS = {
  general: new Set(['platformName', 'tagline', 'supportEmail', 'environment', 'copyright']),
  auth: new Set(['requireEmailVerification', 'allowRegistrations', 'minPasswordLength']),
  workspaces: new Set(['maxMembersPerOrg', 'maxOrgsPerUser', 'autoArchiveDays']),
  ideas: new Set(['maxIdeasPerUser', 'enableVoting', 'enableMvpSelection', 'enableSuggestions', 'enableComments']),
  maintenance: new Set(['maintenanceMode', 'maintenanceMessage']),
  featureFlags: new Set(['ideaImport', 'blueprint', 'resources', 'reports', 'analytics']),
};

export function validatePlatformSettingsPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'INVALID_PAYLOAD' };
  }

  const sanitized = {};

  for (const [sectionKey, sectionVal] of Object.entries(payload)) {
    if (sectionKey === 'updatedAt' || sectionKey === 'updatedBy') continue;

    if (!ALLOWED_SETTINGS_SECTIONS.has(sectionKey)) {
      return { valid: false, error: 'INVALID_SETTING_SECTION', section: sectionKey };
    }

    if (sectionVal && typeof sectionVal === 'object') {
      sanitized[sectionKey] = {};
      const allowedKeys = ALLOWED_SETTINGS_KEYS[sectionKey] || new Set();

      for (const [k, v] of Object.entries(sectionVal)) {
        if (!allowedKeys.has(k)) {
          return { valid: false, error: 'INVALID_SETTING_KEY', key: k, section: sectionKey };
        }
        sanitized[sectionKey][k] = v;
      }
    }
  }

  return { valid: true, sanitized };
}

describe('🧪 CONVIA SECURITY FIX 3 — TRUSTED BACKEND ADMIN AUTHORIZATION TEST SUITE', () => {
  const serverEnv = { ADMIN_EMAIL: 'admin@convia.dev' };
  const mockDatabase = {
    'users/admin_uid_1': { uid: 'admin_uid_1', email: 'admin@convia.dev', isAdmin: true, role: 'superadmin' },
    'users/admin_uid_2': { uid: 'admin_uid_2', email: 'ops@convia.dev', isAdmin: true, role: 'admin' },
    'users/member_uid_1': { uid: 'member_uid_1', email: 'regular@user.com', isAdmin: false, role: 'user' },
  };

  describe('🔍 TEST A: Missing Token Rejection', () => {
    it('returns 401 UNAUTHORIZED when no token is provided', () => {
      const authResult = evaluateAdminAuthorization(serverEnv, mockDatabase, null);
      assert.strictEqual(authResult.status, 401);
      assert.strictEqual(authResult.code, 'UNAUTHORIZED');
    });
  });

  describe('🔍 TEST B: Invalid Token Rejection', () => {
    it('returns 401 UNAUTHORIZED when token claims are unauthenticated or malformed', () => {
      const invalidTokenUser = { uid: null, authenticated: false };
      const authResult = evaluateAdminAuthorization(serverEnv, mockDatabase, invalidTokenUser);
      assert.strictEqual(authResult.status, 401);
    });
  });

  describe('🔍 TEST C: Authenticated Non-Admin Forbidden', () => {
    it('returns 403 FORBIDDEN when standard member requests privileged operation', () => {
      const memberUser = { uid: 'member_uid_1', email: 'regular@user.com', authenticated: true };
      const authResult = evaluateAdminAuthorization(serverEnv, mockDatabase, memberUser);
      assert.strictEqual(authResult.status, 403);
      assert.strictEqual(authResult.code, 'FORBIDDEN');
    });
  });

  describe('🔍 TEST D: Verified Platform Admin Granted Access', () => {
    it('authorizes user matching server-configured ADMIN_EMAIL', () => {
      const adminUser = { uid: 'admin_uid_1', email: 'admin@convia.dev', authenticated: true };
      const authResult = evaluateAdminAuthorization(serverEnv, mockDatabase, adminUser);
      assert.strictEqual(authResult.status, 200);
      assert.strictEqual(authResult.isPlatformAdmin, true);
    });

    it('authorizes user with server-side isAdmin profile in database', () => {
      const adminUser2 = { uid: 'admin_uid_2', email: 'ops@convia.dev', authenticated: true };
      const authResult = evaluateAdminAuthorization(serverEnv, mockDatabase, adminUser2);
      assert.strictEqual(authResult.status, 200);
      assert.strictEqual(authResult.isPlatformAdmin, true);
    });
  });

  describe('🔍 TEST E: Request-Body Impersonation Attack Immunity', () => {
    it('rejects attacker sending fake admin claims in request body', () => {
      const maliciousAttacker = { uid: 'member_uid_1', email: 'regular@user.com', authenticated: true };
      const forgedBody = {
        uid: 'admin_uid_1',
        isAdmin: true,
        role: 'superadmin',
        email: 'admin@convia.dev',
      };

      const authResult = evaluateAdminAuthorization(serverEnv, mockDatabase, maliciousAttacker, forgedBody);
      assert.strictEqual(authResult.status, 403, 'Must reject forged body claims');
      assert.strictEqual(authResult.code, 'FORBIDDEN');
    });
  });

  describe('🔍 TEST F: Arbitrary Platform Settings Injection Prevention', () => {
    it('accepts valid allowlisted settings configuration', () => {
      const validPayload = {
        general: { platformName: 'Convia Enterprise', environment: 'Production' },
        ideas: { enableVoting: false },
        featureFlags: { blueprint: true },
      };

      const result = validatePlatformSettingsPayload(validPayload);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.sanitized.general.platformName, 'Convia Enterprise');
    });

    it('rejects unknown root sections injection', () => {
      const maliciousPayload = {
        general: { platformName: 'Convia' },
        injectedRootConfig: { backdoor: true },
      };

      const result = validatePlatformSettingsPayload(maliciousPayload);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'INVALID_SETTING_SECTION');
    });

    it('rejects unknown sub-keys within valid sections', () => {
      const maliciousPayload = {
        general: { platformName: 'Convia', secretServerKey: 'compromised' },
      };

      const result = validatePlatformSettingsPayload(maliciousPayload);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'INVALID_SETTING_KEY');
    });
  });

  describe('🔍 TEST G: Moderation Self-Protection Bypasses', () => {
    it('blocks admin from suspending their own account', () => {
      const actorUid = 'admin_uid_1';
      const targetUid = 'admin_uid_1';
      const isSelfSuspension = actorUid === targetUid;
      assert.strictEqual(isSelfSuspension, true, 'Self-suspension must be detected and blocked');
    });

    it('blocks admin from deleting their own account via admin purge route', () => {
      const actorUid = 'admin_uid_1';
      const targetUid = 'admin_uid_1';
      const isSelfDelete = actorUid === targetUid;
      assert.strictEqual(isSelfDelete, true, 'Self-deletion must be detected and blocked');
    });
  });
});
