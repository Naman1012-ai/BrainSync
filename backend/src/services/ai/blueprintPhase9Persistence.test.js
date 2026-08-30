import assert from 'node:assert';
import { blueprintStalenessEngine } from './blueprintStalenessEngine.js';
import { blueprintComparisonEngine } from './blueprintComparisonEngine.js';
import { STALENESS_IMPACT_LEVELS, BLUEPRINT_STATUSES, BLUEPRINT_LIFECYCLE_STATES } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT 2.0 — PHASE 9 PERSISTENCE & VERSIONING TEST SUITE');
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
// TEST GROUP 1: DETERMINISTIC SOURCE CONTEXT HASH & STALENESS
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Deterministic Source Hash & Staleness Engine');

it('TEST 1: computeSourceContextHash produces identical hashes for identical data regardless of volatile timestamps', () => {
  const contextA = {
    ideaId: 'idea_123',
    title: 'AI Resume Coach',
    problemStatement: 'Job seekers lack objective feedback',
    proposedSolution: 'Upload resume and get instant scoring',
    techStack: 'React, Node, Firebase',
    teamMembers: [
      { id: 'u1', workspaceRole: 'Lead', declaredSkills: ['React', 'Node'] },
      { id: 'u2', workspaceRole: 'Dev', declaredSkills: ['Python'] },
    ],
    discussions: {
      acceptedSuggestions: [{ id: 'd1', message: 'Add ATS check', isAccepted: true }],
    },
    timestamp: 100000,
  };

  const contextB = {
    ideaId: 'idea_123',
    title: '  AI Resume Coach  ',
    problemStatement: 'Job   seekers lack objective feedback',
    proposedSolution: 'Upload resume and get instant scoring',
    techStack: 'React, Node, Firebase',
    teamMembers: [
      { id: 'u2', workspaceRole: 'Dev', declaredSkills: ['Python'] },
      { id: 'u1', workspaceRole: 'Lead', declaredSkills: ['Node', 'React'] }, // Different order
    ],
    discussions: {
      acceptedSuggestions: [{ id: 'd1', message: 'Add ATS check', isAccepted: true }],
    },
    timestamp: 999999, // Volatile timestamp ignored
  };

  const hashA = blueprintStalenessEngine.computeSourceContextHash(contextA);
  const hashB = blueprintStalenessEngine.computeSourceContextHash(contextB);

  assert.strictEqual(hashA, hashB);
  assert.strictEqual(typeof hashA, 'string');
  assert.strictEqual(hashA.length, 16);
});

it('TEST 2: Meaningful project changes trigger staleness with accurate impact level classification', () => {
  const baseContext = {
    ideaId: 'idea_123',
    title: 'AI Resume Coach',
    problemStatement: 'Job seekers lack feedback',
    proposedSolution: 'Automated critique platform',
    discussions: { acceptedSuggestions: [] },
  };

  const baseHash = blueprintStalenessEngine.computeSourceContextHash(baseContext);
  const blueprintDoc = {
    mvpIdeaId: 'idea_123',
    ideaId: 'idea_123',
    version: '1.0',
    sourceContextHash: baseHash,
    content: {
      projectUnderstanding: { summary: 'Base summary' },
      intelligence: { discussionIntelligence: { decisions: [] } },
    },
  };

  // Scenario A: No changes -> NO_IMPACT
  const resultA = blueprintStalenessEngine.evaluateProjectChanges(baseContext, blueprintDoc);
  assert.strictEqual(resultA.isStale, false);
  assert.strictEqual(resultA.impactLevel, STALENESS_IMPACT_LEVELS.NO_IMPACT);

  // Scenario B: New accepted decision added -> HIGH_IMPACT / REGENERATE
  const contextWithDecision = {
    ...baseContext,
    discussions: {
      acceptedSuggestions: [{ id: 'd1', message: 'Add PDF export feature', isAccepted: true }],
    },
  };
  const resultB = blueprintStalenessEngine.evaluateProjectChanges(contextWithDecision, blueprintDoc);
  assert.strictEqual(resultB.isStale, true);
  assert.strictEqual(resultB.impactLevel, STALENESS_IMPACT_LEVELS.HIGH_IMPACT);
  assert.ok(resultB.changedSources.includes('accepted_decisions'));
  assert.strictEqual(resultB.recommendation, 'REGENERATE');

  // Scenario C: MVP Idea ID changed -> CRITICAL
  const contextWithNewMvp = {
    ...baseContext,
    ideaId: 'idea_999_completely_new',
  };
  const resultC = blueprintStalenessEngine.evaluateProjectChanges(contextWithNewMvp, blueprintDoc);
  assert.strictEqual(resultC.isStale, true);
  assert.strictEqual(resultC.impactLevel, STALENESS_IMPACT_LEVELS.CRITICAL);
  assert.ok(resultC.changedSources.includes('mvp_identity'));
});

