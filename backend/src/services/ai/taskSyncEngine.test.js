import assert from 'node:assert';
import { analyzeTeamCapabilityGaps, calculateTeamWorkloadSummary, generateTaskAssignmentRecommendations, WORKLOAD_LEVELS } from './teamMatchingEngine.js';

console.log('\n🧪 ====================================================');
console.log('🧪 POST-PHASE-11 HARDENING TEST SUITE');
console.log('🧪 TEAM INTELLIGENCE, TASK SYNCHRONIZATION & WORKLOAD ENGINE');
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
// TEST GROUP 1: SKILL COVERAGE SEMANTICS & NO FAKE 100%
// -------------------------------------------------------------
console.log('🔍 TEST GROUP 1: Skill Coverage Semantics & Zero Requirement Handling');

it('Zero required skills returns N/A and hasRequirements: false (DO NOT fake 100%)', () => {
  const members = [
    { id: 'u1', name: 'Naman', declaredSkills: ['React', 'Node.js'] },
    { id: 'u2', name: 'Alex', declaredSkills: [] },
  ];
  const tasks = [
    { id: 'TASK-01', title: 'Setup Repo', requiredCapabilities: [] },
  ];
  const roles = [];

  const gaps = analyzeTeamCapabilityGaps(tasks, roles, members);
  assert.strictEqual(gaps.totalRequiredSkillsCount, 0);
  assert.strictEqual(gaps.hasRequirements, false);
  assert.strictEqual(gaps.coveragePercentage, null);
  assert.strictEqual(gaps.coverageStatus, 'no_requirements');
  assert.strictEqual(gaps.coverageLabel, 'N/A');
  assert.strictEqual(gaps.coveredSkills.length, 0);
  assert.strictEqual(gaps.uncoveredSkills.length, 0);
});

it('Required skills derived from techStack, roles, and tasks correctly', () => {
  const members = [
    { id: 'u1', name: 'Nama_10', declaredSkills: ['React', 'Node.js', 'Python', 'Firebase'] },
    { id: 'u2', name: 'Naman', declaredSkills: [] },
  ];
  const tasks = [
    { id: 'TASK-01', title: 'Build UI', requiredCapabilities: ['React', 'TailwindCSS'] },
    { id: 'TASK-02', title: 'Build NLP Engine', requiredCapabilities: [{ skill: 'Python' }, { skill: 'FastAPI' }] },
  ];
  const roles = [
    { id: 'ROLE-01', roleName: 'DevOps Lead', capabilityRequirements: ['Docker', 'AWS'] },
  ];
  const techStack = {
    frontend: ['React'],
    backend: ['Node.js'],
  };

  const gaps = analyzeTeamCapabilityGaps(tasks, roles, members, techStack);
  // Total unique: React, TailwindCSS, Python, FastAPI, Docker, AWS, Node.js = 7
  assert.strictEqual(gaps.hasRequirements, true);
  assert.strictEqual(gaps.totalRequiredSkillsCount, 7);

  // Covered by Nama_10: React, Python, Node.js (3 out of 7)
  assert.ok(gaps.coveredSkills.includes('React'));
  assert.ok(gaps.coveredSkills.includes('Python'));
  assert.ok(gaps.coveredSkills.includes('Node.js'));
  assert.strictEqual(gaps.coveredSkills.length, 3);

  // Uncovered: TailwindCSS, FastAPI, Docker, AWS (4 out of 7)
  assert.ok(gaps.uncoveredSkills.includes('TailwindCSS'));
  assert.ok(gaps.uncoveredSkills.includes('FastAPI'));
  assert.ok(gaps.uncoveredSkills.includes('Docker'));
  assert.ok(gaps.uncoveredSkills.includes('AWS'));
  assert.strictEqual(gaps.uncoveredSkills.length, 4);

  // Coverage percentage: 3 / 7 * 100 = 43%
  assert.strictEqual(gaps.coveragePercentage, 43);
  assert.strictEqual(gaps.coverageStatus, 'partial_coverage');
  assert.strictEqual(gaps.coverageLabel, '43%');
});

it('100% coverage is only returned when ALL required skills are actually verified in member profiles', () => {
  const members = [
    { id: 'u1', name: 'Dev 1', declaredSkills: ['React', 'TypeScript'] },
    { id: 'u2', name: 'Dev 2', declaredSkills: ['Node.js', 'PostgreSQL'] },
  ];
  const tasks = [
    { id: 'TASK-01', requiredCapabilities: ['React', 'TypeScript'] },
    { id: 'TASK-02', requiredCapabilities: ['Node.js', 'PostgreSQL'] },
  ];

  const gaps = analyzeTeamCapabilityGaps(tasks, [], members);
  assert.strictEqual(gaps.hasRequirements, true);
  assert.strictEqual(gaps.totalRequiredSkillsCount, 4);
  assert.strictEqual(gaps.coveredSkills.length, 4);
  assert.strictEqual(gaps.uncoveredSkills.length, 0);
  assert.strictEqual(gaps.coveragePercentage, 100);
  assert.strictEqual(gaps.coverageStatus, 'full_coverage');
  assert.strictEqual(gaps.coverageLabel, '100%');
});

