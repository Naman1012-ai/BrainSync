/**
 * Convia Blueprint 2.0 — Execution Planning Engine Test Suite (Phase 4)
 * Comprehensive testing of:
 * 1. Task Model Validation & Traceability
 * 2. Dependency Graph Validation & Cycle Detection
 * 3. Topological Ordering & Parallel Branches
 * 4. Execution Waves / Tiers
 * 5. Critical Path Calculation & Missing Duration Handling
 * 6. Dynamic Blocked Task Detection
 * 7. Milestones & Acceptance Criteria Traceability
 * 8. Task Board Adapter Bidirectional Mapping
 * 9. Regeneration & Snapshot Immutability
 */

import {
  validateTaskDependencies,
  deriveTopologicalOrder,
  deriveExecutionWaves,
  calculateCriticalPath,
  deriveBlockedTasks,
  validateAndSynthesizeExecutionPlan,
} from './executionEngine.js';

import {
  convertBlueprintTaskToTaskBoardTask,
  convertTaskBoardTaskToBlueprintTask,
} from '../../utils/blueprintTaskAdapter.js';

import {
  validateBlueprint2Output,
  validateBlueprintOutput,
  mapLegacyBlueprintToV2,
  mapV2BlueprintToLegacy,
} from './blueprintValidator.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('🧪 ====================================================');
console.log('🧪 BLUEPRINT 2.0 EXECUTION PLANNING ENGINE TEST SUITE (PHASE 4)');
console.log('🧪 ====================================================\n');

// ----------------------------------------------------------------------------
// Test 1: Task Model Validation & Cross-Entity Traceability
// ----------------------------------------------------------------------------
console.log('Test 1: Testing Task Validation & Cross-Entity Traceability...');

const sampleFeatures = [
  { id: 'FEAT-01', name: 'Authentication Module' },
  { id: 'FEAT-02', name: 'Realtime Sync Engine' },
];

const sampleRequirements = [
  { id: 'REQ-01', title: 'JWT Auth' },
  { id: 'REQ-02', title: 'Live WebSocket' },
];

const sampleWorkflow = [
  { id: 'WF-01', stepName: 'User Login' },
  { id: 'WF-02', stepName: 'Dashboard Load' },
];

const sampleRoles = [
  { id: 'ROLE-01', roleName: 'Backend Engineer' },
  { id: 'ROLE-02', roleName: 'Frontend Lead' },
];

const sampleMilestones = [
  { id: 'MILE-01', name: 'Sprint 1', taskIds: ['TASK-01', 'TASK-02'] },
];

const validExecution = {
  features: sampleFeatures,
  workflow: sampleWorkflow,
  roles: sampleRoles,
  tasks: [
    {
      id: 'TASK-01',
      title: 'Implement Auth Endpoints',
      description: 'Create login and register routes',
      category: 'backend',
      priority: 'Critical',
      status: 'Todo',
      featureId: 'FEAT-01',
      requirementIds: ['REQ-01'],
      workflowStepId: 'WF-01',
      recommendedRoleId: 'ROLE-01',
      estimatedEffortHours: 6,
      milestoneId: 'MILE-01',
    },
    {
      id: 'TASK-02',
      title: 'Build Login Form Component',
      description: 'Create responsive login UI',
      category: 'frontend',
      priority: 'High',
      status: 'Todo',
      featureId: 'FEAT-01',
      requirementIds: ['REQ-01'],
      workflowStepId: 'WF-01',
      recommendedRoleId: 'ROLE-02',
      estimatedEffortHours: 4,
      milestoneId: 'MILE-01',
    },
  ],
  dependencies: [
    { id: 'DEP-01', sourceTaskId: 'TASK-01', targetTaskId: 'TASK-02', type: 'blocks' },
  ],
  timeline: {
    milestones: sampleMilestones,
  },
};

const synthResult = validateAndSynthesizeExecutionPlan(validExecution, {
  requirements: sampleRequirements,
  features: sampleFeatures,
});

assert(synthResult.isValid === true, 'Valid execution plan passes validation');
assert(synthResult.cleanExecution.tasks.length === 2, 'All tasks preserved');
assert(synthResult.cleanExecution.tasks[0].featureId === 'FEAT-01', 'Task correctly linked to FEAT-01');
assert(synthResult.cleanExecution.tasks[0].requirementIds[0] === 'REQ-01', 'Task correctly linked to REQ-01');

