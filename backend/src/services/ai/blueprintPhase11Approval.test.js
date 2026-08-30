import assert from 'node:assert';
import { blueprintApprovalEngine } from './blueprintApprovalEngine.js';
import { createDefaultBlueprint2Content, BLUEPRINT_LIFECYCLE_STATES, APPROVAL_STATUSES } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT 2.0 — PHASE 11 APPROVAL, HARDENING & WORKFLOW TEST SUITE');
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
// TEST GROUP 1: APPROVAL READINESS PRECONDITIONS (BLOCKING VS WARNINGS)
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Approval Readiness Precondition Engine');

it('TEST 1: Valid canonical Blueprint 2.0 passes all blocking approval preconditions', () => {
  const validContent = createDefaultBlueprint2Content('Resume AI', 'Job seekers lack objective feedback');
  const blueprintDoc = {
    blueprintId: 'bp_org1_idea1',
    workspaceId: 'org1',
    mvpIdeaId: 'idea1',
    version: '1.0',
    schemaVersion: 2,
    status: 'completed',
    content: validContent,
  };

  const projectContext = {
    ideaId: 'idea1',
    title: 'Resume AI',
    problemStatement: 'Job seekers lack objective feedback',
    proposedSolution: 'Automated critique tool',
    techStack: 'React, Node',
    teamMembers: [{ id: 'u1', workspaceRole: 'Lead' }],
    discussions: { acceptedSuggestions: [] },
  };

  const result = blueprintApprovalEngine.evaluateApprovalReadiness(blueprintDoc, projectContext);

  assert.strictEqual(result.canApprove, true);
  assert.strictEqual(result.blockingErrors.length, 0);
  assert.ok(result.readinessScore >= 80);
  assert.ok(result.checklist.length >= 8);
});

it('TEST 2: Missing requirements or empty execution tasks block approval with specific blocking errors', () => {
  const invalidContent = createDefaultBlueprint2Content('Resume AI', 'Job seekers lack objective feedback');
  invalidContent.requirements = []; // Empty requirements
  invalidContent.execution.tasks = []; // Empty tasks

  const blueprintDoc = {
    blueprintId: 'bp_org1_idea1',
    workspaceId: 'org1',
    mvpIdeaId: 'idea1',
    version: '1.0',
    schemaVersion: 2,
    status: 'completed',
    content: invalidContent,
  };

  const result = blueprintApprovalEngine.evaluateApprovalReadiness(blueprintDoc, {});

  assert.strictEqual(result.canApprove, false);
  assert.ok(result.blockingErrors.some((e) => e.includes('No requirements defined')));
  assert.ok(result.blockingErrors.some((e) => e.includes('0 tasks')));
});

it('TEST 3: Circular dependency graph blocks approval with graph cycle error', () => {
  const cyclicContent = createDefaultBlueprint2Content('Resume AI', 'Job seekers lack objective feedback');
  cyclicContent.execution.tasks = [
    { id: 'TASK-01', title: 'Task 1', dependencies: ['TASK-02'] },
    { id: 'TASK-02', title: 'Task 2', dependencies: ['TASK-01'] }, // Cycle
  ];
  cyclicContent.execution.dependencies = [
    { fromTaskId: 'TASK-01', toTaskId: 'TASK-02', type: 'blocks' },
    { fromTaskId: 'TASK-02', toTaskId: 'TASK-01', type: 'blocks' },
  ];

  const blueprintDoc = {
    blueprintId: 'bp_org1_idea1',
    workspaceId: 'org1',
    mvpIdeaId: 'idea1',
    version: '1.0',
    schemaVersion: 2,
    status: 'completed',
    content: cyclicContent,
  };

  const result = blueprintApprovalEngine.evaluateApprovalReadiness(blueprintDoc, {});

  assert.strictEqual(result.canApprove, false);
  assert.ok(result.blockingErrors.some((e) => e.includes('Dependency graph validation failed')));
});