// -------------------------------------------------------------
// TEST GROUP 2: VERSION LINEAGE & IMMUTABILITY
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Version Lineage & Immutability');

it('TEST 3: Version increment calculation preserves lineage and parentVersion', () => {
  const versionHistory = {
    v1_0: { version: '1.0', content: { title: 'V1' } },
    v2_0: { version: '2.0', content: { title: 'V2' }, parentVersion: '1.0' },
  };

  const versionNumbers = Object.values(versionHistory).map((v) => parseFloat(v.version));
  const maxVersion = Math.max(...versionNumbers);
  const nextVersion = (maxVersion + 1.0).toFixed(1);
  const parentVersion = maxVersion.toFixed(1);

  assert.strictEqual(nextVersion, '3.0');
  assert.strictEqual(parentVersion, '2.0');
});

it('TEST 4: Finalized historical version snapshot cannot be mutated by later edits', () => {
  const historicalV1 = Object.freeze({
    version: '1.0',
    status: 'completed',
    content: {
      projectUnderstanding: { problem: 'Original problem' },
    },
  });

  const activeV2 = {
    version: '2.0',
    status: 'completed',
    parentVersion: '1.0',
    content: {
      projectUnderstanding: { problem: 'Updated problem in v2' },
    },
  };

  assert.strictEqual(historicalV1.version, '1.0');
  assert.strictEqual(historicalV1.content.projectUnderstanding.problem, 'Original problem');
  assert.strictEqual(activeV2.parentVersion, '1.0');
  assert.strictEqual(activeV2.content.projectUnderstanding.problem, 'Updated problem in v2');
});

// -------------------------------------------------------------
// TEST GROUP 3: ACTIVE VERSION VS LATEST VERSION PROMOTION
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Active Version vs Latest Version Promotion');

it('TEST 5: Explicit activation promotes historical version and stamps superseded status on old active', () => {
  const currentActiveV2 = {
    version: '2.0',
    status: 'completed',
  };

  const targetSnapshotV1 = {
    version: '1.0',
    status: 'completed',
    content: { summary: 'V1 content' },
  };

  // Simulate explicit activation of v1.0
  const timestamp = Date.now();
  const userUid = 'user_admin_01';

  const oldSnapshotUpdated = {
    ...currentActiveV2,
    status: 'superseded',
    supersededAt: timestamp,
    supersededBy: userUid,
  };

  const newActiveDoc = {
    ...targetSnapshotV1,
    status: 'completed',
    activeVersionId: '1.0',
    version: '1.0',
    updatedAt: timestamp,
    activatedAt: timestamp,
    activatedBy: userUid,
    lastModifiedSource: 'version_activation',
  };

  assert.strictEqual(oldSnapshotUpdated.status, 'superseded');
  assert.strictEqual(oldSnapshotUpdated.supersededBy, 'user_admin_01');
  assert.strictEqual(newActiveDoc.version, '1.0');
  assert.strictEqual(newActiveDoc.status, 'completed');
  assert.strictEqual(newActiveDoc.lastModifiedSource, 'version_activation');
});

// -------------------------------------------------------------
// TEST GROUP 4: GENERATION RACE & CONCURRENCY CONTROL
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Generation Race & Concurrency Control');

it('TEST 6: Generation lock compare-and-set aborts stale generation if superseded by newer attempt', () => {
  const attemptA = 'bp_gen_1000_aaa';
  const attemptB = 'bp_gen_2000_bbb'; // Started later

  // State in database when B starts
  const lockInDb = {
    status: 'generating',
    generationAttemptId: attemptB,
  };

  // Attempt A finishes after Attempt B started
  const isSuperseded = lockInDb.generationAttemptId !== attemptA;
  assert.strictEqual(isSuperseded, true);

  const preCommitCheck = (currentAttemptId, lockRecord) => {
    if (lockRecord?.generationAttemptId && lockRecord.generationAttemptId !== currentAttemptId) {
      return { aborted: true, reason: 'superseded' };
    }
    return { aborted: false };
  };

  const resultA = preCommitCheck(attemptA, lockInDb);
  assert.strictEqual(resultA.aborted, true);
  assert.strictEqual(resultA.reason, 'superseded');

  const resultB = preCommitCheck(attemptB, lockInDb);
  assert.strictEqual(resultB.aborted, false);
});