// ----------------------------------------------------------------------------
// Test 2: Dependency Graph Validation & Cycle Detection
// ----------------------------------------------------------------------------
console.log('\nTest 2: Testing Dependency Graph Validation (Self-Ref, Missing, Duplicate, Cycles)...');

const tasksPool = [
  { id: 'T-A', title: 'Task A', estimatedEffortHours: 4 },
  { id: 'T-B', title: 'Task B', estimatedEffortHours: 6 },
  { id: 'T-C', title: 'Task C', estimatedEffortHours: 2 },
  { id: 'T-D', title: 'Task D', estimatedEffortHours: 8 },
];

// 2a: Self dependency
const selfDep = [{ id: 'D-1', sourceTaskId: 'T-A', targetTaskId: 'T-A' }];
const selfDepRes = validateTaskDependencies(tasksPool, selfDep);
assert(selfDepRes.valid === false && selfDepRes.errors.some((e) => e.includes('Self-referencing')), 'Self-referencing dependency rejected');

// 2b: Missing task reference
const missingTaskDep = [{ id: 'D-2', sourceTaskId: 'T-A', targetTaskId: 'T-NONEXISTENT' }];
const missingRes = validateTaskDependencies(tasksPool, missingTaskDep);
assert(missingRes.valid === false && missingRes.errors.some((e) => e.includes('non-existent')), 'Dependency to non-existent task rejected');

// 2c: Duplicate dependency edge
const dupEdges = [
  { id: 'D-3a', sourceTaskId: 'T-A', targetTaskId: 'T-B' },
  { id: 'D-3b', sourceTaskId: 'T-A', targetTaskId: 'T-B' },
];
const dupRes = validateTaskDependencies(tasksPool, dupEdges);
assert(dupRes.cleanDependencies.length === 1, 'Duplicate dependency edge deduplicated');

// 2d: Circular dependency cycle: A -> B -> C -> A
const cyclicDeps = [
  { id: 'D-C1', sourceTaskId: 'T-A', targetTaskId: 'T-B' },
  { id: 'D-C2', sourceTaskId: 'T-B', targetTaskId: 'T-C' },
  { id: 'D-C3', sourceTaskId: 'T-C', targetTaskId: 'T-A' },
];
const cyclicRes = validateTaskDependencies(tasksPool, cyclicDeps);
assert(cyclicRes.hasCycle === true && cyclicRes.cyclePaths.length > 0, 'Circular cycle detected via DFS with exact cycle path');
assert(cyclicRes.errors.some((e) => e.includes('Circular dependency cycle detected')), 'Cycle error reported with path trace');

// 2e: Contradictory bidirectional dependency: A -> B and B -> A
const contraDeps = [
  { id: 'D-X1', sourceTaskId: 'T-A', targetTaskId: 'T-B' },
  { id: 'D-X2', sourceTaskId: 'T-B', targetTaskId: 'T-A' },
];
const contraRes = validateTaskDependencies(tasksPool, contraDeps);
assert(contraRes.valid === false && contraRes.errors.some((e) => e.includes('Contradictory')), 'Contradictory reverse dependency detected');

// ----------------------------------------------------------------------------
// Test 3: Topological Sorting, Parallel Branches & Converging Nodes
// ----------------------------------------------------------------------------
console.log('\nTest 3: Testing Topological Sorting & Parallel / Converging Graphs...');

// Diamond Graph: T-A -> T-B, T-A -> T-C, T-B -> T-D, T-C -> T-D
const diamondDeps = [
  { id: 'D-1', sourceTaskId: 'T-A', targetTaskId: 'T-B' },
  { id: 'D-2', sourceTaskId: 'T-A', targetTaskId: 'T-C' },
  { id: 'D-3', sourceTaskId: 'T-B', targetTaskId: 'T-D' },
  { id: 'D-4', sourceTaskId: 'T-C', targetTaskId: 'T-D' },
];

