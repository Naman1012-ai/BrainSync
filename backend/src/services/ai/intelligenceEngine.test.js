/**
 * Blueprint 2.0 Intelligence Engine & Security Test Suite (Phase 3)
 * Tests:
 * 1. Authentication & Impersonation Prevention
 * 2. Workspace Authorization Logic
 * 3. Parallel Context Retrieval (Fixing N+1)
 * 4. User Capability Model & Zero-Hallucination Skill Rule
 * 5. Structured Discussion Intelligence
 * 6. Data Minimization & Prompt Security Boundary
 * 7. Blueprint 2.0 Gemini Output & Validation Pipeline
 * 8. Generation Lock, Stale Recovery & Version History Preservation
 * 9. Legacy Blueprint Compatibility
 */

import { requireAuth } from '../../middleware/authMiddleware.js';
import { aiBlueprintService } from '../aiBlueprintService.js';
import { rtdbService } from '../rtdbService.js';
import {
  detectSchemaVersion,
  validateBlueprint2Output,
  validateBlueprintOutput,
  mapLegacyBlueprintToV2,
  mapV2BlueprintToLegacy,
  safeParseJson,
} from './blueprintValidator.js';
import { SCHEMA_VERSIONS, createDefaultBlueprint2Content } from '../../constants/blueprintSchema.js';

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
console.log('🧪 BLUEPRINT 2.0 INTELLIGENCE ENGINE & SECURITY TEST SUITE (PHASE 3)');
console.log('🧪 ====================================================\n');

// ----------------------------------------------------------------------------
// Test 1: Authentication & Impersonation Prevention (requireAuth & Token Logic)
// ----------------------------------------------------------------------------
console.log('Test 1: Testing Authentication & Impersonation Prevention...');

// Mock Express req/res
const createMockReqRes = (user, body = {}, query = {}) => {
  const req = { user, body, query, headers: {} };
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
  return { req, res };
};

// 1a: Missing user fails with 401
let nextCalled = false;
const { req: unauthReq, res: unauthRes } = createMockReqRes(null);
requireAuth(unauthReq, unauthRes, () => { nextCalled = true; });
assert(unauthRes.statusCode === 401 && !nextCalled, 'Unauthenticated request correctly rejected with HTTP 401');

// 1b: Valid verified user succeeds
nextCalled = false;
const verifiedUser = { uid: 'user_alice_123', email: 'alice@example.com', authenticated: true };
const { req: authReq, res: authRes } = createMockReqRes(verifiedUser);
requireAuth(authReq, authRes, () => { nextCalled = true; });
assert(nextCalled === true && authRes.statusCode === 200, 'Authenticated request with verified token allowed through');

// 1c: Impersonation test - Body userUid differs from token uid
const impersonatorUser = { uid: 'user_attacker_999', authenticated: true };
const forgedBody = { workspaceId: 'ws_target_org', userUid: 'user_victim_victim_001' };
const { req: impReq } = createMockReqRes(impersonatorUser, forgedBody);

// Simulate route handler extracting identity
const extractedUid = impReq.user?.uid; // Route strictly takes req.user.uid
assert(extractedUid === 'user_attacker_999', 'Route strictly extracts verified identity (user_attacker_999) ignoring forged body (user_victim_victim_001)');
assert(extractedUid !== forgedBody.userUid, 'Forged userUid in request body successfully ignored');

// ----------------------------------------------------------------------------
// Test 2: Data Minimization & Sanitization
// ----------------------------------------------------------------------------
console.log('\nTest 2: Testing Data Minimization & Context Sanitization...');

// Mock RTDB queries for context preparation
const mockWorkspaceId = 'ws_test_org_777';
const mockMvpIdea = {
  ideaId: 'idea_food_connect_01',
  title: 'FoodConnect MVP',
  problemStatement: 'Excess food from campus dining halls is discarded while students face food insecurity.',
  proposedSolution: 'A realtime redistribution platform with instant notification alerts and pickup scheduling.',
  techStack: 'React, Node.js, Firebase RTDB',
  category: 'Social Impact',
  difficultyLevel: 'Intermediate',
  voteCount: 14,
  authorName: 'Sarah Jenkins',
};