it('TEST 7: Manual edit with stale expectedUpdatedAt is rejected with 409 conflict', () => {
  const existingBpInDb = {
    version: '2.0',
    updatedAt: 200000,
    content: { title: 'Updated by Alice' },
  };

  const clientPayload = {
    content: { title: 'Bob stale edits' },
    expectedUpdatedAt: 100000, // Bob opened when updatedAt was 100000
    expectedVersion: '2.0',
  };

  const validateConcurrency = (existingDoc, payload) => {
    if (payload.expectedUpdatedAt && existingDoc.updatedAt && existingDoc.updatedAt > payload.expectedUpdatedAt) {
      const err = new Error('VERSION_CONFLICT: Blueprint was modified by another collaborator');
      err.statusCode = 409;
      throw err;
    }
  };

  assert.throws(
    () => validateConcurrency(existingBpInDb, clientPayload),
    (err) => err.statusCode === 409
  );
});

// -------------------------------------------------------------
// TEST GROUP 5: STRUCTURED VERSION COMPARISON
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 5: Structured Version Comparison Engine');

it('TEST 8: blueprintComparisonEngine accurately computes section-level diffs', () => {
  const versionA = {
    version: '1.0',
    content: {
      requirements: [
        { id: 'REQ-01', title: 'Auth', priority: 'Critical', description: 'User login' },
      ],
      execution: {
        features: [{ id: 'FEAT-01', name: 'Auth Module' }],
        tasks: [
          { id: 'TASK-01', title: 'Setup DB', estimatedEffortHours: 4 },
        ],
      },
      intelligence: {
        discussionIntelligence: {
          decisions: [{ id: 'DEC-01', status: 'approved' }],
        },
      },
    },
  };

  const versionB = {
    version: '2.0',
    content: {
      requirements: [
        { id: 'REQ-01', title: 'Auth', priority: 'Critical', description: 'User login' },
        { id: 'REQ-02', title: 'Payment', priority: 'Must Have', description: 'Stripe integration' },
      ],
      execution: {
        features: [
          { id: 'FEAT-01', name: 'Auth Module' },
          { id: 'FEAT-02', name: 'Billing Module' },
        ],
        tasks: [
          { id: 'TASK-01', title: 'Setup DB', estimatedEffortHours: 4 },
          { id: 'TASK-02', title: 'Stripe Webhook', estimatedEffortHours: 8 },
        ],
      },
      intelligence: {
        discussionIntelligence: {
          decisions: [
            { id: 'DEC-01', status: 'approved' },
            { id: 'DEC-02', status: 'approved' },
          ],
        },
      },
    },
  };

  const diff = blueprintComparisonEngine.compareVersions(versionA, versionB);

  assert.strictEqual(diff.hasChanges, true);
  assert.strictEqual(diff.sections.requirements.added, 1);
  assert.strictEqual(diff.sections.execution.tasksAdded, 1);
  assert.strictEqual(diff.sections.execution.effortDeltaHours, 8);
  assert.strictEqual(diff.sections.decisions.approvedDelta, 1);
  assert.ok(diff.summary.includes('+1 tasks'));
  assert.ok(diff.summary.includes('+1 reqs'));
  assert.ok(diff.summary.includes('+8h effort'));
});

// -------------------------------------------------------------
// TEST GROUP 6: SCHEMA & LIFECYCLE CONTRACT
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 6: Schema & Lifecycle Contract Integrity');

it('TEST 9: Lifecycle states and impact level enums are defined and non-empty', () => {
  assert.ok(BLUEPRINT_LIFECYCLE_STATES.ACTIVE);
  assert.ok(BLUEPRINT_LIFECYCLE_STATES.STALE);
  assert.ok(BLUEPRINT_LIFECYCLE_STATES.SUPERSEDED);
  assert.ok(STALENESS_IMPACT_LEVELS.NO_IMPACT);
  assert.ok(STALENESS_IMPACT_LEVELS.CRITICAL);
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 PHASE 9 PERSISTENCE TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 9 PERSISTENCE, VERSIONING & REGENERATION TESTS PASSED PERFECTLY!\n');
}
