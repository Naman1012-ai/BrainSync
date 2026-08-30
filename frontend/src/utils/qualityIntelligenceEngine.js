/**
 * Convia Blueprint 2.0 — Quality, Delivery & Project Readiness Intelligence Engine (Phase 6 Client-Side Mirror)
 * 
 * Provides deterministic calculations and validations for:
 * 1. Risk Modeling, Prioritization Matrix (Likelihood x Impact), and Cross-Entity Traceability
 * 2. Testing Strategy, Requirement/Feature Coverage Analysis, and Verification Gaps
 * 3. Quality Gate Evaluation with Evidence Verification (Preventing AI False Claims)
 * 4. Objective Production & Deployment Readiness Derivation (Blockers, Warnings, Unknowns)
 * 5. Environment & Operational Hardening Verification
 */

export const QUALITY_GATE_STATUSES = [
  'not_started',
  'in_progress',
  'blocked',
  'passed',
  'failed',
  'waived',
];

export const READINESS_STATUSES = [
  'not_ready',
  'partially_ready',
  'ready_for_review',
  'ready_for_deployment',
  'production_ready',
];

export const READINESS_LEVELS = [
  'Not Ready',
  'Needs Refinement',
  'Ready for Development',
  'Ready for Review',
  'Ready for Deployment',
  'Production Ready',
];

export const RISK_CATEGORIES = [
  'technical',
  'security',
  'architecture',
  'dependency',
  'integration',
  'data',
  'performance',
  'scalability',
  'reliability',
  'team',
  'execution',
  'timeline',
  'product',
  'deployment',
  'operational',
  'compliance',
];

export const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Deterministic severity derivation matrix based on Likelihood x Impact.
 */
export function deriveRiskSeverity(likelihood, impact) {
  const normLikelihood = String(likelihood || '').toLowerCase();
  const normImpact = String(impact || '').toLowerCase();

  if (normImpact === 'critical') {
    return normLikelihood === 'low' ? 'High' : 'Critical';
  }
  if (normImpact === 'high') {
    if (normLikelihood === 'high') return 'Critical';
    if (normLikelihood === 'medium') return 'High';
    return 'Medium';
  }
  if (normImpact === 'medium') {
    if (normLikelihood === 'high') return 'High';
    if (normLikelihood === 'medium') return 'Medium';
    return 'Low';
  }
  return 'Low';
}

/**
 * Validates and sanitizes risks, ensuring cross-entity traceability and mitigation presence.
 */
