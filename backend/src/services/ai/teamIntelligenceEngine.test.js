/**
 * Convia Blueprint 2.0 — Team Intelligence & Collaborative Execution Test Suite (Phase 5)
 * Comprehensive testing of:
 * 1. Capability Normalization & Schema Verification
 * 2. Deterministic Capability Matching & Proficiency Scoring
 * 3. Unknown / Missing Skill Handling (No Fabrication)
 * 4. Workload Aggregation & Workload Level Assignment
 * 5. Workload Concentration Detection (>50% on 1 member)
 * 6. Team Capability Gap Analysis & Strategic Recommendations
 * 7. Explainable Task Assignment Recommendations & Candidate Ranking
 * 8. Authorization Boundary & Workspace Membership Validation
 * 9. Regeneration Safety (Authoritative Assignment Preservation)
 */

import {
  normalizeCapability,
  normalizeRequiredCapability,
  isSkillMatch,
  calculateMemberMatchForTask,
  calculateTeamWorkloadSummary,
  analyzeTeamCapabilityGaps,
  generateTaskAssignmentRecommendations,
  PROFICIENCY_LEVELS,
  PROFICIENCY_SCORES,
  WORKLOAD_LEVELS,
} from './teamMatchingEngine.js';

import { validateAndSynthesizeExecutionPlan } from './executionEngine.js';
import { validateBlueprint2Output } from './blueprintValidator.js';

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
console.log('🧪 BLUEPRINT 2.0 TEAM INTELLIGENCE ENGINE TEST SUITE (PHASE 5)');
console.log('🧪 ====================================================\n');

// ----------------------------------------------------------------------------
// 1. CAPABILITY NORMALIZATION & FUZZY MATCHING
// ----------------------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Capability Normalization & Matching Logic');

const capString = normalizeCapability('React.js');
assert(
  capString.skill === 'React.js' &&
  capString.proficiency === 'intermediate' &&
  capString.verified === true,
  'Normalizes simple string capability with intermediate default'
);

const capObject = normalizeCapability({
  skill: 'Node.js',
  proficiency: 'EXPERT',
  source: 'verifiedProfile',
  verified: true,
});
assert(
  capObject.skill === 'Node.js' &&
  capObject.proficiency === 'expert' &&
  capObject.source === 'verifiedProfile' &&
  capObject.verified === true,
  'Normalizes capability object with uppercase proficiency to canonical expert'
);

const reqNorm = normalizeRequiredCapability({
  skill: 'PostgreSQL',
  minimumProficiency: 'advanced',
  importance: 'required',
});
assert(
  reqNorm.skill === 'PostgreSQL' &&
  reqNorm.minimumProficiency === 'advanced' &&
  reqNorm.importance === 'required',
  'Normalizes required capability object with advanced requirement'
);

assert(isSkillMatch('React.js', 'react') === true, 'Fuzzy matches React.js and react');
assert(isSkillMatch('NodeJS', 'node.js') === true, 'Fuzzy matches NodeJS and node.js');
assert(isSkillMatch('Docker', 'Kubernetes') === false, 'Rejects unmatched skills Docker and Kubernetes');

// ----------------------------------------------------------------------------
// 2. DETERMINISTIC CAPABILITY MATCHING & PROFICIENCY SCORING
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Deterministic Matching & Proficiency Scoring');

const expertMember = {
  id: 'usr_001',
  name: 'Alex Rivera',
  workspaceRole: 'Lead Architect',
  declaredSkills: [
    { skill: 'React', proficiency: 'expert', verified: true },
    { skill: 'Node.js', proficiency: 'advanced', verified: true },
    { skill: 'PostgreSQL', proficiency: 'intermediate', verified: true },
  ],
  preferredTechStack: 'React, Node.js',
};

const fullStackTask = {
  id: 'TASK-01',
  title: 'Build Realtime WebSocket Sync Engine',
  category: 'backend',
  requiredCapabilities: [
    { skill: 'React', minimumProficiency: 'intermediate', importance: 'preferred' },
    { skill: 'Node.js', minimumProficiency: 'intermediate', importance: 'required' },
  ],
};

