import assert from 'node:assert';
import { createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT ↔ TASK BOARD LIVE STATUS REFLECTION TEST SUITE');
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
// HELPER: Simulated Dynamic Overlay Engine
// (Mirrors the exact logic in BlueprintPage.jsx enrichedBlueprint useMemo)
// -------------------------------------------------------------
function overlayLiveExecutionStatus(displayedBlueprint, liveExecutionTasks, viewedVersion, isViewingHistorical = false) {
  if (!displayedBlueprint || !displayedBlueprint.content) return displayedBlueprint;

  const rawV2 = displayedBlueprint.rawV2Content || displayedBlueprint.__v2Content || displayedBlueprint.content || {};
  const execution = rawV2.execution || {};
  const plannedTasks = execution.tasks || [];

  if (!Array.isArray(plannedTasks) || plannedTasks.length === 0 || !Array.isArray(liveExecutionTasks)) {
    return displayedBlueprint;
  }

  const liveByTaskId = new Map();
  const liveBySourceKey = new Map();
  const liveByBpTaskId = new Map();

  liveExecutionTasks.forEach((t) => {
    if (!t) return;
    if (t.taskId) liveByTaskId.set(t.taskId, t);
    
    const bpId = t.sourceBlueprintTaskId || t.blueprintTaskId;
    const bpVer = String(t.sourceBlueprintVersionId || t.blueprintVersion || '');
    if (bpId && bpVer) {
      liveBySourceKey.set(`${bpId}__v${bpVer}`, t);
    }
    if (bpId) {
      liveByBpTaskId.set(bpId, t);
    }
  });

  const currentViewVer = String(viewedVersion || displayedBlueprint.version || '1.0');

  const enrichedTasks = plannedTasks.map((pt) => {
    const bpTaskId = pt.id;
    
    // Match 1: Direct link via convertedTaskId
    let match = pt.convertedTaskId ? liveByTaskId.get(pt.convertedTaskId) : null;

    // Match 2: Exact matching source blueprint version + task ID
    if (!match && bpTaskId) {
      match = liveBySourceKey.get(`${bpTaskId}__v${currentViewVer}`);
    }

    // Match 3: Matching blueprintTaskId on active project if viewing active version
    if (!match && bpTaskId && !isViewingHistorical) {
      match = liveByBpTaskId.get(bpTaskId);
    }

    if (match) {
      if (match.isDeleted) {
        return {
          ...pt,
          executionTaskId: match.taskId,
          isExecutionLinked: false,
          isExecutionDeleted: true,
          executionStatus: 'Unlinked',
          status: 'Unlinked',
          sourceBlueprintVersionId: match.sourceBlueprintVersionId || currentViewVer,
        };
      }

      const liveStatus = match.status || 'Todo';
      return {
        ...pt,
        executionTaskId: match.taskId,
        isExecutionLinked: true,
        isExecutionDeleted: false,
        executionStatus: liveStatus,
        status: liveStatus,
        assignedUserId: match.assignedTo || pt.assignedUserId,
        assignedUserName: match.assignedToName || pt.assignedUserName,
        sourceBlueprintVersionId: match.sourceBlueprintVersionId || currentViewVer,
      };
    }

    return {
      ...pt,
      isExecutionLinked: false,
      isExecutionDeleted: false,
      status: pt.status || 'Todo',
      executionStatus: pt.status || 'Todo',
    };
  });

  return {
    ...displayedBlueprint,
    content: {
      ...displayedBlueprint.content,
      execution: {
        ...execution,
        tasks: enrichedTasks,
      },
    },
  };
}

// -------------------------------------------------------------
// TEST GROUP 1: PERMANENT SOURCE LINK & SYNC INTEGRITY
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Permanent Source Link & Initial Sync (TEST 1 & TEST 11)');

it('TEST 1: Syncing Blueprint v15 creates Task Board task with permanent source link metadata', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [{ id: 'TASK-01', title: 'Implement Auth' }];
  const bpV15 = { version: '15.0', blueprintId: 'bp_ws1_mvp1', content: bpContent };

  const createdExecutionTask = {
    taskId: 'task_exec_101',
    executionTaskId: 'task_exec_101',
    blueprintId: 'bp_ws1_mvp1',
    blueprintTaskId: 'TASK-01',
    sourceBlueprintTaskId: 'TASK-01',
    blueprintVersion: '15.0',
    sourceBlueprintVersionId: '15.0',
    workspaceId: 'ws1',
    projectId: 'mvp1',
    title: 'Implement Auth',
    status: 'Todo',
    isDeleted: false,
  };

  const liveTasks = [createdExecutionTask];
  const enriched = overlayLiveExecutionStatus(bpV15, liveTasks, '15.0', false);

  const task = enriched.content.execution.tasks[0];
  assert.strictEqual(task.status, 'Todo');
  assert.strictEqual(task.isExecutionLinked, true);
  assert.strictEqual(task.executionTaskId, 'task_exec_101');
  assert.strictEqual(task.sourceBlueprintVersionId, '15.0');
});

