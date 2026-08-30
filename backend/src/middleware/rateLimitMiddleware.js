/**
 * Production-Grade Tiered Rate Limiting Middleware.
 * Backed by pluggable RateLimitStore with bounded memory, atomic increments, and LRU pruning.
 * 
 * Guarantees:
 * 1. Strict server-derived identity (verified req.user.uid for authenticated callers).
 * 2. Unspoofable IP resolution adhering to Express trust proxy configuration.
 * 3. Deterministic failure policies (failClosed for expensive AI/admin routes, failOpen for liveness).
 * 4. Standard rate limit headers (X-RateLimit-Limit, Remaining, Reset, Retry-After).
 * 5. Standard Convia error envelope { success: false, error: { code, message, retryAfterSeconds } }.
 */

import { getRateLimitStore, MemoryRateLimitStore } from '../services/rateLimitStore.js';

/**
 * Safely resolves client IP address without trusting unverified spoofed headers.
 */
export function resolveClientIp(req) {
  // If Express trust proxy is enabled, req.ip contains the validated client IP.
  if (req.ip) {
    return req.ip;
  }

  // Fallback to socket remote address
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Resolves authoritative rate-limit identity key.
 * Strictly derives from verified req.user.uid for authenticated requests, ignoring client-supplied headers.
 */
export function resolveRateLimitIdentity(req) {
  if (req.user && typeof req.user.uid === 'string' && req.user.uid.trim()) {
    return `user:${req.user.uid.trim()}`;
  }

  const safeIp = resolveClientIp(req);
  return `ip:${safeIp}`;
}

export class TieredRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.max = options.max || 60;
    this.name = options.name || 'default';
    this.costTier = options.costTier || 'standard';
    this.failClosed = options.failClosed ?? (this.costTier === 'expensive_ai' || this.costTier === 'admin');
    this.store = options.store || getRateLimitStore();
  }

  middleware() {
    return async (req, res, next) => {
      const identity = resolveRateLimitIdentity(req);
      const fullKey = `${this.name}:${identity}`;

      try {
        const result = await this.store.increment(fullKey, this.windowMs, this.max);

        res.setHeader('X-RateLimit-Limit', this.max);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', result.resetTimeSeconds);

        if (!result.allowed) {
          res.setHeader('Retry-After', result.retryAfterSeconds);
          return res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Too many requests to ${this.name}. Please wait ${result.retryAfterSeconds} second(s) before trying again.`,
              retryAfterSeconds: result.retryAfterSeconds,
            },
          });
        }

        next();
      } catch (err) {
        console.error(`🚨 [rateLimitMiddleware] Store error on key '${fullKey}':`, err.message);

        if (this.failClosed) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_STORE_UNAVAILABLE',
              message: 'Rate limit verification is temporarily unavailable. Request blocked for system protection.',
            },
          });
        }

        // Fail-open for lightweight / non-critical routes to preserve availability
        console.warn(`⚠️ [rateLimitMiddleware] Fail-open policy applied for ${this.name} on '${identity}'`);
        next();
      }
    };
  }

  async reset() {
    if (this.store && typeof this.store.reset === 'function') {
      await this.store.reset();
    }
  }
}

/**
 * Pre-configured rate limiters for distinct operational tiers:
 */

// Tier 0: Public liveness and global statistics (IP-keyed, failOpen)
export const healthRateLimiter = new TieredRateLimiter({
  windowMs: 60000,
  max: 240,
  name: 'health_check',
  costTier: 'public_lightweight',
  failClosed: false,
}).middleware();

export const publicRateLimiter = new TieredRateLimiter({
  windowMs: 60000,
  max: 120,
  name: 'public_stats',
  costTier: 'public_stats',
  failClosed: false,
}).middleware();

// Tier 1: Expensive AI Generation & Community Intelligence (User-keyed, failClosed)
export const aiRateLimiter = new TieredRateLimiter({
  windowMs: 60000,
  max: 10,
  name: 'ai_operations',
  costTier: 'expensive_ai',
  failClosed: true,
}).middleware();

// Tier 2: High-Cost Operational Routes (Sync, Approval, Recovery) (User-keyed, failClosed)
export const highCostRateLimiter = new TieredRateLimiter({
  windowMs: 60000,
  max: 30,
  name: 'high_cost_operations',
  costTier: 'high_cost_ops',
  failClosed: true,
}).middleware();

// Tier 3: Standard Authenticated Operations (User-keyed, failOpen with log)
export const standardRateLimiter = new TieredRateLimiter({
  windowMs: 60000,
  max: 60,
  name: 'standard_operations',
  costTier: 'standard',
  failClosed: false,
}).middleware();

// Tier 4: Privileged Administrative Operations (Admin-keyed, failClosed)
export const adminRateLimiter = new TieredRateLimiter({
  windowMs: 60000,
  max: 60,
  name: 'admin_operations',
  costTier: 'admin',
  failClosed: true,
}).middleware();

// Factory export for testing and custom rate limit configurations
export function createRateLimiter(windowMs, max, name, options = {}) {
  return new TieredRateLimiter({
    windowMs,
    max,
    name,
    ...options,
  });
}