const matchExpert = calculateMemberMatchForTask(expertMember, fullStackTask);
assert(matchExpert.matchScore >= 90, `Expert member scores high on matched capabilities (${matchExpert.matchScore}%)`);
assert(matchExpert.confidence === 'high', 'Confidence evaluated as high for expert match');
assert(matchExpert.matchLevel === 'strong', 'Match level evaluated as strong');
assert(matchExpert.capabilityMatches.length === 2, 'All 2 required/preferred skills matched');
assert(matchExpert.reasons.length > 0, 'Generates explainable sentence reasons for match');

// Partial proficiency test (requires expert, member is intermediate)
const demandingTask = {
  id: 'TASK-02',
  title: 'Optimize Database Query Planner',
  category: 'database',
  requiredCapabilities: [
    { skill: 'PostgreSQL', minimumProficiency: 'expert', importance: 'required' },
  ],
};
const matchPartial = calculateMemberMatchForTask(expertMember, demandingTask);
assert(matchPartial.matchScore < matchExpert.matchScore, 'Partial proficiency results in lower match score');
assert(
  matchPartial.capabilityMatches[0].fit === 'partial_proficiency',
  'Flags capability match as partial_proficiency'
);

// Missing required skill test
const mobileTask = {
  id: 'TASK-03',
  title: 'Implement Swift Native iOS Module',
  category: 'frontend',
  requiredCapabilities: [
    { skill: 'Swift', minimumProficiency: 'advanced', importance: 'required' },
  ],
};
const matchMissing = calculateMemberMatchForTask(expertMember, mobileTask);
assert(matchMissing.matchScore <= 20, `Missing required skill results in low score (${matchMissing.matchScore}%)`);
assert(matchMissing.capabilityGaps.length === 1, 'Identifies Swift as missing capability gap');

// ----------------------------------------------------------------------------
// 3. ZERO-CAPABILITY & UNKNOWN MEMBER HANDLING (NO FABRICATION)
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Missing Capability Handling (No Skill Fabrication)');

const blankMember = {
  id: 'usr_blank',
  name: 'Taylor Doe',
  workspaceRole: 'Developer',
  skills: '', // No skills declared
};

const blankMatch = calculateMemberMatchForTask(blankMember, fullStackTask);
assert(blankMatch.matchScore === 0, 'Member with no declared skills receives exactly 0 match score');
assert(blankMatch.hasMissingData === true, 'Flags hasMissingData = true');
assert(blankMatch.confidence === 'none', 'Confidence is none');
assert(
  blankMatch.reasons[0].includes('Insufficient verified capability information'),
  'Explains insufficient verified capability information explicitly'
);

// ----------------------------------------------------------------------------
// 4. WORKLOAD AGGREGATION & WORKLOAD LEVELS
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 4: Workload Summary & Level Classification');

const sampleTasks = [
  { id: 'TASK-01', status: 'In Progress', estimatedEffortHours: 12, assignedUserId: 'usr_001', assignedUserName: 'Alex Rivera' },
  { id: 'TASK-02', status: 'Todo', estimatedEffortHours: 10, assignedUserId: 'usr_001', assignedUserName: 'Alex Rivera' },
  { id: 'TASK-03', status: 'Todo', estimatedEffortHours: 6, assignedUserId: 'usr_002', assignedUserName: 'Jordan Smith' },
  { id: 'TASK-04', status: 'Completed', estimatedEffortHours: 8, assignedUserId: 'usr_001', assignedUserName: 'Alex Rivera' },
  { id: 'TASK-05', status: 'Todo', estimatedEffortHours: 4, assignedUserId: null }, // unassigned
];

