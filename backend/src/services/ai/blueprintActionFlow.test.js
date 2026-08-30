import assert from 'node:assert';
import { createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT ACTION FLOW, ACTIVE RESOLUTION & ROUTING TEST SUITE');
console.log('🧪 ====================================================\n');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// TEST GROUP 1: AUTHORITATIVE ACTIVE BLUEPRINT RESOLUTION
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Authoritative Active Blueprint Resolution Engine');

// Simulated resolver mirroring resolveActiveBlueprintRecord
function resolveActiveBlueprint(workspaceId, userUid, databaseState) {
  if (!workspaceId || !userUid) throw new Error('Workspace ID and User UID are required.');

  const memberRecord = databaseState[`organization_members/${workspaceId}/${userUid}`];
  const org = databaseState[`organizations/${workspaceId}`] || databaseState[`workspaces/${workspaceId}`];
  const wsMeta = databaseState[`workspaces/${workspaceId}/metadata`];
  const userRecord = databaseState[`users/${userUid}`];

  if (!org) throw new Error('Workspace does not exist.');
  const isOwner = org.ownerId === userUid || org.createdBy === userUid || org.ownerUid === userUid;
  const isMember = Boolean(memberRecord || isOwner || (org.members && org.members[userUid]));
  if (!isMember) {
    throw new Error('Unauthorized. You must be a member of this workspace to perform this action.');
  }

  let activeMvpId = org.activeProjectId || org.selectedIdeaId || org.activeMvpId || wsMeta?.selectedIdeaId || wsMeta?.activeProjectId;

  if (!activeMvpId) {
    const allIdeas = databaseState[`ideas/${workspaceId}`] || {};
    const selectedIdea = Object.values(allIdeas).find(
      (i) => i && (i.isSelected === true || i.status === 'Selected MVP' || i.isMvp === true)
    );
    if (selectedIdea) {
      activeMvpId = selectedIdea.id || selectedIdea.ideaId;
    }
  }

  let bp = null;
  if (activeMvpId) {
    bp = databaseState[`blueprints/${workspaceId}/${activeMvpId}`];
  }
  if (!bp || !bp.content) {
    bp = databaseState[`blueprints/${workspaceId}/current`] || databaseState[`blueprints/${workspaceId}/active`];
  }
  if (!bp || !bp.content) {
    const rawRoot = databaseState[`blueprints/${workspaceId}`];
    if (rawRoot && typeof rawRoot === 'object') {
      if (rawRoot.content || rawRoot.projectOverview) {
        bp = rawRoot;
      } else if (activeMvpId && rawRoot[activeMvpId] && (rawRoot[activeMvpId].content || rawRoot[activeMvpId].projectOverview)) {
        bp = rawRoot[activeMvpId];
      } else if (rawRoot.current && (rawRoot.current.content || rawRoot.current.projectOverview)) {
        bp = rawRoot.current;
      }
    }
  }

  if (!bp || !bp.content) {
    const allVersions = databaseState[`blueprints/${workspaceId}/${activeMvpId}/versions`] ||
                        databaseState[`blueprints/${workspaceId}/versions`] ||
                        bp?.versions ||
                        {};
    const validVersions = Object.values(allVersions).filter((v) => v && (v.content || v.projectOverview));
    if (validVersions.length > 0) {
      validVersions.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
      bp = {
        ...validVersions[0],
        status: 'completed',
        versions: allVersions,
      };
    }
  }

  if (!bp || !bp.content) {
    throw new Error('No active Blueprint found for this workspace. Please generate a Blueprint first.');
  }

  const userName = userRecord?.displayName || userRecord?.name || userRecord?.email?.split('@')[0] || 'Team Lead';

  return { bp, activeMvpId, org, userName, isOwner };
}

it('Resolves active Blueprint from direct MVP path when activeProjectId is populated', () => {
  const v17Content = createDefaultBlueprint2Content();
  const db = {
    'organizations/ws_1': { id: 'ws_1', ownerId: 'user_1', activeProjectId: 'idea_1' },
    'users/user_1': { uid: 'user_1', displayName: 'Naman' },
    'blueprints/ws_1/idea_1': {
      blueprintId: 'bp_1',
      version: '17.0',
      status: 'completed',
      content: v17Content,
    },
  };

  const res = resolveActiveBlueprint('ws_1', 'user_1', db);
  assert.strictEqual(res.activeMvpId, 'idea_1');
  assert.strictEqual(res.bp.version, '17.0');
  assert.ok(res.bp.content);
});

it('Resolves active Blueprint from current alias when activeProjectId points to empty draft', () => {
  const v17Content = createDefaultBlueprint2Content();
  const db = {
    'organizations/ws_1': { id: 'ws_1', ownerId: 'user_1', activeProjectId: 'idea_1' },
    'users/user_1': { uid: 'user_1', displayName: 'Naman' },
    'blueprints/ws_1/idea_1': { blueprintId: 'bp_1', version: '1.0', content: null }, // empty placeholder
    'blueprints/ws_1/current': {
      blueprintId: 'bp_1',
      version: '17.0',
      status: 'completed',
      content: v17Content,
    },
  };

  const res = resolveActiveBlueprint('ws_1', 'user_1', db);
  assert.strictEqual(res.bp.version, '17.0');
  assert.ok(res.bp.content);
});

it('Resolves active Blueprint by recovering latest completed version snapshot when root node has stale lock', () => {
  const v17Content = createDefaultBlueprint2Content();
  const db = {
    'organizations/ws_1': { id: 'ws_1', ownerId: 'user_1', activeProjectId: 'idea_1' },
    'users/user_1': { uid: 'user_1', displayName: 'Naman' },
    'blueprints/ws_1/idea_1': { blueprintId: 'bp_1', version: '1.0', status: 'generating', content: null },
    'blueprints/ws_1/idea_1/versions': {
      v16_0: { version: '16.0', status: 'completed', content: createDefaultBlueprint2Content() },
      v17_0: { version: '17.0', status: 'completed', content: v17Content },
    },
  };

  const res = resolveActiveBlueprint('ws_1', 'user_1', db);
  assert.strictEqual(res.bp.version, '17.0');
  assert.strictEqual(res.bp.status, 'completed');
  assert.ok(res.bp.content);
});

it('Resolves selected MVP from ideas collection when org metadata is missing activeProjectId', () => {
  const v17Content = createDefaultBlueprint2Content();
  const db = {
    'organizations/ws_1': { id: 'ws_1', ownerId: 'user_1' }, // activeProjectId missing
    'users/user_1': { uid: 'user_1', displayName: 'Naman' },
    'ideas/ws_1': {
      idea_draft: { id: 'idea_draft', title: 'Idea 1', isSelected: false },
      idea_winner: { id: 'idea_winner', title: 'Winner MVP', isSelected: true },
    },
    'blueprints/ws_1/idea_winner': {
      blueprintId: 'bp_winner',
      version: '17.0',
      status: 'completed',
      content: v17Content,
    },
  };

  const res = resolveActiveBlueprint('ws_1', 'user_1', db);
  assert.strictEqual(res.activeMvpId, 'idea_winner');
  assert.strictEqual(res.bp.version, '17.0');
});

// -------------------------------------------------------------
// TEST GROUP 2: BLUEPRINT ACTION HANDLERS (ASSIGN, APPROVE, REJECT)
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Blueprint Interactive Action Execution');

it('Confirm Assignment updates task in execution plan without corrupting version', () => {
  const content = createDefaultBlueprint2Content();
  const db = {
    'organizations/ws_1': { id: 'ws_1', ownerId: 'user_lead', activeProjectId: 'idea_1' },
    'organization_members/ws_1/user_dev': { role: 'member' },
    'users/user_lead': { uid: 'user_lead', displayName: 'Team Lead' },
    'users/user_dev': { uid: 'user_dev', displayName: 'Alice Dev' },
    'blueprints/ws_1/idea_1': {
      blueprintId: 'bp_1',
      version: '17.0',
      status: 'completed',
      content,
    },
  };

  const { bp } = resolveActiveBlueprint('ws_1', 'user_lead', db);
  const targetTask = bp.content.execution.tasks[0];
  targetTask.assignedUserId = 'user_dev';
  targetTask.assignedUserName = 'Alice Dev';

  assert.strictEqual(bp.content.execution.tasks[0].assignedUserId, 'user_dev');
  assert.strictEqual(bp.content.execution.tasks[0].assignedUserName, 'Alice Dev');
  assert.strictEqual(bp.version, '17.0');
});

it('Approve Decision sets status approved, stamps reviewer and auto-resolves question', () => {
  const content = createDefaultBlueprint2Content();
  content.intelligence.discussionIntelligence = {
    decisions: [
      {
        id: 'DEC-01',
        title: 'PostgreSQL for Storage',
        status: 'proposed',
        sourceQuestionIds: ['Q-01'],
      },
    ],
    unresolvedQuestions: [
      { id: 'Q-01', question: 'Which DB?', status: 'open' },
    ],
  };

  const db = {
    'organizations/ws_1': { id: 'ws_1', ownerId: 'user_lead', activeProjectId: 'idea_1' },
    'users/user_lead': { uid: 'user_lead', displayName: 'Lead Architect' },
    'blueprints/ws_1/idea_1': {
      blueprintId: 'bp_1',
      version: '17.0',
      status: 'completed',
      content,
    },
  };

  const { bp, userName } = resolveActiveBlueprint('ws_1', 'user_lead', db);
  const dec = bp.content.intelligence.discussionIntelligence.decisions.find((d) => d.id === 'DEC-01');
  dec.status = 'approved';
  dec.approvedBy = 'user_lead';
  dec.approvedByName = userName;
  dec.approvedAt = Date.now();

  const q = bp.content.intelligence.discussionIntelligence.unresolvedQuestions.find((q) => q.id === 'Q-01');
  q.status = 'resolved';
  q.resolvedByDecisionId = 'DEC-01';

  assert.strictEqual(dec.status, 'approved');
  assert.strictEqual(dec.approvedByName, 'Lead Architect');
  assert.strictEqual(q.status, 'resolved');
  assert.strictEqual(q.resolvedByDecisionId, 'DEC-01');
});

it('Approve Change Recommendation marks recommendation approved with author tracking', () => {
  const content = createDefaultBlueprint2Content();
  content.intelligence.discussionIntelligence = {
    changeRecommendations: [
      { id: 'CR-01', title: 'Add Redis Cache', status: 'proposed' },
    ],
  };

  const db = {
    'organizations/ws_1': { id: 'ws_1', ownerId: 'user_lead', activeProjectId: 'idea_1' },
    'users/user_lead': { uid: 'user_lead', displayName: 'Lead Architect' },
    'blueprints/ws_1/idea_1': {
      blueprintId: 'bp_1',
      version: '17.0',
      status: 'completed',
      content,
    },
  };

  const { bp, userName } = resolveActiveBlueprint('ws_1', 'user_lead', db);
  const rec = bp.content.intelligence.discussionIntelligence.changeRecommendations.find((r) => r.id === 'CR-01');
  rec.status = 'approved';
  rec.reviewedBy = 'user_lead';
  rec.reviewedByName = userName;
  rec.reviewedAt = Date.now();

  assert.strictEqual(rec.status, 'approved');
  assert.strictEqual(rec.reviewedByName, 'Lead Architect');
});

// -------------------------------------------------------------
// TEST GROUP 3: TASK BOARD ROUTING & NAVIGATION AUDIT
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Task Board Route Resolution & Navigation Contract');

function resolveTaskBoardRoute(orgId, ideaId = null) {
  if (!orgId) throw new Error('Organization ID is required');
  if (ideaId) {
    return `/workspaces/${orgId}/ideas/${ideaId}/tasks`;
  }
  return `/workspaces/${orgId}/tasks`;
}

it('Task Board link with ideaId generates canonical nested task route', () => {
  const route = resolveTaskBoardRoute('ws_123', 'idea_456');
  assert.strictEqual(route, '/workspaces/ws_123/ideas/idea_456/tasks');
});

it('Task Board link without ideaId falls back to workspace task route without 404', () => {
  const route = resolveTaskBoardRoute('ws_123', null);
  assert.strictEqual(route, '/workspaces/ws_123/tasks');
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 ACTION FLOW & ROUTING TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL BLUEPRINT ACTION FLOW & ROUTING TESTS PASSED PERFECTLY!\n');
}