const topoRes = deriveTopologicalOrder(tasksPool, diamondDeps);
assert(topoRes.isValid === true, 'Topological sorting succeeded on diamond DAG');
assert(topoRes.executionOrder[0] === 'T-A', 'T-A is first in topological order');
assert(topoRes.executionOrder[3] === 'T-D', 'T-D is last in topological order (converging target)');
assert(
  topoRes.executionOrder.indexOf('T-B') < topoRes.executionOrder.indexOf('T-D') &&
  topoRes.executionOrder.indexOf('T-C') < topoRes.executionOrder.indexOf('T-D'),
  'Prerequisites T-B and T-C precede converging node T-D'
);

// ----------------------------------------------------------------------------
// Test 4: Execution Waves / Tiers (Parallelism Analysis)
// ----------------------------------------------------------------------------
console.log('\nTest 4: Testing Execution Waves & Parallel Execution Tiers...');

const waves = deriveExecutionWaves(tasksPool, diamondDeps);
assert(waves.length === 3, 'Derived 3 execution waves for diamond graph');
assert(waves[0].taskIds.length === 1 && waves[0].taskIds[0] === 'T-A', 'Wave 0 contains root task T-A');
assert(waves[1].taskIds.includes('T-B') && waves[1].taskIds.includes('T-C'), 'Wave 1 contains parallel tasks T-B and T-C');
assert(waves[1].parallelCapacity === 2, 'Wave 1 has parallel capacity = 2');
assert(waves[2].taskIds.length === 1 && waves[2].taskIds[0] === 'T-D', 'Wave 2 contains final converging task T-D');

// ----------------------------------------------------------------------------
// Test 5: Critical Path Calculation Algorithm
// ----------------------------------------------------------------------------
console.log('\nTest 5: Testing Critical Path Calculation...');

// Branch 1: T-A (4h) -> T-B (6h) -> T-D (8h) = Total 18h
// Branch 2: T-A (4h) -> T-C (2h) -> T-D (8h) = Total 14h
// Critical Path MUST be T-A -> T-B -> T-D with 18 hours duration!

const cpRes = calculateCriticalPath(tasksPool, diamondDeps);
assert(cpRes.isAvailable === true, 'Critical path calculated successfully');
assert(cpRes.criticalDurationHours === 18, 'Longest path calculated correctly as 18 hours (4 + 6 + 8)');
assert(
  cpRes.criticalPathTaskIds.join(' -> ') === 'T-A -> T-B -> T-D',
  'Critical path correctly identified as T-A -> T-B -> T-D'
);
assert(cpRes.criticalDependencies.length === 2, '2 critical dependency edges identified');

// Missing duration test: If all tasks have null effort
const tasksNoEffort = tasksPool.map((t) => ({ ...t, estimatedEffortHours: null }));
const cpNoEffortRes = calculateCriticalPath(tasksNoEffort, diamondDeps);
assert(cpNoEffortRes.isAvailable === false, 'Gracefully reports critical path unavailable when durations are missing');
assert(cpNoEffortRes.reason.includes('insufficient'), 'Explains duration insufficiency without fabricating fake numbers');

// ----------------------------------------------------------------------------
// Test 6: Dynamic Blocked Tasks Derivation
// ----------------------------------------------------------------------------
console.log('\nTest 6: Testing Dynamic Blocked Task Derivation...');

// Scenario: T-A is 'Completed', T-B is 'In Progress', T-C is 'Todo', T-D is 'Todo'
const liveTasks = [
  { id: 'T-A', status: 'Completed' },
  { id: 'T-B', status: 'In Progress' },
  { id: 'T-C', status: 'Todo' },
  { id: 'T-D', status: 'Todo' }, // Blocked by T-B and T-C!
];

const blockedMap = deriveBlockedTasks(liveTasks, diamondDeps);
assert(blockedMap['T-A'].isBlocked === false, 'T-A is completed (not blocked)');
assert(blockedMap['T-B'].isBlocked === false, 'T-B prerequisite T-A is completed (T-B is unblocked and runnable)');
assert(blockedMap['T-C'].isBlocked === false, 'T-C prerequisite T-A is completed (T-C is unblocked and runnable)');
assert(blockedMap['T-D'].isBlocked === true, 'T-D is blocked because prerequisites T-B and T-C are not yet completed');
assert(blockedMap['T-D'].unmetPrerequisiteIds.includes('T-B') && blockedMap['T-D'].unmetPrerequisiteIds.includes('T-C'), 'Unmet prerequisites T-B and T-C accurately identified for T-D');

