/**
 * Convia Blueprint 2.0 — Phase 7 Discussion Intelligence & Decision Traceability Test Suite
 *
 * Tests:
 * 1. Discussion Item Classification (Comment vs Suggestion vs Question vs Decision)
 * 2. Decision Validation & Cross-Entity Traceability (Decisions -> Reqs, Feats, Tasks, Risks, Tests)
 * 3. Duplicate & Conflict Detection with Existing Approved Decisions
 * 4. Scope Change & Expansion Detection (No Silent Scope Creep)
 * 5. Question Lifecycle & Deterministic Blocking Status Evaluation (Critical Path / Architecture)
 * 6. Change Recommendations Synthesis, Staleness Detection & User Approval Authority
 * 7. Decision Impact Breakdown Calculations
 * 8. End-to-End Blueprint 2.0 Discussion Intelligence Synthesis & Validation
 * 9. Regeneration Immutability & History Preservation
 */

import {
  validateAndSynthesizeDecisions,
  validateAndSynthesizeQuestions,
  validateAndSynthesizeSuggestions,
  synthesizeChangeRecommendations,
  calculateDecisionImpact,
  synthesizeDiscussionIntelligence,
} from './discussionIntelligenceEngine.js';

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
console.log('🧪 BLUEPRINT 2.0 DISCUSSION INTELLIGENCE TEST SUITE (PHASE 7)');
console.log('🧪 ====================================================');

// Mock Project Context
const sampleContext = {
  requirements: [
    { id: 'REQ-01', title: 'User Authentication', priority: 'Must Have' },
    { id: 'REQ-02', title: 'Real-time Canvas Sync', priority: 'Must Have' },
    { id: 'REQ-03', title: 'PDF Export', priority: 'Nice to Have' },
  ],
  features: [
    { id: 'FEAT-01', name: 'Auth Module' },
    { id: 'FEAT-02', name: 'Sync Engine' },
  ],
  tasks: [
    { id: 'TASK-01', title: 'Configure Firebase Auth', isCriticalPath: true, priority: 'Critical', status: 'In Progress' },
    { id: 'TASK-02', title: 'Implement RTDB listeners', isCriticalPath: true, priority: 'High', status: 'Completed' },
    { id: 'TASK-03', title: 'Add PDF generation script', isCriticalPath: false, priority: 'Low', status: 'Todo' },
  ],
  risks: [
    { id: 'RISK-01', title: 'Realtime Latency' },
  ],
  testCases: [
    { id: 'TC-01', title: 'Verify Auth Token' },
  ],
};

// ----------------------------------------------------------------------------
// 1. DISCUSSION CLASSIFICATION & DECISION SYNTHESIS
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 1: Decision Validation & Cross-Entity Traceability');

const rawDecisions = [
  {
    id: 'DEC-01',
    decision: 'Use Firebase Authentication with Google OAuth.',
    rationale: 'Reduces auth backend development overhead and integrates with RTDB.',
    category: 'technology',
    status: 'proposed',
    sourceDiscussionIds: ['disc_101'],
    affectedRequirementIds: ['REQ-01', 'REQ-NONEXISTENT'],
    affectedFeatureIds: ['FEAT-01'],
    affectedTaskIds: ['TASK-01', 'TASK-999'],
    affectedRiskIds: ['RISK-01'],
    affectedTestIds: ['TC-01'],
  },
  {
    id: 'DEC-02',
    decision: 'Use WebSockets over Firebase Realtime Database for state sync.',
    rationale: 'Allows sub-50ms latency across multi-user canvas sessions.',
    category: 'database',
    status: 'proposed',
    affectedRequirementIds: ['REQ-02'],
    affectedFeatureIds: ['FEAT-02'],
    affectedTaskIds: ['TASK-02'],
  },
  {
    id: 'DEC-01', // Duplicate ID
    decision: 'Duplicate ID Check with different decision text.',
    category: 'architecture',
  },
];