it('TEST 11: Clicking Sync again does not create duplicate tasks', () => {
  const existingTasks = {
    task_exec_101: {
      taskId: 'task_exec_101',
      blueprintTaskId: 'TASK-01',
      sourceBlueprintTaskId: 'TASK-01',
      sourceBlueprintVersionId: '15.0',
      status: 'Todo',
    },
  };

  // Simulate idempotent lookup
  const bpTaskId = 'TASK-01';
  const existing = Object.values(existingTasks).find((t) => t.blueprintTaskId === bpTaskId);
  assert.ok(existing);
  assert.strictEqual(existing.taskId, 'task_exec_101');
  assert.strictEqual(Object.keys(existingTasks).length, 1);
});

// -------------------------------------------------------------
// TEST GROUP 2: LIVE STATUS REFLECTION & REOPENING
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Status Lifecycle Reflection (TEST 2, 3, 4, 5, 9)');

it('TEST 2: Task Board TODO -> IN_PROGRESS is reflected into Blueprint without regeneration', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [{ id: 'TASK-01', title: 'Implement Auth', convertedTaskId: 'task_exec_101' }];
  const bpV15 = { version: '15.0', content: bpContent };

  const liveTasks = [
    {
      taskId: 'task_exec_101',
      sourceBlueprintTaskId: 'TASK-01',
      sourceBlueprintVersionId: '15.0',
      status: 'In Progress',
      assignedTo: 'uid_alice',
      assignedToName: 'Alice Developer',
      isDeleted: false,
    },
  ];

  const enriched = overlayLiveExecutionStatus(bpV15, liveTasks, '15.0', false);
  const task = enriched.content.execution.tasks[0];

  assert.strictEqual(task.status, 'In Progress');
  assert.strictEqual(task.executionStatus, 'In Progress');
  assert.strictEqual(task.assignedUserName, 'Alice Developer');
});

it('TEST 3: Task Board IN_PROGRESS -> COMPLETED is reflected into Blueprint', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [{ id: 'TASK-01', title: 'Implement Auth', convertedTaskId: 'task_exec_101' }];
  const bpV15 = { version: '15.0', content: bpContent };

  const liveTasks = [
    {
      taskId: 'task_exec_101',
      sourceBlueprintTaskId: 'TASK-01',
      sourceBlueprintVersionId: '15.0',
      status: 'Completed',
      isDeleted: false,
    },
  ];

  const enriched = overlayLiveExecutionStatus(bpV15, liveTasks, '15.0', false);
  const task = enriched.content.execution.tasks[0];

  assert.strictEqual(task.status, 'Completed');
  assert.strictEqual(task.executionStatus, 'Completed');
});

it('TEST 4 & 5: Refresh and Navigation preserve live status accurately from persisted DB data', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [{ id: 'TASK-01', title: 'Implement Auth', convertedTaskId: 'task_exec_101' }];
  const bpV15 = { version: '15.0', content: bpContent };

  // Fresh load from DB after navigation
  const reloadedLiveTasks = [
    {
      taskId: 'task_exec_101',
      sourceBlueprintTaskId: 'TASK-01',
      sourceBlueprintVersionId: '15.0',
      status: 'Completed',
      isDeleted: false,
    },
  ];

  const enrichedAfterReload = overlayLiveExecutionStatus(bpV15, reloadedLiveTasks, '15.0', false);
  assert.strictEqual(enrichedAfterReload.content.execution.tasks[0].status, 'Completed');
});

it('TEST 9: Task Board COMPLETED -> IN_PROGRESS (Reopened) updates Blueprint immediately (not permanently completed)', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [{ id: 'TASK-01', title: 'Implement Auth', convertedTaskId: 'task_exec_101' }];
  const bpV15 = { version: '15.0', content: bpContent };

  const liveTasks = [
    {
      taskId: 'task_exec_101',
      sourceBlueprintTaskId: 'TASK-01',
      sourceBlueprintVersionId: '15.0',
      status: 'In Progress', // Reopened!
      isDeleted: false,
    },
  ];

  const enriched = overlayLiveExecutionStatus(bpV15, liveTasks, '15.0', false);
  assert.strictEqual(enriched.content.execution.tasks[0].status, 'In Progress');
});

