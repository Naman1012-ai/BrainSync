import assert from 'node:assert';
import {
  extractCanonicalVersionKey,
  extractCanonicalVersionNumber,
  validatePathSegment,
  buildBlueprintPath,
  buildBlueprintVersionPath,
  buildTaskPath,
  validateRtdbUpdateMap,
} from '../../utils/blueprintPathBuilder.js';
import { taskSyncService } from './taskSyncService.js';
import { createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT 2.0 — TASK SYNC & RTDB PATH VALIDATION TEST SUITE');
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
// TEST GROUP 1: CANONICAL VERSION KEY & NUMBER RESOLUTION
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Canonical Version Key & Number Resolvers');

it('TEST 1: extractCanonicalVersionKey normalizes dotted version strings ("1.0", "19.0")', () => {
  assert.strictEqual(extractCanonicalVersionKey('1.0'), 'v1_0');
  assert.strictEqual(extractCanonicalVersionKey('19.0'), 'v19_0');
  assert.strictEqual(extractCanonicalVersionKey('2.5.1'), 'v2_5_1');
});

it('TEST 2: extractCanonicalVersionKey normalizes prefixed version keys ("v1_0", "v19_0")', () => {
  assert.strictEqual(extractCanonicalVersionKey('v1_0'), 'v1_0');
  assert.strictEqual(extractCanonicalVersionKey('v19_0'), 'v19_0');
  assert.strictEqual(extractCanonicalVersionKey('V19_0'), 'v19_0');
});

it('TEST 3: extractCanonicalVersionKey extracts version from version container objects', () => {
  assert.strictEqual(extractCanonicalVersionKey({ version: '19.0' }), 'v19_0');
  assert.strictEqual(extractCanonicalVersionKey({ targetVersion: '19.0' }), 'v19_0');
  assert.strictEqual(extractCanonicalVersionKey({ versionId: '19.0' }), 'v19_0');
  assert.strictEqual(extractCanonicalVersionKey({ key: 'v19_0' }), 'v19_0');
  assert.strictEqual(extractCanonicalVersionKey({ id: 'v19_0', version: '19.0' }), 'v19_0');
  assert.strictEqual(extractCanonicalVersionKey({ targetVersion: { id: 'v19_0' } }), 'v19_0');
});

it('TEST 4: extractCanonicalVersionKey rejects null, undefined, empty strings, and [object Object]', () => {
  assert.strictEqual(extractCanonicalVersionKey(null), null);
  assert.strictEqual(extractCanonicalVersionKey(undefined), null);
  assert.strictEqual(extractCanonicalVersionKey(''), null);
  assert.strictEqual(extractCanonicalVersionKey('   '), null);
  assert.strictEqual(extractCanonicalVersionKey('[object Object]'), null);
  assert.strictEqual(extractCanonicalVersionKey('v[object Object]'), null);
  assert.strictEqual(extractCanonicalVersionKey({}), null);
});

it('TEST 5: extractCanonicalVersionNumber normalizes version numbers from keys and objects', () => {
  assert.strictEqual(extractCanonicalVersionNumber('1.0'), '1.0');
  assert.strictEqual(extractCanonicalVersionNumber('v1_0'), '1.0');
  assert.strictEqual(extractCanonicalVersionNumber('v19_0'), '19.0');
  assert.strictEqual(extractCanonicalVersionNumber({ version: '19.0' }), '19.0');
  assert.strictEqual(extractCanonicalVersionNumber({ key: 'v19_0' }), '19.0');
  assert.strictEqual(extractCanonicalVersionNumber(null), null);
});

// -------------------------------------------------------------
// TEST GROUP 2: PATH SEGMENT VALIDATION & RTDB PATH BUILDERS
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Path Segment Validation & Canonical Path Builders');

it('TEST 6: validatePathSegment accepts valid alphanumeric IDs with underscores/hyphens', () => {
  assert.strictEqual(validatePathSegment('org_1786727905629_l5jmm', 'workspaceId'), 'org_1786727905629_l5jmm');
  assert.strictEqual(validatePathSegment('idea_1786728063293_3qmut', 'mvpIdeaId'), 'idea_1786728063293_3qmut');
  assert.strictEqual(validatePathSegment('TASK-01', 'taskId'), 'TASK-01');
});

it('TEST 7: validatePathSegment throws on empty string, object, [object Object], or illegal chars', () => {
  assert.throws(() => validatePathSegment('', 'workspaceId'), /cannot be an empty string/);
  assert.throws(() => validatePathSegment('  ', 'workspaceId'), /cannot be an empty string/);
  assert.throws(() => validatePathSegment({}, 'workspaceId'), /cannot be an Object/);
  assert.throws(() => validatePathSegment('[object Object]', 'workspaceId'), /contains '\[object Object\]'/);
  assert.throws(() => validatePathSegment('user.uid#1', 'workspaceId'), /contains illegal characters/);
});

it('TEST 8: buildBlueprintVersionPath builds valid canonical version path and prevents [object Object]', () => {
  const path = buildBlueprintVersionPath('org_1786727905629_l5jmm', 'idea_1786728063293_3qmut', '19.0');
  assert.strictEqual(path, 'blueprints/org_1786727905629_l5jmm/idea_1786728063293_3qmut/versions/v19_0');

  // Verify object input also resolves cleanly
  const pathFromObj = buildBlueprintVersionPath('org_1786727905629_l5jmm', 'idea_1786728063293_3qmut', { id: 'v19_0', version: '19.0' });
  assert.strictEqual(pathFromObj, 'blueprints/org_1786727905629_l5jmm/idea_1786728063293_3qmut/versions/v19_0');

  // Verify bad input throws before reaching RTDB
  assert.throws(() => buildBlueprintVersionPath('org_123', 'idea_456', {}), /could not be resolved/);
});

it('TEST 9: buildTaskPath builds valid task board execution path', () => {
  const path = buildTaskPath('org_1786727905629_l5jmm', 'task_1786728099_abc12');
  assert.strictEqual(path, 'tasks/org_1786727905629_l5jmm/task_1786728099_abc12');
});

// -------------------------------------------------------------
// TEST GROUP 3: RTDB UPDATE MAP VALIDATION (NO EMPTY PATHS)
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: RTDB Multi-Path Update Map Validation');

it('TEST 10: validateRtdbUpdateMap accepts valid multi-location dictionary', () => {
  const validMap = {
    'tasks/org_123/task_1': { title: 'Task 1', status: 'Todo' },
    'tasks/org_123/task_2': { title: 'Task 2', status: 'In Progress' },
    'blueprints/org_123/idea_456': { lastTaskSyncAt: Date.now() },
  };

  assert.doesNotThrow(() => validateRtdbUpdateMap(validMap, 'testContext'));
});

it('TEST 11: validateRtdbUpdateMap catches and rejects empty string keys and [object Object]', () => {
  const emptyKeyMap = {
    '': { some: 'value' },
  };
  assert.throws(() => validateRtdbUpdateMap(emptyKeyMap, 'testContext'), /empty string or non-string key detected/);

  const objectStringMap = {
    'blueprints/org_123/versions/v[object Object]': { data: 1 },
  };
  assert.throws(() => validateRtdbUpdateMap(objectStringMap, 'testContext'), /'\[object Object\]' detected in path/);
});

// -------------------------------------------------------------
// TEST GROUP 4: TASK SYNCHRONIZATION DATA CONTRACT & IDEMPOTENCY
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Task Synchronization Data Contract & Idempotency');

it('TEST 12: taskSyncService.synchronizeBlueprintTasks validates inputs and formats canonical execution tasks', async () => {
  const content = createDefaultBlueprint2Content('Resume AI', 'Job seekers lack objective feedback');
  const blueprintDoc = {
    blueprintId: 'bp_org_123_idea_456',
    workspaceId: 'org_123',
    mvpIdeaId: 'idea_456',
    version: '19.0',
    content,
  };

  const results = await taskSyncService.synchronizeBlueprintTasks('org_123', blueprintDoc, 'user_tester');

  assert.strictEqual(results.success, true);
  assert.strictEqual(results.totalPlannedTasks, content.execution.tasks.length);
  assert.ok(results.createdCount > 0);
  assert.strictEqual(results.createdCount, results.totalExecutionTasks);
});

it('TEST 13: Synchronizing already-synced Blueprint tasks preserves executionTaskId and status without duplicates', async () => {
  const content = createDefaultBlueprint2Content('Resume AI', 'Job seekers lack objective feedback');
  // Simulate task already synced with convertedTaskId
  content.execution.tasks[0].convertedTaskId = 'task_existing_exec_01';

  const blueprintDoc = {
    blueprintId: 'bp_org_123_idea_456',
    workspaceId: 'org_123',
    mvpIdeaId: 'idea_456',
    version: '19.0',
    content,
  };

  const results = await taskSyncService.synchronizeBlueprintTasks('org_123', blueprintDoc, 'user_tester');
  assert.strictEqual(results.success, true);
  // Total execution tasks should equal total planned tasks without duplicate creation
  assert.strictEqual(results.totalPlannedTasks, content.execution.tasks.length);
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 TASK SYNC & PATH VALIDATION TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL TASK SYNC & RTDB PATH VALIDATION TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}
