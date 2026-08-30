/**
 * Convia Blueprint 2.0 — Frontend Discussion Intelligence & Decision Traceability Engine (Phase 7)
 * Mirror of backend discussionIntelligenceEngine for client-side reactive computation and offline inspection.
 */

export const DECISION_CATEGORIES = [
  'product',
  'scope',
  'requirement',
  'architecture',
  'technology',
  'database',
  'security',
  'ux',
  'workflow',
  'team',
  'timeline',
  'testing',
  'deployment',
  'operations',
  'hosting',
];

export const DECISION_STATUSES = [
  'proposed',
  'under_review',
  'approved',
  'rejected',
  'superseded',
  'reverted',
];

export const QUESTION_STATUSES = [
  'open',
  'answered',
  'resolved',
  'dismissed',
];

export const QUESTION_CATEGORIES = [
  'informational',
  'implementation',
  'requirement',
  'architecture',
  'decision_blocking',
  'execution_blocking',
];

export const SUGGESTION_STATUSES = [
  'proposed',
  'under_review',
  'accepted',
  'rejected',
  'superseded',
  'implemented',
];

export const CHANGE_RECOMMENDATION_STATUSES = [
  'proposed',
  'approved',
  'rejected',
  'applied',
  'stale',
];

export const CHANGE_TARGET_TYPES = [
  'requirement',
  'feature',
  'task',
  'dependency',
  'milestone',
  'risk',
  'test',
  'architecture',
];

export const CHANGE_TYPES = [
  'create',
  'modify',
  'remove',
  'clarify',
  'invalidate',
];

/**
 * Validates and synthesizes decisions.
 */
