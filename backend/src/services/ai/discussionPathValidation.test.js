import { describe, it } from 'node:test';
import assert from 'node:assert';

// Explicit database path generators matching frontend/src/constants/databasePaths.js
export const getWorkspaceDiscussionPath = (orgId, ideaId, discussionId = null) => {
  if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
    throw new Error('[databasePaths] orgId is required for workspace discussion path.');
  }
  if (!ideaId || typeof ideaId !== 'string' || !ideaId.trim()) {
    throw new Error('[databasePaths] ideaId is required for workspace discussion path.');
  }
  const cleanOrg = orgId.trim();
  const cleanIdea = ideaId.trim();
  if (!discussionId) return `discussions/${cleanOrg}/${cleanIdea}`;
  return `discussions/${cleanOrg}/${cleanIdea}/${String(discussionId).trim()}`;
};

export const getPublicDiscussionPath = (ideaId, discussionId = null) => {
  if (!ideaId || typeof ideaId !== 'string' || !ideaId.trim()) {
    throw new Error('[databasePaths] ideaId is required for public discussion path.');
  }
  const cleanIdea = ideaId.trim();
  if (!discussionId) return `discussions/public/${cleanIdea}`;
  return `discussions/public/${cleanIdea}/${String(discussionId).trim()}`;
};

export const getDiscussionPath = (arg1, arg2 = null, arg3 = null) => {
  if (arg1 && typeof arg1 === 'object') {
    const { scope = 'workspace', orgId, ideaId, discussionId = null } = arg1;
    if (scope === 'public') {
      return getPublicDiscussionPath(ideaId, discussionId);
    }
    return getWorkspaceDiscussionPath(orgId, ideaId, discussionId);
  }

  const orgId = arg1;
  const ideaId = arg2;
  const discussionId = arg3;

  if (orgId === 'public' || orgId === null || orgId === undefined) {
    if (orgId === 'public') {
      return getPublicDiscussionPath(ideaId, discussionId);
    }
    throw new Error('[databasePaths] Missing orgId. For public discussions, explicitly use getPublicDiscussionPath(ideaId) or pass orgId = "public".');
  }

  return getWorkspaceDiscussionPath(orgId, ideaId, discussionId);
};

// Verified Idea Ownership simulation matching frontend/src/services/discussionService.js
export function verifyIdeaOwnership(mockDb, orgId, ideaId, isPublic = false) {
  if (!ideaId) return false;
  if (isPublic || orgId === 'public') {
    const pubIdea = mockDb[`publicIdeas/${ideaId}`];
    return Boolean(pubIdea && !pubIdea.isDeleted);
  }
  if (!orgId || typeof orgId !== 'string' || !orgId.trim()) return false;
  const wsIdea = mockDb[`ideas/${orgId.trim()}/${ideaId}`];
  return Boolean(wsIdea && !wsIdea.isDeleted);
}

// Fallback resolver with ownership verification
export function resolveDiscussionsWithFallback(mockDb, orgId, ideaId, isPublic = false) {
  const canonicalPath = isPublic
    ? getPublicDiscussionPath(ideaId)
    : getWorkspaceDiscussionPath(orgId, ideaId);

  const canonicalData = mockDb[canonicalPath];
  if (canonicalData && Object.keys(canonicalData).length > 0) {
    return { data: canonicalData, source: 'canonical', allowed: true };
  }

  // Security Check: Verify ownership before attempting legacy fallback
  const isOwnershipVerified = verifyIdeaOwnership(mockDb, orgId, ideaId, isPublic);
  if (!isOwnershipVerified) {
    return { data: null, source: 'denied', allowed: false };
  }

  const legacyData = mockDb[`discussions/${ideaId}`];
  if (legacyData && Object.keys(legacyData).length > 0) {
    return { data: legacyData, source: 'legacy_fallback', allowed: true };
  }

  return { data: null, source: 'empty', allowed: true };
}

// Recursive discussion leaf counter matching backend/src/services/globalStatsService.js
export function countDiscussionLeaves(node) {
  let count = 0;
  function traverse(n) {
    if (!n || typeof n !== 'object') return;
    if (n.discussionId || (n.message && n.authorId)) {
      if (!n.isDeleted) count++;
      return;
    }
    Object.values(n).forEach((child) => traverse(child));
  }
  traverse(node);
  return count;
}