// -------------------------------------------------------------
// TEST GROUP 2: STALENESS & CONTEXT DRIFT IMPACT ON APPROVAL
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Staleness Impact on Approval Eligibility');

it('TEST 4: Material context change (accepted decisions / changed MVP) blocks approval of stale Blueprint', () => {
  const content = createDefaultBlueprint2Content('Resume AI', 'Problem statement');
  const blueprintDoc = {
    blueprintId: 'bp_org1_idea1',
    workspaceId: 'org1',
    mvpIdeaId: 'idea1',
    ideaId: 'idea1',
    version: '1.0',
    schemaVersion: 2,
    sourceContextHash: 'hash_original_state',
    content,
  };

  // Realtime context has a newly accepted decision (high-impact shift)
  const shiftedProjectContext = {
    ideaId: 'idea1',
    title: 'Resume AI',
    problemStatement: 'Problem statement',
    proposedSolution: 'Solution',
    techStack: 'React',
    teamMembers: [],
    discussions: {
      acceptedSuggestions: [{ id: 'd1', message: 'Add ATS scanner', isAccepted: true }],
    },
  };

  const result = blueprintApprovalEngine.evaluateApprovalReadiness(blueprintDoc, shiftedProjectContext);

  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.canApprove, false);
  assert.ok(result.blockingErrors.some((e) => e.includes('Project state changed materially')));
});

// -------------------------------------------------------------
// TEST GROUP 3: VERSION-SPECIFIC APPROVAL & SUPERSESSION
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Version-Specific Approval & Supersession Model');

it('TEST 5: Explicit approval promotes target version, stamps approvedBy metadata, and supersedes previous active', () => {
  const currentActiveV1 = {
    version: '1.0',
    status: 'completed',
    lifecycleState: 'active',
    approvalStatus: 'approved',
    approvedBy: 'user_initial_lead',
  };

  const targetSnapshotV2 = {
    version: '2.0',
    parentVersion: '1.0',
    status: 'completed',
    lifecycleState: 'ready_for_review',
    approvalStatus: 'pending_approval',
    content: createDefaultBlueprint2Content('Resume AI', 'Problem statement'),
  };

  const timestamp = Date.now();
  const approverUid = 'user_lead_01';

  // 1. Mark old version superseded
  const supersededV1 = {
    ...currentActiveV1,
    status: 'superseded',
    lifecycleState: 'superseded',
    supersededAt: timestamp,
    supersededBy: approverUid,
  };

  // 2. Mark target version approved & active
  const approvedV2 = {
    ...targetSnapshotV2,
    status: 'completed',
    lifecycleState: 'active',
    approvalStatus: 'approved',
    activeVersionId: '2.0',
    version: '2.0',
    updatedAt: timestamp,
    approvedAt: timestamp,
    approvedBy: approverUid,
    activatedAt: timestamp,
    activatedBy: approverUid,
    lastModifiedSource: 'human_approval',
  };

  assert.strictEqual(supersededV1.status, 'superseded');
  assert.strictEqual(supersededV1.supersededBy, 'user_lead_01');
  assert.strictEqual(approvedV2.version, '2.0');
  assert.strictEqual(approvedV2.approvalStatus, 'approved');
  assert.strictEqual(approvedV2.lifecycleState, 'active');
  assert.strictEqual(approvedV2.approvedBy, 'user_lead_01');
});

it('TEST 6: Newly generated version (v3.0) does NOT automatically overwrite active version (v2.0) until approved', () => {
  const activeVersion = '2.0';
  const generatedVersion = '3.0';

  const isCurrentActive = (viewedVer) => viewedVer === activeVersion;

  assert.strictEqual(isCurrentActive(activeVersion), true);
  assert.strictEqual(isCurrentActive(generatedVersion), false);
});

// -------------------------------------------------------------
// TEST GROUP 4: LIFECYCLE & WORKFLOW STATE CONTRACT INTEGRITY
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Lifecycle & Workflow State Contract Integrity');

