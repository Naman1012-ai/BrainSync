/**
 * Server-Side AI Blueprint & Community Intelligence JSON Validator (Phase 2 Canonical Upgrade)
 * Validates raw Gemini AI output & manual edits against both:
 * 1. Canonical Blueprint 2.0 Schema Contract (schemaVersion: 2)
 * 2. Legacy 16-Section Blueprint Contract (schemaVersion: 1)
 *
 * Provides bidirectional lossless mapping, graph cycle detection, reference validation,
 * and resilient auto-healing.
 */

import {
  SCHEMA_VERSIONS,
  REQUIREMENT_TYPES,
  PRIORITY_LEVELS,
  TASK_CATEGORIES,
  TASK_STATUSES,
  DEPENDENCY_TYPES,
  RISK_CATEGORIES,
  SEVERITY_LEVELS,
  DECISION_CATEGORIES,
  AI_RECOMMENDATION_CATEGORIES,
  READINESS_LEVELS,
  createDefaultBlueprint2Content,
} from '../../constants/blueprintSchema.js';

import {
  validateTaskDependencies,
  deriveTopologicalOrder,
  deriveExecutionWaves,
  calculateCriticalPath,
  deriveBlockedTasks,
  validateAndSynthesizeExecutionPlan,
} from './executionEngine.js';

import {
  deriveRiskSeverity,
  validateAndSynthesizeRisks,
  calculateTestingCoverage,
  getDefaultQualityGates,
  evaluateQualityGates,
  deriveProjectReadiness,
} from './qualityIntelligenceEngine.js';

import {
  synthesizeDiscussionIntelligence,
  validateAndSynthesizeDecisions,
  validateAndSynthesizeQuestions,
  validateAndSynthesizeSuggestions,
  synthesizeChangeRecommendations,
  calculateDecisionImpact,
} from './discussionIntelligenceEngine.js';

export {
  validateTaskDependencies,
  deriveTopologicalOrder,
  deriveExecutionWaves,
  calculateCriticalPath,
  deriveBlockedTasks,
  validateAndSynthesizeExecutionPlan,
  deriveRiskSeverity,
  validateAndSynthesizeRisks,
  calculateTestingCoverage,
  getDefaultQualityGates,
  evaluateQualityGates,
  deriveProjectReadiness,
  synthesizeDiscussionIntelligence,
  validateAndSynthesizeDecisions,
  validateAndSynthesizeQuestions,
  validateAndSynthesizeSuggestions,
  synthesizeChangeRecommendations,
  calculateDecisionImpact,
};

const VALID_RELEVANCE_LEVELS = new Set(['high', 'medium', 'low', 'irrelevant']);
const VALID_IMPACT_LEVELS = new Set(['high', 'medium', 'low']);

/**
 * Safely parse raw AI output string into a JSON object.
 * Includes fallback regex extraction & trailing comma cleanup for resilient LLM parsing.
 */
export function safeParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI response is empty or non-string.');
  }

  let cleanText = rawText.trim();

  // Strip markdown code blocks (```json ... ```)
  if (cleanText.includes('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      cleanText = match[1].trim();
    } else {
      cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
  }

  // Attempt direct parse
  try {
    return JSON.parse(cleanText);
  } catch (firstErr) {
    // Clean trailing commas in objects and arrays
    try {
      const sanitized = cleanText
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      return JSON.parse(sanitized);
    } catch (secondErr) {
      // Extract first '{' to last '}'
      const startIdx = cleanText.indexOf('{');
      const endIdx = cleanText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx > startIdx) {
        try {
          const substringJson = cleanText.substring(startIdx, endIdx + 1);
          return JSON.parse(substringJson);
        } catch (thirdErr) {
          console.error('[blueprintValidator] JSON extraction failed:', thirdErr.message);
        }
      }
      console.error('[blueprintValidator] Unrecoverable JSON parse error:', firstErr.message, 'Snippet:', cleanText.slice(0, 300));
      throw new Error('AI response could not be parsed as valid JSON.');
    }
  }
}

/**
 * Detects whether a JSON object conforms to Schema Version 2 (Canonical 2.0) or Schema Version 1 (Legacy 16-section).
 */
export function detectSchemaVersion(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object') return SCHEMA_VERSIONS.LEGACY_V1;

  if (jsonObj.schemaVersion === 2 || jsonObj.schemaVersion === '2') {
    return SCHEMA_VERSIONS.CANONICAL_V2;
  }

  // Check for presence of Blueprint 2.0 grouped root keys
  const v2Keys = ['projectUnderstanding', 'requirements', 'architecture', 'execution', 'quality', 'intelligence'];
  const matches = v2Keys.filter((k) => k in jsonObj);
  if (matches.length >= 3) {
    return SCHEMA_VERSIONS.CANONICAL_V2;
  }

  return SCHEMA_VERSIONS.LEGACY_V1;
}

// ============================================================================
// GRAPH & REFERENCE VALIDATION HELPERS
// ============================================================================

/**
 * Validates cross-entity references in Blueprint 2.0 content.
 */