describe('🧪 CONVIA SECURITY FIX 2A — DISCUSSION MIGRATION BOUNDARY HARDENING TEST SUITE', () => {
  describe('🔍 TEST A: Correct Workspace Path Resolution', () => {
    it('generates discussions/orgA/idea1 for workspace idea', () => {
      const path = getWorkspaceDiscussionPath('orgA', 'idea1');
      assert.strictEqual(path, 'discussions/orgA/idea1');
    });

    it('generates discussions/orgA/idea1/disc99 for workspace discussion document', () => {
      const path = getWorkspaceDiscussionPath('orgA', 'idea1', 'disc99');
      assert.strictEqual(path, 'discussions/orgA/idea1/disc99');
    });
  });

  describe('🔍 TEST B: Missing Workspace Boundary Failure (No Implicit Fallback)', () => {
    it('throws error when orgId is null on workspace path request', () => {
      assert.throws(() => {
        getWorkspaceDiscussionPath(null, 'idea1');
      }, /orgId is required/);
    });

    it('throws error when orgId is undefined on workspace path request', () => {
      assert.throws(() => {
        getWorkspaceDiscussionPath(undefined, 'idea1');
      }, /orgId is required/);
    });

    it('throws error when orgId is empty string', () => {
      assert.throws(() => {
        getWorkspaceDiscussionPath('   ', 'idea1');
      }, /orgId is required/);
    });

    it('unified getDiscussionPath fails explicitly if workspace call omits orgId', () => {
      assert.throws(() => {
        getDiscussionPath(null, 'idea1');
      }, /Missing orgId/);
    });
  });

  describe('🔍 TEST C: Explicit Public Path Resolution', () => {
    it('generates discussions/public/idea1 for explicit public idea', () => {
      const path = getPublicDiscussionPath('idea1');
      assert.strictEqual(path, 'discussions/public/idea1');
    });

    it('generates discussions/public/idea1/disc88 for public discussion item', () => {
      const path = getPublicDiscussionPath('idea1', 'disc88');
      assert.strictEqual(path, 'discussions/public/idea1/disc88');
    });

    it('unified getDiscussionPath with scope "public" produces public path', () => {
      const path = getDiscussionPath({ scope: 'public', ideaId: 'idea_global' });
      assert.strictEqual(path, 'discussions/public/idea_global');
    });
  });

  describe('🔍 TEST D: Cross-Organization Legacy Fallback Attack Prevention', () => {
    it('DENIES fallback when Organization A queries Idea B belonging to Organization B', () => {
      const mockDatabase = {
        'ideas/orgB/ideaB': { ideaId: 'ideaB', orgId: 'orgB', title: 'Org B Secret Proposal' },
        'discussions/ideaB': {
          disc_b1: { discussionId: 'disc_b1', message: 'Confidential discussion in Org B' },
        },
      };

      // Attacker from orgA requests discussions for ideaB
      const result = resolveDiscussionsWithFallback(mockDatabase, 'orgA', 'ideaB', false);
      assert.strictEqual(result.allowed, false, 'Cross-org legacy fallback must be DENIED');
      assert.strictEqual(result.source, 'denied');
      assert.strictEqual(result.data, null, 'No confidential discussions returned');
    });
  });

  describe('🔍 TEST E: Valid Legacy Fallback with Confirmed Ownership', () => {
    it('ALLOWS fallback when Idea A exists under Org A and legacy discussions exist', () => {
      const mockDatabase = {
        'ideas/orgA/ideaA': { ideaId: 'ideaA', orgId: 'orgA', title: 'Legitimate Org A Proposal' },
        'discussions/ideaA': {
          disc_a1: { discussionId: 'disc_a1', message: 'Legitimate discussion for Idea A' },
        },
      };

      const result = resolveDiscussionsWithFallback(mockDatabase, 'orgA', 'ideaA', false);
      assert.strictEqual(result.allowed, true, 'Fallback should be allowed for genuine owner');
      assert.strictEqual(result.source, 'legacy_fallback');
      assert.ok(result.data.disc_a1, 'Returns Idea A discussion data');
    });

    it('prefers canonical discussions/orgA/ideaA when populated without reading legacy', () => {
      const mockDatabase = {
        'ideas/orgA/ideaA': { ideaId: 'ideaA', orgId: 'orgA', title: 'Legitimate Org A Proposal' },
        'discussions/orgA/ideaA': {
          disc_canonical: { discussionId: 'disc_canonical', message: 'Canonical 3-segment post' },
        },
        'discussions/ideaA': {
          disc_legacy: { discussionId: 'disc_legacy', message: 'Stale legacy post' },
        },
      };

      const result = resolveDiscussionsWithFallback(mockDatabase, 'orgA', 'ideaA', false);
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.source, 'canonical');
      assert.ok(result.data.disc_canonical);
      assert.strictEqual(result.data.disc_legacy, undefined);
    });
  });

  describe('🔍 TEST F: Public vs Workspace Isolation', () => {
    it('ensures public discussions are segregated from workspace discussions with identical ideaId', () => {
      const pubPath = getPublicDiscussionPath('same_id');
      const wsPath = getWorkspaceDiscussionPath('org_xyz', 'same_id');
      assert.notStrictEqual(pubPath, wsPath);
      assert.strictEqual(pubPath, 'discussions/public/same_id');
      assert.strictEqual(wsPath, 'discussions/org_xyz/same_id');
    });
  });

  describe('🔍 TEST G: CRUD Boundary Regression Verification', () => {
    it('accurately counts multi-level discussion trees in global telemetry', () => {
      const complexTree = {
        org_1: {
          idea_1: {
            d1: { discussionId: 'd1', message: 'Comment 1', authorId: 'u1', isDeleted: false },
          },
        },
        public: {
          idea_2: {
            d2: { discussionId: 'd2', message: 'Comment 2', authorId: 'u2', isDeleted: false },
          },
        },
      };

      const total = countDiscussionLeaves(complexTree);
      assert.strictEqual(total, 2);
    });
  });
});
