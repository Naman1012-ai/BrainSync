/**
 * Convia Blueprint 2.0 — Phase 6 Quality Intelligence Engine Test Suite
 *
 * Tests:
 * 1. Risk Modeling, Severity Derivation Matrix (Likelihood x Impact), & Mitigation Enforcement
 * 2. Cross-Entity Traceability (Risks -> Tasks, Features, Requirements)
 * 3. Structured Testing Strategy & Requirement / Feature Coverage Analysis
 * 4. Quality Gates Lifecycle (Stages 1-8) & Evidence Verification (No False AI Claims)
 * 5. Deterministic Production & Deployment Readiness Derivation (Blockers vs Warnings vs Unknowns)
 * 6. Full End-to-End Blueprint 2.0 Quality Synthesis & Validation
 * 7. Regeneration Safety & Immutability
 */

import {
  deriveRiskSeverity,
  validateAndSynthesizeRisks,
  calculateTestingCoverage,
  getDefaultQualityGates,
  evaluateQualityGates,
  deriveProjectReadiness,
} from './qualityIntelligenceEngine.js';

import { validateBlueprint2Output } from './blueprintValidator.js';
import { createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

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
console.log('🧪 BLUEPRINT 2.0 QUALITY INTELLIGENCE ENGINE TEST SUITE (PHASE 6)');
console.log('🧪 ====================================================');

// ----------------------------------------------------------------------------
// 1. RISK SEVERITY DERIVATION & PRIORITIZATION MATRIX
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 1: Risk Severity Derivation & Prioritization Matrix');

assert(deriveRiskSeverity('High', 'Critical') === 'Critical', 'High likelihood + Critical impact derives Critical severity');
assert(deriveRiskSeverity('Low', 'Critical') === 'High', 'Low likelihood + Critical impact derives High severity');
assert(deriveRiskSeverity('High', 'High') === 'Critical', 'High likelihood + High impact derives Critical severity');
assert(deriveRiskSeverity('Medium', 'High') === 'High', 'Medium likelihood + High impact derives High severity');
assert(deriveRiskSeverity('Low', 'High') === 'Medium', 'Low likelihood + High impact derives Medium severity');
assert(deriveRiskSeverity('High', 'Medium') === 'High', 'High likelihood + Medium impact derives High severity');
assert(deriveRiskSeverity('Medium', 'Medium') === 'Medium', 'Medium likelihood + Medium impact derives Medium severity');
assert(deriveRiskSeverity('Low', 'Low') === 'Low', 'Low likelihood + Low impact derives Low severity');

// ----------------------------------------------------------------------------
// 2. RISK VALIDATION & CROSS-ENTITY TRACEABILITY
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Risk Validation & Cross-Entity Traceability');

const sampleContext = {
  features: [{ id: 'FEAT-01' }, { id: 'FEAT-02' }],
  tasks: [{ id: 'TASK-01' }, { id: 'TASK-02' }, { id: 'TASK-03' }],
  requirements: [{ id: 'REQ-01' }, { id: 'REQ-02' }],
};

const rawRisks = [
  {
    id: 'RISK-01',
    title: 'Database Contention',
    description: 'Concurrent writes may exceed connection limits.',
    category: 'database',
    likelihood: 'High',
    impact: 'High',
    mitigation: 'Implement connection pooling and Redis caching.',
    contingency: 'Scale database replica instances.',
    affectedFeatureIds: ['FEAT-01', 'FEAT-NONEXISTENT'],
    affectedTaskIds: ['TASK-01', 'TASK-999'],
    affectedRequirementIds: ['REQ-01'],
    status: 'identified',
  },
  {
    id: 'RISK-02',
    title: 'OAuth Callback Timeout',
    description: 'Third-party auth latency.',
    category: 'security',
    likelihood: 'Low',
    impact: 'Medium',
    mitigation: 'Add exponential backoff retry handler.',
    affectedFeatureIds: ['FEAT-02'],
    affectedTaskIds: ['TASK-02'],
    status: 'mitigated',
  },
  {
    id: 'RISK-01', // Duplicate ID
    title: 'Duplicate Risk Check',
    category: 'technical',
    likelihood: 'Low',
    impact: 'Low',
    mitigation: 'Standard logging.',
  },
  {
    id: 'RISK-04',
    title: 'Critical Security Vulnerability',
    category: 'security',
    likelihood: 'High',
    impact: 'Critical',
    mitigation: '', // Missing mitigation on critical risk
  },
];

const riskResult = validateAndSynthesizeRisks(rawRisks, sampleContext);
assert(riskResult.cleanRisks.length === 4, 'Preserves all 4 risks with sanitized structures');
assert(riskResult.cleanRisks[0].id === 'RISK-01', 'Retains original valid risk ID');
assert(riskResult.cleanRisks[0].severity === 'Critical', 'Derives Critical severity from High x High');
assert(riskResult.cleanRisks[0].affectedFeatureIds.length === 1 && riskResult.cleanRisks[0].affectedFeatureIds[0] === 'FEAT-01', 'Filters out non-existent feature references');
assert(riskResult.cleanRisks[0].affectedTaskIds.length === 1 && riskResult.cleanRisks[0].affectedTaskIds[0] === 'TASK-01', 'Filters out non-existent task references');
assert(riskResult.cleanRisks[2].id.startsWith('RISK-03_') || riskResult.cleanRisks[2].id !== 'RISK-01', 'Deduplicates duplicate risk ID');
assert(riskResult.unmitigatedHighRisksCount === 2, 'Detects 2 unmitigated High/Critical risks');

// ----------------------------------------------------------------------------
// 3. TESTING STRATEGY & REQUIREMENT / FEATURE COVERAGE
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Testing Strategy & Coverage Analysis');

const sampleReqs = [
  { id: 'REQ-01', title: 'User Authentication', priority: 'Must Have' },
  { id: 'REQ-02', title: 'Real-time Canvas Sync', priority: 'Must Have' },
  { id: 'REQ-03', title: 'Export PDF Report', priority: 'Nice to Have' },
];

const sampleFeats = [
  { id: 'FEAT-01', name: 'Auth System', priority: 'Must Have' },
  { id: 'FEAT-02', name: 'Collaboration Canvas', priority: 'Must Have' },
];

const sampleTestCases = [
  {
    id: 'TC-01',
    title: 'Verify JWT token validation and expiry',
    category: 'security',
    relatedRequirementIds: ['REQ-01'],
    relatedFeatureIds: ['FEAT-01'],
    relatedTaskIds: ['TASK-01'],
    targetVerification: 'Rejects expired tokens with HTTP 401.',
    status: 'planned',
  },
  {
    id: 'TC-02',
    title: 'Verify WebSocket message broadcast',
    category: 'integration',
    relatedRequirementIds: ['REQ-02'],
    relatedFeatureIds: ['FEAT-02'],
    relatedTaskIds: ['TASK-02'],
    targetVerification: 'Receives updates across connected peers.',
    status: 'planned',
  },
];

const testCoverage = calculateTestingCoverage(sampleTestCases, sampleReqs, sampleFeats, sampleContext.tasks);
assert(testCoverage.totalRequirementsCount === 3, 'Counts 3 total requirements');
assert(testCoverage.coveredRequirementsCount === 2, 'Counts 2 covered requirements');
assert(testCoverage.requirementCoveragePercentage === 67, 'Calculates 67% requirement coverage');
assert(testCoverage.totalFeaturesCount === 2, 'Counts 2 total features');
assert(testCoverage.coveredFeaturesCount === 2, 'Counts 2 covered features');
assert(testCoverage.featureCoveragePercentage === 100, 'Calculates 100% feature coverage');
assert(testCoverage.uncoveredCriticalRequirements.length === 0, 'Zero uncovered critical requirements');

// Test with uncovered critical requirement
const uncompletedCoverage = calculateTestingCoverage(sampleTestCases.slice(0, 1), sampleReqs, sampleFeats, sampleContext.tasks);
assert(uncompletedCoverage.uncoveredCriticalRequirements.includes('Real-time Canvas Sync'), 'Flags uncovered critical requirement');

// ----------------------------------------------------------------------------
// 4. QUALITY GATES LIFECYCLE & EVIDENCE VERIFICATION (NO FALSE AI CLAIMS)
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Quality Gates Lifecycle & Evidence Verification');

const defaultGates = getDefaultQualityGates();
assert(defaultGates.length === 8, 'Initializes standard 8 quality gates');
assert(defaultGates[0].id === 'GATE-01' && defaultGates[0].name === 'Requirements & Scope Alignment', 'Gate 1 is Requirements Alignment');
assert(defaultGates[7].id === 'GATE-08' && defaultGates[7].name === 'Production & Deployment Readiness', 'Gate 8 is Production & Deployment Readiness');

// Test: AI attempts to falsely claim Gate 6 (Automated Testing) & Gate 7 (Security) passed without evidence
const fakeAiGates = [
  { id: 'GATE-06', status: 'passed', verifiedBy: 'ai' },
  { id: 'GATE-07', status: 'passed', verifiedBy: 'system' },
];

const evaluatedGates = evaluateQualityGates(fakeAiGates, {
  requirements: sampleReqs,
  architecture: { dataArchitecture: { primaryDatabase: 'Firebase RTDB' } },
  execution: { tasks: sampleContext.tasks, teamExecutionSummary: { teamCoveragePercentage: 90 } },
}, {});

const gate6 = evaluatedGates.qualityGates.find((g) => g.id === 'GATE-06');
const gate7 = evaluatedGates.qualityGates.find((g) => g.id === 'GATE-07');
assert(gate6.status === 'not_started', 'Demotes false AI claim on Gate 6 to not_started when live evidence is absent');
assert(gate7.status === 'not_started', 'Demotes false AI claim on Gate 7 to not_started when live evidence is absent');

// Test with live verified evidence
const verifiedGates = evaluateQualityGates([], {
  requirements: sampleReqs,
  architecture: { dataArchitecture: { primaryDatabase: 'Firebase RTDB' } },
  execution: { tasks: [{ id: 'TASK-01', assignedUserId: 'usr_123' }], teamExecutionSummary: { teamCoveragePercentage: 90 } },
}, {
  'GATE-06': true,
  'GATE-07': true,
});

assert(verifiedGates.qualityGates.find((g) => g.id === 'GATE-01').status === 'passed', 'Gate 1 passes on valid requirements');
assert(verifiedGates.qualityGates.find((g) => g.id === 'GATE-02').status === 'passed', 'Gate 2 passes on valid database architecture');

// ----------------------------------------------------------------------------
// 5. DETERMINISTIC READINESS DERIVATION (BLOCKERS VS WARNINGS VS UNKNOWNS)
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 5: Deterministic Readiness Derivation');

const mockContent = {
  requirements: sampleReqs,
  architecture: { dataArchitecture: { primaryDatabase: 'PostgreSQL' } },
  execution: {
    tasks: [
      { id: 'TASK-01', status: 'In Progress', isCriticalPath: true, assignedUserId: 'usr_001' },
      { id: 'TASK-02', status: 'Todo', isCriticalPath: true, assignedUserId: null }, // Unassigned critical task
    ],
  },
  quality: {
    risks: riskResult.cleanRisks,
    testingStrategy: { testCases: sampleTestCases },
  },
};

const readiness = deriveProjectReadiness(mockContent, {});
assert(readiness.overallStatus === 'not_ready' || readiness.overallStatus === 'partially_ready', 'Correctly evaluates newly formulated project as not production ready');
assert(readiness.readinessScore < 80, `Derives realistic score (${readiness.readinessScore}%)`);
assert(readiness.warnings.some((w) => w.includes('critical-path tasks')), 'Warns about unassigned critical-path task');
assert(readiness.unknownChecks.some((u) => u.includes('Security hardening')), 'Flags security audit as unverified unknown check');
assert(readiness.unknownChecks.some((u) => u.includes('Deployment readiness')), 'Flags live deployment as unverified unknown check');

// ----------------------------------------------------------------------------
// 6. FULL END-TO-END BLUEPRINT 2.0 QUALITY VALIDATION
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 6: Full End-to-End Blueprint 2.0 Quality Validation');

const rawBlueprint2 = createDefaultBlueprint2Content('Test MVP', 'Solving testing challenges');
rawBlueprint2.quality.risks = rawRisks;
rawBlueprint2.quality.testingStrategy.testCases = sampleTestCases;

const validated = validateBlueprint2Output(rawBlueprint2, 'Test MVP', {
  teamMembers: [{ uid: 'usr_001', declaredSkills: ['JavaScript', 'Node.js'] }],
});

assert(validated.schemaVersion === 2, 'Validated schemaVersion: 2');
assert(Array.isArray(validated.quality.risks) && validated.quality.risks.length > 0, 'Synthesizes quality risks');
assert(Array.isArray(validated.quality.qualityGates) && validated.quality.qualityGates.length === 8, 'Synthesizes all 8 quality gates');
assert(validated.quality.testingStrategy.testCases.length === 2, 'Synthesizes structured test cases');
assert(validated.quality.testingStrategy.testCoverageSummary.requirementCoveragePercentage > 0, 'Synthesizes requirement coverage summary');
assert(validated.quality.productionReadiness.overallStatus !== undefined, 'Synthesizes production readiness summary');

// ----------------------------------------------------------------------------
// 7. REGENERATION IMMUTABILITY & SAFETY
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 7: Regeneration Immutability & Safety');

const regeneratedBlueprint = validateBlueprint2Output(validated, 'Regenerated MVP', {
  teamMembers: [{ uid: 'usr_001', declaredSkills: ['JavaScript', 'Node.js'] }],
});

assert(regeneratedBlueprint.quality.qualityGates.length === 8, 'Preserves quality gates on regeneration');
assert(regeneratedBlueprint.quality.risks.length > 0, 'Preserves risks on regeneration');

console.log('\n====================================================');
console.log(`📊 PHASE 6 TEST RESULTS: ${passed} Passed | ${failed} Failed`);
console.log('====================================================');

if (failed === 0) {
  console.log('🎉 ALL PHASE 6 QUALITY INTELLIGENCE TESTS PASSED PERFECTLY!\n');
} else {
  process.exit(1);
}