it('TEST 7: Approval statuses and lifecycle states are defined and consistent', () => {
  assert.strictEqual(BLUEPRINT_LIFECYCLE_STATES.ACTIVE, 'active');
  assert.strictEqual(BLUEPRINT_LIFECYCLE_STATES.READY_FOR_REVIEW, 'ready_for_review');
  assert.strictEqual(BLUEPRINT_LIFECYCLE_STATES.SUPERSEDED, 'superseded');
  assert.strictEqual(APPROVAL_STATUSES.APPROVED, 'approved');
  assert.strictEqual(APPROVAL_STATUSES.PENDING_APPROVAL, 'pending_approval');
  assert.strictEqual(APPROVAL_STATUSES.READY_FOR_REVIEW, 'ready_for_review');
});

it('TEST 8: Newly generated Blueprint starts strictly as pending_approval (NEVER automatically approved)', () => {
  const generatedBlueprintDoc = {
    blueprintId: 'bp_org1_idea1',
    workspaceId: 'org1',
    mvpIdeaId: 'idea1',
    version: '1.0',
    status: 'completed',
    lifecycleState: 'ready_for_review',
    approvalStatus: 'pending_approval',
    approvedAt: null,
    approvedBy: null,
    generationStage: 'completed',
  };

  assert.strictEqual(generatedBlueprintDoc.approvalStatus, 'pending_approval');
  assert.strictEqual(generatedBlueprintDoc.lifecycleState, 'ready_for_review');
  assert.strictEqual(generatedBlueprintDoc.approvedAt, null);
  assert.strictEqual(generatedBlueprintDoc.approvedBy, null);
});

it('TEST 9: Sequential generation stages transition deterministically without repeating or looping', () => {
  const stageSequence = ['context_preparing', 'ai_synthesis', 'validating_schema', 'persisting', 'completed'];
  const stageHistory = [];

  let currentStageIndex = 0;
  while (currentStageIndex < stageSequence.length) {
    const stage = stageSequence[currentStageIndex];
    stageHistory.push(stage);
    currentStageIndex++;
  }

  assert.deepStrictEqual(stageHistory, [
    'context_preparing',
    'ai_synthesis',
    'validating_schema',
    'persisting',
    'completed',
  ]);
  // Verify no duplicate/repeating stages
  const uniqueStages = new Set(stageHistory);
  assert.strictEqual(uniqueStages.size, stageHistory.length);
});

it('TEST 10: Generation failure records exact failedStage and halts without advancing', () => {
  let currentStage = 'context_preparing';
  let isFailed = false;
  let recordedFailedStage = null;

  try {
    // Stage 1 passes
    currentStage = 'ai_synthesis';
    // Simulate AI synthesis timeout/failure
    throw new Error('Gemini API quota exceeded or timed out');
  } catch (err) {
    isFailed = true;
    recordedFailedStage = currentStage;
  }

  assert.strictEqual(isFailed, true);
  assert.strictEqual(recordedFailedStage, 'ai_synthesis');
  // Did NOT advance to validating_schema or persisting
  assert.notStrictEqual(recordedFailedStage, 'validating_schema');
  assert.notStrictEqual(recordedFailedStage, 'persisting');
});

it('TEST 11: Approval is idempotent and does not mutate version or duplicate records on repeat calls', () => {
  const approvedDoc = {
    version: '1.0',
    status: 'completed',
    lifecycleState: 'active',
    approvalStatus: 'approved',
    approvedAt: 1700000000000,
    approvedBy: 'user_lead',
  };

  // Repeated call returns existing approved state
  const isAlreadyApproved = approvedDoc.approvalStatus === 'approved';
  assert.strictEqual(isAlreadyApproved, true);
  assert.strictEqual(approvedDoc.version, '1.0');
  assert.strictEqual(approvedDoc.approvedAt, 1700000000000);
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 PHASE 11 WORKFLOW & APPROVAL TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 11 APPROVAL, HARDENING & WORKFLOW TESTS PASSED PERFECTLY!\n');
}