export function validateAndSynthesizeDecisions(rawDecisions = [], context = {}, existingDecisions = []) {
  const reqIdSet = new Set((context.requirements || []).map((r) => r.id));
  const featIdSet = new Set((context.features || []).map((f) => f.id));
  const taskIdSet = new Set((context.tasks || []).map((t) => t.id));
  const riskIdSet = new Set((context.risks || []).map((r) => r.id));
  const testIdSet = new Set((context.testCases || []).map((t) => t.id));

  const existingMap = new Map();
  const existingByTextMap = new Map();
  const cleanDecisions = [];
  const duplicateWarnings = [];
  const conflictWarnings = [];
  let scopeChangeDecisionsCount = 0;
  const seenIds = new Set();
  const seenDecisions = new Set();

  (existingDecisions || []).forEach((d) => {
    if (d && d.id) existingMap.set(d.id, d);
    if (d && d.decision) {
      const normText = d.decision.trim().toLowerCase();
      existingByTextMap.set(normText, d);
      seenDecisions.add(normText);
    }
  });

  const rawList = Array.isArray(rawDecisions) ? rawDecisions : [];

  rawList.forEach((item, idx) => {
    if (!item) return;

    let id = item.id ? String(item.id).trim().toUpperCase() : `DEC-0${idx + 1}`;
    if (!id.startsWith('DEC-')) id = `DEC-${id.replace(/^[^0-9]+/, '') || idx + 1}`;

    if (seenIds.has(id)) {
      id = `${id}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }
    seenIds.add(id);

    const decisionText = (item.decision || item.title || item.content || '').trim();
    if (!decisionText) return;

    const normText = decisionText.toLowerCase();

    if (seenDecisions.has(normText)) {
      duplicateWarnings.push(`Duplicate decision proposal ignored: "${decisionText.substring(0, 40)}..."`);
      return;
    }
    seenDecisions.add(normText);

    let category = (item.category || 'technology').toLowerCase();
    if (!DECISION_CATEGORIES.includes(category)) category = 'technology';

    let status = (item.status || 'proposed').toLowerCase();
    if (!DECISION_STATUSES.includes(status)) status = 'proposed';

    let approvedBy = item.approvedBy || null;
    let approvedByName = item.approvedByName || null;
    let approvedAt = item.approvedAt || null;

    const matchExisting = existingMap.get(id) || existingByTextMap.get(normText);
    if (matchExisting) {
      if (matchExisting.status === 'approved' || matchExisting.status === 'rejected' || matchExisting.status === 'superseded') {
        status = matchExisting.status;
        approvedBy = matchExisting.approvedBy || null;
        approvedByName = matchExisting.approvedByName || null;
        approvedAt = matchExisting.approvedAt || null;
      }
    }

    let confidence = (item.confidence || 'high').toLowerCase();
    if (!['high', 'medium', 'low'].includes(confidence)) confidence = 'medium';

    const affectedRequirementIds = (Array.isArray(item.affectedRequirementIds) ? item.affectedRequirementIds : [])
      .map((idStr) => String(idStr).trim().toUpperCase())
      .filter((rId) => reqIdSet.has(rId));

    const affectedFeatureIds = (Array.isArray(item.affectedFeatureIds) ? item.affectedFeatureIds : [])
      .map((idStr) => String(idStr).trim().toUpperCase())
      .filter((fId) => featIdSet.has(fId));

    const affectedTaskIds = (Array.isArray(item.affectedTaskIds) ? item.affectedTaskIds : [])
      .map((idStr) => String(idStr).trim().toUpperCase())
      .filter((tId) => taskIdSet.has(tId));

    const affectedRiskIds = (Array.isArray(item.affectedRiskIds) ? item.affectedRiskIds : [])
      .map((idStr) => String(idStr).trim().toUpperCase())
      .filter((rkId) => riskIdSet.has(rkId));

    const affectedTestIds = (Array.isArray(item.affectedTestIds) ? item.affectedTestIds : [])
      .map((idStr) => String(idStr).trim().toUpperCase())
      .filter((tcId) => testIdSet.has(tcId));

    const isScopeChange = Boolean(
      item.isScopeChange ||
      category === 'scope' ||
      /new feature|external payment|third-party integration|video generation|enterprise/i.test(decisionText)
    );

    let scopeChangeDescription = item.scopeChangeDescription || null;
    if (isScopeChange) {
      scopeChangeDecisionsCount++;
      if (!scopeChangeDescription) {
        scopeChangeDescription = `Introduces scope adjustment in ${category} domain requiring product approval.`;
      }
    }

    let conflictWith = null;
    existingDecisions.forEach((ex) => {
      if (ex.id !== id && ex.status === 'approved' && ex.category === category) {
        if (normText.includes('use ') && ex.decision.toLowerCase().includes('use ') && normText !== ex.decision.toLowerCase()) {
          conflictWith = {
            existingDecisionId: ex.id,
            existingDecision: ex.decision,
            reason: `Potential architectural divergence with approved decision ${ex.id}.`,
          };
          conflictWarnings.push(`Conflict: ${id} diverges from approved ${ex.id}.`);
        }
      }
    });

    cleanDecisions.push({
      id,
      title: (item.title || decisionText.substring(0, 60)).trim(),
      decision: decisionText,
      rationale: (item.rationale || 'Derived from technical discussion context.').trim(),
      category,
      status,
      confidence,
      sourceDiscussionIds: Array.isArray(item.sourceDiscussionIds) ? item.sourceDiscussionIds : item.sourceDiscussionId ? [item.sourceDiscussionId] : [],
      sourceSuggestionIds: Array.isArray(item.sourceSuggestionIds) ? item.sourceSuggestionIds : [],
      sourceQuestionIds: Array.isArray(item.sourceQuestionIds) ? item.sourceQuestionIds : [],
      affectedRequirementIds,
      affectedFeatureIds,
      affectedTaskIds,
      affectedRiskIds,
      affectedTestIds,
      supersedesDecisionId: item.supersedesDecisionId || null,
      supersededByDecisionId: item.supersededByDecisionId || null,
      isScopeChange,
      scopeChangeDescription,
      potentialConflict: conflictWith,
      createdBy: item.createdBy || 'system',
      createdByName: item.createdByName || item.authorName || 'AI Proposal Engine',
      approvedBy,
      approvedByName,
      approvedAt,
      createdAt: item.createdAt || Date.now(),
      updatedAt: item.updatedAt || Date.now(),
      source: item.source || (approvedBy ? 'user_defined' : 'ai_proposed'),

      // Backward Compatibility
      sourceDiscussionId: item.sourceDiscussionId || (item.sourceDiscussionIds?.[0] || null),
      authorName: item.authorName || item.createdByName || 'AI Proposal Engine',
      impactArea: item.impactArea || category,
      timestamp: item.timestamp || item.createdAt || Date.now(),
    });
  });

  existingDecisions.forEach((ex) => {
    if (ex && ex.status === 'approved' && !cleanDecisions.some((c) => c.id === ex.id)) {
      cleanDecisions.unshift(ex);
    }
  });

  return {
    cleanDecisions,
    duplicateWarnings,
    conflictWarnings,
    scopeChangeDecisionsCount,
  };
}

/**
 * Validates and synthesizes questions.
 */
export function validateAndSynthesizeQuestions(rawQuestions = [], context = {}, approvedDecisions = []) {
  const reqMap = new Map((context.requirements || []).map((r) => [r.id, r]));
  const criticalTaskIds = new Set(
    (context.tasks || []).filter((t) => t.isCriticalPath || t.priority === 'Critical').map((t) => t.id)
  );

  const cleanQuestions = [];
  let openCount = 0;
  let blockingCount = 0;
  const seenIds = new Set();

  const rawList = Array.isArray(rawQuestions) ? rawQuestions : [];

  rawList.forEach((item, idx) => {
    if (!item) return;

    let id = item.id ? String(item.id).trim().toUpperCase() : `Q-0${idx + 1}`;
    if (!id.startsWith('Q-')) id = `Q-${id.replace(/^[^0-9]+/, '') || idx + 1}`;

    if (seenIds.has(id)) {
      id = `${id}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }
    seenIds.add(id);

    const questionText = (item.question || item.content || item.message || '').trim();
    if (!questionText) return;

    let category = (item.category || 'informational').toLowerCase();
    if (!QUESTION_CATEGORIES.includes(category)) category = 'informational';

    let status = (item.status || 'open').toLowerCase();
    if (!QUESTION_STATUSES.includes(status)) status = 'open';

    const affectedRequirementIds = (Array.isArray(item.affectedRequirementIds) ? item.affectedRequirementIds : [])
      .map((rId) => String(rId).trim().toUpperCase())
      .filter((rId) => reqMap.has(rId));

    const affectedTaskIds = (Array.isArray(item.affectedTaskIds) ? item.affectedTaskIds : [])
      .map((tId) => String(tId).trim().toUpperCase())
      .filter((tId) => (context.tasks || []).some((t) => t.id === tId));

    const touchesCriticalTask = affectedTaskIds.some((tId) => criticalTaskIds.has(tId));
    const touchesCriticalReq = affectedRequirementIds.some((rId) => {
      const req = reqMap.get(rId);
      return req && (req.priority === 'Critical' || req.priority === 'Must Have');
    });
    const touchesArchitecture = category === 'architecture' || /database|auth provider|hosting|security/i.test(questionText);

    const isBlocking = Boolean(
      item.isBlocking ||
      category === 'decision_blocking' ||
      category === 'execution_blocking' ||
      touchesCriticalTask ||
      touchesCriticalReq ||
      touchesArchitecture
    );

    let resolvedByDecisionId = item.resolvedByDecisionId || null;
    if (!resolvedByDecisionId && status === 'open') {
      const matchingDecision = approvedDecisions.find((d) => {
        if (!d || d.status !== 'approved') return false;
        return (
          d.sourceQuestionIds?.includes(id) ||
          (d.category === category && d.decision.toLowerCase().includes(questionText.substring(0, 20).toLowerCase()))
        );
      });

      if (matchingDecision) {
        resolvedByDecisionId = matchingDecision.id;
        status = 'resolved';
      }
    }

    if (status === 'open') {
      openCount++;
      if (isBlocking) blockingCount++;
    }

    cleanQuestions.push({
      id,
      question: questionText,
      authorName: item.authorName || 'Collaborator',
      status,
      category,
      isBlocking,
      suggestedOwnerRoleId: item.suggestedOwnerRoleId || null,
      recommendedNextAction: item.recommendedNextAction || (isBlocking ? 'Address in team planning before next sprint wave.' : 'Clarify during sprint execution.'),
      sourceDiscussionId: item.sourceDiscussionId || null,
      resolvedByDecisionId,
      affectedRequirementIds,
      affectedFeatureIds: Array.isArray(item.affectedFeatureIds) ? item.affectedFeatureIds : [],
      affectedTaskIds,
      createdAt: item.createdAt || Date.now(),

      // Backward Compatibility
      area: item.area || category,
      severity: isBlocking ? 'high' : 'medium',
      suggestedResolution: item.suggestedResolution || item.recommendedNextAction || 'Team discussion required.',
    });
  });

  return {
    cleanQuestions,
    openCount,
    blockingCount,
  };
}