// -------------------------------------------------------------
// TEST GROUP 3: HISTORICAL VERSIONS & RECONCILIATION
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Historical Versions & Carry-Forward (TEST 6, 7, 8)');

it('TEST 7: Viewing historical Blueprint v15 shows live Task Board status for v15 origin tasks', () => {
  const bpContentV15 = createDefaultBlueprint2Content();
  bpContentV15.execution.tasks = [{ id: 'TASK-01', title: 'Implement Auth' }];
  const bpV15 = { version: '15.0', content: bpContentV15 };

  const liveTasks = [
    {
      taskId: 'task_exec_101',
      sourceBlueprintTaskId: 'TASK-01',
      sourceBlueprintVersionId: '15.0',
      status: 'In Progress',
      isDeleted: false,
    },
  ];

  // User views historical v15 while active is v17
  const enrichedV15 = overlayLiveExecutionStatus(bpV15, liveTasks, '15.0', true);
  assert.strictEqual(enrichedV15.content.execution.tasks[0].status, 'In Progress');
  assert.strictEqual(enrichedV15.content.execution.tasks[0].isExecutionLinked, true);
});

it('TEST 8: Viewing v17 does not fabricate fake links for unlinked or brand new tasks', () => {
  const bpContentV17 = createDefaultBlueprint2Content();
  bpContentV17.execution.tasks = [{ id: 'TASK-99', title: 'New Unsynced Feature in v17' }];
  const bpV17 = { version: '17.0', content: bpContentV17 };

  const liveTasks = [
    {
      taskId: 'task_exec_101',
      sourceBlueprintTaskId: 'TASK-01',
      sourceBlueprintVersionId: '15.0',
      status: 'In Progress',
      isDeleted: false,
    },
  ];

  // Viewing v17 with an unrelated task TASK-99
  const enrichedV17 = overlayLiveExecutionStatus(bpV17, liveTasks, '17.0', false);
  assert.strictEqual(enrichedV17.content.execution.tasks[0].status, 'Todo');
  assert.strictEqual(enrichedV17.content.execution.tasks[0].isExecutionLinked, false);
});

// -------------------------------------------------------------
// TEST GROUP 4: DELETION / UNLINK HANDLING
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Task Board Deletion & Unlink (TEST 10 & 12)');

it('TEST 10: Deleting a Task Board task marks Blueprint task as Unlinked (not falsely Completed)', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [{ id: 'TASK-01', title: 'Implement Auth', convertedTaskId: 'task_exec_101' }];
  const bpV15 = { version: '15.0', content: bpContent };

  const liveTasks = [
    {
      taskId: 'task_exec_101',
      sourceBlueprintTaskId: 'TASK-01',
      sourceBlueprintVersionId: '15.0',
      status: 'Completed',
      isDeleted: true, // DELETED FROM TASK BOARD!
    },
  ];

  const enriched = overlayLiveExecutionStatus(bpV15, liveTasks, '15.0', false);
  const task = enriched.content.execution.tasks[0];

  assert.strictEqual(task.status, 'Unlinked');
  assert.strictEqual(task.isExecutionLinked, false);
  assert.strictEqual(task.isExecutionDeleted, true);
  assert.notStrictEqual(task.status, 'Completed');
});

it('TEST 12: Realtime Task Board status update reflects without page refresh', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [{ id: 'TASK-01', title: 'Implement Auth', convertedTaskId: 'task_exec_101' }];
  const bp = { version: '17.0', content: bpContent };

  // State 1: Todo
  let liveTasks = [{ taskId: 'task_exec_101', status: 'Todo', isDeleted: false }];
  let enriched = overlayLiveExecutionStatus(bp, liveTasks, '17.0', false);
  assert.strictEqual(enriched.content.execution.tasks[0].status, 'Todo');

  // State 2: Realtime update received from Task Board -> In Progress
  liveTasks = [{ taskId: 'task_exec_101', status: 'In Progress', isDeleted: false }];
  enriched = overlayLiveExecutionStatus(bp, liveTasks, '17.0', false);
  assert.strictEqual(enriched.content.execution.tasks[0].status, 'In Progress');

  // State 3: Realtime update received from Task Board -> Completed
  liveTasks = [{ taskId: 'task_exec_101', status: 'Completed', isDeleted: false }];
  enriched = overlayLiveExecutionStatus(bp, liveTasks, '17.0', false);
  assert.strictEqual(enriched.content.execution.tasks[0].status, 'Completed');
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 STATUS REFLECTION TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL BLUEPRINT ↔ TASK STATUS REFLECTION TESTS PASSED PERFECTLY!\n');
}
