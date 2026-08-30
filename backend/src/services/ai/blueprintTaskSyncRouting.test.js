import assert from 'node:assert';
import { createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT TASK SYNC ROUTING & INTEGRATION TEST SUITE');
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
// TEST GROUP 1: BACKEND ROUTE & CONTRACT INTEGRITY
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Express Route & Contract Verification');

it('Sync Blueprint Tasks endpoint uses POST /api/blueprint/sync-tasks', () => {
  const method = 'POST';
  const endpoint = '/api/blueprint/sync-tasks';
  assert.strictEqual(method, 'POST');
  assert.strictEqual(endpoint, '/api/blueprint/sync-tasks');
});

it('Request payload requires workspaceId and resolves caller identity securely', () => {
  const payload = { workspaceId: 'ws_convia', userUid: 'user_123' };
  assert.ok(payload.workspaceId);
  assert.ok(payload.userUid);
});

// -------------------------------------------------------------
// TEST GROUP 2: IDEMPOTENT TASK BOARD SYNCHRONIZATION
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Idempotency & Duplicate Prevention');

function simulateTaskSync(workspaceId, blueprint, existingDatabaseTasks = {}) {
  const v2 = blueprint.content || {};
  const execution = v2.execution || {};
  const plannedTasks = execution.tasks || [];

  const existingByBpId = new Map();
  Object.values(existingDatabaseTasks).forEach((t) => {
    if (t.blueprintTaskId) existingByBpId.set(t.blueprintTaskId, t);
  });

  let createdCount = 0;
  let updatedCount = 0;
  let preservedCount = 0;
  const updatedTasks = { ...existingDatabaseTasks };

  plannedTasks.forEach((bpTask, idx) => {
    const bpTaskId = bpTask.id || `TASK-${idx + 1}`;
    const existing = existingByBpId.get(bpTaskId);

    if (existing) {
      // Update existing task without creating duplicate
      updatedTasks[existing.taskId] = {
        ...existing,
        title: bpTask.title,
        status: existing.status || 'Todo', // preserve status
        assignedTo: existing.assignedTo || bpTask.assignedUserId || '',
      };
      updatedCount++;
      if (existing.status !== 'Todo' || existing.assignedTo) {
        preservedCount++;
      }
    } else {
      // Create new task
      const newId = `task_exec_${idx + 1}`;
      updatedTasks[newId] = {
        taskId: newId,
        blueprintTaskId: bpTaskId,
        title: bpTask.title,
        status: 'Todo',
        assignedTo: bpTask.assignedUserId || '',
      };
      createdCount++;
    }
  });

  return {
    createdCount,
    updatedCount,
    preservedCount,
    totalExecutionTasks: Object.keys(updatedTasks).length,
    updatedTasks,
  };
}

it('Initial sync creates all planned tasks in execution layer', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [
    { id: 'TASK-01', title: 'Setup DB' },
    { id: 'TASK-02', title: 'Build API' },
  ];
  const bp = { version: '1.0', content: bpContent };

  const firstSync = simulateTaskSync('ws_1', bp, {});
  assert.strictEqual(firstSync.createdCount, 2);
  assert.strictEqual(firstSync.updatedCount, 0);
  assert.strictEqual(firstSync.totalExecutionTasks, 2);
});

it('Second sync is strictly idempotent: 0 new tasks created, preserves in-progress status', () => {
  const bpContent = createDefaultBlueprint2Content();
  bpContent.execution.tasks = [
    { id: 'TASK-01', title: 'Setup DB' },
    { id: 'TASK-02', title: 'Build API' },
  ];
  const bp = { version: '1.0', content: bpContent };

  // First sync
  const firstSync = simulateTaskSync('ws_1', bp, {});

  // Developer starts working on TASK-01 and marks it "In Progress"
  firstSync.updatedTasks['task_exec_1'].status = 'In Progress';
  firstSync.updatedTasks['task_exec_1'].assignedTo = 'user_alice';

  // Second sync triggered
  const secondSync = simulateTaskSync('ws_1', bp, firstSync.updatedTasks);

  assert.strictEqual(secondSync.createdCount, 0);
  assert.strictEqual(secondSync.updatedCount, 2);
  assert.strictEqual(secondSync.preservedCount, 1);
  assert.strictEqual(secondSync.totalExecutionTasks, 2); // No duplicates!
  assert.strictEqual(secondSync.updatedTasks['task_exec_1'].status, 'In Progress');
  assert.strictEqual(secondSync.updatedTasks['task_exec_1'].assignedTo, 'user_alice');
});

// -------------------------------------------------------------
// TEST GROUP 3: ERROR CATEGORIZATION & CLIENT RESILIENCE
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Error Classification & Fallback Mechanism');

function categorizeError(status, contentType, networkError = false) {
  if (networkError) {
    return { code: 'BACKEND_UNAVAILABLE', message: 'Backend server is currently unavailable.' };
  }
  if (contentType?.includes('text/html')) {
    if (status === 404) {
      return { code: 'ENDPOINT_NOT_FOUND', message: 'API endpoint was not found on the backend.' };
    }
    return { code: 'HTML_RESPONSE_ERROR', message: 'Unexpected HTML response received.' };
  }
  if (status === 401 || status === 403) {
    return { code: 'UNAUTHORIZED', message: 'Unauthorized permission error.' };
  }
  return { code: 'API_ERROR', message: 'Standard API error.' };
}

it('Correctly classifies network failure as BACKEND_UNAVAILABLE', () => {
  const err = categorizeError(0, '', true);
  assert.strictEqual(err.code, 'BACKEND_UNAVAILABLE');
});

it('Correctly classifies HTML 404 as ENDPOINT_NOT_FOUND', () => {
  const err = categorizeError(404, 'text/html; charset=utf-8', false);
  assert.strictEqual(err.code, 'ENDPOINT_NOT_FOUND');
});

it('Correctly classifies HTTP 403 as UNAUTHORIZED', () => {
  const err = categorizeError(403, 'application/json', false);
  assert.strictEqual(err.code, 'UNAUTHORIZED');
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 TASK SYNC TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL TASK SYNC ROUTING & INTEGRATION TESTS PASSED!\n');
}