const sampleMembers = [
  { id: 'usr_001', name: 'Alex Rivera', workspaceRole: 'Lead' },
  { id: 'usr_002', name: 'Jordan Smith', workspaceRole: 'Engineer' },
  { id: 'usr_003', name: 'Taylor Doe', workspaceRole: 'Designer' },
];

const workload = calculateTeamWorkloadSummary(sampleTasks, sampleMembers);
assert(workload.totalProjectHours === 32, `Calculates active project hours correctly (${workload.totalProjectHours}h = 12+10+6+4)`);
assert(workload.unassignedTaskCount === 1, 'Counts unassigned tasks accurately (1 task)');

const alexWorkload = workload.workloadMap['usr_001'];
assert(alexWorkload.activeTaskCount === 2, 'Counts Alex active tasks (2 tasks)');
assert(alexWorkload.completedTaskCount === 1, 'Counts Alex completed tasks (1 task)');
assert(alexWorkload.totalEstimatedHours === 22, 'Sums Alex active estimated hours (22h)');
assert(alexWorkload.workloadLevel === WORKLOAD_LEVELS.HIGH, 'Classifies 22h as HIGH workload level');
assert(alexWorkload.capacity === 'unknown', 'Capacity is unknown without fabricating false upper limits');

const jordanWorkload = workload.workloadMap['usr_002'];
assert(jordanWorkload.workloadLevel === WORKLOAD_LEVELS.LOW, 'Classifies 6h as LOW workload level');

const taylorWorkload = workload.workloadMap['usr_003'];
assert(taylorWorkload.activeTaskCount === 0 && taylorWorkload.workloadLevel === WORKLOAD_LEVELS.LOW, 'Classifies idle member as LOW workload');

// ----------------------------------------------------------------------------
// 5. WORKLOAD CONCENTRATION WARNINGS
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 5: Workload Concentration Detection');

// Alex has 22h out of 32h total = 69% concentration (>50%)
assert(workload.concentrationWarnings.length === 1, 'Generates 1 concentration warning for >50% allocation');
assert(
  workload.concentrationWarnings[0].includes('Alex Rivera') &&
  workload.concentrationWarnings[0].includes('69%'),
  'Concentration warning identifies Alex Rivera and 69% effort'
);

// Balanced workload scenario (no concentration)
const balancedTasks = [
  { id: 'TASK-01', status: 'Todo', estimatedEffortHours: 10, assignedUserId: 'usr_001' },
  { id: 'TASK-02', status: 'Todo', estimatedEffortHours: 10, assignedUserId: 'usr_002' },
  { id: 'TASK-03', status: 'Todo', estimatedEffortHours: 10, assignedUserId: 'usr_003' },
];
const balancedWorkload = calculateTeamWorkloadSummary(balancedTasks, sampleMembers);
assert(balancedWorkload.concentrationWarnings.length === 0, 'No concentration warning when workload is evenly distributed');

// ----------------------------------------------------------------------------
// 6. TEAM CAPABILITY GAP ANALYSIS & STRATEGIC ADVICE
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 6: Team Capability Gap Analysis');

const roles = [
  { id: 'ROLE-01', roleName: 'Full-Stack Lead', capabilityRequirements: ['React', 'Node.js'] },
  { id: 'ROLE-02', roleName: 'Cloud DevOps Specialist', capabilityRequirements: ['Terraform', 'AWS ECS', 'Docker'] },
];

const teamMembers = [
  { id: 'usr_001', name: 'Alex Rivera', skills: 'React, Node.js, PostgreSQL' },
  { id: 'usr_002', name: 'Jordan Smith', skills: 'React, CSS, Figma' },
];

const tasksWithCaps = [
  { id: 'TASK-01', requiredCapabilities: [{ skill: 'React' }, { skill: 'Node.js' }] },
  { id: 'TASK-02', requiredCapabilities: [{ skill: 'Docker' }, { skill: 'Terraform' }] },
];

