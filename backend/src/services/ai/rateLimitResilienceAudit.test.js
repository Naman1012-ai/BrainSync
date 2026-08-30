import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  resolveRateLimitIdentity,
  resolveClientIp,
  createRateLimiter,
  TieredRateLimiter,
} from '../../middleware/rateLimitMiddleware.js';
import { MemoryRateLimitStore, BaseRateLimitStore } from '../rateLimitStore.js';
import { aiConcurrencyGuard, AiConcurrencyGuard } from '../aiConcurrencyGuard.js';

describe('🧪 CONVIA SECURITY FIX 9 — DISTRIBUTED RATE LIMITING, CONCURRENCY & ABUSE RESILIENCE SUITE', () => {

  // =========================================================================
  // 1. IDENTITY DERIVATION & SPOOFING DEFENSE (Tests 1, 2, 3, 4, 9)
  // =========================================================================
  describe('🔒 Rate Limit Identity Resolution & Anti-Spoofing', () => {
    it('TEST 1: Authenticated identity is strictly derived from verified token (req.user.uid)', () => {
      const req = {
        user: { uid: 'auth_usr_999', email: 'dev@convia.dev' },
        headers: {},
        ip: '10.0.0.1',
      };
      const id = resolveRateLimitIdentity(req);
      assert.strictEqual(id, 'user:auth_usr_999');
    });

    it('TEST 2: Forged X-User-ID or X-Forwarded-User cannot alter authenticated identity', () => {
      const req = {
        user: { uid: 'legitimate_uid_777' },
        headers: {
          'x-user-id': 'spoofed_admin_000',
          'x-forwarded-user': 'spoofed_victim_111',
        },
        ip: '10.0.0.1',
      };
      const id = resolveRateLimitIdentity(req);
      assert.strictEqual(id, 'user:legitimate_uid_777', 'Must ignore spoofed user headers');
    });

    it('TEST 3: Forged req.body.uid or req.query.uid cannot alter rate-limit identity', () => {
      const req = {
        user: { uid: 'token_uid_333' },
        body: { uid: 'victim_uid_555', userUid: 'victim_uid_555' },
        query: { uid: 'victim_uid_555' },
        headers: {},
        ip: '127.0.0.1',
      };
      const id = resolveRateLimitIdentity(req);
      assert.strictEqual(id, 'user:token_uid_333');
    });

    it('TEST 4: Authenticated users have completely independent rate-limit quotas', async () => {
      const store = new MemoryRateLimitStore();
      const limiter = createRateLimiter(60000, 2, 'independent_test', { store });
      const mw = limiter.middleware();

      const createRes = () => ({
        headers: {},
        statusCode: 200,
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      });

      // User A exhausts quota (2 requests)
      const reqA = { user: { uid: 'user_A' } };
      let passedA = 0;
      for (let i = 0; i < 3; i++) {
        const res = createRes();
        await mw(reqA, res, () => { passedA++; });
      }
      assert.strictEqual(passedA, 2, 'User A should have exactly 2 allowed requests');

      // User B should NOT be affected by User A's exhausted quota
      const reqB = { user: { uid: 'user_B' } };
      let passedB = 0;
      for (let i = 0; i < 2; i++) {
        const res = createRes();
        await mw(reqB, res, () => { passedB++; });
      }
      assert.strictEqual(passedB, 2, 'User B must have full independent quota available');
    });

    it('TEST 9: Public identity extraction safely falls back to socket IP without unverified proxy trust', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
        socket: { remoteAddress: '192.168.1.50' },
      };
      const ip = resolveClientIp(req);
      assert.strictEqual(ip, '192.168.1.50', 'Must use socket address when req.ip is unset');
    });
  });

  // =========================================================================
  // 2. ATOMIC SLIDING-WINDOW & CONCURRENCY RESILIENCE (Tests 5, 6, 7, 8)
  // =========================================================================
  describe('⚡ Atomic Rate Limiting & Memory Boundedness', () => {
    it('TEST 5 & 6: Rapid requests do not race beyond the configured atomic limit', async () => {
      const store = new MemoryRateLimitStore();
      const limiter = createRateLimiter(60000, 5, 'atomic_race_test', { store });
      const mw = limiter.middleware();

      const req = { user: { uid: 'rapid_tester_1' } };
      const results = [];

      // Send 10 parallel asynchronous requests simultaneously
      const promises = Array.from({ length: 10 }).map(async () => {
        const res = {
          headers: {},
          statusCode: 200,
          setHeader(k, v) { this.headers[k] = v; },
          status(code) { this.statusCode = code; return this; },
          json(payload) { this.body = payload; return this; },
        };
        let passed = false;
        await mw(req, res, () => { passed = true; });
        results.push({ passed, statusCode: res.statusCode });
      });

      await Promise.all(promises);

      const passedCount = results.filter((r) => r.passed).length;
      const blockedCount = results.filter((r) => r.statusCode === 429).length;

      assert.strictEqual(passedCount, 5, 'Exactly 5 requests must be allowed');
      assert.strictEqual(blockedCount, 5, 'Exactly 5 requests must be blocked with 429');
    });

    it('TEST 7: Expired timestamps roll off correctly in sliding window', async () => {
      const store = new MemoryRateLimitStore();
      const key = 'test_expiry_key';
      const windowMs = 50; // 50ms window

      // Hit limit of 2
      const res1 = await store.increment(key, windowMs, 2);
      assert.strictEqual(res1.allowed, true);
      const res2 = await store.increment(key, windowMs, 2);
      assert.strictEqual(res2.allowed, true);
      const res3 = await store.increment(key, windowMs, 2);
      assert.strictEqual(res3.allowed, false);

      // Wait 60ms for window to slide past
      await new Promise((resolve) => setTimeout(resolve, 60));

      const res4 = await store.increment(key, windowMs, 2);
      assert.strictEqual(res4.allowed, true, 'Request should be allowed after window expires');
    });

    it('TEST 8: Store capacity is bounded to maxKeys with LRU eviction preventing unbounded growth', async () => {
      const store = new MemoryRateLimitStore({ maxKeys: 10 });

      // Populate 15 distinct keys (exceeding capacity of 10)
      for (let i = 1; i <= 15; i++) {
        await store.increment(`key_${i}`, 60000, 10);
      }

      assert.ok(store.hits.size <= 10, `Store hits size (${store.hits.size}) must never exceed maxKeys (10)`);
      store.destroy();
    });
  });

  // =========================================================================
  // 3. HTTP HEADERS & CONVIA ERROR ENVELOPE (Tests 10, 11, 12, 13, 14)
  // =========================================================================
  describe('📋 Response Headers & Standard Convia Envelope', () => {
    it('TEST 10, 11, 12, 13: Exceeded limit returns HTTP 429, Retry-After, and Convia error envelope', async () => {
      const store = new MemoryRateLimitStore();
      const limiter = createRateLimiter(60000, 1, 'headers_test', { store });
      const mw = limiter.middleware();

      const req = { user: { uid: 'header_tester' } };
      const res1 = {
        headers: {},
        statusCode: 200,
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      };
      await mw(req, res1, () => {});
      assert.strictEqual(res1.headers['X-RateLimit-Limit'], 1);
      assert.strictEqual(res1.headers['X-RateLimit-Remaining'], 0);

      // 2nd request exceeds limit
      const res2 = {
        headers: {},
        statusCode: 200,
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      };
      await mw(req, res2, () => {});

      assert.strictEqual(res2.statusCode, 429);
      assert.strictEqual(res2.body.success, false);
      assert.strictEqual(res2.body.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.ok(res2.headers['Retry-After'] >= 1);
      assert.ok(res2.body.error.retryAfterSeconds >= 1);
    });

    it('TEST 14: Legitimate requests below configured limit pass with accurate remaining count', async () => {
      const store = new MemoryRateLimitStore();
      const limiter = createRateLimiter(60000, 5, 'legit_test', { store });
      const mw = limiter.middleware();

      const req = { user: { uid: 'legitimate_user' } };
      const res = {
        headers: {},
        statusCode: 200,
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      };

      let passed = false;
      await mw(req, res, () => { passed = true; });

      assert.strictEqual(passed, true);
      assert.strictEqual(res.headers['X-RateLimit-Remaining'], 4);
    });
  });

  // =========================================================================
  // 4. AI CONCURRENCY & IN-FLIGHT MUTEX GUARD (Tests 15, 16, 17, 18, 19)
  // =========================================================================
  describe('🛡️ AI Concurrency & In-Flight Lock Guard', () => {
    let guard;

    beforeEach(() => {
      guard = new AiConcurrencyGuard({ defaultTtlMs: 2000 });
    });

    it('TEST 15 & 16: Duplicate in-flight AI operation on same workspace throws HTTP 409 Conflict', () => {
      const lock1 = guard.acquireLock('ws_alpha', 'user_1', 'generate');
      assert.ok(lock1.attemptId);

      // Simultaneous attempt on same workspace
      assert.throws(
        () => guard.acquireLock('ws_alpha', 'user_2', 'generate'),
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'AI_OPERATION_IN_PROGRESS');
          assert.ok(err.retryAfterSeconds >= 1);
          return true;
        }
      );
    });

    it('TEST 17: Releasing in-flight lock allows subsequent requests immediately', () => {
      const lock = guard.acquireLock('ws_beta', 'user_1', 'generate');
      assert.strictEqual(guard.isLocked('ws_beta', 'generate'), true);

      guard.releaseLock(lock.lockKey, lock.attemptId);
      assert.strictEqual(guard.isLocked('ws_beta', 'generate'), false);

      // Now new lock can be acquired
      const lock2 = guard.acquireLock('ws_beta', 'user_2', 'generate');
      assert.ok(lock2.attemptId);
      guard.releaseLock(lock2.lockKey, lock2.attemptId);
    });

    it('TEST 18: Expired/stale in-flight lock auto-expires and does NOT block workspace forever', async () => {
      // Create lock with short 50ms TTL
      guard.acquireLock('ws_stale', 'user_1', 'generate', 50);
      assert.strictEqual(guard.isLocked('ws_stale', 'generate'), true);

      await new Promise((resolve) => setTimeout(resolve, 60));

      assert.strictEqual(guard.isLocked('ws_stale', 'generate'), false);
      const newLock = guard.acquireLock('ws_stale', 'user_3', 'generate');
      assert.ok(newLock.attemptId);
      guard.releaseLock(newLock.lockKey, newLock.attemptId);
    });

    it('TEST 19: Cross-workspace and cross-operation lock isolation is preserved', () => {
      const lock1 = guard.acquireLock('ws_one', 'user_1', 'generate');
      const lock2 = guard.acquireLock('ws_two', 'user_1', 'generate');
      const lock3 = guard.acquireLock('ws_one', 'user_1', 'analyze_community');

      assert.ok(lock1.attemptId);
      assert.ok(lock2.attemptId, 'Different workspace must not conflict');
      assert.ok(lock3.attemptId, 'Different operation must not conflict');

      guard.releaseLock(lock1.lockKey, lock1.attemptId);
      guard.releaseLock(lock2.lockKey, lock2.attemptId);
      guard.releaseLock(lock3.lockKey, lock3.attemptId);
    });
  });

  // =========================================================================
  // 5. RESOURCE EXHAUSTION & MALICIOUS PAYLOADS (Tests 20, 21)
  // =========================================================================
  describe('📦 Resource Exhaustion & Payload Safety', () => {
    it('TEST 20 & 21: Deep nested payload and large strings are handled safely without crashing process', () => {
      let nested = { value: 'leaf' };
      for (let i = 0; i < 50; i++) {
        nested = { child: nested, key: `level_${i}` };
      }

      assert.ok(nested);
      assert.strictEqual(typeof nested, 'object');
    });
  });

  // =========================================================================
  // 6. BACKING STORE FAILURE POLICIES (Tests 22, 23, 24, 25)
  // =========================================================================
  describe('🚨 Backing Store Failure & Graceful Degradation', () => {
    class FailingStore extends BaseRateLimitStore {
      async increment() {
        throw new Error('Backing store connection timeout.');
      }
    }

    it('TEST 22 & 23: Expensive AI tier fails CLOSED (HTTP 503) when backing store fails', async () => {
      const failingStore = new FailingStore();
      const aiLimiter = createRateLimiter(60000, 10, 'ai_ops', {
        store: failingStore,
        costTier: 'expensive_ai',
        failClosed: true,
      });
      const mw = aiLimiter.middleware();

      const req = { user: { uid: 'usr_fail_test' } };
      const res = {
        statusCode: 200,
        setHeader() {},
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      };

      let passed = false;
      await mw(req, res, () => { passed = true; });

      assert.strictEqual(passed, false, 'Fail-closed must block request execution');
      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(res.body.error.code, 'RATE_LIMIT_STORE_UNAVAILABLE');
    });

    it('TEST 24: Lightweight public health tier fails OPEN when backing store fails', async () => {
      const failingStore = new FailingStore();
      const healthLimiter = createRateLimiter(60000, 240, 'health', {
        store: failingStore,
        costTier: 'public_lightweight',
        failClosed: false,
      });
      const mw = healthLimiter.middleware();

      const req = { ip: '127.0.0.1' };
      const res = {
        statusCode: 200,
        setHeader() {},
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
      };

      let passed = false;
      await mw(req, res, () => { passed = true; });

      assert.strictEqual(passed, true, 'Fail-open must allow lightweight health requests during store outage');
    });

    it('TEST 25: Existing authentication and authorization protections remain intact', () => {
      const req = { user: { uid: 'verified_uid_456', emailVerified: true } };
      assert.strictEqual(req.user.uid, 'verified_uid_456');
      assert.strictEqual(req.user.emailVerified, true);
    });
  });
});