const decisionResult = validateAndSynthesizeDecisions(rawDecisions, sampleContext, []);
assert(decisionResult.cleanDecisions.length === 3, 'Preserves all 3 valid decisions with unique sanitized IDs');
assert(decisionResult.cleanDecisions[0].id === 'DEC-01', 'Retains original DEC-01 ID');
assert(decisionResult.cleanDecisions[0].affectedRequirementIds.length === 1 && decisionResult.cleanDecisions[0].affectedRequirementIds[0] === 'REQ-01', 'Filters out non-existent requirement references');
assert(decisionResult.cleanDecisions[0].affectedTaskIds.length === 1 && decisionResult.cleanDecisions[0].affectedTaskIds[0] === 'TASK-01', 'Filters out non-existent task references');
assert(decisionResult.cleanDecisions[2].id.startsWith('DEC-01_'), 'Deduplicates duplicate decision ID');

// ----------------------------------------------------------------------------
// 2. DUPLICATE & CONFLICT DETECTION
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Duplicate & Conflict Detection with Approved Decisions');

const existingApproved = [
  {
    id: 'DEC-00',
    decision: 'Use PostgreSQL for primary database storage.',
    category: 'database',
    status: 'approved',
    approvedBy: 'usr_admin',
    approvedByName: 'Alex Rivera',
  },
];

const conflictTestDecisions = [
  {
    id: 'DEC-03',
    decision: 'Use Firebase RTDB for primary database storage.',
    category: 'database',
    status: 'proposed',
  },
  {
    id: 'DEC-04',
    decision: 'Use PostgreSQL for primary database storage.', // Exact duplicate of approved
    category: 'database',
    status: 'proposed',
  },
];

const conflictResult = validateAndSynthesizeDecisions(conflictTestDecisions, sampleContext, existingApproved);
assert(conflictResult.conflictWarnings.length > 0, 'Detects architectural conflict with existing approved database decision');
assert(conflictResult.duplicateWarnings.length > 0, 'Detects and ignores duplicate proposal of approved decision');
assert(conflictResult.cleanDecisions.some((d) => d.id === 'DEC-00' && d.status === 'approved'), 'Preserves existing approved decision in list');

// ----------------------------------------------------------------------------
// 3. SCOPE CHANGE & EXPANSION DETECTION (NO SILENT SCOPE CREEP)
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Scope Change & Expansion Detection');

const scopeDecisions = [
  {
    id: 'DEC-05',
    decision: 'Integrate Stripe external payment processing gateway.',
    category: 'scope',
    status: 'proposed',
  },
  {
    id: 'DEC-06',
    decision: 'Optimize client cache memory allocation.',
    category: 'performance',
    status: 'proposed',
  },
];

const scopeResult = validateAndSynthesizeDecisions(scopeDecisions, sampleContext, []);
assert(scopeResult.cleanDecisions[0].isScopeChange === true, 'Flags external payment integration as scope change');
assert(scopeResult.cleanDecisions[0].scopeChangeDescription !== null, 'Attaches scope change explanation');
assert(scopeResult.cleanDecisions[1].isScopeChange === false, 'Standard performance optimization is not flagged as scope change');

// ----------------------------------------------------------------------------
// 4. QUESTION LIFECYCLE & DETERMINISTIC BLOCKING EVALUATION
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Question Lifecycle & Deterministic Blocking Status');

const rawQuestions = [
  {
    id: 'Q-01',
    question: 'Which OAuth client credentials provider should be configured in production?',
    category: 'architecture',
    status: 'open',
    affectedTaskIds: ['TASK-01'], // Touches critical path task
    affectedRequirementIds: ['REQ-01'],
  },
  {
    id: 'Q-02',
    question: 'Should the PDF report button display an export icon?',
    category: 'informational',
    status: 'open',
    affectedTaskIds: ['TASK-03'], // Touches non-critical task
    affectedRequirementIds: ['REQ-03'],
  },
  {
    id: 'Q-03',
    question: 'How should WebSockets authenticate initial connection handshake?',
    category: 'implementation',
    status: 'open',
    sourceDiscussionId: 'disc_202',
  },
];

