/**
 * Blueprint 2.0 Contract Verification Test Suite (Phase 2)
 * Tests all 11 verification points for contract validation, legacy mapping,
 * schema detection, reference validation, cycle detection, and auto-healing.
 */

import {
  SCHEMA_VERSIONS,
  createDefaultBlueprint2Content,
} from '../../constants/blueprintSchema.js';

import {
  detectSchemaVersion,
  validateBlueprintOutput,
  validateBlueprint2Output,
  validateLegacyBlueprintOutput,
  validateTaskDependencies,
  validateEntityReferences,
  mapLegacyBlueprintToV2,
  mapV2BlueprintToLegacy,
  safeParseJson,
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
console.log('🧪 BLUEPRINT 2.0 CONTRACT VERIFICATION TEST SUITE');
console.log('🧪 ====================================================\n');

// ----------------------------------------------------------------------------
// Test 1: Current Blueprint 1.x Data Validates & Loads Cleanly
// ----------------------------------------------------------------------------
console.log('Test 1: Validating Legacy 16-Section Blueprint 1.x Data...');
const legacyV1Sample = {
  projectOverview: { summary: 'Legacy Summary', vision: 'Legacy Vision', targetAudience: 'Users' },
  mvpScope: { inScope: ['Auth', 'Dashboard'], outOfScope: ['Billing'], successCriteria: ['Deploys'] },
  recommendedTechStack: { frontend: ['React'], backend: ['Express'], database: ['RTDB'], hosting: ['Vercel'], thirdPartyApis: [], evaluationReason: 'Speed' },
  coreFeatures: [{ featureName: 'Task Manager', description: 'Manages tasks', priority: 'Must Have' }],
  userFlow: [{ stepNumber: 1, stepName: 'Login', description: 'User authenticates' }],
  technicalArchitecture: { architecturePattern: 'Client-Server', components: ['App', 'API'], dataFlowDescription: 'REST' },
  databaseDesign: { primaryDatabase: 'Firebase RTDB', entities: [{ entityName: 'Users', fields: ['uid', 'email'] }] },
  teamAllocation: [{ memberName: 'Alice', assignedRole: 'Lead', recommendedTasks: ['Design API'] }],
  challengesAndDifficulties: [{ challenge: 'Latency', severity: 'Medium', mitigationStrategy: 'Caching' }],
  innovationAndDifferentiation: { keyDifferentiators: ['Fast setup'], marketAdvantage: 'High velocity' },
  developmentRoadmap: [{ phase: 'Phase 1', duration: 'Sprint 1', deliverables: ['DB setup'] }],
  suggestionsAnalysis: [{ id: 's1', content: 'Add rate limit', relevance: 'high', reason: 'Security', impact: 'High', recommendation: 'Use middleware' }],
  commentsAnalysis: [{ id: 'c1', content: 'Good design', relevance: 'medium', reason: 'Feedback', insight: 'Looks clean', recommendation: 'Proceed' }],
  questionsAnalysis: [{ id: 'q1', content: 'What DB?', relevance: 'high', reason: 'Architecture', area: 'DB', recommendation: 'RTDB' }],
  communityInsightsSummary: 'Discussions analyzed.',
  projectReadiness: { score: 90, readinessLevel: 'Ready for Development', reasons: ['Solid concept'] },
};

const v1Validated = validateBlueprintOutput(legacyV1Sample);
assert(detectSchemaVersion(legacyV1Sample) === SCHEMA_VERSIONS.LEGACY_V1, 'Correctly detected Schema Version 1');
assert(v1Validated.projectOverview.summary === 'Legacy Summary', 'Preserved project overview summary in V1 validation');
assert(v1Validated.coreFeatures.length === 1, 'Preserved core features in V1 validation');
assert(v1Validated.projectReadiness.score === 90, 'Preserved project readiness score in V1 validation');

// ----------------------------------------------------------------------------
// Test 2: Minimal Blueprint 2.0 Object Validates with All 6 Groups
// ----------------------------------------------------------------------------
console.log('\nTest 2: Validating Minimal Canonical Blueprint 2.0 Object...');
const minimalV2 = createDefaultBlueprint2Content('Alpha Project', 'Solve latency issues');
const v2Validated = validateBlueprintOutput(minimalV2);

assert(detectSchemaVersion(minimalV2) === SCHEMA_VERSIONS.CANONICAL_V2, 'Correctly detected Schema Version 2');
assert(v2Validated.schemaVersion === 2, 'Schema version 2 confirmed on validated object');
assert(Boolean(v2Validated.projectUnderstanding), 'Group 1 (projectUnderstanding) populated');
assert(Array.isArray(v2Validated.requirements), 'Group 2 (requirements) populated');
assert(Boolean(v2Validated.architecture), 'Group 3 (architecture) populated');
assert(Boolean(v2Validated.execution), 'Group 4 (execution) populated');
assert(Boolean(v2Validated.quality), 'Group 5 (quality) populated');
assert(Boolean(v2Validated.intelligence), 'Group 6 (intelligence) populated');

// ----------------------------------------------------------------------------
// Test 3: Required Fields & Auto-Healing of Empty / Malformed Objects
// ----------------------------------------------------------------------------
console.log('\nTest 3: Testing Resilient Auto-Healing for Malformed Data...');
const healedEmpty = validateBlueprint2Output({});
assert(healedEmpty.projectUnderstanding.summary.length > 0, 'Auto-healed empty project understanding');
assert(healedEmpty.requirements.length > 0, 'Auto-healed missing requirements');
assert(healedEmpty.architecture.technologyStack.frontend.length > 0, 'Auto-healed technology stack');
assert(healedEmpty.execution.tasks.length > 0, 'Auto-healed execution tasks');
assert(healedEmpty.quality.readiness.score >= 0, 'Auto-healed readiness score');

// ----------------------------------------------------------------------------
// Test 4 & 5: Dependency Graph Validation, Duplicate IDs & Cycles
// ----------------------------------------------------------------------------
console.log('\nTest 4 & 5: Testing Dependency Graph Validation (Duplicates, Self-refs, Cycles)...');
const tasksSample = [
  { id: 'TASK-01', title: 'DB Setup' },
  { id: 'TASK-02', title: 'API Endpoints' },
  { id: 'TASK-03', title: 'UI Integration' },
];

// Valid chain: T1 -> T2 -> T3
const validDeps = [
  { id: 'DEP-01', sourceTaskId: 'TASK-01', targetTaskId: 'TASK-02', type: 'blocks' },
  { id: 'DEP-02', sourceTaskId: 'TASK-02', targetTaskId: 'TASK-03', type: 'blocks' },
];
const validDepResult = validateTaskDependencies(tasksSample, validDeps);
assert(validDepResult.valid === true && validDepResult.hasCycle === false, 'Valid linear dependency graph accepted');

// Circular graph: T1 -> T2 -> T3 -> T1
const cyclicDeps = [
  { id: 'DEP-01', sourceTaskId: 'TASK-01', targetTaskId: 'TASK-02', type: 'blocks' },
  { id: 'DEP-02', sourceTaskId: 'TASK-02', targetTaskId: 'TASK-03', type: 'blocks' },
  { id: 'DEP-03', sourceTaskId: 'TASK-03', targetTaskId: 'TASK-01', type: 'blocks' },
];
const cyclicResult = validateTaskDependencies(tasksSample, cyclicDeps);
assert(cyclicResult.hasCycle === true, 'Circular dependency cycle detected correctly');

// Self-referencing dependency
const selfRefDeps = [
  { id: 'DEP-01', sourceTaskId: 'TASK-01', targetTaskId: 'TASK-01', type: 'blocks' },
];
const selfRefResult = validateTaskDependencies(tasksSample, selfRefDeps);
assert(selfRefResult.valid === false && selfRefResult.errors.some((e) => e.includes('Self-referencing')), 'Self-referencing dependency rejected');

// Duplicate dependency IDs
const duplicateDeps = [
  { id: 'DEP-01', sourceTaskId: 'TASK-01', targetTaskId: 'TASK-02', type: 'blocks' },
  { id: 'DEP-01', sourceTaskId: 'TASK-02', targetTaskId: 'TASK-03', type: 'blocks' },
];
const dupResult = validateTaskDependencies(tasksSample, duplicateDeps);
assert(dupResult.errors.some((e) => e.includes('Duplicate dependency ID')), 'Duplicate dependency IDs detected and handled');

// ----------------------------------------------------------------------------
// Test 6: Enum Normalization & Safe Defaults
// ----------------------------------------------------------------------------
console.log('\nTest 6: Testing Enum Value Normalization...');
const invalidEnumsV2 = {
  schemaVersion: 2,
  requirements: [
    { id: 'REQ-01', type: 'invalid_type_string', priority: 'ultra_mega_urgent', title: 'Test Req' },
  ],
  execution: {
    tasks: [
      { id: 'TASK-01', category: 'alien_tech', priority: 'crazy_high', status: 'flying' },
    ],
  },
};
const enumValidated = validateBlueprint2Output(invalidEnumsV2);
assert(enumValidated.requirements[0].type === 'functional', 'Invalid requirement type normalized to functional');
assert(enumValidated.requirements[0].priority === 'Must Have', 'Invalid priority normalized to Must Have');
assert(enumValidated.execution.tasks[0].category === 'general', 'Invalid task category normalized to general');
assert(enumValidated.execution.tasks[0].status === 'Todo', 'Invalid task status normalized to Todo');

// ----------------------------------------------------------------------------
// Test 7: Lossless Legacy-to-2.0 Mapping
// ----------------------------------------------------------------------------
console.log('\nTest 7: Testing Bidirectional Legacy-to-2.0 & 2.0-to-Legacy Mapping...');
const convertedV2 = mapLegacyBlueprintToV2(legacyV1Sample, 'Legacy Project', 'Legacy Problem');
assert(convertedV2.schemaVersion === 2, 'Converted to Schema Version 2');
assert(convertedV2.projectUnderstanding.summary === 'Legacy Summary', 'Project summary preserved in V2');
assert(convertedV2.projectUnderstanding.mvpScope.inScope.includes('Auth'), 'MVP Scope inScope preserved');
assert(convertedV2.architecture.technologyStack.frontend.includes('React'), 'Tech stack frontend preserved');
assert(convertedV2.execution.features[0].name === 'Task Manager', 'Core features mapped to execution.features');
assert(convertedV2.execution.workflow[0].stepName === 'Login', 'User flow mapped to execution.workflow');
assert(convertedV2.execution.roles[0].roleName === 'Lead', 'Team allocation mapped to execution.roles');
assert(convertedV2.quality.risks[0].title === 'Latency', 'Challenges mapped to quality.risks');

const backToLegacy = mapV2BlueprintToLegacy(convertedV2);
assert(backToLegacy.projectOverview.summary === 'Legacy Summary', 'Project summary preserved when mapping V2 back to Legacy');
assert(backToLegacy.coreFeatures[0].featureName === 'Task Manager', 'Core features preserved when mapping V2 back to Legacy');
assert(backToLegacy.recommendedTechStack.frontend.includes('React'), 'Tech stack preserved when mapping V2 back to Legacy');

// ----------------------------------------------------------------------------
// Test 8: Safe Handling of Unknown Schema Versions & Raw String JSON Parsing
// ----------------------------------------------------------------------------
console.log('\nTest 8: Testing JSON Parsing Robustness & Schema Version Detection...');
const rawMarkdownJson = '```json\n{\n  "schemaVersion": 2,\n  "projectUnderstanding": {\n    "summary": "Markdown Parsed"\n  }\n}\n```';
const parsedMarkdown = safeParseJson(rawMarkdownJson);
assert(parsedMarkdown.schemaVersion === 2, 'Successfully parsed markdown-wrapped JSON');

const parsedAndValidated = validateBlueprintOutput(parsedMarkdown);
assert(parsedAndValidated.schemaVersion === 2, 'Parsed and validated V2 from raw markdown string');
assert(parsedAndValidated.projectUnderstanding.summary === 'Markdown Parsed', 'Preserved parsed summary');

// ----------------------------------------------------------------------------
// Test 9: Entity Reference Integrity Check
// ----------------------------------------------------------------------------
console.log('\nTest 9: Testing Entity Reference Integrity...');
const brokenRefsV2 = {
  requirements: [{ id: 'REQ-01', title: 'Valid Req' }],
  execution: {
    features: [{ id: 'FEAT-01', name: 'Feature 1', requirementIds: ['REQ-UNKNOWN-99'] }],
    tasks: [{ id: 'TASK-01', title: 'Task 1', featureId: 'FEAT-NONEXISTENT', recommendedRoleId: 'ROLE-GHOST' }],
  },
};
const refCheck = validateEntityReferences(brokenRefsV2);
assert(refCheck.valid === false, 'Invalid foreign key references correctly flagged');
assert(refCheck.errors.some((e) => e.includes('REQ-UNKNOWN-99')), 'Unknown requirement ID flagged in feature');
assert(refCheck.errors.some((e) => e.includes('FEAT-NONEXISTENT')), 'Unknown feature ID flagged in task');

// ----------------------------------------------------------------------------
// Final Summary
// ----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