// -------------------------------------------------------------
// TEST GROUP 2: TEAM WORKLOAD CALCULATION & UNASSIGNED TASKS
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 2: Team Workload Calculation & Unassigned Task Accounting');

it('Workload calculates total hours and unestimated task counts without fabricating fake estimates', () => {
  const members = [
    { id: 'u1', name: 'Alice' },
    { id: 'u2', name: 'Bob' },
  ];
  const tasks = [
    { id: 'TASK-01', title: 'Task A', estimatedEffortHours: 10, assignedUserId: 'u1', status: 'In Progress' },
    { id: 'TASK-02', title: 'Task B', estimatedEffortHours: 15, assignedUserId: 'u1', status: 'Todo' },
    { id: 'TASK-03', title: 'Task C', estimatedEffortHours: 0, assignedUserId: 'u2', status: 'Todo' }, // Unestimated
    { id: 'TASK-04', title: 'Task D', estimatedEffortHours: 8, assignedUserId: null, status: 'Todo' }, // Unassigned
    { id: 'TASK-05', title: 'Task E', estimatedEffortHours: 20, assignedUserId: 'u2', status: 'Completed' }, // Completed
  ];

  const summary = calculateTeamWorkloadSummary(tasks, members);

  // Total project active hours: Task A (10) + Task B (15) + Task D (8) = 33h
  assert.strictEqual(summary.totalProjectHours, 33);
  assert.strictEqual(summary.totalTaskCount, 5);
  assert.strictEqual(summary.activeTaskCount, 4);
  assert.strictEqual(summary.completedTaskCount, 1);
  assert.strictEqual(summary.unestimatedTaskCount, 1);
  assert.strictEqual(summary.unassignedTaskCount, 1);

  // Alice (u1): 2 active tasks, 25h total effort, 76% share of 33h
  const alice = summary.membersWorkload.find((m) => m.memberId === 'u1');
  assert.strictEqual(alice.activeTaskCount, 2);
  assert.strictEqual(alice.completedTaskCount, 0);
  assert.strictEqual(alice.totalEstimatedHours, 25);
  assert.strictEqual(alice.workloadPercentage, 76);
  assert.strictEqual(alice.workloadLevel, WORKLOAD_LEVELS.HIGH);

  // Bob (u2): 1 active task (unestimated 0h), 1 completed task, 0h effort, 0% share
  const bob = summary.membersWorkload.find((m) => m.memberId === 'u2');
  assert.strictEqual(bob.activeTaskCount, 1);
  assert.strictEqual(bob.completedTaskCount, 1);
  assert.strictEqual(bob.totalEstimatedHours, 0);
  assert.strictEqual(bob.unestimatedTaskCount, 1);
  assert.strictEqual(bob.workloadPercentage, 0);
  assert.strictEqual(bob.workloadLevel, WORKLOAD_LEVELS.LOW);

  // Unassigned task (TASK-04) does NOT inflate any member's workload
  assert.strictEqual(summary.unassignedTasks[0].id, 'TASK-04');
});

// -------------------------------------------------------------
// TEST GROUP 3: TASK ASSIGNMENT RECOMMENDATIONS
// -------------------------------------------------------------
console.log('\n🔍 TEST GROUP 3: Task Assignment Recommendation Engine');

it('Recommendations match candidates based on skill match and available bandwidth', () => {
  const members = [
    { id: 'u1', name: 'Alice (React Expert)', declaredSkills: ['React', 'JavaScript'] },
    { id: 'u2', name: 'Bob (Python Expert)', declaredSkills: ['Python', 'FastAPI'] },
  ];
  const tasks = [
    { id: 'TASK-01', title: 'Build React UI Component', requiredCapabilities: ['React'] },
    { id: 'TASK-02', title: 'Build ML Inference API', requiredCapabilities: ['Python'] },
  ];

  const recs = generateTaskAssignmentRecommendations(tasks, [], members);
  assert.strictEqual(recs.length, 2);

  // TASK-01 should recommend Alice
  const rec1 = recs.find((r) => r.taskId === 'TASK-01');
  assert.strictEqual(rec1.recommendedUserId, 'u1');
  assert.strictEqual(rec1.recommendedUserName, 'Alice (React Expert)');
  assert.ok(rec1.matchScore > 70);

  // TASK-02 should recommend Bob
  const rec2 = recs.find((r) => r.taskId === 'TASK-02');
  assert.strictEqual(rec2.recommendedUserId, 'u2');
  assert.strictEqual(rec2.recommendedUserName, 'Bob (Python Expert)');
  assert.ok(rec2.matchScore > 70);
});

// -------------------------------------------------------------
// TEST SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 POST-PHASE-11 TESTS: ${passedTests} Passed | ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL POST-PHASE-11 HARDENING TESTS PASSED PERFECTLY!\n');
}