const questionResult = validateAndSynthesizeQuestions(rawQuestions, sampleContext, [
  { id: 'DEC-01', decision: 'Use Firebase Authentication', status: 'approved', sourceQuestionIds: ['Q-03'] },
]);

assert(questionResult.cleanQuestions.length === 3, 'Synthesizes all 3 questions');
assert(questionResult.cleanQuestions[0].isBlocking === true, 'Evaluates Q-01 touching critical-path task as blocking');
assert(questionResult.cleanQuestions[1].isBlocking === false, 'Evaluates Q-02 touching non-critical PDF button as non-blocking');
assert(questionResult.cleanQuestions[2].status === 'resolved', 'Resolves Q-03 answered by approved decision DEC-01');
assert(questionResult.cleanQuestions[2].resolvedByDecisionId === 'DEC-01', 'Links Q-03 to resolving decision DEC-01');
assert(questionResult.blockingCount === 1, 'Accurately counts 1 active blocking question');

// ----------------------------------------------------------------------------
// 5. SUGGESTIONS & SCOPE EXPANSION DETECTION
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 5: Suggestions & Scope Expansion Detection');

const rawSuggestions = [
  {
    id: 'SUGG-01',
    content: 'Add dark mode toggle to UI canvas.',
    authorName: 'Alex',
    isAccepted: true,
    relevance: 'high',
  },
  {
    id: 'SUGG-02',
    content: 'Add AI video generation and rendering pipeline.',
    authorName: 'Jordan',
    status: 'rejected',
    reason: 'Out of MVP scope.',
  },
];

const suggestionResult = validateAndSynthesizeSuggestions(rawSuggestions, sampleContext);
assert(suggestionResult.cleanAccepted.length === 1, 'Retains 1 accepted suggestion');
assert(suggestionResult.cleanRejected.length === 1, 'Retains 1 rejected suggestion with reason');
assert(suggestionResult.scopeExpansionCount === 1, 'Flags video generation suggestion as scope expansion');

// ----------------------------------------------------------------------------
// 6. CHANGE RECOMMENDATIONS & STALENESS DETECTION
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 6: Change Recommendations & Staleness Detection');

const rawRecommendations = [
  {
    id: 'CR-01',
    sourceDecisionId: 'DEC-01',
    targetType: 'task',
    targetId: 'TASK-01', // Task in progress
    changeType: 'modify',
    currentStateSummary: 'Basic auth routes',
    proposedChange: 'Add Google OAuth middleware and JWT token verification',
    reason: 'Align with decision DEC-01',
    impactSeverity: 'high',
    status: 'proposed',
  },
  {
    id: 'CR-02',
    sourceDecisionId: 'DEC-02',
    targetType: 'task',
    targetId: 'TASK-02', // Task is already Completed in sampleContext
    changeType: 'modify',
    proposedChange: 'Rewrite listener architecture',
    status: 'proposed',
  },
];

const recommendationResult = synthesizeChangeRecommendations(
  rawRecommendations,
  decisionResult.cleanDecisions,
  sampleContext,
  []
);

assert(recommendationResult.cleanRecommendations.length === 2, 'Synthesizes 2 change recommendations');
assert(recommendationResult.cleanRecommendations[0].status === 'proposed', 'CR-01 remains proposed');
assert(recommendationResult.cleanRecommendations[1].isStale === true, 'Flags CR-02 as stale because target TASK-02 is already Completed');
assert(recommendationResult.cleanRecommendations[1].status === 'stale', 'Marks stale recommendation status as stale');
assert(recommendationResult.pendingCount === 1, 'Accurately counts 1 pending non-stale recommendation');

