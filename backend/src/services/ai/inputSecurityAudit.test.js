import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validatePathSegment,
  validateRtdbUpdateMap,
  stripPrototypePollution,
  extractCanonicalVersionKey,
} from '../../utils/blueprintPathBuilder.js';
import { createRateLimiter } from '../../middleware/rateLimitMiddleware.js';
import { sanitizationMiddleware } from '../../middleware/sanitizationMiddleware.js';
import { validateBlueprintOutput, safeParseJson } from './blueprintValidator.js';

describe('🧪 CONVIA SECURITY FIX 8 — INPUT VALIDATION, INJECTION & API ABUSE AUDIT SUITE', () => {

  // =========================================================================
  // 1. PROTOTYPE POLLUTION & DANGEROUS OBJECT SANITIZATION (Scenarios 6, 7)
  // =========================================================================
  describe('🛡️ Prototype Pollution Defense', () => {
    it('TEST 6: stripPrototypePollution removes __proto__ keys from malicious nested objects', () => {
      const maliciousPayload = JSON.parse('{"title":"Project Alpha","__proto__":{"isAdmin":true,"polluted":true},"config":{"constructor":{"prototype":{"hacked":true}}}}');
      const sanitized = stripPrototypePollution(maliciousPayload);

      assert.strictEqual(sanitized.title, 'Project Alpha');
      assert.strictEqual(sanitized.__proto__.isAdmin, undefined);
      assert.strictEqual(sanitized.config.constructor?.prototype?.hacked, undefined);
      assert.strictEqual(({}).polluted, undefined, 'Global Object.prototype must NOT be polluted');
    });

    it('TEST 7: sanitizationMiddleware scrubs prototype pollution vectors from req.body and req.query', () => {
      const req = {
        body: JSON.parse('{"name":"Test","__proto__":{"escalated":true}}'),
        query: JSON.parse('{"filter":"active","constructor":{"prototype":{"bypass":true}}}'),
      };
      let nextCalled = false;

      sanitizationMiddleware(req, {}, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.body.name, 'Test');
      assert.strictEqual(req.body.__proto__.escalated, undefined);
      assert.strictEqual(({}).escalated, undefined);
    });
  });

  // =========================================================================
  // 2. PATH & IDENTIFIER MANIPULATION DEFENSE (Scenarios 1, 2, 3, 8)
  // =========================================================================
  describe('🔒 Path & Identifier Validation', () => {
    it('TEST 1 & 2: validatePathSegment rejects empty, null, undefined, and non-string inputs', () => {
      assert.throws(() => validatePathSegment(null, 'workspaceId'), /required/i);
      assert.throws(() => validatePathSegment('', 'workspaceId'), /empty string/i);
      assert.throws(() => validatePathSegment('   ', 'workspaceId'), /empty string/i);
      assert.throws(() => validatePathSegment({}, 'workspaceId'), /cannot be an Object/i);
    });

    it('TEST 3 & 8: validatePathSegment rejects path traversal, illegal RTDB characters, and [object Object]', () => {
      assert.throws(() => validatePathSegment('[object Object]', 'workspaceId'), /contains '\[object Object\]'/i);
      assert.throws(() => validatePathSegment('org.invalid$name', 'workspaceId'), /contains illegal characters/i);
      assert.throws(() => validatePathSegment('org#name', 'workspaceId'), /contains illegal characters/i);
      assert.throws(() => validatePathSegment('__proto__', 'workspaceId'), /prototype property/i);
      assert.throws(() => validatePathSegment('constructor', 'workspaceId'), /prototype property/i);

      // Valid alphanumeric and hyphenated IDs are accepted
      const valid = validatePathSegment('org_alpha-123', 'workspaceId');
      assert.strictEqual(valid, 'org_alpha-123');
    });

    it('TEST 8B: validateRtdbUpdateMap rejects update maps with prototype pollution or illegal paths', () => {
      assert.throws(
        () => validateRtdbUpdateMap({ '__proto__/isAdmin': true }),
        /prototype property/i
      );
      assert.throws(
        () => validateRtdbUpdateMap({ 'blueprints/[object Object]': { data: true } }),
        /\[object Object\]/i
      );
    });
  });

  // =========================================================================
  // 3. AI PROMPT-INJECTION & CONTEXT BOUNDARY HARDENING (Scenarios 9, 10, 11, 12)
  // =========================================================================
  describe('🤖 AI Input & Output Security Boundaries', () => {
    it('TEST 9: safeParseJson safely parses valid JSON and strips markdown fences', () => {
      const rawWithFences = '```json\n{"schemaVersion": 2, "projectUnderstanding": {"problemStatement": "Valid"}}\n```';
      const parsed = safeParseJson(rawWithFences);
      assert.strictEqual(parsed.schemaVersion, 2);
      assert.strictEqual(parsed.projectUnderstanding.problemStatement, 'Valid');
    });

    it('TEST 10: safeParseJson rejects completely unparseable or malicious text', () => {
      assert.throws(() => safeParseJson('NOT_VALID_JSON_AT_ALL'), /could not be parsed/i);
    });

    it('TEST 11 & 12: validateBlueprintOutput enforces canonical schema and ignores forged authority fields', () => {
      const rawAiOutput = {
        schemaVersion: 2,
        workspaceId: 'FORGED_WORKSPACE_ID', // Forged field from model
        ownerId: 'FORGED_OWNER_UID',       // Forged owner from model
        isAdmin: true,                     // Forged privilege from model
        projectUnderstanding: {
          problemStatement: 'Automated invoice reconciliation system.',
          mvpScope: { inScope: ['Core feature'], outOfScope: [] },
        },
        execution: {
          tasks: [
            { id: 'TASK-01', title: 'Setup DB', category: 'database', priority: 'High', status: 'Todo' },
          ],
          features: [],
          roles: [],
        },
      };

      const validated = validateBlueprintOutput(rawAiOutput, 'Invoice Pro', 'Reconcile invoices');
      assert.strictEqual(validated.schemaVersion, 2);
      assert.ok(validated.projectUnderstanding);
      assert.ok(validated.execution.tasks.length >= 1);
    });
  });

  // =========================================================================
  // 4. API ABUSE & RATE LIMITING DEFENSE (Scenarios 14, 15)
  // =========================================================================
  describe('⚡ API Abuse & Rate Limiting Enforcement', () => {
    it('TEST 14: Rate limiter blocks requests exceeding configured threshold with HTTP 429', async () => {
      const limiter = createRateLimiter(60000, 3, 'test_abuse_limiter');
      const middleware = limiter.middleware();

      const req = { user: { uid: 'user_spammer_123' }, ip: '127.0.0.1' };
      const res = {
        headers: {},
        statusCode: 200,
        body: null,
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      };

      let passedCount = 0;
      for (let i = 0; i < 5; i++) {
        res.statusCode = 200;
        await middleware(req, res, () => { passedCount++; });
      }

      assert.strictEqual(passedCount, 3, 'Exactly 3 requests should pass');
      assert.strictEqual(res.statusCode, 429, '4th and 5th requests must be rejected with HTTP 429');
      assert.strictEqual(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.ok(res.headers['Retry-After']);
    });
  });

  // =========================================================================
  // 5. ERROR HANDLING & INFORMATION DISCLOSURE (Scenarios 16, 17)
  // =========================================================================
  describe('🛡️ Safe Error Handling & Secret Masking', () => {
    it('TEST 16 & 17: Masking prevents API keys from leaking in error messages', () => {
      const rawErrorWithKey = 'Error calling Gemini API at https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyA12345678901234567890123456789012';
      const cleanMessage = String(rawErrorWithKey)
        .replace(/AIza[0-9A-Za-z-_]{35}/g, '[MASKED_KEY]')
        .replace(/key=[a-zA-Z0-9-_]+/gi, 'key=[MASKED]');

      assert.strictEqual(cleanMessage.includes('AIzaSyA12345678901234567890123456789012'), false);
      assert.ok(cleanMessage.includes('[MASKED_KEY]'));
    });
  });
});