/**
 * Validates and synthesizes suggestions.
 */
export function validateAndSynthesizeSuggestions(rawSuggestions = [], context = {}) {
  const featIdSet = new Set((context.features || []).map((f) => f.id));

  const cleanAccepted = [];
  const cleanRejected = [];
  let scopeExpansionCount = 0;

  const rawList = Array.isArray(rawSuggestions) ? rawSuggestions : [];

  rawList.forEach((item, idx) => {
    if (!item) return;

    const id = item.id || `SUGG-0${idx + 1}`;
    const content = (item.content || item.suggestion || item.message || '').trim();
    if (!content) return;

    const authorName = item.authorName || 'Collaborator';
    let relevance = (item.relevance || 'medium').toLowerCase();
    if (!['high', 'medium', 'low'].includes(relevance)) relevance = 'medium';

    let status = (item.status || (item.isAccepted ? 'accepted' : 'proposed')).toLowerCase();
    if (!SUGGESTION_STATUSES.includes(status)) status = item.isAccepted ? 'accepted' : 'proposed';

    const isScopeExpansion = Boolean(
      item.isScopeExpansion ||
      /new module|add payment|ai video|mobile app|enterprise/i.test(content)
    );
    if (isScopeExpansion) scopeExpansionCount++;

    const cleanItem = {
      id,
      content,
      suggestion: content,
      authorName,
      status,
      isAccepted: status === 'accepted' || Boolean(item.isAccepted),
      relevance,
      reason: item.reason || (status === 'accepted' ? 'Accepted by project creator.' : 'Recorded in community feedback.'),
      impact: item.impact || 'Improves MVP user experience and functional completeness.',
      recommendation: item.recommendation || 'Proceed with execution plan integration.',
      implementedInFeatureId: item.implementedInFeatureId && featIdSet.has(item.implementedInFeatureId) ? item.implementedInFeatureId : null,
      linkedDecisionId: item.linkedDecisionId || null,
      isScopeExpansion,
      affectedProjectElements: Array.isArray(item.affectedProjectElements) ? item.affectedProjectElements : [],
      createdAt: item.createdAt || Date.now(),
    };

    if (cleanItem.isAccepted || status === 'accepted' || status === 'implemented') {
      cleanAccepted.push(cleanItem);
    } else if (status === 'rejected') {
      cleanRejected.push({
        id,
        content,
        suggestion: content,
        authorName,
        status: 'rejected',
        reason: item.reason || 'Rejected by project creator or deemed out of MVP scope.',
        affectedProjectElements: cleanItem.affectedProjectElements,
        createdAt: cleanItem.createdAt,
      });
    } else {
      cleanAccepted.push(cleanItem);
    }
  });

  return {
    cleanAccepted,
    cleanRejected,
    scopeExpansionCount,
  };
}