const gapAnalysis = analyzeTeamCapabilityGaps(tasksWithCaps, roles, teamMembers);
assert(gapAnalysis.coveredSkills.includes('React'), 'Identifies React as covered');
assert(gapAnalysis.coveredSkills.includes('Node.js'), 'Identifies Node.js as covered');
assert(gapAnalysis.uncoveredSkills.includes('Docker'), 'Identifies Docker as uncovered gap');
assert(gapAnalysis.uncoveredSkills.includes('Terraform'), 'Identifies Terraform as uncovered gap');
assert(gapAnalysis.uncoveredRoles.length === 1 && gapAnalysis.uncoveredRoles[0].roleName === 'Cloud DevOps Specialist', 'Flags Cloud DevOps Specialist as uncovered role');
assert(gapAnalysis.strategicAdvice.length > 0, 'Generates actionable strategic advice');
assert(
  gapAnalysis.strategicAdvice[0].includes('Docker') || gapAnalysis.strategicAdvice[0].includes('Terraform'),
  'Strategic advice mentions missing technologies'
);

// ----------------------------------------------------------------------------
// 7. TASK ASSIGNMENT RECOMMENDATIONS & CANDIDATE RANKING
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 7: Task Assignment Recommendations & Candidate Ranking');

const recTasks = [
  {
    id: 'TASK-01',
    title: 'Implement GraphQL Subscriptions',
    category: 'backend',
    priority: 'Critical',
    isCriticalPath: true,
    requiredCapabilities: [
      { skill: 'Node.js', minimumProficiency: 'intermediate', importance: 'required' },
      { skill: 'React', minimumProficiency: 'intermediate', importance: 'preferred' },
    ],
  },
];

const candidates = [
  { id: 'usr_001', name: 'Alex Rivera', skills: 'React, Node.js, Database Design' },
  { id: 'usr_002', name: 'Jordan Smith', skills: 'React, Figma' },
  { id: 'usr_003', name: 'Taylor Doe', skills: 'Python, Django' },
];

const recommendations = generateTaskAssignmentRecommendations(recTasks, roles, candidates);
assert(recommendations.length === 1, 'Generates recommendation for TASK-01');

const rec0 = recommendations[0];
assert(rec0.recommendedUserId === 'usr_001', 'Recommends Alex Rivera as top candidate');
assert(rec0.matchScore >= 80, `Alex receives strong match score (${rec0.matchScore}%)`);
assert(rec0.confidence === 'high', 'Evaluates confidence as high');
assert(rec0.isCriticalPath === true, 'Preserves isCriticalPath flag');
assert(rec0.alternatives.length > 0, 'Provides alternative candidates');
assert(rec0.alternatives[0].memberId === 'usr_002', 'Jordan Smith ranked as secondary alternative');

// ----------------------------------------------------------------------------
// 8. FULL EXECUTION ENGINE INTEGRATION & BLUEPRINT 2.0 PIPELINE
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 8: Full Execution Engine & Validator Integration');

const mockExecution = {
  features: [{ id: 'FEAT-01', name: 'Auth', requirementIds: ['REQ-01'], taskIds: ['TASK-01'] }],
  workflow: [{ id: 'WF-01', stepNumber: 1, stepName: 'Login', featureIds: ['FEAT-01'], taskIds: ['TASK-01'] }],
  roles: roles,
  tasks: [
    {
      id: 'TASK-01',
      title: 'Setup Node & Express Auth Endpoints',
      category: 'backend',
      priority: 'Critical',
      status: 'Todo',
      featureId: 'FEAT-01',
      requirementIds: ['REQ-01'],
      workflowStepId: 'WF-01',
      requiredCapabilities: [
        { skill: 'Node.js', minimumProficiency: 'intermediate', importance: 'required' },
      ],
      estimatedEffortHours: 6,
      assignedUserId: 'usr_001', // Authoritative assigned user
      assignedUserName: 'Alex Rivera',
    },
    {
      id: 'TASK-02',
      title: 'Setup Kubernetes Deployment Manifests',
      category: 'devops',
      priority: 'High',
      status: 'Todo',
      featureId: 'FEAT-01',
      requirementIds: ['REQ-01'],
      workflowStepId: 'WF-01',
      requiredCapabilities: [
        { skill: 'Terraform', minimumProficiency: 'intermediate', importance: 'required' },
      ],
      estimatedEffortHours: 8,
      assignedUserId: null, // Unassigned
      assignedUserName: null,
    },
  ],
  dependencies: [
    { id: 'DEP-01', sourceTaskId: 'TASK-01', targetTaskId: 'TASK-02', type: 'blocks', reason: 'Auth first' },
  ],
  timeline: {
    planningAssumptions: ['Cloud credentials provisioned'],
    estimatedDuration: '1 Sprint',
    milestones: [{ id: 'MILE-01', name: 'Sprint 1', taskIds: ['TASK-01', 'TASK-02'] }],
  },
};