// ----------------------------------------------------------------------------
// 7. DECISION IMPACT METRIC BREAKDOWN
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 7: Decision Impact Metric Breakdown');

const sampleDec = decisionResult.cleanDecisions[0];
const impact = calculateDecisionImpact(sampleDec, sampleContext);
assert(impact.affectedRequirementsCount === 1, 'Calculates 1 affected requirement');
assert(impact.affectedFeaturesCount === 1, 'Calculates 1 affected feature');
assert(impact.affectedTasksCount === 1, 'Calculates 1 affected task');
assert(impact.affectedRisksCount === 1, 'Calculates 1 affected risk');
assert(impact.affectedTestsCount === 1, 'Calculates 1 affected test');

// ----------------------------------------------------------------------------
// 8. END-TO-END BLUEPRINT 2.0 DISCUSSION INTELLIGENCE VALIDATION
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 8: End-to-End Blueprint 2.0 Validation with Discussion Intelligence');

const rawBlueprint2 = createDefaultBlueprint2Content('Discussion MVP', 'Testing discussion intelligence');
// Mark TASK-02 as Completed so CR-02 is evaluated as stale
rawBlueprint2.execution.tasks[1].status = 'Completed';
// Set REQ-03 as Nice to Have so non-critical question Q-02 is non-blocking
rawBlueprint2.requirements[2].priority = 'Nice to Have';

rawBlueprint2.intelligence.discussionIntelligence = {
  summary: 'Team discussed authentication and database protocols.',
  decisions: rawDecisions,
  unresolvedQuestions: rawQuestions,
  acceptedSuggestions: [rawSuggestions[0]],
  rejectedSuggestions: [rawSuggestions[1]],
  changeRecommendations: rawRecommendations,
};

const validated = validateBlueprint2Output(rawBlueprint2, 'Discussion MVP', {
  existingDecisions: existingApproved,
});

assert(validated.schemaVersion === 2, 'Validated schemaVersion: 2');
assert(Array.isArray(validated.intelligence.discussionIntelligence.decisions), 'Synthesizes decisions array');
assert(validated.intelligence.discussionIntelligence.decisions.length >= 3, 'Preserves synthesized decisions');
assert(validated.intelligence.discussionIntelligence.statistics.blockingQuestionsCount === 1, 'Calculates blocking questions count in statistics');
assert(validated.intelligence.discussionIntelligence.statistics.pendingChangeRecommendationsCount === 1, 'Calculates pending change recommendations count in statistics');

// ----------------------------------------------------------------------------
// 9. REGENERATION IMMUTABILITY & USER APPROVAL PRESERVATION
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 9: Regeneration Immutability & User Approval Preservation');

// Simulate user approving DEC-01
const targetDec = validated.intelligence.discussionIntelligence.decisions.find((d) => d.id === 'DEC-01');
assert(Boolean(targetDec), 'Finds DEC-01 in validated decisions list');
targetDec.status = 'approved';
targetDec.approvedBy = 'usr_lead_001';
targetDec.approvedByName = 'Lead Architect';

// Regenerate with newly validated data
const regenerated = validateBlueprint2Output(validated, 'Regenerated MVP', {
  existingDecisions: validated.intelligence.discussionIntelligence.decisions,
});

const regenDec1 = regenerated.intelligence.discussionIntelligence.decisions.find((d) => d.id === 'DEC-01');
assert(regenDec1 && regenDec1.status === 'approved', 'Preserves user approved status across regeneration');
assert(regenDec1 && regenDec1.approvedByName === 'Lead Architect', 'Preserves approver name across regeneration');

console.log('\n====================================================');
console.log(`📊 PHASE 7 TEST RESULTS: ${passed} Passed | ${failed} Failed`);
console.log('====================================================');

if (failed === 0) {
  console.log('🎉 ALL PHASE 7 DISCUSSION INTELLIGENCE TESTS PASSED PERFECTLY!\n');
} else {
  process.exit(1);
}