/**
 * Synthesizes change recommendations.
 */
export function synthesizeChangeRecommendations(rawRecommendations = [], decisions = [], context = {}, existingRecommendations = []) {
  const taskMap = new Map((context.tasks || []).map((t) => [t.id, t]));
  const decisionSet = new Set((decisions || []).map((d) => d.id));

  const existingMap = new Map();
  (existingRecommendations || []).forEach((cr) => {
    if (cr && cr.id) existingMap.set(cr.id, cr);
  });

  const cleanRecommendations = [];
  let pendingCount = 0;
  const seenIds = new Set();

  const rawList = Array.isArray(rawRecommendations) ? rawRecommendations : [];

  rawList.forEach((item, idx) => {
    if (!item) return;

    let id = item.id ? String(item.id).trim().toUpperCase() : `CR-0${idx + 1}`;
    if (!id.startsWith('CR-')) id = `CR-${id.replace(/^[^0-9]+/, '') || idx + 1}`;

    if (seenIds.has(id)) {
      id = `${id}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }
    seenIds.add(id);

    let targetType = (item.targetType || 'task').toLowerCase();
    if (!CHANGE_TARGET_TYPES.includes(targetType)) targetType = 'task';

    const targetId = (item.targetId || '').trim().toUpperCase();
    let changeType = (item.changeType || 'modify').toLowerCase();
    if (!CHANGE_TYPES.includes(changeType)) changeType = 'modify';

    let status = (item.status || 'proposed').toLowerCase();
    if (!CHANGE_RECOMMENDATION_STATUSES.includes(status)) status = 'proposed';

    let reviewedBy = item.reviewedBy || null;
    let reviewedByName = item.reviewedByName || null;
    let reviewedAt = item.reviewedAt || null;

    const existing = existingMap.get(id);
    if (existing && (existing.status === 'approved' || existing.status === 'rejected' || existing.status === 'applied')) {
      status = existing.status;
      reviewedBy = existing.reviewedBy || null;
      reviewedByName = existing.reviewedByName || null;
      reviewedAt = existing.reviewedAt || null;
    }

    let isStale = false;
    if (targetType === 'task' && targetId) {
      const task = taskMap.get(targetId);
      if (task && task.status === 'Completed') {
        isStale = true;
        if (status === 'proposed') status = 'stale';
      }
    }

    let impactSeverity = (item.impactSeverity || 'medium').toLowerCase();
    if (!['high', 'medium', 'low'].includes(impactSeverity)) impactSeverity = 'medium';

    if (status === 'proposed') pendingCount++;

    cleanRecommendations.push({
      id,
      sourceDecisionId: item.sourceDecisionId && decisionSet.has(item.sourceDecisionId) ? item.sourceDecisionId : (decisions[0]?.id || 'DEC-01'),
      targetType,
      targetId,
      changeType,
      currentStateSummary: item.currentStateSummary || 'Current baseline specification.',
      proposedChange: item.proposedChange || 'Update entity specification according to team decision.',
      reason: item.reason || 'Align implementation with confirmed project decisions.',
      impactSeverity,
      downstreamImpactSummary: item.downstreamImpactSummary || `Affects ${targetType} ${targetId} execution workflow.`,
      status,
      isStale,
      reviewedBy,
      reviewedByName,
      reviewedAt,
      createdAt: item.createdAt || Date.now(),
    });
  });

  return {
    cleanRecommendations,
    pendingCount,
  };
}

/**
 * Calculates downstream impact metric breakdown.
 */
export function calculateDecisionImpact(decision = {}, context = {}) {
  const reqs = (decision.affectedRequirementIds || []).filter((id) => (context.requirements || []).some((r) => r.id === id));
  const feats = (decision.affectedFeatureIds || []).filter((id) => (context.features || []).some((f) => f.id === id));
  const tasks = (decision.affectedTaskIds || []).filter((id) => (context.tasks || []).some((t) => t.id === id));
  const risks = (decision.affectedRiskIds || []).filter((id) => (context.risks || []).some((r) => r.id === id));
  const tests = (decision.affectedTestIds || []).filter((id) => (context.testCases || []).some((t) => t.id === id));

  return {
    affectedRequirementsCount: reqs.length,
    affectedFeaturesCount: feats.length,
    affectedTasksCount: tasks.length,
    affectedRisksCount: risks.length,
    affectedTestsCount: tests.length,
    impactSummary: `${reqs.length} requirements, ${feats.length} features, ${tasks.length} tasks, ${risks.length} risks, and ${tests.length} tests affected.`,
  };
}

/**
 * Frontend Discussion Intelligence orchestrator.
 */
export function synthesizeDiscussionIntelligence(
  rawIntelligence = {},
  projectContext = {},
  existingDecisions = [],
  existingChangeRecommendations = []
) {
  const context = {
    requirements: projectContext.requirements || [],
    features: projectContext.execution?.features || projectContext.features || [],
    tasks: projectContext.execution?.tasks || projectContext.tasks || [],
    risks: projectContext.quality?.risks || projectContext.risks || [],
    testCases: projectContext.quality?.testingStrategy?.testCases || projectContext.testCases || [],
  };

  const rawDecisions = rawIntelligence.decisions || [];
  const rawQuestions = rawIntelligence.unresolvedQuestions || rawIntelligence.questions || [];
  const rawAccepted = rawIntelligence.acceptedSuggestions || rawIntelligence.suggestions || [];
  const rawRejected = rawIntelligence.rejectedSuggestions || [];
  const rawRecommendations = rawIntelligence.changeRecommendations || [];

  const decisionResult = validateAndSynthesizeDecisions(rawDecisions, context, existingDecisions);
  const cleanDecisions = decisionResult.cleanDecisions;

  const questionResult = validateAndSynthesizeQuestions(rawQuestions, context, cleanDecisions);
  const cleanQuestions = questionResult.cleanQuestions;

  const suggestionResult = validateAndSynthesizeSuggestions([...rawAccepted, ...rawRejected], context);

  const recommendationResult = synthesizeChangeRecommendations(
    rawRecommendations,
    cleanDecisions,
    context,
    existingChangeRecommendations
  );

  const approvedDecisionsCount = cleanDecisions.filter((d) => d.status === 'approved').length;
  const stats = {
    totalDiscussions: rawIntelligence.statistics?.totalDiscussions || (cleanDecisions.length + cleanQuestions.length + suggestionResult.cleanAccepted.length),
    suggestionsCount: suggestionResult.cleanAccepted.length + suggestionResult.cleanRejected.length,
    questionsCount: cleanQuestions.length,
    commentsCount: Array.isArray(rawIntelligence.importantComments) ? rawIntelligence.importantComments.length : 0,
    decisionsCount: cleanDecisions.length,
    approvedDecisionsCount,
    openQuestionsCount: questionResult.openCount,
    blockingQuestionsCount: questionResult.blockingCount,
    pendingChangeRecommendationsCount: recommendationResult.pendingCount,
  };

  return {
    summary: (rawIntelligence.summary || 'Discussion intelligence and decision traceability synthesized.').trim(),
    keyThemes: Array.isArray(rawIntelligence.keyThemes) ? rawIntelligence.keyThemes : [],
    conflicts: Array.isArray(rawIntelligence.conflicts) ? rawIntelligence.conflicts : [],
    decisions: cleanDecisions,
    acceptedSuggestions: suggestionResult.cleanAccepted,
    rejectedSuggestions: suggestionResult.cleanRejected,
    unresolvedQuestions: cleanQuestions,
    importantComments: Array.isArray(rawIntelligence.importantComments) ? rawIntelligence.importantComments : [],
    changeRecommendations: recommendationResult.cleanRecommendations,
    statistics: stats,
    duplicateWarnings: decisionResult.duplicateWarnings,
    conflictWarnings: decisionResult.conflictWarnings,
    scopeChangeDecisionsCount: decisionResult.scopeChangeDecisionsCount,
  };
}
