/**
 * Authoritative Server-Side AI Concurrency & Duplicate Request Guard.
 * 
 * Prevents concurrent duplicate expensive AI operations (Blueprint generation, Community Analysis)
 * on the same workspace from:
 * 1. Double-billing Google Gemini API credits.
 * 2. Creating conflicting active Blueprint records or task sync races.
 * 3. Bypassing rate limits through rapid parallel requests.
 * 
 * Guarantees:
 * - Atomic in-flight lock acquisition.
 * - Automatic TTL expiration (default 180s) to prevent permanent lockouts if an operation crashes.
 * - Attempt ID verification on release to prevent releasing subsequent locks.
 * - Returns consistent HTTP 409 Conflict with retry semantics.
 */

class AiConcurrencyGuard {
  constructor(options = {}) {
    this.defaultTtlMs = options.defaultTtlMs || 180000; // 3 minutes maximum lock duration
    this.activeLocks = new Map(); // lockKey -> { userUid, attemptId, acquiredAt, expiresAt }

    // Periodic sweep every 60s to remove expired locks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, lock] of this.activeLocks.entries()) {
      if (now >= lock.expiresAt) {
        console.warn(`⏳ [aiConcurrencyGuard] Auto-expired stale in-flight lock for '${key}' (Held by ${lock.userUid} for ${now - lock.acquiredAt}ms)`);
        this.activeLocks.delete(key);
      }
    }
  }

  /**
   * Builds canonical lock key for an AI operation.
   */
  getLockKey(workspaceId, operation = 'generate') {
    return `workspace:${String(workspaceId).trim()}:operation:${String(operation).trim()}`;
  }

  /**
   * Atomically acquires an in-flight lock.
   * Throws HTTP 409 Conflict Error if already locked by another in-flight operation.
   * 
   * @param {string} workspaceId - Workspace identifier
   * @param {string} userUid - Authenticated user identifier
   * @param {string} operation - Operation name ('generate', 'analyze_community')
   * @param {number} ttlMs - Optional custom lock TTL
   * @returns {{ attemptId: string, lockKey: string, acquiredAt: number, expiresAt: number }}
   */
  acquireLock(workspaceId, userUid, operation = 'generate', ttlMs = this.defaultTtlMs) {
    if (!workspaceId || !userUid) {
      throw new Error('[aiConcurrencyGuard] workspaceId and userUid are required to acquire lock.');
    }

    const lockKey = this.getLockKey(workspaceId, operation);
    const now = Date.now();
    const existingLock = this.activeLocks.get(lockKey);

    if (existingLock && now < existingLock.expiresAt) {
      const remainingSeconds = Math.max(1, Math.ceil((existingLock.expiresAt - now) / 1000));
      console.warn(`🔒 [aiConcurrencyGuard] Duplicate parallel ${operation} blocked for workspace '${workspaceId}' (Active attempt: ${existingLock.attemptId} by ${existingLock.userUid})`);

      const conflictError = new Error(
        `A blueprint ${operation} is already in progress for this workspace. Please wait for it to complete.`
      );
      conflictError.statusCode = 409;
      conflictError.code = 'AI_OPERATION_IN_PROGRESS';
      conflictError.retryAfterSeconds = remainingSeconds;
      conflictError.activeUserUid = existingLock.userUid;
      conflictError.attemptId = existingLock.attemptId;
      throw conflictError;
    }

    const attemptId = `lock_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = now + ttlMs;

    const lockData = {
      userUid,
      attemptId,
      acquiredAt: now,
      expiresAt,
    };

    this.activeLocks.set(lockKey, lockData);
    console.log(`🔓 [aiConcurrencyGuard] Acquired in-flight lock for '${lockKey}' (Attempt: ${attemptId} by ${userUid}, TTL: ${ttlMs / 1000}s)`);

    return {
      attemptId,
      lockKey,
      acquiredAt: now,
      expiresAt,
    };
  }

  /**
   * Releases an in-flight lock.
   * Verifies attemptId to prevent releasing a subsequent lock acquired after timeout.
   * 
   * @param {string} lockKey - Full lock key
   * @param {string} attemptId - Attempt identifier returned by acquireLock
   * @returns {boolean} Whether the lock was successfully released
   */
  releaseLock(lockKey, attemptId) {
    if (!lockKey) return false;

    const existingLock = this.activeLocks.get(lockKey);
    if (!existingLock) {
      return true; // Already released or expired
    }

    if (attemptId && existingLock.attemptId !== attemptId) {
      console.warn(`⚠️ [aiConcurrencyGuard] Attempt ID mismatch on lock release for '${lockKey}'. Expected ${existingLock.attemptId}, got ${attemptId}. Ignored.`);
      return false;
    }

    this.activeLocks.delete(lockKey);
    console.log(`✅ [aiConcurrencyGuard] Released in-flight lock for '${lockKey}' (Attempt: ${attemptId})`);
    return true;
  }

  /**
   * Checks if an operation is currently locked.
   */
  isLocked(workspaceId, operation = 'generate') {
    const lockKey = this.getLockKey(workspaceId, operation);
    const existingLock = this.activeLocks.get(lockKey);
    if (!existingLock) return false;
    if (Date.now() >= existingLock.expiresAt) {
      this.activeLocks.delete(lockKey);
      return false;
    }
    return true;
  }

  reset() {
    this.activeLocks.clear();
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.activeLocks.clear();
  }
}

export const aiConcurrencyGuard = new AiConcurrencyGuard();
export { AiConcurrencyGuard };