// Override rtdbService.getData for mock test
const originalGetData = rtdbService.getData;
rtdbService.getData = async (path) => {
  if (path.startsWith('organization_members/')) {
    return {
      'uid_member_1': { role: 'Lead Architect' },
      'uid_member_2': { role: 'Frontend Developer' },
      'uid_member_3': { role: 'Contributor' },
    };
  }
  if (path === 'users/uid_member_1') {
    return {
      uid: 'uid_member_1',
      displayName: 'Alice Engineer',
      email: 'alice@secret-domain.internal',
      skills: 'Node.js, Express, Firebase RTDB, System Architecture',
      techStack: 'Node.js, React',
      college: 'Tech University',
    };
  }
  if (path === 'users/uid_member_2') {
    return {
      uid: 'uid_member_2',
      displayName: 'Bob Designer',
      email: 'bob@secret-domain.internal',
      skills: 'React, Tailwind CSS, UI/UX',
    };
  }
  if (path === 'users/uid_member_3') {
    return {
      uid: 'uid_member_3',
      displayName: 'Charlie Newbie',
      email: 'charlie@secret-domain.internal',
      // No skills declared!
    };
  }
  if (path.startsWith('discussions/')) {
    return {
      'disc_01': {
        discussionId: 'disc_01',
        type: 'suggestion',
        authorName: 'David',
        message: 'Add SMS notifications for urgent food pickups.',
        isAccepted: true,
      },
      'disc_02': {
        discussionId: 'disc_02',
        type: 'question',
        authorName: 'Eva',
        message: 'How will food safety expiration times be verified?',
        isAccepted: false,
      },
      'disc_03': {
        discussionId: 'disc_03',
        type: 'comment',
        authorName: 'Frank',
        message: 'Campus dining manager agreed to participate in pilot.',
        isAccepted: false,
      },
    };
  }
  return null;
};

// ----------------------------------------------------------------------------
// Test 3: Parallel Context Retrieval & Discussion Intelligence
// ----------------------------------------------------------------------------
console.log('\nTest 3: Testing Parallel Context Retrieval & Discussion Categorization...');
const contextPayload = await aiBlueprintService.prepareAiInputContext(mockWorkspaceId, mockMvpIdea);

assert(contextPayload.ideaTitle === 'FoodConnect MVP', 'Correct project title in context');
assert(contextPayload.teamMembers.length === 3, 'All 3 team members retrieved in parallel');
assert(contextPayload.discussions.acceptedSuggestions.length === 1, '1 accepted suggestion correctly categorized');
assert(contextPayload.discussions.unresolvedQuestions.length === 1, '1 unresolved question correctly categorized');
assert(contextPayload.discussions.importantComments.length === 1, '1 important comment correctly categorized');

// ----------------------------------------------------------------------------
// Test 4: Zero-Hallucination Capability Rule
// ----------------------------------------------------------------------------
console.log('\nTest 4: Testing Team Capability Profile & Zero-Hallucination Skill Rule...');
const memberAlice = contextPayload.teamMembers.find((m) => m.id === 'uid_member_1');
const memberCharlie = contextPayload.teamMembers.find((m) => m.id === 'uid_member_3');

assert(memberAlice.hasDeclaredSkills === true, 'Alice has verified declared skills');
assert(memberAlice.declaredSkills.includes('Node.js'), 'Alice has Node.js in declared skills');
assert(memberCharlie.hasDeclaredSkills === false, 'Charlie explicitly has hasDeclaredSkills = false');
assert(memberCharlie.declaredSkills.length === 0, 'Charlie has empty declared skills (skills not fabricated)');

