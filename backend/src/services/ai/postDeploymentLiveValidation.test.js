import { describe, it } from 'node:test';
import assert from 'node:assert';

const RTDB_URL = 'https://brainsync-07-default-rtdb.asia-southeast1.firebasedatabase.app';

describe('🧪 CONVIA SECURITY FIX 6 — LIVE POST-DEPLOYMENT CLOUD ENFORCEMENT', () => {
  describe('🔒 LIVE ENFORCEMENT: Unauthenticated Protected Path Denials', () => {
    it('live cloud rejects unauthenticated read to /users.json with Permission denied', async () => {
      const res = await fetch(`${RTDB_URL}/users.json`);
      const data = await res.json();
      assert.strictEqual(res.status, 401, 'Status must be 401 Unauthorized');
      assert.strictEqual(data.error, 'Permission denied');
    });

    it('live cloud rejects unauthenticated read to /ideas.json with Permission denied', async () => {
      const res = await fetch(`${RTDB_URL}/ideas.json`);
      const data = await res.json();
      assert.strictEqual(res.status, 401, 'Status must be 401 Unauthorized');
      assert.strictEqual(data.error, 'Permission denied');
    });

    it('live cloud rejects unauthenticated read to /tasks.json with Permission denied', async () => {
      const res = await fetch(`${RTDB_URL}/tasks.json`);
      const data = await res.json();
      assert.strictEqual(res.status, 401, 'Status must be 401 Unauthorized');
      assert.strictEqual(data.error, 'Permission denied');
    });

    it('live cloud rejects unauthenticated read to /blueprints.json with Permission denied', async () => {
      const res = await fetch(`${RTDB_URL}/blueprints.json`);
      const data = await res.json();
      assert.strictEqual(res.status, 401, 'Status must be 401 Unauthorized');
      assert.strictEqual(data.error, 'Permission denied');
    });

    it('live cloud rejects unauthenticated read to /workspaceChats.json with Permission denied', async () => {
      const res = await fetch(`${RTDB_URL}/workspaceChats.json`);
      const data = await res.json();
      assert.strictEqual(res.status, 401, 'Status must be 401 Unauthorized');
      assert.strictEqual(data.error, 'Permission denied');
    });

    it('live cloud rejects unauthenticated read to /admin_audit_logs.json with Permission denied', async () => {
      const res = await fetch(`${RTDB_URL}/admin_audit_logs.json`);
      const data = await res.json();
      assert.strictEqual(res.status, 401, 'Status must be 401 Unauthorized');
      assert.strictEqual(data.error, 'Permission denied');
    });
  });

  describe('🌐 LIVE ENFORCEMENT: Public Reads & Write Lockouts', () => {
    it('live cloud allows public read to /globalStats.json', async () => {
      const res = await fetch(`${RTDB_URL}/globalStats.json`);
      assert.strictEqual(res.status, 200, 'Global stats must be publicly readable');
    });

    it('live cloud rejects unauthenticated write to /platform_settings.json', async () => {
      const res = await fetch(`${RTDB_URL}/platform_settings.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maliciousKey: true }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Permission denied');
    });

    it('live cloud rejects unauthenticated write to /announcements.json', async () => {
      const res = await fetch(`${RTDB_URL}/announcements.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maliciousAnnouncement: true }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Permission denied');
    });
  });
});