export function validateEntityReferences(v2Content) {
  const errors = [];
  const reqIds = new Set((v2Content.requirements || []).map((r) => r.id));
  const featIds = new Set((v2Content.execution?.features || []).map((f) => f.id));
  const roleIds = new Set((v2Content.execution?.roles || []).map((r) => r.id));
  const taskIds = new Set((v2Content.execution?.tasks || []).map((t) => t.id));

  // Check Feature Requirement References
  for (const feat of v2Content.execution?.features || []) {
    for (const rId of feat.requirementIds || []) {
      if (!reqIds.has(rId)) {
        errors.push(`Feature '${feat.id}' references unknown requirement ID '${rId}'.`);
      }
    }
  }

  // Check Task References
  for (const task of v2Content.execution?.tasks || []) {
    if (task.featureId && !featIds.has(task.featureId)) {
      errors.push(`Task '${task.id}' references unknown feature ID '${task.featureId}'.`);
    }
    if (task.recommendedRoleId && !roleIds.has(task.recommendedRoleId)) {
      errors.push(`Task '${task.id}' references unknown role ID '${task.recommendedRoleId}'.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// CANONICAL BLUEPRINT 2.0 VALIDATOR
// ============================================================================

/**
 * Validates & auto-heals a Blueprint 2.0 content object against the canonical contract.
 */
export function validateBlueprint2Output(jsonObj, fallbackTitle = 'Project', fallbackProblemOrOptions = '', contextOrOptions = {}) {
  let fallbackProblem = '';
  let options = {};
  if (typeof fallbackProblemOrOptions === 'object' && fallbackProblemOrOptions !== null) {
    options = fallbackProblemOrOptions;
    fallbackProblem = options.problemStatement || '';
  } else {
    fallbackProblem = typeof fallbackProblemOrOptions === 'string' ? fallbackProblemOrOptions : '';
    options = contextOrOptions || {};
  }

  const defaults = createDefaultBlueprint2Content(fallbackTitle, fallbackProblem);

  if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) {
    return defaults;
  }

  const result = {
    schemaVersion: SCHEMA_VERSIONS.CANONICAL_V2,
  };

  // 1. projectUnderstanding
  const pu = jsonObj.projectUnderstanding || {};
  result.projectUnderstanding = {
    summary: pu.summary || defaults.projectUnderstanding.summary,
    vision: pu.vision || defaults.projectUnderstanding.vision,
    problemStatement: pu.problemStatement || fallbackProblem || defaults.projectUnderstanding.problemStatement,
    targetAudience: pu.targetAudience || defaults.projectUnderstanding.targetAudience,
    proposedSolution: pu.proposedSolution || defaults.projectUnderstanding.proposedSolution,
    valueProposition: pu.valueProposition || defaults.projectUnderstanding.valueProposition,
    mvpScope: {
      inScope: Array.isArray(pu.mvpScope?.inScope) ? pu.mvpScope.inScope : defaults.projectUnderstanding.mvpScope.inScope,
      outOfScope: Array.isArray(pu.mvpScope?.outOfScope) ? pu.mvpScope.outOfScope : defaults.projectUnderstanding.mvpScope.outOfScope,
      successCriteria: Array.isArray(pu.mvpScope?.successCriteria) ? pu.mvpScope.successCriteria : defaults.projectUnderstanding.mvpScope.successCriteria,
    },
    assumptions: Array.isArray(pu.assumptions) ? pu.assumptions : defaults.projectUnderstanding.assumptions,
    constraints: Array.isArray(pu.constraints) ? pu.constraints : defaults.projectUnderstanding.constraints,
  };

  // 2. requirements
  if (Array.isArray(jsonObj.requirements) && jsonObj.requirements.length > 0) {
    const seenReqIds = new Set();
    result.requirements = jsonObj.requirements.map((req, idx) => {
      let id = req.id || `REQ-${String(idx + 1).padStart(2, '0')}`;
      if (seenReqIds.has(id)) id = `REQ-${String(idx + 1).padStart(2, '0')}_${Math.random().toString(36).slice(2, 5)}`;
      seenReqIds.add(id);

      return {
        id,
        title: req.title || `Requirement ${idx + 1}`,
        description: req.description || 'Requirement specification.',
        type: REQUIREMENT_TYPES.includes(req.type) ? req.type : 'functional',
        priority: PRIORITY_LEVELS.includes(req.priority) ? req.priority : 'Must Have',
        source: req.source || 'ai_inferred',
        status: req.status || 'proposed',
        category: req.category || 'general',
      };
    });
  } else {
    result.requirements = defaults.requirements;
  }

  // 3. architecture
  const arch = jsonObj.architecture || {};
  const techStack = arch.technologyStack || {};
  const dataArch = arch.dataArchitecture || {};

  result.architecture = {
    architecturePattern: arch.architecturePattern || defaults.architecture.architecturePattern,
    components: Array.isArray(arch.components) ? arch.components : defaults.architecture.components,
    dataFlowDescription: arch.dataFlowDescription || defaults.architecture.dataFlowDescription,
    technologyStack: {
      frontend: Array.isArray(techStack.frontend) ? techStack.frontend : defaults.architecture.technologyStack.frontend,
      backend: Array.isArray(techStack.backend) ? techStack.backend : defaults.architecture.technologyStack.backend,
      database: Array.isArray(techStack.database) ? techStack.database : defaults.architecture.technologyStack.database,
      hosting: Array.isArray(techStack.hosting) ? techStack.hosting : defaults.architecture.technologyStack.hosting,
      thirdPartyApis: Array.isArray(techStack.thirdPartyApis) ? techStack.thirdPartyApis : defaults.architecture.technologyStack.thirdPartyApis,
      evaluationReason: techStack.evaluationReason || defaults.architecture.technologyStack.evaluationReason,
    },
    decisions: Array.isArray(arch.decisions) && arch.decisions.length > 0
      ? arch.decisions.map((dec, idx) => ({
          id: dec.id || `ADR-${String(idx + 1).padStart(2, '0')}`,
          category: DECISION_CATEGORIES.includes(dec.category) ? dec.category : 'architecture',
          decision: dec.decision || 'Architecture decision.',
          rationale: dec.rationale || 'Decision rationale.',
          alternatives: Array.isArray(dec.alternatives) ? dec.alternatives : [],
          tradeOffs: dec.tradeOffs || 'Trade-off analysis.',
          consequences: dec.consequences || 'System impact.',
          confidence: ['high', 'medium', 'low'].includes(dec.confidence) ? dec.confidence : 'high',
          source: dec.source || 'ai_recommended',
        }))
      : defaults.architecture.decisions,
    dataArchitecture: {
      primaryDatabase: dataArch.primaryDatabase || defaults.architecture.dataArchitecture.primaryDatabase,
      entities: Array.isArray(dataArch.entities) && dataArch.entities.length > 0
        ? dataArch.entities.map((ent) => ({
            entityName: ent.entityName || 'Entity',
            entityType: ent.entityType || (ent.isOptional ? 'Optional Entity' : 'Necessary Entity'),
            isOptional: Boolean(ent.isOptional || String(ent.entityType || '').toLowerCase().includes('optional')),
            description: ent.description || undefined,
            fields: Array.isArray(ent.fields) ? ent.fields : ['id', 'createdAt'],
            optionalFields: Array.isArray(ent.optionalFields) ? ent.optionalFields : [],
          }))
        : defaults.architecture.dataArchitecture.entities,
    },
  };

  // 4. execution (Synthesized & Validated via Execution Engine)
  const exec = jsonObj.execution || {};
  const synth = validateAndSynthesizeExecutionPlan(exec, {
    requirements: result.requirements,
    acceptanceCriteria: jsonObj.quality?.acceptanceCriteria,
    teamMembers: Array.isArray(options.teamMembers) ? options.teamMembers : [],
  });

  result.execution = synth.cleanExecution;
  // If execution was empty, ensure defaults are present
  if (!result.execution.tasks || result.execution.tasks.length === 0) {
    result.execution = defaults.execution;
  }

  // 5. quality (Phase 6 Quality, Delivery & Readiness Intelligence)
  const q = jsonObj.quality || {};
  
  const rawRisks = Array.isArray(q.risks) && q.risks.length > 0 ? q.risks : defaults.quality.risks;
  const synthRisks = validateAndSynthesizeRisks(rawRisks, {
    features: result.execution.features,
    tasks: result.execution.tasks,
    requirements: result.requirements,
  });

  const rawTestCases = Array.isArray(q.testingStrategy?.testCases) && q.testingStrategy.testCases.length > 0
    ? q.testingStrategy.testCases
    : defaults.quality.testingStrategy.testCases;

  const testCoverage = calculateTestingCoverage(
    rawTestCases,
    result.requirements,
    result.execution.features,
    result.execution.tasks
  );

  const rawGates = Array.isArray(q.qualityGates) && q.qualityGates.length > 0
    ? q.qualityGates
    : defaults.quality.qualityGates;

  const evaluatedGates = evaluateQualityGates(
    rawGates,
    {
      requirements: result.requirements,
      architecture: result.architecture,
      execution: result.execution,
    },
    options?.liveEvidence || {}
  );

  const derivedReadiness = deriveProjectReadiness(
    {
      requirements: result.requirements,
      architecture: result.architecture,
      execution: result.execution,
      quality: {
        risks: synthRisks.cleanRisks,
        testingStrategy: { testCases: testCoverage.testCases },
        qualityGates: evaluatedGates.qualityGates,
      },
    },
    options?.liveEvidence || {}
  );

  result.quality = {
    acceptanceCriteria: Array.isArray(q.acceptanceCriteria) && q.acceptanceCriteria.length > 0
      ? q.acceptanceCriteria.map((ac, idx) => ({
          id: ac.id || `AC-${String(idx + 1).padStart(2, '0')}`,
          description: ac.description || 'Acceptance criterion verification.',
          type: ['functional', 'technical', 'security', 'performance', 'ux'].includes(ac.type) ? ac.type : 'functional',
          status: ac.status || 'pending',
          relatedTaskId: ac.relatedTaskId || null,
          relatedFeatureId: ac.relatedFeatureId || null,
        }))
      : defaults.quality.acceptanceCriteria,
    testingStrategy: {
      overview: q.testingStrategy?.overview || defaults.quality.testingStrategy.overview,
      unitTesting: q.testingStrategy?.unitTesting || defaults.quality.testingStrategy.unitTesting,
      integrationTesting: q.testingStrategy?.integrationTesting || defaults.quality.testingStrategy.integrationTesting,
      apiTesting: q.testingStrategy?.apiTesting || defaults.quality.testingStrategy.apiTesting,
      uiTesting: q.testingStrategy?.uiTesting || defaults.quality.testingStrategy.uiTesting,
      securityTesting: q.testingStrategy?.securityTesting || defaults.quality.testingStrategy.securityTesting,
      performanceTesting: q.testingStrategy?.performanceTesting || defaults.quality.testingStrategy.performanceTesting,
      e2eTesting: q.testingStrategy?.e2eTesting || defaults.quality.testingStrategy.e2eTesting,
      testCases: testCoverage.testCases,
      testCoverageSummary: testCoverage,
    },
    risks: synthRisks.cleanRisks,
    qualityGates: evaluatedGates.qualityGates,
    definitionOfDone: {
      developmentComplete: Array.isArray(q.definitionOfDone?.developmentComplete) ? q.definitionOfDone.developmentComplete : defaults.quality.definitionOfDone.developmentComplete,
      testingCriteria: Array.isArray(q.definitionOfDone?.testingCriteria) ? q.definitionOfDone.testingCriteria : defaults.quality.definitionOfDone.testingCriteria,
      securityChecks: Array.isArray(q.definitionOfDone?.securityChecks) ? q.definitionOfDone.securityChecks : defaults.quality.definitionOfDone.securityChecks,
      deploymentReadiness: Array.isArray(q.definitionOfDone?.deploymentReadiness) ? q.definitionOfDone.deploymentReadiness : defaults.quality.definitionOfDone.deploymentReadiness,
      documentation: Array.isArray(q.definitionOfDone?.documentation) ? q.definitionOfDone.documentation : defaults.quality.definitionOfDone.documentation,
      operationalReadiness: Array.isArray(q.definitionOfDone?.operationalReadiness) ? q.definitionOfDone.operationalReadiness : defaults.quality.definitionOfDone.operationalReadiness,
    },
    readiness: {
      score: derivedReadiness.readinessScore,
      level: derivedReadiness.derivedLevel,
      gaps: derivedReadiness.blockers.concat(derivedReadiness.warnings),
    },
    productionReadiness: derivedReadiness,
  };

  // 6. intelligence (Phase 7 Discussion Intelligence & Decision Traceability)
  const intel = jsonObj.intelligence || {};
  const discIntel = intel.discussionIntelligence || {};

  const synthesizedDiscussionIntel = synthesizeDiscussionIntelligence(
    discIntel,
    {
      requirements: result.requirements,
      execution: result.execution,
      quality: result.quality,
    },
    options.existingDecisions || [],
    options.existingChangeRecommendations || []
  );

  result.intelligence = {
    discussionIntelligence: synthesizedDiscussionIntel,
    recommendations: Array.isArray(intel.recommendations) && intel.recommendations.length > 0
      ? intel.recommendations.map((rec, idx) => ({
          id: rec.id || `REC-${String(idx + 1).padStart(2, '0')}`,
          title: rec.title || `Recommendation ${idx + 1}`,
          description: rec.description || 'Recommendation description.',
          rationale: rec.rationale || 'Recommendation rationale.',
          category: AI_RECOMMENDATION_CATEGORIES.includes(rec.category) ? rec.category : 'architecture',
          confidence: ['high', 'medium', 'low'].includes(rec.confidence) ? rec.confidence : 'high',
          impact: ['high', 'medium', 'low'].includes(rec.impact) ? rec.impact : 'high',
          status: rec.status || 'proposed',
        }))
      : defaults.intelligence.recommendations,
    futureBacklog: Array.isArray(intel.futureBacklog) && intel.futureBacklog.length > 0
      ? intel.futureBacklog.map((back, idx) => ({
          id: back.id || `BACK-${String(idx + 1).padStart(2, '0')}`,
          title: back.title || `Backlog Item ${idx + 1}`,
          description: back.description || 'Backlog item description.',
          reason: back.reason || 'Post-MVP consideration.',
          priority: ['High', 'Medium', 'Low'].includes(back.priority) ? back.priority : 'Medium',
          relatedFeatureIds: Array.isArray(back.relatedFeatureIds) ? back.relatedFeatureIds : [],
        }))
      : defaults.intelligence.futureBacklog,
  };

  return result;
}

// ============================================================================
// LEGACY BLUEPRINT 1.X VALIDATOR
// ============================================================================

/**
 * Validate & auto-heal parsed JSON object against the legacy 16-section Blueprint contract.
 */
export function validateLegacyBlueprintOutput(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) {
    jsonObj = {};
  }

  // 1. projectOverview
  if (!jsonObj.projectOverview || typeof jsonObj.projectOverview !== 'object') {
    jsonObj.projectOverview = {};
  }
  jsonObj.projectOverview = {
    summary: jsonObj.projectOverview.summary || 'Comprehensive technical blueprint specification.',
    vision: jsonObj.projectOverview.vision || 'Build and launch a scalable MVP.',
    targetAudience: jsonObj.projectOverview.targetAudience || 'Developers, Product Leads, and End Users.',
  };

  // 2. mvpScope
  if (!jsonObj.mvpScope || typeof jsonObj.mvpScope !== 'object') {
    jsonObj.mvpScope = {};
  }
  jsonObj.mvpScope = {
    inScope: Array.isArray(jsonObj.mvpScope.inScope) ? jsonObj.mvpScope.inScope : ['Core feature implementation', 'User authentication', 'Database schema'],
    outOfScope: Array.isArray(jsonObj.mvpScope.outOfScope) ? jsonObj.mvpScope.outOfScope : ['Advanced enterprise analytics', 'Third-party integrations'],
    successCriteria: Array.isArray(jsonObj.mvpScope.successCriteria) ? jsonObj.mvpScope.successCriteria : ['Functional MVP deployment', 'Positive user feedback'],
  };

  // 3. recommendedTechStack
  if (!jsonObj.recommendedTechStack || typeof jsonObj.recommendedTechStack !== 'object') {
    jsonObj.recommendedTechStack = {};
  }
  jsonObj.recommendedTechStack = {
    frontend: Array.isArray(jsonObj.recommendedTechStack.frontend) ? jsonObj.recommendedTechStack.frontend : ['React', 'Tailwind CSS'],
    backend: Array.isArray(jsonObj.recommendedTechStack.backend) ? jsonObj.recommendedTechStack.backend : ['Node.js', 'Express'],
    database: Array.isArray(jsonObj.recommendedTechStack.database) ? jsonObj.recommendedTechStack.database : ['Firebase Realtime Database'],
    hosting: Array.isArray(jsonObj.recommendedTechStack.hosting) ? jsonObj.recommendedTechStack.hosting : ['Vercel', 'Render'],
    thirdPartyApis: Array.isArray(jsonObj.recommendedTechStack.thirdPartyApis) ? jsonObj.recommendedTechStack.thirdPartyApis : [],
    evaluationReason: jsonObj.recommendedTechStack.evaluationReason || 'Recommended for rapid development, real-time data sync, and effortless deployment.',
  };

  // 4. coreFeatures
  if (!Array.isArray(jsonObj.coreFeatures)) {
    jsonObj.coreFeatures = [
      { featureName: 'Core Workflow Engine', description: 'Primary feature execution module.', priority: 'Must Have' },
      { featureName: 'Realtime Data Sync', description: 'Sub-second synchronization across client sessions.', priority: 'Must Have' },
    ];
  }

  // 5. userFlow
  if (!Array.isArray(jsonObj.userFlow)) {
    jsonObj.userFlow = [
      { stepNumber: 1, stepName: 'Sign In / Workspace Join', description: 'User authenticates and accesses workspace dashboard.' },
      { stepNumber: 2, stepName: 'Feature Execution', description: 'User interacts with core feature workflows.' },
    ];
  }

  // 6. technicalArchitecture
  if (!jsonObj.technicalArchitecture || typeof jsonObj.technicalArchitecture !== 'object') {
    jsonObj.technicalArchitecture = {};
  }
  jsonObj.technicalArchitecture = {
    architecturePattern: jsonObj.technicalArchitecture.architecturePattern || 'Client-Server Realtime Architecture',
    components: Array.isArray(jsonObj.technicalArchitecture.components) ? jsonObj.technicalArchitecture.components : ['React Web Client', 'Express REST API', 'Firebase Realtime Database'],
    dataFlowDescription: jsonObj.technicalArchitecture.dataFlowDescription || 'Client initiates state mutations via REST API endpoints, synchronized across connected clients via Firebase RTDB.',
  };

  // 7. databaseDesign
  if (!jsonObj.databaseDesign || typeof jsonObj.databaseDesign !== 'object') {
    jsonObj.databaseDesign = {};
  }
  jsonObj.databaseDesign.primaryDatabase = jsonObj.databaseDesign.primaryDatabase || 'Firebase Realtime Database';
  if (!Array.isArray(jsonObj.databaseDesign.entities)) {
    jsonObj.databaseDesign.entities = [
      { entityName: 'Users', entityType: 'Necessary Entity', isOptional: false, fields: ['uid', 'email', 'displayName', 'createdAt'], optionalFields: ['avatarUrl'] },
      { entityName: 'Workspaces', entityType: 'Necessary Entity', isOptional: false, fields: ['workspaceId', 'name', 'ownerId', 'createdAt'], optionalFields: ['settings'] },
    ];
  } else {
    jsonObj.databaseDesign.entities = jsonObj.databaseDesign.entities.map((ent) => {
      const isOpt = Boolean(ent.isOptional || (ent.entityType && String(ent.entityType).toLowerCase().includes('optional')));
      return {
        entityName: ent.entityName || 'Entity',
        entityType: ent.entityType || (isOpt ? 'Optional Entity' : 'Necessary Entity'),
        isOptional: isOpt,
        fields: Array.isArray(ent.fields) ? ent.fields : ['id', 'createdAt'],
        optionalFields: Array.isArray(ent.optionalFields) ? ent.optionalFields : [],
      };
    });
  }

  // 8. teamAllocation
  if (!Array.isArray(jsonObj.teamAllocation)) {
    jsonObj.teamAllocation = [];
  }

  // 9. challengesAndDifficulties
  if (!Array.isArray(jsonObj.challengesAndDifficulties)) {
    jsonObj.challengesAndDifficulties = [
      { challenge: 'Realtime state synchronization latency', severity: 'Medium', mitigationStrategy: 'Implement optimistic UI updates and websocket reconnection policies.' },
    ];
  }

  // 10. innovationAndDifferentiation
  if (!jsonObj.innovationAndDifferentiation || typeof jsonObj.innovationAndDifferentiation !== 'object') {
    jsonObj.innovationAndDifferentiation = {};
  }
  jsonObj.innovationAndDifferentiation = {
    keyDifferentiators: Array.isArray(jsonObj.innovationAndDifferentiation.keyDifferentiators) ? jsonObj.innovationAndDifferentiation.keyDifferentiators : ['AI-Assisted Technical Blueprint Generation'],
    marketAdvantage: jsonObj.innovationAndDifferentiation.marketAdvantage || 'Drastically reduces time from concept ideation to production sprint planning.',
  };

  // 11. developmentRoadmap
  if (!Array.isArray(jsonObj.developmentRoadmap)) {
    jsonObj.developmentRoadmap = [
      { phase: 'Phase 1: Foundation & Setup', duration: 'Sprint 1', deliverables: ['Environment config', 'Core DB schema', 'Auth setup'] },
      { phase: 'Phase 2: Core Feature Implementation', duration: 'Sprint 2', deliverables: ['Primary feature modules', 'UI design integration'] },
    ];
  }

  // 12-14. Community Analyses
  if (!Array.isArray(jsonObj.suggestionsAnalysis)) jsonObj.suggestionsAnalysis = [];
  if (!Array.isArray(jsonObj.commentsAnalysis)) jsonObj.commentsAnalysis = [];
  if (!Array.isArray(jsonObj.questionsAnalysis)) jsonObj.questionsAnalysis = [];

  const validateCommunityAnalysisList = (list) => {
    for (const item of list) {
      if (item && item.relevance) {
        const norm = String(item.relevance).toLowerCase();
        item.relevance = VALID_RELEVANCE_LEVELS.has(norm) ? norm : 'medium';
      }
    }
  };

  validateCommunityAnalysisList(jsonObj.suggestionsAnalysis);
  validateCommunityAnalysisList(jsonObj.commentsAnalysis);
  validateCommunityAnalysisList(jsonObj.questionsAnalysis);

  // 15. communityInsightsSummary
  if (!jsonObj.communityInsightsSummary || typeof jsonObj.communityInsightsSummary !== 'object') {
    jsonObj.communityInsightsSummary = {
      summary: typeof jsonObj.communityInsightsSummary === 'string' ? jsonObj.communityInsightsSummary : 'Community feedback analysis complete.',
      keyTakeaways: [],
    };
  }

  // 16. projectReadiness
  if (!jsonObj.projectReadiness || typeof jsonObj.projectReadiness !== 'object') {
    jsonObj.projectReadiness = {};
  }
  const scoreNum = Number(jsonObj.projectReadiness.score);
  jsonObj.projectReadiness = {
    score: !isNaN(scoreNum) ? Math.max(0, Math.min(100, scoreNum)) : 85,
    readinessLevel: jsonObj.projectReadiness.readinessLevel || 'High',
    keyGaps: Array.isArray(jsonObj.projectReadiness.keyGaps) ? jsonObj.projectReadiness.keyGaps : [],
  };

  return jsonObj;
}

// ============================================================================
// BIDIRECTIONAL MIGRATION & COMPATIBILITY MAPPINGS
// ============================================================================

/**
 * Maps legacy 16-section Blueprint V1 content into canonical Blueprint 2.0 structure.
 * Guaranteed lossless conversion preserving all legacy fields into corresponding canonical groups.
 */
export function mapLegacyBlueprintToV2(v1Content, title = 'Project', problem = '') {
  const validatedV1 = validateLegacyBlueprintOutput(v1Content);

  // Map features
  const features = (validatedV1.coreFeatures || []).map((feat, idx) => ({
    id: `FEAT-${String(idx + 1).padStart(2, '0')}`,
    name: feat.featureName || `Feature ${idx + 1}`,
    description: feat.description || '',
    priority: feat.priority || 'Must Have',
    status: 'planned',
    requirementIds: [`REQ-${String(idx + 1).padStart(2, '0')}`],
    acceptanceCriteriaIds: [`AC-${String(idx + 1).padStart(2, '0')}`],
    taskIds: [`TASK-${String(idx + 1).padStart(2, '0')}`],
  }));

  // Map requirements from features
  const requirements = features.map((feat, idx) => ({
    id: `REQ-${String(idx + 1).padStart(2, '0')}`,
    title: feat.name,
    description: feat.description,
    type: 'functional',
    priority: feat.priority,
    source: 'mvp_proposal',
    status: 'proposed',
    category: 'core',
  }));

  // Map workflow from userFlow
  const workflow = (validatedV1.userFlow || []).map((step, idx) => ({
    id: `WF-${String(idx + 1).padStart(2, '0')}`,
    stepNumber: step.stepNumber || idx + 1,
    stepName: step.stepName || `Step ${idx + 1}`,
    description: step.description || '',
    input: 'User Interaction',
    output: 'System State Update',
    featureIds: features.length > 0 ? [features[Math.min(idx, features.length - 1)].id] : [],
    taskIds: [],
    dependencyStepIds: idx > 0 ? [`WF-${String(idx).padStart(2, '0')}`] : [],
  }));

  // Map roles from teamAllocation
  const tasks = [];
  const roles = (validatedV1.teamAllocation || []).map((mem, idx) => {
    const roleId = `ROLE-${String(idx + 1).padStart(2, '0')}`;
    const assignedTaskIds = [];

    (mem.recommendedTasks || []).forEach((tDesc, tIdx) => {
      const taskId = `TASK-${String(tasks.length + 1).padStart(2, '0')}`;
      assignedTaskIds.push(taskId);
      tasks.push({
        id: taskId,
        title: tDesc,
        description: `Deliverable assigned under ${mem.assignedRole || 'Team Member'}.`,
        category: 'general',
        priority: 'Medium',
        status: 'Todo',
        featureId: features.length > 0 ? features[0].id : null,
        requirementIds: requirements.length > 0 ? [requirements[0].id] : [],
        workflowStepId: workflow.length > 0 ? workflow[0].id : null,
        recommendedRoleId: roleId,
        assignedUserId: mem.memberId || null,
        assignedUserName: mem.memberName || null,
        dependencyIds: tasks.length > 0 ? [tasks[tasks.length - 1].id] : [],
        acceptanceCriteriaIds: [],
        estimatedEffortHours: 4,
        milestoneId: 'MILE-01',
        source: 'ai_proposed',
        isConvertedToTask: false,
        convertedTaskId: null,
      });
    });

    return {
      id: roleId,
      roleName: mem.assignedRole || 'Team Contributor',
      responsibility: `Primary lead for ${mem.assignedRole || 'project tasks'}.`,
      capabilityRequirements: ['General Technical Capabilities'],
      recommendedUserId: mem.memberId || null,
      recommendedUserName: mem.memberName || null,
      assignmentStatus: mem.memberId ? 'assigned' : 'recommended',
      assignmentNote: 'Derived from legacy team allocation snapshot.',
      taskIds: assignedTaskIds,
    };
  });

  // If no tasks generated from team allocation, create default tasks from features
  if (tasks.length === 0) {
    features.forEach((feat, idx) => {
      tasks.push({
        id: `TASK-${String(idx + 1).padStart(2, '0')}`,
        title: `Implement ${feat.name}`,
        description: feat.description,
        category: 'general',
        priority: feat.priority,
        status: 'Todo',
        featureId: feat.id,
        requirementIds: feat.requirementIds,
        workflowStepId: workflow.length > 0 ? workflow[0].id : null,
        recommendedRoleId: roles.length > 0 ? roles[0].id : null,
        assignedUserId: null,
        assignedUserName: null,
        dependencyIds: idx > 0 ? [`TASK-${String(idx).padStart(2, '0')}`] : [],
        acceptanceCriteriaIds: [],
        estimatedEffortHours: 4,
        milestoneId: 'MILE-01',
        source: 'ai_proposed',
        isConvertedToTask: false,
        convertedTaskId: null,
      });
    });
  }

  // Dependencies
  const dependencies = [];
  for (let i = 1; i < tasks.length; i++) {
    dependencies.push({
      id: `DEP-${String(i).padStart(2, '0')}`,
      sourceTaskId: tasks[i - 1].id,
      targetTaskId: tasks[i].id,
      type: 'blocks',
      reason: 'Sequential prerequisite task delivery.',
    });
  }

  // Milestones from developmentRoadmap
  const milestones = (validatedV1.developmentRoadmap || []).map((phase, idx) => ({
    id: `MILE-${String(idx + 1).padStart(2, '0')}`,
    name: phase.phase || `Phase ${idx + 1}`,
    description: `Deliverables: ${(phase.deliverables || []).join(', ')}`,
    order: idx + 1,
    duration: phase.duration || `Sprint ${idx + 1}`,
    deliverables: phase.deliverables || [],
    taskIds: idx === 0 ? tasks.map((t) => t.id) : [],
    status: 'planned',
  }));

  // Acceptance Criteria
  const acceptanceCriteria = features.map((feat, idx) => ({
    id: `AC-${String(idx + 1).padStart(2, '0')}`,
    description: `Verification that ${feat.name} functions as specified in MVP scope.`,
    type: 'functional',
    status: 'pending',
    relatedTaskId: tasks.length > idx ? tasks[idx].id : null,
    relatedFeatureId: feat.id,
  }));

  // Risks from challengesAndDifficulties
  const risks = (validatedV1.challengesAndDifficulties || []).map((ch, idx) => ({
    id: `RISK-${String(idx + 1).padStart(2, '0')}`,
    title: ch.challenge || `Risk ${idx + 1}`,
    description: ch.challenge || '',
    category: 'technical',
    likelihood: 'Medium',
    impact: ch.severity || 'Medium',
    severity: ch.severity || 'Medium',
    mitigation: ch.mitigationStrategy || 'Implement preventive testing and error logging.',
    contingency: 'Fallback to manual administrative override.',
    ownerRoleId: roles.length > 0 ? roles[0].id : null,
    relatedTaskIds: [],
    status: 'identified',
  }));

  // Discussions
  const discussionSummaryText = typeof validatedV1.communityInsightsSummary === 'object'
    ? validatedV1.communityInsightsSummary?.summary || 'Community intelligence synthesis.'
    : String(validatedV1.communityInsightsSummary || 'Community intelligence synthesis.');

  const acceptedSuggestions = (validatedV1.suggestionsAnalysis || [])
    .filter((s) => s.relevance === 'high' || s.relevance === 'medium')
    .map((s) => ({
      id: s.id || `SUG-${Math.random().toString(36).slice(2, 6)}`,
      content: s.content || '',
      authorName: 'Community Contributor',
      relevance: s.relevance || 'medium',
      impact: s.impact || 'medium',
      recommendation: s.recommendation || '',
      implementedInFeatureId: features.length > 0 ? features[0].id : null,
    }));

  const importantComments = (validatedV1.commentsAnalysis || [])
    .filter((c) => c.relevance === 'high' || c.relevance === 'medium')
    .map((c) => ({
      id: c.id || `COM-${Math.random().toString(36).slice(2, 6)}`,
      content: c.content || '',
      authorName: 'Collaborator',
      insight: c.insight || c.reason || '',
      relevance: c.relevance || 'medium',
    }));

  const unresolvedQuestions = (validatedV1.questionsAnalysis || []).map((q) => ({
    id: q.id || `Q-${Math.random().toString(36).slice(2, 6)}`,
    question: q.content || '',
    authorName: 'Team Member',
    area: q.area || 'architecture',
    severity: q.relevance === 'high' ? 'high' : 'medium',
    suggestedResolution: q.recommendation || 'Clarify during upcoming sprint sync.',
  }));

  const v2Payload = {
    schemaVersion: SCHEMA_VERSIONS.CANONICAL_V2,
    projectUnderstanding: {
      summary: validatedV1.projectOverview.summary,
      vision: validatedV1.projectOverview.vision,
      problemStatement: problem || validatedV1.projectOverview.summary,
      targetAudience: validatedV1.projectOverview.targetAudience,
      proposedSolution: validatedV1.projectOverview.vision,
      valueProposition: (validatedV1.innovationAndDifferentiation?.keyDifferentiators || []).join('; ') || 'AI-Assisted Technical Architecture',
      mvpScope: {
        inScope: validatedV1.mvpScope.inScope,
        outOfScope: validatedV1.mvpScope.outOfScope,
        successCriteria: validatedV1.mvpScope.successCriteria,
      },
      assumptions: ['Cloud database availability', 'Stable network connectivity'],
      constraints: ['Sprint timeline budget'],
    },
    requirements,
    architecture: {
      architecturePattern: validatedV1.technicalArchitecture.architecturePattern,
      components: validatedV1.technicalArchitecture.components,
      dataFlowDescription: validatedV1.technicalArchitecture.dataFlowDescription,
      technologyStack: validatedV1.recommendedTechStack,
      decisions: [
        {
          id: 'ADR-01',
          category: 'architecture',
          decision: `Adopt ${validatedV1.technicalArchitecture.architecturePattern} architecture.`,
          rationale: validatedV1.recommendedTechStack.evaluationReason || 'Standardized for rapid sprint delivery.',
          alternatives: [],
          tradeOffs: 'Optimized for velocity over complex distributed partitioning.',
          consequences: 'Enforces clean client-server REST and Realtime boundary.',
          confidence: 'high',
          source: 'ai_recommended',
        },
      ],
      dataArchitecture: validatedV1.databaseDesign,
    },
    execution: {
      features,
      workflow,
      roles,
      tasks,
      dependencies,
      timeline: {
        planningAssumptions: ['Full sprint commitment', 'Standard dev tools'],
        estimatedDuration: `${milestones.length} Sprints`,
        milestones,
        criticalPathTaskIds: tasks.slice(0, 3).map((t) => t.id),
      },
    },
    quality: {
      acceptanceCriteria,
      testingStrategy: {
        overview: 'Tiered testing focusing on schema validation, API contracts, and live sync.',
        unitTesting: { enabled: true, scope: 'Validators and utility models', tools: ['Node test runner'] },
        integrationTesting: { enabled: true, scope: 'REST endpoints and RTDB queries', tools: ['Supertest'] },
        apiTesting: { enabled: true, scope: 'Route responses', tools: ['Fetch API'] },
        uiTesting: { enabled: true, scope: 'Component rendering', tools: ['React Testing'] },
        securityTesting: { enabled: true, scope: 'Token authentication and RTDB rules', tools: ['Audit'] },
        performanceTesting: { enabled: true, scope: 'Latency and payload size', tools: ['Lighthouse'] },
        e2eTesting: { enabled: false, scope: 'Post-MVP', tools: [] },
      },
      risks,
      definitionOfDone: {
        developmentComplete: ['Code merged with zero lint errors'],
        testingCriteria: ['All validation passes'],
        securityChecks: ['Endpoints verify auth tokens'],
        deploymentReadiness: ['Clean production build'],
        documentation: ['API schema documented'],
        operationalReadiness: ['Error recovery operational'],
      },
      readiness: {
        score: validatedV1.projectReadiness.score,
        level: validatedV1.projectReadiness.readinessLevel || 'Ready for Development',
        gaps: validatedV1.projectReadiness.keyGaps || [],
      },
    },
    intelligence: {
      discussionIntelligence: {
        summary: discussionSummaryText,
        decisions: [],
        acceptedSuggestions,
        rejectedSuggestions: [],
        unresolvedQuestions,
        importantComments,
      },
      recommendations: [
        {
          id: 'REC-01',
          title: 'Maintain MVP Scope Discipline',
          description: (validatedV1.mvpScope.outOfScope || []).join(', ')
            ? `Keep items out-of-scope during initial sprint: ${validatedV1.mvpScope.outOfScope.join(', ')}.`
            : 'Focus strictly on Must-Have deliverables for sprint 1.',
          rationale: 'Prevents scope creep and ensures on-time release.',
          category: 'product',
          confidence: 'high',
          impact: 'high',
          status: 'proposed',
        },
      ],
      futureBacklog: (validatedV1.mvpScope.outOfScope || []).map((item, idx) => ({
        id: `BACK-${String(idx + 1).padStart(2, '0')}`,
        title: item,
        description: `Post-MVP feature: ${item}.`,
        reason: 'Deferred to post-MVP development.',
        priority: 'Medium',
        relatedFeatureIds: [],
      })),
    },
  };

  return validateBlueprint2Output(v2Payload, title, problem);
}

/**
 * Extracts legacy 16-section structure from a Canonical Blueprint 2.0 object for backward-compatible consumers.
 */
export function mapV2BlueprintToLegacy(v2Content) {
  const v2 = validateBlueprint2Output(v2Content);

  return {
    projectOverview: {
      summary: v2.projectUnderstanding.summary,
      vision: v2.projectUnderstanding.vision,
      targetAudience: v2.projectUnderstanding.targetAudience,
    },
    mvpScope: v2.projectUnderstanding.mvpScope,
    recommendedTechStack: v2.architecture.technologyStack,
    coreFeatures: (v2.execution.features || []).map((f) => ({
      featureName: f.name,
      description: f.description,
      priority: f.priority,
    })),
    userFlow: (v2.execution.workflow || []).map((wf) => ({
      stepNumber: wf.stepNumber,
      stepName: wf.stepName,
      description: wf.description,
    })),
    technicalArchitecture: {
      architecturePattern: v2.architecture.architecturePattern,
      components: v2.architecture.components,
      dataFlowDescription: v2.architecture.dataFlowDescription,
    },
    databaseDesign: v2.architecture.dataArchitecture,
    teamAllocation: (v2.execution.roles || []).map((r) => {
      const assignedTasks = (v2.execution.tasks || [])
        .filter((t) => t.recommendedRoleId === r.id || t.assignedUserId === r.recommendedUserId)
        .map((t) => t.title);

      return {
        memberId: r.recommendedUserId || undefined,
        memberName: r.recommendedUserName || r.roleName,
        assignedRole: r.roleName,
        recommendedTasks: assignedTasks.length > 0 ? assignedTasks : ['General development & review.'],
      };
    }),
    challengesAndDifficulties: (v2.quality.risks || []).map((r) => ({
      challenge: r.title,
      severity: r.severity,
      mitigationStrategy: r.mitigation,
    })),
    innovationAndDifferentiation: {
      keyDifferentiators: [v2.projectUnderstanding.valueProposition],
      marketAdvantage: v2.projectUnderstanding.valueProposition,
    },
    developmentRoadmap: (v2.execution.timeline.milestones || []).map((m) => ({
      phase: m.name,
      duration: m.duration,
      deliverables: m.deliverables,
    })),
    suggestionsAnalysis: (v2.intelligence.discussionIntelligence.acceptedSuggestions || []).map((s) => ({
      id: s.id,
      content: s.content,
      relevance: s.relevance,
      reason: 'Accepted suggestion integrated into blueprint requirements.',
      impact: s.impact,
      recommendation: s.recommendation,
    })),
    commentsAnalysis: (v2.intelligence.discussionIntelligence.importantComments || []).map((c) => ({
      id: c.id,
      content: c.content,
      relevance: c.relevance,
      reason: 'Key discussion insight.',
      insight: c.insight,
      recommendation: 'Maintain alignment during implementation.',
    })),
    questionsAnalysis: (v2.intelligence.discussionIntelligence.unresolvedQuestions || []).map((q) => ({
      id: q.id,
      content: q.question,
      relevance: q.severity === 'high' ? 'high' : 'medium',
      reason: 'Unresolved technical inquiry.',
      area: q.area,
      recommendation: q.suggestedResolution,
    })),
    communityInsightsSummary: {
      summary: v2.intelligence.discussionIntelligence.summary,
      keyTakeaways: (v2.intelligence.recommendations || []).map((r) => r.title),
    },
    projectReadiness: {
      score: v2.quality.readiness.score,
      readinessLevel: v2.quality.readiness.level,
      reasons: (v2.intelligence.recommendations || []).map((r) => r.description),
      keyGaps: v2.quality.readiness.gaps,
    },
  };
}

// ============================================================================
// MAIN VALIDATION ENTRY POINTS (Unified & Backwards Compatible)
// ============================================================================

/**
 * Main validator entry point.
 * Automatically inspects the payload's schema version and applies the appropriate validator,
 * guaranteeing backward compatibility for Schema V1 while enabling Schema V2.
 */
export function validateBlueprintOutput(jsonObj, fallbackTitle = 'Project', fallbackProblem = '') {
  if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) {
    return validateLegacyBlueprintOutput({});
  }

  const version = detectSchemaVersion(jsonObj);
  if (version === SCHEMA_VERSIONS.CANONICAL_V2) {
    return validateBlueprint2Output(jsonObj, fallbackTitle, fallbackProblem);
  }

  return validateLegacyBlueprintOutput(jsonObj);
}

/**
 * Parse raw text and validate against Blueprint schema contract (Auto-detecting V1 vs V2).
 */
export function parseAndValidateBlueprint(rawText, fallbackTitle = 'Project', fallbackProblem = '') {
  const parsed = safeParseJson(rawText);
  return validateBlueprintOutput(parsed, fallbackTitle, fallbackProblem);
}

/**
 * Validate Community Intelligence output JSON for Phase 4.
 */
export function validateCommunityIntelligenceOutput(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) {
    jsonObj = {};
  }

  const normalizeList = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      const relNorm = String(item.relevance || 'medium').toLowerCase();
      const impNorm = String(item.impact || 'medium').toLowerCase();
      return {
        id: item.id || `item_${Math.random().toString(36).slice(2, 7)}`,
        content: item.content || item.originalContent || '',
        relevance: VALID_RELEVANCE_LEVELS.has(relNorm) ? relNorm : 'medium',
        area: item.area || 'general',
        reason: item.reason || 'Analyzed feedback.',
        impact: VALID_IMPACT_LEVELS.has(impNorm) ? impNorm : 'medium',
        recommendation: item.recommendation || 'No recommendation.',
        insight: item.insight || item.concern || undefined,
      };
    });
  };

  const suggestionsAnalysis = normalizeList(jsonObj.suggestionsAnalysis);
  const commentsAnalysis = normalizeList(jsonObj.commentsAnalysis);
  const questionsAnalysis = normalizeList(jsonObj.questionsAnalysis);

  const stats = jsonObj.communityInsights?.statistics || {
    suggestionsAnalyzed: suggestionsAnalysis.length,
    suggestionsRelevant: suggestionsAnalysis.filter((s) => s.relevance === 'high' || s.relevance === 'medium').length,
    commentsAnalyzed: commentsAnalysis.length,
    commentsRelevant: commentsAnalysis.filter((c) => c.relevance === 'high' || c.relevance === 'medium').length,
    questionsAnalyzed: questionsAnalysis.length,
    questionsRelevant: questionsAnalysis.filter((q) => q.relevance === 'high' || q.relevance === 'medium').length,
  };

  const keyInsights = Array.isArray(jsonObj.communityInsights?.keyInsights)
    ? jsonObj.communityInsights.keyInsights.map((k) => ({
        insight: typeof k === 'string' ? k : k.insight || '',
        category: typeof k === 'object' && k.category ? k.category : 'architecture',
        impact: typeof k === 'object' && VALID_IMPACT_LEVELS.has(String(k.impact).toLowerCase()) ? String(k.impact).toLowerCase() : 'medium',
      }))
    : [];

  return {
    suggestionsAnalysis,
    commentsAnalysis,
    questionsAnalysis,
    communityInsightsSummary: jsonObj.communityInsightsSummary || jsonObj.communityInsights?.summary || 'Community discussion analysis complete.',
    communityInsights: {
      statistics: stats,
      keyInsights,
    },
  };
}

/**
 * Parse raw text and validate against Community Intelligence schema contract.
 */
export function parseAndValidateCommunityIntelligence(rawText) {
  const parsed = safeParseJson(rawText);
  return validateCommunityIntelligenceOutput(parsed);
}