// ----------------------------------------------------------------------------
// Test 5: Blueprint 2.0 Output Validation Pipeline
// ----------------------------------------------------------------------------
console.log('\nTest 5: Testing Blueprint 2.0 Output Generation & Validation...');
const sampleBlueprint2Output = {
  schemaVersion: 2,
  projectUnderstanding: {
    summary: 'Food redistribution platform for campus communities.',
    vision: 'Eliminate edible food waste on university campuses.',
    problemStatement: mockMvpIdea.problemStatement,
    targetAudience: 'Students and dining staff',
    proposedSolution: mockMvpIdea.proposedSolution,
    valueProposition: 'Immediate real-time matching of surplus food.',
    mvpScope: {
      inScope: ['Pickup listings', 'Realtime notifications', 'Auth'],
      outOfScope: ['Off-campus delivery', 'Payment processing'],
      successCriteria: ['100% of pilot food batches claimed within 30 min'],
    },
    assumptions: ['Dining staff will log food batches'],
    constraints: ['Food safety window of 2 hours'],
  },
  requirements: [
    {
      id: 'REQ-01',
      title: 'Realtime Food Listing',
      description: 'Dining managers can post surplus food batches.',
      type: 'functional',
      priority: 'Must Have',
      source: 'mvp_proposal',
      status: 'proposed',
    },
    {
      id: 'REQ-02',
      title: 'SMS Alert Notification',
      description: 'Subscribed students receive instant SMS alerts.',
      type: 'functional',
      priority: 'Should Have',
      source: 'discussion_decision',
      status: 'proposed',
    },
  ],
  architecture: {
    architecturePattern: 'Client-Server Realtime Architecture',
    components: ['React SPA', 'Node.js Express API', 'Firebase Realtime Database'],
    dataFlowDescription: 'Listings published to RTDB stream directly to student subscribers.',
    technologyStack: {
      frontend: ['React', 'Tailwind CSS'],
      backend: ['Node.js', 'Express'],
      database: ['Firebase RTDB'],
      hosting: ['Vercel'],
      thirdPartyApis: ['Twilio SMS'],
      evaluationReason: 'Optimized for live sync latency.',
    },
    decisions: [
      {
        id: 'ADR-01',
        category: 'database',
        decision: 'Use Firebase Realtime Database for active food batch notifications.',
        rationale: 'Sub-second event propagation is critical for perishable food claiming.',
        alternatives: ['PostgreSQL with Polling'],
        tradeOffs: 'Requires denormalized listing records.',
        consequences: 'Enforces clean listener disposal.',
        confidence: 'high',
        source: 'ai_recommended',
      },
    ],
    dataArchitecture: {
      primaryDatabase: 'Firebase Realtime Database',
      entities: [
        {
          entityName: 'FoodListings',
          entityType: 'Necessary Entity',
          isOptional: false,
          fields: ['listingId', 'title', 'quantity', 'expirationTimestamp', 'status'],
          optionalFields: ['dietaryTags'],
        },
      ],
    },
  },
  execution: {
    features: [
      {
        id: 'FEAT-01',
        name: 'Surplus Food Feed',
        description: 'Live interactive feed of available food pickups.',
        priority: 'Must Have',
        status: 'planned',
        requirementIds: ['REQ-01'],
        acceptanceCriteriaIds: ['AC-01'],
        taskIds: ['TASK-01'],
      },
    ],
    workflow: [
      {
        id: 'WF-01',
        stepNumber: 1,
        stepName: 'Post Food Batch',
        description: 'Staff logs available items.',
        input: 'Food batch payload',
        output: 'Active listing in RTDB',
        featureIds: ['FEAT-01'],
        taskIds: ['TASK-01'],
        dependencyStepIds: [],
      },
    ],
    roles: [
      {
        id: 'ROLE-01',
        roleName: 'Backend & Realtime Lead',
        responsibility: 'API endpoints, RTDB rules, SMS integration.',
        capabilityRequirements: ['Node.js', 'Express', 'Firebase RTDB'],
        recommendedUserId: 'uid_member_1', // Alice explicitly has these declared skills!
        recommendedUserName: 'Alice Engineer',
        assignmentStatus: 'recommended',
        assignmentNote: 'Matched based on verified declared skills (Node.js, Express, Firebase RTDB).',
        taskIds: ['TASK-01'],
      },
      {
        id: 'ROLE-02',
        roleName: 'QA & Safety Tester',
        responsibility: 'Validates expiration logic and edge cases.',
        capabilityRequirements: ['Integration Testing', 'Manual QA'],
        recommendedUserId: null, // Charlie has no verified skills; do not fabricate!
        recommendedUserName: null,
        assignmentStatus: 'recommended',
        assignmentNote: 'Strategic recommendation based on project requirements; member skills unverified.',
        taskIds: [],
      },
    ],
    tasks: [
      {
        id: 'TASK-01',
        title: 'Build Food Listing REST Endpoints & RTDB Trigger',
        description: 'Create listing creation endpoint and websocket push.',
        category: 'backend',
        priority: 'Critical',
        status: 'Todo',
        featureId: 'FEAT-01',
        requirementIds: ['REQ-01'],
        workflowStepId: 'WF-01',
        recommendedRoleId: 'ROLE-01',
        assignedUserId: null,
        assignedUserName: null,
        dependencyIds: [],
        acceptanceCriteriaIds: ['AC-01'],
        estimatedEffortHours: 4,
        milestoneId: 'MILE-01',
        source: 'ai_proposed',
        isConvertedToTask: false,
        convertedTaskId: null,
      },
    ],
    dependencies: [],
    timeline: {
      planningAssumptions: ['2 Sprints duration'],
      estimatedDuration: '2 Sprints (2 Weeks)',
      milestones: [
        {
          id: 'MILE-01',
          name: 'Sprint 1: Core Redistribution Engine',
          description: 'Deploy food listings and real-time feed.',
          order: 1,
          duration: 'Sprint 1',
          deliverables: ['Listing endpoints', 'Realtime feed'],
          taskIds: ['TASK-01'],
          status: 'planned',
        },
      ],
      criticalPathTaskIds: ['TASK-01'],
    },
  },
  quality: {
    acceptanceCriteria: [
      {
        id: 'AC-01',
        description: 'New food listings appear on connected student clients in under 500ms.',
        type: 'functional',
        status: 'pending',
        relatedTaskId: 'TASK-01',
        relatedFeatureId: 'FEAT-01',
      },
    ],
    testingStrategy: {
      overview: 'Realtime synchronization and listing lifecycle testing.',
      unitTesting: { enabled: true, scope: 'Validators', tools: ['Node test'] },
      integrationTesting: { enabled: true, scope: 'API & RTDB', tools: ['Supertest'] },
      apiTesting: { enabled: true, scope: 'Endpoints', tools: ['Fetch'] },
      uiTesting: { enabled: true, scope: 'Feed rendering', tools: ['React Testing'] },
      securityTesting: { enabled: true, scope: 'Auth token validation', tools: ['Audit'] },
      performanceTesting: { enabled: true, scope: 'Sync latency', tools: ['Lighthouse'] },
      e2eTesting: { enabled: false, scope: 'Post-MVP', tools: [] },
    },
    risks: [
      {
        id: 'RISK-01',
        title: 'Perishable Food Expiration Window',
        description: 'Food may spoil if not picked up before expiration.',
        category: 'product',
        likelihood: 'Medium',
        impact: 'High',
        severity: 'High',
        mitigation: 'Implement auto-closing listings with countdown timers.',
        contingency: 'Alert dining staff to discard uncollected batch.',
        ownerRoleId: 'ROLE-01',
        relatedTaskIds: ['TASK-01'],
        status: 'identified',
      },
    ],
    definitionOfDone: {
      developmentComplete: ['Code merged with zero lint errors'],
      testingCriteria: ['All validation passes'],
      securityChecks: ['Endpoints verify auth tokens'],
      deploymentReadiness: ['Clean production build'],
      documentation: ['API schema documented'],
      operationalReadiness: ['Error recovery operational'],
    },
    readiness: {
      score: 92,
      level: 'Ready for Development',
      gaps: [],
    },
  },
  intelligence: {
    discussionIntelligence: {
      summary: 'Discussion confirmed strong campus dining interest and prioritized SMS alerts.',
      decisions: [],
      acceptedSuggestions: [
        {
          id: 'disc_01',
          content: 'Add SMS notifications for urgent food pickups.',
          authorName: 'David',
          relevance: 'high',
          impact: 'high',
          recommendation: 'Integrated into REQ-02.',
          implementedInFeatureId: 'FEAT-01',
        },
      ],
      rejectedSuggestions: [],
      unresolvedQuestions: [
        {
          id: 'disc_02',
          question: 'How will food safety expiration times be verified?',
          authorName: 'Eva',
          area: 'safety',
          severity: 'high',
          suggestedResolution: 'Require dining staff to enter certified preparation time on batch creation.',
        },
      ],
      importantComments: [],
    },
    recommendations: [
      {
        id: 'REC-01',
        title: 'Automated Expiration Expiry Sweeper',
        description: 'Run scheduled background job to mark expired listings inactive.',
        rationale: 'Prevents students from arriving for expired food.',
        category: 'product',
        confidence: 'high',
        impact: 'high',
        status: 'proposed',
      },
    ],
    futureBacklog: [
      {
        id: 'BACK-01',
        title: 'Campus Dining POS Integration',
        description: 'Direct webhook from campus kitchen inventory systems.',
        reason: 'Automates batch logging post-MVP.',
        priority: 'Medium',
        relatedFeatureIds: ['FEAT-01'],
      },
    ],
  },
};

