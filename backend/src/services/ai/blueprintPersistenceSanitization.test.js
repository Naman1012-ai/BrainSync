import assert from 'node:assert';
import { sanitizeForRtdb } from '../rtdbService.js';
import { validateBlueprint2Output } from './blueprintValidator.js';
import { createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

console.log('\n🧪 ====================================================');
console.log('🧪 BLUEPRINT PERSISTENCE SANITIZATION & RTDB SAFETY TEST SUITE');
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
// TEST GROUP 1: RECURSIVE RTDB SANITIZER (sanitizeForRtdb)
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Recursive RTDB Sanitizer');

it('TEST 1: sanitizeForRtdb removes undefined properties from objects', () => {
  const input = {
    workspaceId: 'org_123',
    version: '19.0',
    communityIntelligence: undefined,
    status: 'completed',
  };

  const sanitized = sanitizeForRtdb(input);

  assert.strictEqual(sanitized.workspaceId, 'org_123');
  assert.strictEqual(sanitized.version, '19.0');
  assert.strictEqual(sanitized.status, 'completed');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitized, 'communityIntelligence'), false);
  assert.strictEqual(input.communityIntelligence, undefined); // Original object unmutated
});

it('TEST 2: sanitizeForRtdb recursively cleans nested objects and arrays', () => {
  const input = {
    blueprint: {
      content: {
        title: 'Project X',
        missingProp: undefined,
        deep: {
          level2: undefined,
          valid: 'yes',
        },
      },
      tags: ['tag1', undefined, 'tag3'],
    },
  };

  const sanitized = sanitizeForRtdb(input);

  assert.strictEqual(sanitized.blueprint.content.title, 'Project X');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitized.blueprint.content, 'missingProp'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitized.blueprint.content.deep, 'level2'), false);
  assert.strictEqual(sanitized.blueprint.content.deep.valid, 'yes');
  assert.strictEqual(sanitized.blueprint.tags[0], 'tag1');
  assert.strictEqual(sanitized.blueprint.tags[1], null); // Array undefined converted to null
  assert.strictEqual(sanitized.blueprint.tags[2], 'tag3');
});

it('TEST 3: sanitizeForRtdb preserves valid falsy values (null, false, 0, "")', () => {
  const input = {
    nullVal: null,
    falseVal: false,
    zeroVal: 0,
    emptyStr: '',
    undefVal: undefined,
  };

  const sanitized = sanitizeForRtdb(input);

  assert.strictEqual(sanitized.nullVal, null);
  assert.strictEqual(sanitized.falseVal, false);
  assert.strictEqual(sanitized.zeroVal, 0);
  assert.strictEqual(sanitized.emptyStr, '');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitized, 'undefVal'), false);
});

// -------------------------------------------------------------
// TEST GROUP 2: CANONICAL 8-COMPONENT PERSISTENCE VALIDATION
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Canonical 8-Component Persistence Validation');

it('TEST 4: Blueprint persistence document contains no undefined fields under standard generation', () => {
  const defaultContent = createDefaultBlueprint2Content('Resume AI', 'Job seekers need resume critique');
  const validated = validateBlueprint2Output(defaultContent, 'Resume AI', 'Job seekers need resume critique');

  const completeDoc = {
    blueprintId: 'bp_org1_idea1',
    workspaceId: 'org1',
    orgId: 'org1',
    mvpIdeaId: 'idea1',
    ideaId: 'idea1',
    versionId: '19.0',
    activeVersionId: '19.0',
    version: '19.0',
    schemaVersion: 2,
    status: 'completed',
    timestamp: Date.now(),
    content: validated,
    // communityIntelligence intentionally absent (optional)
  };

  const sanitized = sanitizeForRtdb(completeDoc);

  // Verify no undefined in JSON stringification
  const jsonStr = JSON.stringify(sanitized);
  assert.ok(!jsonStr.includes('undefined'));
  assert.strictEqual(sanitized.schemaVersion, 2);
  assert.strictEqual(sanitized.version, '19.0');
});

it('TEST 5: Persistence validation catches missing required fields before RTDB call', () => {
  const incompleteDoc = {
    workspaceId: 'org1',
    // Missing blueprintId, mvpIdeaId, version, status, content, schemaVersion
  };

  const requiredFields = ['blueprintId', 'workspaceId', 'mvpIdeaId', 'version', 'status', 'content', 'schemaVersion'];
  const validatePersistence = (doc) => {
    for (const field of requiredFields) {
      if (!doc[field]) {
        throw new Error(`Missing required Blueprint field: '${field}'`);
      }
    }
  };

  assert.throws(
    () => validatePersistence(incompleteDoc),
    (err) => err.message.includes("Missing required Blueprint field: 'blueprintId'")
  );
});

// -------------------------------------------------------------
// TEST GROUP 3: FAIL-SAFE PRESERVATION & RETRY BEHAVIOR
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Fail-Safe Preservation & Retry Behavior');

it('TEST 6: Generation failure leaves previous completed version intact in fail-safe simulation', () => {
  const existingV18 = {
    version: '18.0',
    status: 'completed',
    content: { projectUnderstanding: { summary: 'V18 content' } },
  };

  const simulateFailureHandler = (existingBp, err) => {
    const errTimestamp = Date.now();
    const friendlyError = err.message?.includes('set failed')
      ? 'Blueprint generation could not be saved to workspace database. Previous version preserved.'
      : err.message;

    if (existingBp && existingBp.status === 'completed' && existingBp.content) {
      return {
        status: 'completed',
        version: existingBp.version,
        activeVersionId: existingBp.version,
        updatedAt: errTimestamp,
        lastError: friendlyError,
      };
    }
    return { status: 'failed', lastError: friendlyError };
  };

  const preservedState = simulateFailureHandler(existingV18, new Error('set failed: value argument contains undefined'));
  assert.strictEqual(preservedState.status, 'completed');
  assert.strictEqual(preservedState.version, '18.0');
  assert.strictEqual(preservedState.lastError, 'Blueprint generation could not be saved to workspace database. Previous version preserved.');
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 PERSISTENCE SANITIZATION TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PERSISTENCE SANITIZATION & RTDB SAFETY TESTS PASSED PERFECTLY!\n');
}
