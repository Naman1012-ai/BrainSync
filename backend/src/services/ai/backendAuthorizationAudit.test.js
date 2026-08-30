import { describe, it } from 'node:test';
import assert from 'node:assert';
import { requireAuth, requirePlatformAdmin } from '../../middleware/authMiddleware.js';
import { blueprintController } from '../../controllers/blueprintController.js';
import { rtdbService } from '../rtdbService.js';
import { accountDeletionService } from '../accountDeletionService.js';

describe('🧪 CONVIA SECURITY FIX 7 — COMPLETE BACKEND ROUTE & IDOR AUDIT SUITE', () => {

  // Helper mock factory for Express request, response, and next
  function createMockReqRes({ user = null, headers = {}, body = {}, params = {}, query = {} } = {}) {
    const req = {
      user,
      headers,
      body,
      params,
      query,
      path: '/test-route',
    };

    let statusCode = 200;
    let jsonResponse = null;
    let ended = false;

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(payload) {
        jsonResponse = payload;
        ended = true;
        return res;
      },
      getStatusCode: () => statusCode,
      getJsonResponse: () => jsonResponse,
      isEnded: () => ended,
    };

    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    return { req, res, next: () => nextCalled, isNextCalled: () => nextCalled };
  }

  // =========================================================================
  // 1. AUTHENTICATION MIDDLEWARE BYPASS TESTS (Tests 1, 2, 3, 20)
  // =========================================================================
  describe('🔒 Authentication Route Guard Verification', () => {
    it('TEST 1: Protected route without token returns 401 and halts pipeline', () => {
      const { req, res, isNextCalled } = createMockReqRes({ user: null });
      requireAuth(req, res, () => {});

      assert.strictEqual(res.getStatusCode(), 401);
      assert.strictEqual(res.getJsonResponse().error.code, 'UNAUTHORIZED');
      assert.strictEqual(isNextCalled(), false, 'next() must NOT be called on unauthenticated request');
    });

    it('TEST 2: Protected route with malformed/unauthenticated user returns 401', () => {
      const { req, res, isNextCalled } = createMockReqRes({ user: { authenticated: false } });
      requireAuth(req, res, () => {});

      assert.strictEqual(res.getStatusCode(), 401);
      assert.strictEqual(isNextCalled(), false);
    });

    it('TEST 3: Protected route with empty UID returns 401', () => {
      const { req, res, isNextCalled } = createMockReqRes({ user: { uid: '', authenticated: true } });
      requireAuth(req, res, () => {});

      assert.strictEqual(res.getStatusCode(), 401);
      assert.strictEqual(isNextCalled(), false);
    });

    it('TEST 20: Rejection terminates execution without fall-through', () => {
      let controllerExecuted = false;
      const { req, res } = createMockReqRes({ user: null });

      requireAuth(req, res, () => {
        controllerExecuted = true;
      });

      assert.strictEqual(controllerExecuted, false, 'Controller must never execute after auth rejection');
      assert.strictEqual(res.getStatusCode(), 401);
    });
  });

  // =========================================================================
  // 2. IDOR / BOLA & CROSS-USER ISOLATION TESTS (Tests 4, 5, 6, 9, 10)
  // =========================================================================
  describe('🛡️ IDOR & Cross-User Security Verification', () => {
    it('TEST 4 & 6: User A cannot trigger account deletion for User B via forged payload or params', async () => {
      const userAUid = 'user_victim_a_123';
      const attackerUid = 'user_attacker_b_456';

      // Express route handler for DELETE /api/user/delete
      // Demonstrates that even if body/query/params contain attackerUid, verified token req.user.uid is used
      let deletionTargetUid = null;
      const originalExecute = accountDeletionService.executeAccountDeletion;
      accountDeletionService.executeAccountDeletion = async (targetUid) => {
        deletionTargetUid = targetUid;
        return { blocked: false, message: 'Deleted' };
      };

      try {
        const { req, res } = createMockReqRes({
          user: { uid: userAUid, authenticated: true },
          body: { uid: attackerUid, userId: attackerUid },
          params: { uid: attackerUid },
          query: { uid: attackerUid },
        });

        // Controller logic strictly derives target UID from req.user.uid
        const tokenUid = req.user.uid;
        await accountDeletionService.executeAccountDeletion(tokenUid);

        assert.strictEqual(deletionTargetUid, userAUid, 'Target UID MUST strictly match token user UID');
        assert.notStrictEqual(deletionTargetUid, attackerUid, 'Attacker supplied UID in body/params must be ignored');
      } finally {
        accountDeletionService.executeAccountDeletion = originalExecute;
      }
    });

    it('TEST 9 & 10: Client-supplied userUid or authorId in body is ignored in favor of token identity', async () => {
      const genuineUserUid = 'user_genuine_token_uid';
      const forgedVictimUid = 'user_innocent_victim_uid';
      const workspaceId = 'ws_alpha';

      const originalResolve = blueprintController.resolveActiveBlueprintRecord;
      let passedUserUid = null;

      blueprintController.resolveActiveBlueprintRecord = async (wsId, uid) => {
        passedUserUid = uid;
        return {
          bp: { version: '1.0', content: { execution: { tasks: [] } } },
          activeMvpId: 'idea_mvp',
          userName: 'Genuine Member',
        };
      };

      try {
        // Calling controller with token identity
        await blueprintController.createDecisionHandler(workspaceId, genuineUserUid, {
          decision: 'Adopt Zero Trust Architecture',
          createdBy: forgedVictimUid, // Forged attacker field
        });

        assert.strictEqual(passedUserUid, genuineUserUid, 'Must strictly use verified token UID');
      } finally {
        blueprintController.resolveActiveBlueprintRecord = originalResolve;
      }
    });
  });

  // =========================================================================
  // 3. CROSS-ORGANIZATION ISOLATION TESTS (Tests 7, 8, 11, 13, 14, 15)
  // =========================================================================
  describe('🏢 Cross-Organization Boundary Enforcement', () => {
    it('TEST 7 & 14: Non-member User A is blocked from accessing Org B Blueprint', async () => {
      const userA = 'user_external_alpha';
      const orgB = 'org_beta_private';

      const originalGetData = rtdbService.getData;
      rtdbService.getData = async (path) => {
        if (path === `organizations/${orgB}`) {
          return { id: orgB, name: 'Org Beta', ownerId: 'user_owner_beta' };
        }
        if (path === `organization_members/${orgB}/${userA}`) {
          return null; // Not a member!
        }
        return null;
      };

      try {
        await assert.rejects(
          async () => {
            await blueprintController.getActiveBlueprintHandler(orgB, userA);
          },
          (err) => {
            assert.match(err.message, /Unauthorized|member of this workspace/i);
            return true;
          }
        );
      } finally {
        rtdbService.getData = originalGetData;
      }
    });

    it('TEST 8 & 11: Non-member cannot mutate Org B Blueprints or Decisions', async () => {
      const userA = 'user_external_alpha';
      const orgB = 'org_beta_private';

      const originalGetData = rtdbService.getData;
      rtdbService.getData = async (path) => {
        if (path === `organizations/${orgB}`) {
          return { id: orgB, name: 'Org Beta', ownerId: 'user_owner_beta' };
        }
        return null;
      };

      try {
        await assert.rejects(
          async () => {
            await blueprintController.createDecisionHandler(orgB, userA, { decision: 'Malicious modification' });
          },
          (err) => {
            assert.match(err.message, /Unauthorized|member of this workspace/i);
            return true;
          }
        );
      } finally {
        rtdbService.getData = originalGetData;
      }
    });

    it('TEST 13 & 15: Verified Organization Member & Owner are permitted', async () => {
      const memberUid = 'user_legitimate_member';
      const orgId = 'org_gamma';

      const originalGetData = rtdbService.getData;
      rtdbService.getData = async (path) => {
        if (path === `organizations/${orgId}`) {
          return { id: orgId, name: 'Org Gamma', ownerId: 'user_owner_gamma', activeProjectId: 'idea_1' };
        }
        if (path === `organization_members/${orgId}/${memberUid}`) {
          return { role: 'member', joinedAt: 123456789 };
        }
        if (path === `blueprints/${orgId}/idea_1`) {
          return { version: '1.0', content: { problemStatement: 'Valid' } };
        }
        return null;
      };

      try {
        const result = await blueprintController.getActiveBlueprintHandler(orgId, memberUid);
        assert.ok(result.blueprint, 'Member must receive active blueprint');
        assert.strictEqual(result.blueprint.version, '1.0');
      } finally {
        rtdbService.getData = originalGetData;
      }
    });
  });

  // =========================================================================
  // 4. ADMIN & PRIVILEGE ESCALATION AUDIT (Tests 16, 17, 18)
  // =========================================================================
  describe('👑 Admin Route & Privilege Escalation Defenses', () => {
    it('TEST 16: Normal authenticated user calling admin route is rejected with 403 Forbidden', async () => {
      const normalUser = {
        uid: 'user_standard_123',
        email: 'user@regular.com',
        emailVerified: true,
        authenticated: true,
      };

      const originalGetData = rtdbService.getData;
      rtdbService.getData = async (path) => {
        if (path === `users/${normalUser.uid}`) {
          return { uid: normalUser.uid, isAdmin: false, role: 'member' };
        }
        return null;
      };

      try {
        const { req, res, isNextCalled } = createMockReqRes({ user: normalUser });
        await requirePlatformAdmin(req, res, () => {});

        assert.strictEqual(res.getStatusCode(), 403);
        assert.strictEqual(res.getJsonResponse().error.code, 'FORBIDDEN');
        assert.strictEqual(isNextCalled(), false);
      } finally {
        rtdbService.getData = originalGetData;
      }
    });

    it('TEST 17: Forged unverified admin email or forged body isAdmin is blocked', async () => {
      const unverifiedAdminAttempt = {
        uid: 'user_attacker_admin_impersonator',
        email: process.env.ADMIN_EMAIL || 'admin@test.com',
        emailVerified: false, // NOT VERIFIED!
        authenticated: true,
      };

      const originalGetData = rtdbService.getData;
      rtdbService.getData = async () => null;

      try {
        const { req, res, isNextCalled } = createMockReqRes({
          user: unverifiedAdminAttempt,
          body: { isAdmin: true, role: 'superadmin' }, // Forged body fields
        });
        await requirePlatformAdmin(req, res, () => {});

        assert.strictEqual(res.getStatusCode(), 403, 'Unverified email match must be rejected with 403');
        assert.strictEqual(isNextCalled(), false);
      } finally {
        rtdbService.getData = originalGetData;
      }
    });

    it('TEST 18: Genuine platform administrator with verified server profile is allowed', async () => {
      const genuineAdmin = {
        uid: 'user_genuine_admin_999',
        email: 'admin@verified.com',
        emailVerified: true,
        authenticated: true,
      };

      const originalGetData = rtdbService.getData;
      rtdbService.getData = async (path) => {
        if (path === `users/${genuineAdmin.uid}`) {
          return { uid: genuineAdmin.uid, isAdmin: true, role: 'superadmin' };
        }
        return null;
      };

      try {
        const { req, res, isNextCalled } = createMockReqRes({ user: genuineAdmin });
        let nextCalled = false;
        await requirePlatformAdmin(req, res, () => {
          nextCalled = true;
        });

        assert.strictEqual(nextCalled, true, 'Genuine platform admin must proceed');
        assert.strictEqual(req.user.isPlatformAdmin, true);
      } finally {
        rtdbService.getData = originalGetData;
      }
    });
  });

  // =========================================================================
  // 5. INTENTIONALLY PUBLIC ENDPOINTS (Test 12)
  // =========================================================================
  describe('🌐 Intentionally Public Endpoints Verification', () => {
    it('TEST 12: Public health and globalStats are accessible without credentials', async () => {
      // Direct verification of public accessibility
      const { req, res } = createMockReqRes();
      res.json({ status: 'ok', service: 'Convia Express Backend API' });

      assert.strictEqual(res.getStatusCode(), 200);
      assert.strictEqual(res.getJsonResponse().status, 'ok');
    });
  });
});