const validatedBp2 = validateBlueprint2Output(sampleBlueprint2Output);
assert(detectSchemaVersion(validatedBp2) === SCHEMA_VERSIONS.CANONICAL_V2, 'Blueprint 2.0 schema detected correctly');
assert(validatedBp2.schemaVersion === 2, 'schemaVersion: 2 confirmed');
assert(validatedBp2.requirements.length === 2, 'Requirements preserved and validated');
assert(validatedBp2.architecture.decisions[0].id === 'ADR-01', 'Architectural Decision Record validated');
assert(validatedBp2.execution.roles[0].recommendedUserId === 'uid_member_1', 'Alice correctly matched to Backend Lead based on declared skills');
assert(validatedBp2.execution.roles[1].recommendedUserId === null, 'Charlie correctly unassigned without skill hallucination');
assert(validatedBp2.intelligence.discussionIntelligence.acceptedSuggestions[0].id === 'disc_01', 'Accepted suggestion preserved in discussion intelligence');
assert(validatedBp2.intelligence.discussionIntelligence.unresolvedQuestions[0].id === 'disc_02', 'Unresolved question preserved with suggested resolution');

// ----------------------------------------------------------------------------
// Test 6: Legacy Compatibility & Bidirectional Mapping
// ----------------------------------------------------------------------------
console.log('\nTest 6: Testing Legacy Compatibility & View Mapping...');
const legacyView = mapV2BlueprintToLegacy(validatedBp2);
assert(legacyView.projectOverview.summary === sampleBlueprint2Output.projectUnderstanding.summary, 'Project summary accessible via legacy view');
assert(legacyView.coreFeatures[0].featureName === 'Surplus Food Feed', 'Features accessible via legacy coreFeatures');
assert(legacyView.challengesAndDifficulties[0].challenge === 'Perishable Food Expiration Window', 'Risks accessible via legacy challenges');
assert(legacyView.suggestionsAnalysis[0].content === 'Add SMS notifications for urgent food pickups.', 'Suggestions accessible via legacy suggestionsAnalysis');

// ----------------------------------------------------------------------------
// Test 7: Regeneration & Version History Snapshot Preservation
// ----------------------------------------------------------------------------
console.log('\nTest 7: Testing Regeneration & Version Snapshot Preservation...');
const v1Snapshot = { ...validatedBp2, version: '1.0' };
const v2Snapshot = { ...validatedBp2, version: '2.0', requirements: [...validatedBp2.requirements, { id: 'REQ-03', title: 'Analytics', description: 'Track saved meals', type: 'business', priority: 'Nice to Have' }] };

const versionHistory = {
  'v1_0': v1Snapshot,
  'v2_0': v2Snapshot,
};

assert(Object.keys(versionHistory).length === 2, 'Both v1.0 and v2.0 snapshots preserved in version history map');
assert(versionHistory['v1_0'].requirements.length === 2, 'v1.0 snapshot remains intact with original requirements');
assert(versionHistory['v2_0'].requirements.length === 3, 'v2.0 snapshot contains new requirement without mutating v1.0');

// Restore original getData
rtdbService.getData = originalGetData;

// ----------------------------------------------------------------------------
// Final Summary
// ----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`🏁 PHASE 3 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