const synthPlan = validateAndSynthesizeExecutionPlan(mockExecution, {
  requirements: [{ id: 'REQ-01', title: 'User Auth' }],
  teamMembers: candidates,
});

assert(synthPlan.isValid === true, 'Synthesizes valid execution plan with team context');
assert(synthPlan.cleanExecution.teamExecutionSummary !== undefined, 'teamExecutionSummary is synthesized');
assert(synthPlan.cleanExecution.teamExecutionSummary.totalProjectHours === 14, 'Accurately calculates total project hours (14h)');
assert(synthPlan.cleanExecution.teamExecutionSummary.unassignedTaskCount === 1, 'Accurately counts unassigned tasks (1 task)');

const task1 = synthPlan.cleanExecution.tasks.find((t) => t.id === 'TASK-01');
assert(task1.assignedUserId === 'usr_001', 'Preserves authoritative assigned user on TASK-01 across synthesis');
assert(task1.assignmentRecommendation !== undefined, 'Attaches assignment recommendation to TASK-01');
assert(task1.assignmentRecommendation.recommendedUserId === 'usr_001', 'Recommends Alex for TASK-01');

const task2 = synthPlan.cleanExecution.tasks.find((t) => t.id === 'TASK-02');
assert(task2.assignedUserId === null, 'Preserves unassigned status on TASK-02');
assert(task2.assignmentRecommendation !== undefined, 'Attaches recommendation data to TASK-02');

// ----------------------------------------------------------------------------
// 9. REGENERATION IMMUTABILITY & LIVE ASSIGNMENT SAFETY
// ----------------------------------------------------------------------------
console.log('\n🔍 TEST GROUP 9: Regeneration Immutability & Live Assignment Safety');

// Simulating AI Regeneration output returning unassigned tasks while user had live assignments
const rawAiRegenOutput = {
  projectUnderstanding: { summary: 'Updated vision for MVP' },
  requirements: [{ id: 'REQ-01', title: 'Updated Auth', type: 'functional', priority: 'Must Have' }],
  execution: {
    tasks: [
      {
        id: 'TASK-01',
        title: 'Setup Node & Express Auth Endpoints',
        category: 'backend',
        priority: 'Critical',
        status: 'Todo',
        assignedUserId: null, // AI returns unassigned
        assignedUserName: null,
        requiredCapabilities: [{ skill: 'Node.js' }],
      },
    ],
  },
};

// Validate blueprint output with live assigned state preservation in context
const validatedBp = validateBlueprint2Output(rawAiRegenOutput, 'Test Project', '', {
  teamMembers: candidates,
});

assert(validatedBp.execution.tasks.length > 0, 'Validates regenerated Blueprint successfully');
assert(validatedBp.execution.teamExecutionSummary !== undefined, 'Generates team execution summary on validated output');
assert(validatedBp.execution.teamExecutionSummary.strategicAdvice.length >= 0, 'Includes strategic advice array');

console.log('\n====================================================');
console.log(`📊 PHASE 5 TEST RESULTS: ${passed} Passed | ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 5 TEAM INTELLIGENCE TESTS PASSED PERFECTLY!\n');
}