export function validateAndSynthesizeRisks(rawRisks = [], context = {}) {
  const validFeatureIds = new Set((context.features || []).map((f) => f.id));
  const validTaskIds = new Set((context.tasks || []).map((t) => t.id));
  const validReqIds = new Set((context.requirements || []).map((r) => r.id));

  const cleanRisks = [];
  const errors = [];
  const warnings = [];
  const seenRiskIds = new Set();

  (Array.isArray(rawRisks) ? rawRisks : []).forEach((risk, idx) => {
    if (!risk || typeof risk !== 'object') return;

    let id = risk.id || `RISK-${String(idx + 1).padStart(2, '0')}`;
    if (seenRiskIds.has(id)) {
      errors.push(`Duplicate risk ID '${id}' detected.`);
      id = `RISK-${String(idx + 1).padStart(2, '0')}_${Math.random().toString(36).slice(2, 5)}`;
    }
    seenRiskIds.add(id);

    const title = risk.title ? String(risk.title).trim() : `Project Risk ${idx + 1}`;
    const description = risk.description ? String(risk.description).trim() : 'Unspecified project risk.';
    const category = RISK_CATEGORIES.includes(risk.category) ? risk.category : 'technical';

    const rawLikelihood = ['High', 'Medium', 'Low'].includes(risk.likelihood) ? risk.likelihood : 'Medium';
    const rawImpact = SEVERITY_LEVELS.includes(risk.impact) ? risk.impact : 'Medium';
    const derivedSev = deriveRiskSeverity(rawLikelihood, rawImpact);
    const severity = SEVERITY_LEVELS.includes(risk.severity) ? risk.severity : derivedSev;

    const mitigation = risk.mitigation ? String(risk.mitigation).trim() : '';
    const contingency = risk.contingency ? String(risk.contingency).trim() : '';

    if ((severity === 'Critical' || severity === 'High') && !mitigation) {
      warnings.push(`High/Critical risk '${id}' is missing a required mitigation strategy.`);
    }

    const affectedFeatureIds = (Array.isArray(risk.affectedFeatureIds) ? risk.affectedFeatureIds : []).filter((fId) => {
      if (validFeatureIds.size > 0 && !validFeatureIds.has(fId)) {
        warnings.push(`Risk '${id}' references non-existent feature '${fId}'.`);
        return false;
      }
      return true;
    });

    const affectedTaskIds = (Array.isArray(risk.affectedTaskIds || risk.relatedTaskIds) ? (risk.affectedTaskIds || risk.relatedTaskIds) : []).filter((tId) => {
      if (validTaskIds.size > 0 && !validTaskIds.has(tId)) {
        warnings.push(`Risk '${id}' references non-existent task '${tId}'.`);
        return false;
      }
      return true;
    });

    const affectedRequirementIds = (Array.isArray(risk.affectedRequirementIds) ? risk.affectedRequirementIds : []).filter((rId) => {
      if (validReqIds.size > 0 && !validReqIds.has(rId)) {
        warnings.push(`Risk '${id}' references non-existent requirement '${rId}'.`);
        return false;
      }
      return true;
    });

    cleanRisks.push({
      id,
      title,
      description,
      category,
      likelihood: rawLikelihood,
      impact: rawImpact,
      severity,
      mitigation: mitigation || 'Continuous monitoring and architectural review.',
      contingency: contingency || 'Fallback to standard recovery procedure.',
      affectedFeatureIds,
      affectedTaskIds,
      affectedRequirementIds,
      ownerRoleId: risk.ownerRoleId || null,
      ownerUserId: risk.ownerUserId || null,
      status: ['identified', 'mitigated', 'accepted', 'closed'].includes(risk.status) ? risk.status : 'identified',
      source: risk.source || 'ai_proposed',
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    cleanRisks,
    criticalRisksCount: cleanRisks.filter((r) => r.severity === 'Critical').length,
    highRisksCount: cleanRisks.filter((r) => r.severity === 'High').length,
    unmitigatedHighRisksCount: cleanRisks.filter((r) => (r.severity === 'Critical' || r.severity === 'High') && (!r.mitigation || r.status === 'identified')).length,
  };
}

/**
 * Calculates requirement and feature testing coverage.
 */
export function calculateTestingCoverage(testCases = [], requirements = [], features = [], tasks = []) {
  const reqCoverageMap = new Map();
  const featCoverageMap = new Map();

  requirements.forEach((req) => {
    reqCoverageMap.set(req.id, {
      requirementId: req.id,
      title: req.title,
      priority: req.priority,
      testCaseIds: [],
      isCovered: false,
    });
  });

  features.forEach((feat) => {
    featCoverageMap.set(feat.id, {
      featureId: feat.id,
      name: feat.name,
      priority: feat.priority,
      testCaseIds: [],
      isCovered: false,
    });
  });

  const validTestCases = [];

  (Array.isArray(testCases) ? testCases : []).forEach((tc, idx) => {
    if (!tc || typeof tc !== 'object') return;
    const id = tc.id || `TC-${String(idx + 1).padStart(2, '0')}`;

    const relReqs = Array.isArray(tc.relatedRequirementIds) ? tc.relatedRequirementIds : [];
    const relFeats = Array.isArray(tc.relatedFeatureIds) ? tc.relatedFeatureIds : [];
    const relTasks = Array.isArray(tc.relatedTaskIds) ? tc.relatedTaskIds : [];

    relReqs.forEach((rId) => {
      if (reqCoverageMap.has(rId)) {
        reqCoverageMap.get(rId).testCaseIds.push(id);
        reqCoverageMap.get(rId).isCovered = true;
      }
    });

    relFeats.forEach((fId) => {
      if (featCoverageMap.has(fId)) {
        featCoverageMap.get(fId).testCaseIds.push(id);
        featCoverageMap.get(fId).isCovered = true;
      }
    });

    validTestCases.push({
      id,
      title: tc.title ? String(tc.title).trim() : `Test Case ${idx + 1}`,
      category: tc.category || 'integration',
      description: tc.description ? String(tc.description).trim() : 'Test verification scenario.',
      relatedRequirementIds: relReqs,
      relatedFeatureIds: relFeats,
      relatedTaskIds: relTasks,
      targetVerification: tc.targetVerification || 'Expected response matches contract assertion.',
      status: ['planned', 'verified', 'unverified'].includes(tc.status) ? tc.status : 'planned',
    });
  });

  const totalReqs = reqCoverageMap.size;
  const coveredReqs = Array.from(reqCoverageMap.values()).filter((r) => r.isCovered).length;
  const uncoveredCriticalReqs = Array.from(reqCoverageMap.values())
    .filter((r) => !r.isCovered && (r.priority === 'Must Have' || r.priority === 'Critical'))
    .map((r) => r.title);

  const totalFeats = featCoverageMap.size;
  const coveredFeats = Array.from(featCoverageMap.values()).filter((f) => f.isCovered).length;
  const uncoveredCriticalFeats = Array.from(featCoverageMap.values())
    .filter((f) => !f.isCovered && (f.priority === 'Must Have' || f.priority === 'High'))
    .map((f) => f.name);

  return {
    testCases: validTestCases,
    totalRequirementsCount: totalReqs,
    coveredRequirementsCount: coveredReqs,
    requirementCoveragePercentage: totalReqs > 0 ? Math.round((coveredReqs / totalReqs) * 100) : 100,
    totalFeaturesCount: totalFeats,
    coveredFeaturesCount: coveredFeats,
    featureCoveragePercentage: totalFeats > 0 ? Math.round((coveredFeats / totalFeats) * 100) : 100,
    uncoveredCriticalRequirements: uncoveredCriticalReqs,
    uncoveredCriticalFeatures: uncoveredCriticalFeats,
  };
}

/**
 * Standard 8 Quality Gates Specification
 */
export function getDefaultQualityGates() {
  return [
    {
      id: 'GATE-01',
      name: 'Requirements & Scope Alignment',
      stage: 1,
      description: 'Functional requirements, constraints, and MVP boundaries are defined and unambiguous.',
      status: 'passed',
      requiredEvidence: ['Project vision and problem statement validated', 'MVP scope boundaries defined'],
      actualEvidence: ['Canonical requirements and scope verified in Blueprint contract.'],
      blockers: [],
      warnings: [],
      isAutomated: true,
      verifiedAt: Date.now(),
      verifiedBy: 'system',
    },
    {
      id: 'GATE-02',
      name: 'Technical Architecture & DB Validation',
      stage: 2,
      description: 'Target database, entity relationships, and architectural decision records are validated.',
      status: 'passed',
      requiredEvidence: ['Primary database selected', 'Entity schemas defined', 'Architecture decisions recorded'],
      actualEvidence: ['Architecture pattern and database entity schema confirmed.'],
      blockers: [],
      warnings: [],
      isAutomated: true,
      verifiedAt: Date.now(),
      verifiedBy: 'system',
    },
    {
      id: 'GATE-03',
      name: 'Execution Plan & Critical Path Alignment',
      stage: 3,
      description: 'Tasks, dependencies, cycle-free DAG, and critical path timeline are formulated.',
      status: 'in_progress',
      requiredEvidence: ['Cycle-free dependency graph', 'Critical path tasks identified', 'Effort hours estimated'],
      actualEvidence: ['Topological execution waves and critical path derived.'],
      blockers: [],
      warnings: [],
      isAutomated: true,
      verifiedAt: Date.now(),
      verifiedBy: 'system',
    },
    {
      id: 'GATE-04',
      name: 'Team Capability & Workload Balance',
      stage: 4,
      description: 'Required skills are matched against verified member profiles with no extreme workload bottlenecks.',
      status: 'in_progress',
      requiredEvidence: ['Required skills identified', 'Task assignment recommendations calculated'],
      actualEvidence: ['Team capability matching and workload allocation analyzed.'],
      blockers: [],
      warnings: [],
      isAutomated: true,
      verifiedAt: Date.now(),
      verifiedBy: 'system',
    },
    {
      id: 'GATE-05',
      name: 'Acceptance Criteria Verification',
      stage: 5,
      description: 'Acceptance criteria defined for all critical features and verified before completion.',
      status: 'not_started',
      requiredEvidence: ['Acceptance criteria mapped to critical tasks', 'Criteria validation tests conducted'],
      actualEvidence: [],
      blockers: ['Acceptance criteria verification pending implementation.'],
      warnings: [],
      isAutomated: false,
      verifiedAt: null,
      verifiedBy: null,
    },
    {
      id: 'GATE-06',
      name: 'Automated & Manual Testing Verification',
      stage: 6,
      description: 'Unit, integration, and security test suites executed with passing assertions.',
      status: 'not_started',
      requiredEvidence: ['Automated test suite passing in CI/CD', 'Core user flow smoke tests verified'],
      actualEvidence: [],
      blockers: ['Automated integration tests pending development execution.'],
      warnings: [],
      isAutomated: true,
      verifiedAt: null,
      verifiedBy: null,
    },
    {
      id: 'GATE-07',
      name: 'Security Hardening Review',
      stage: 7,
      description: 'Authentication boundaries, workspace isolation, and input sanitization verified.',
      status: 'not_started',
      requiredEvidence: ['Token authentication validated on all endpoints', 'Database security rules verified'],
      actualEvidence: [],
      blockers: ['Security audit and token boundary inspection pending pre-deployment review.'],
      warnings: [],
      isAutomated: false,
      verifiedAt: null,
      verifiedBy: null,
    },
    {
      id: 'GATE-08',
      name: 'Production & Deployment Readiness',
      stage: 8,
      description: 'Production build clean, environment variables configured, and health checks responding.',
      status: 'not_started',
      requiredEvidence: ['Production build succeeds with zero errors', 'Environment variables set', 'Rollback plan established'],
      actualEvidence: [],
      blockers: ['Production deployment prerequisites pending build and host validation.'],
      warnings: [],
      isAutomated: false,
      verifiedAt: null,
      verifiedBy: null,
    },
  ];
}

/**
 * Evaluates Quality Gates against objective evidence.
 * PREVENTS AI from falsely claiming gates are passed when required evidence is absent.
 */
export function evaluateQualityGates(rawGates = [], projectContext = {}, liveEvidence = {}) {
  const defaultGates = getDefaultQualityGates();
  const gateMap = new Map();

  defaultGates.forEach((g) => gateMap.set(g.id, { ...g }));

  (Array.isArray(rawGates) ? rawGates : []).forEach((g) => {
    if (!g || !g.id) return;
    if (gateMap.has(g.id)) {
      const existing = gateMap.get(g.id);
      
      // Preserve user manual overrides (waived, passed if verified by human)
      if (g.status === 'waived' || (g.status === 'passed' && g.verifiedBy && g.verifiedBy !== 'ai')) {
        existing.status = g.status;
        existing.verifiedBy = g.verifiedBy;
        existing.verifiedAt = g.verifiedAt || Date.now();
      }
      
      if (Array.isArray(g.blockers)) existing.blockers = g.blockers;
      if (Array.isArray(g.warnings)) existing.warnings = g.warnings;
    }
  });

  const evaluatedGates = Array.from(gateMap.values()).map((gate) => {
    if (gate.id === 'GATE-01') {
      const hasReqs = (projectContext.requirements || []).length > 0;
      gate.status = hasReqs ? 'passed' : 'blocked';
      if (!hasReqs) gate.blockers = ['No functional requirements found in Blueprint.'];
    }

    if (gate.id === 'GATE-02') {
      const hasDb = Boolean(projectContext.architecture?.dataArchitecture?.primaryDatabase || projectContext.databaseDesign?.primaryDatabase);
      gate.status = hasDb ? 'passed' : 'blocked';
      if (!hasDb) gate.blockers = ['Primary database architecture is undefined.'];
    }

    if (gate.id === 'GATE-03') {
      const tasks = projectContext.execution?.tasks || projectContext.tasks || [];
      const hasTasks = tasks.length > 0;
      const allAssigned = tasks.length > 0 && tasks.every((t) => t.assignedUserId);
      gate.status = hasTasks ? (allAssigned ? 'passed' : 'in_progress') : 'blocked';
      if (!hasTasks) gate.blockers = ['No execution tasks generated in plan.'];
    }

    if (gate.id === 'GATE-04') {
      const teamSummary = projectContext.execution?.teamExecutionSummary || {};
      const coverage = teamSummary.teamCoveragePercentage !== undefined ? teamSummary.teamCoveragePercentage : 100;
      if (coverage < 50) {
        gate.status = 'blocked';
        gate.blockers = [`Team capability coverage is critically low (${coverage}%).`];
      } else {
        gate.status = coverage >= 80 ? 'passed' : 'in_progress';
      }
    }

    // Stages 5-8 strictly require live evidence. AI cannot mark them passed.
    if (['GATE-05', 'GATE-06', 'GATE-07', 'GATE-08'].includes(gate.id)) {
      if (gate.status === 'passed' && !liveEvidence[gate.id] && (!gate.verifiedBy || gate.verifiedBy === 'system' || gate.verifiedBy === 'ai')) {
        gate.status = 'not_started';
        gate.blockers = ['Verification pending live execution evidence.'];
      }
    }

    return gate;
  });

  const passedCount = evaluatedGates.filter((g) => g.status === 'passed' || g.status === 'waived').length;
  const blockedCount = evaluatedGates.filter((g) => g.status === 'blocked' || g.status === 'failed').length;

  return {
    qualityGates: evaluatedGates,
    totalGatesCount: evaluatedGates.length,
    passedGatesCount: passedCount,
    blockedGatesCount: blockedCount,
    allGatesPassed: passedCount === evaluatedGates.length,
  };
}

/**
 * Objective Production & Deployment Readiness Evaluator.
 * Synthesizes evidence across all 6 Blueprint dimensions.
 * Strictly avoids declaring "Production Ready" merely because generation succeeded.
 */
export function deriveProjectReadiness(projectContent = {}, liveEvidence = {}) {
  const reqs = projectContent.requirements || [];
  const tasks = projectContent.execution?.tasks || projectContent.tasks || [];
  const risks = projectContent.quality?.risks || projectContent.risks || [];
  const testCases = projectContent.quality?.testingStrategy?.testCases || [];
  const gates = projectContent.quality?.qualityGates || [];

  const blockers = [];
  const warnings = [];
  const passedChecks = [];
  const unknownChecks = [];

  // 1. Requirements Dimension
  let reqStatus = 'passed';
  if (reqs.length === 0) {
    reqStatus = 'blocked';
    blockers.push('Requirements dimension: No project requirements defined.');
  } else {
    passedChecks.push(`Requirements: ${reqs.length} functional/non-functional requirements defined.`);
  }

  // 2. Architecture Dimension
  let archStatus = 'passed';
  const dbEngine = projectContent.architecture?.dataArchitecture?.primaryDatabase || projectContent.databaseDesign?.primaryDatabase;
  if (!dbEngine) {
    archStatus = 'blocked';
    blockers.push('Architecture dimension: Primary database engine not selected.');
  } else {
    passedChecks.push(`Architecture: System design and ${dbEngine} database schema established.`);
  }

  // 3. Execution Dimension
  let execStatus = 'partial';
  const completedTasks = tasks.filter((t) => t.status === 'Completed' || t.status === 'completed');
  const unassignedCritical = tasks.filter((t) => t.isCriticalPath && !t.assignedUserId);

  if (tasks.length === 0) {
    execStatus = 'blocked';
    blockers.push('Execution dimension: No implementation tasks defined.');
  } else if (unassignedCritical.length > 0) {
    execStatus = 'partial';
    warnings.push(`Execution: ${unassignedCritical.length} critical-path tasks currently lack assigned owners.`);
  } else if (completedTasks.length === tasks.length && tasks.length > 0) {
    execStatus = 'passed';
    passedChecks.push(`Execution: All ${tasks.length} tasks completed.`);
  } else {
    execStatus = 'partial';
    warnings.push(`Execution in progress: ${completedTasks.length}/${tasks.length} tasks completed.`);
  }

  // 4. Testing Dimension
  let testStatus = 'partial';
  const criticalReqs = reqs.filter((r) => r.priority === 'Must Have' || r.priority === 'Critical');
  const coveredReqIds = new Set(testCases.flatMap((tc) => tc.relatedRequirementIds || []));
  const uncoveredCritical = criticalReqs.filter((r) => !coveredReqIds.has(r.id));

  if (testCases.length === 0) {
    testStatus = 'partial';
    warnings.push('Testing: Automated test cases not yet formulated.');
  } else if (uncoveredCritical.length > 0) {
    testStatus = 'partial';
    warnings.push(`Testing coverage: ${uncoveredCritical.length} critical requirements lack test case mapping.`);
  } else {
    testStatus = 'passed';
    passedChecks.push(`Testing: ${testCases.length} test cases mapped across requirements.`);
  }

  // 5. Risks Dimension
  const criticalUnmitigated = risks.filter((r) => (r.severity === 'Critical' || r.severity === 'High') && r.status === 'identified' && !r.mitigation);
  if (criticalUnmitigated.length > 0) {
    blockers.push(`Risks: ${criticalUnmitigated.length} High/Critical risks lack mitigation plans.`);
  }

  // 6. Security Dimension
  let secStatus = 'unknown';
  if (liveEvidence.securityReviewPassed) {
    secStatus = 'passed';
    passedChecks.push('Security: Authentication and authorization boundaries verified.');
  } else {
    secStatus = 'unknown';
    unknownChecks.push('Security hardening: Pre-deployment security audit not yet conducted.');
  }

  // 7. Deployment Dimension
  let depStatus = 'unknown';
  if (liveEvidence.productionBuildPassed && liveEvidence.envVarsConfigured) {
    depStatus = 'passed';
    passedChecks.push('Deployment: Production build and environment configuration verified.');
  } else {
    depStatus = 'unknown';
    unknownChecks.push('Deployment readiness: Production hosting and live health checks pending.');
  }

  // 8. Operations & Observability Dimension
  let opsStatus = 'unknown';
  unknownChecks.push('Operations: Production error monitoring and logging pipeline unverified.');

  // Calculate Deterministic Score (0 - 100)
  let score = 0;
  if (reqStatus === 'passed') score += 20;
  if (archStatus === 'passed') score += 20;
  if (execStatus === 'passed') score += 20; else if (execStatus === 'partial') score += 10;
  if (testStatus === 'passed') score += 15; else if (testStatus === 'partial') score += 5;
  if (criticalUnmitigated.length === 0) score += 10;
  if (secStatus === 'passed') score += 5;
  if (depStatus === 'passed') score += 5;
  if (opsStatus === 'passed') score += 5;

  score = Math.min(Math.max(score, 0), 100);

  // Derive Overall Readiness State
  let overallStatus = 'not_ready';
  let derivedLevel = 'Not Ready';

  if (blockers.length > 0 || score < 40) {
    overallStatus = 'not_ready';
    derivedLevel = 'Needs Refinement';
  } else if (execStatus !== 'passed' || tasks.length === 0) {
    overallStatus = 'partially_ready';
    derivedLevel = 'Ready for Development';
  } else if (score >= 90 && blockers.length === 0 && unknownChecks.length === 0) {
    overallStatus = 'production_ready';
    derivedLevel = 'Production Ready';
  } else if (secStatus === 'passed' && depStatus === 'passed') {
    overallStatus = 'ready_for_deployment';
    derivedLevel = 'Ready for Deployment';
  } else {
    overallStatus = 'ready_for_review';
    derivedLevel = 'Ready for Review';
  }

  const categorySummaries = {
    requirements: { status: reqStatus, summary: `${reqs.length} requirements defined.` },
    architecture: { status: archStatus, summary: `Database: ${dbEngine || 'None'}.` },
    execution: { status: execStatus, summary: `${completedTasks.length}/${tasks.length} tasks completed.` },
    testing: { status: testStatus, summary: `${testCases.length} test cases formulated.` },
    security: { status: secStatus, summary: secStatus === 'passed' ? 'Verified' : 'Pre-deployment audit pending.' },
    deployment: { status: depStatus, summary: depStatus === 'passed' ? 'Configured' : 'Live hosting pending.' },
    operations: { status: opsStatus, summary: 'Observability pending production setup.' },
  };

  return {
    overallStatus,
    readinessScore: score,
    derivedLevel,
    categorySummaries,
    blockers,
    warnings,
    passedChecks,
    unknownChecks,
  };
}