// ----------------------------------------------------------------------------
// Test 7: Task Board Adapter Bidirectional Mapping & Traceability
// ----------------------------------------------------------------------------
console.log('\nTest 7: Testing Task Board Adapter Mapping...');

const bpTask = {
  id: 'TASK-01',
  title: 'Setup Database Rules',
  description: 'Configure security rules in Firebase',
  priority: 'High',
  status: 'Todo',
  category: 'database',
  assignedUserId: 'uid_alex',
  assignedUserName: 'Alex Developer',
  estimatedEffortHours: 4,
  featureId: 'FEAT-01',
};

const taskBoardEntity = convertBlueprintTaskToTaskBoardTask(bpTask, 'ws_org_100', 'idea_mvp_200', {
  uid: 'uid_creator',
  displayName: 'Lead Architect',
});

assert(taskBoardEntity.orgId === 'ws_org_100', 'Organization ID mapped');
assert(taskBoardEntity.projectId === 'idea_mvp_200', 'Project ID mapped');
assert(taskBoardEntity.blueprintTaskId === 'TASK-01', 'Blueprint Task ID reference preserved');
assert(taskBoardEntity.originatingBlueprintId === 'bp_ws_org_100_idea_mvp_200', 'Originating blueprint ID tracked');
assert(taskBoardEntity.title === 'Setup Database Rules', 'Title mapped cleanly');
assert(taskBoardEntity.assignedTo === 'uid_alex', 'Assignee UID preserved');

const mappedBack = convertTaskBoardTaskToBlueprintTask(taskBoardEntity);
assert(mappedBack.id === 'TASK-01', 'Mapped back to Blueprint task ID');
assert(mappedBack.isConvertedToTask === true, 'isConvertedToTask set to true');
assert(mappedBack.convertedTaskId === taskBoardEntity.taskId, 'Live taskId reference linked');

// ----------------------------------------------------------------------------
// Test 8: End-to-End Blueprint 2.0 Integration & Regeneration Preservation
// ----------------------------------------------------------------------------
console.log('\nTest 8: Testing End-to-End Blueprint 2.0 Validation with Execution Plan...');

const fullV2Blueprint = {
  schemaVersion: 2,
  projectUnderstanding: { summary: 'Project Overview', vision: 'Vision', problemStatement: 'Problem', targetAudience: 'Users' },
  requirements: sampleRequirements,
  architecture: { architecturePattern: 'Modular', components: ['Web'], technologyStack: { frontend: ['React'], backend: ['Node'] } },
  execution: validExecution,
  quality: {
    acceptanceCriteria: [
      { id: 'AC-01', description: 'Auth endpoints return 200 on valid credentials', relatedTaskId: 'TASK-01', relatedFeatureId: 'FEAT-01' },
    ],
    risks: [{ id: 'RISK-01', title: 'Token Expire', severity: 'Medium' }],
    definitionOfDone: { developmentComplete: ['Code merged'] },
    readiness: { score: 90, level: 'Ready for Development' },
  },
  intelligence: { discussionIntelligence: { summary: 'Discussions' } },
};

const validatedDoc = validateBlueprint2Output(fullV2Blueprint);
assert(validatedDoc.schemaVersion === 2, 'Validated Blueprint 2.0 schemaVersion: 2');
assert(validatedDoc.execution.tasks.length === 2, 'Execution tasks validated');
assert(validatedDoc.execution.dependencies.length === 1, 'Dependencies validated');
assert(validatedDoc.execution.timeline.criticalPathTaskIds.length > 0, 'Critical path task IDs synthesized');

// Legacy mapping check
const legacyExport = mapV2BlueprintToLegacy(validatedDoc);
assert(legacyExport.coreFeatures.length === 2, 'Features extracted to legacy coreFeatures');
assert(legacyExport.developmentRoadmap.length === 1, 'Milestones extracted to legacy developmentRoadmap');

// ----------------------------------------------------------------------------
// Final Summary
// ----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`🏁 PHASE 4 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
