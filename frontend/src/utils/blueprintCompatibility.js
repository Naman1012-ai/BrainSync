/**
 * Convia Blueprint Compatibility & Normalization Layer (Frontend)
 * Guarantees seamless rendering across Schema Version 1 (Legacy 16-section)
 * and Schema Version 2 (Canonical Blueprint 2.0).
 */

import { SCHEMA_VERSIONS } from '../types/blueprint2Contracts';
import {
  deriveExecutionWaves,
  calculateCriticalPath,
  deriveTopologicalOrder,
  deriveBlockedTasks,
} from './executionEngine';

/**
 * Detects whether a blueprint content object is Schema V2 or Schema V1.
 */
export function isBlueprintV2(content) {
  if (!content || typeof content !== 'object') return false;
  if (content.schemaVersion === 2 || content.schemaVersion === '2') return true;
  const v2Keys = ['projectUnderstanding', 'requirements', 'architecture', 'execution', 'quality', 'intelligence'];
  const matches = v2Keys.filter((k) => k in content);
  return matches.length >= 3;
}

/**
 * Normalizes any blueprint document or content object into a standard representation
 * that current UI components and PDF generators can consume without errors.
 */
export function normalizeBlueprintForDisplay(blueprintDoc) {
  if (!blueprintDoc) return null;

  const rawContent = blueprintDoc.content || (blueprintDoc.projectOverview ? blueprintDoc : null);
  if (!rawContent) return blueprintDoc;

  const isV2 = isBlueprintV2(rawContent);

  if (isV2) {
    const v2 = rawContent;
    const legacyProjectOverview = {
      summary: v2.projectUnderstanding?.summary || '',
      vision: v2.projectUnderstanding?.vision || '',
      targetAudience: v2.projectUnderstanding?.targetAudience || '',
    };

    const legacyMvpScope = v2.projectUnderstanding?.mvpScope || {
      inScope: [],
      outOfScope: [],
      successCriteria: [],
    };

    const legacyTechStack = v2.architecture?.technologyStack || {
      frontend: [],
      backend: [],
      database: [],
      hosting: [],
      thirdPartyApis: [],
      evaluationReason: '',
    };

    const legacyCoreFeatures = (v2.execution?.features || []).map((f) => ({
      featureName: f.name || 'Feature',
      description: f.description || '',
      priority: f.priority || 'Must Have',
    }));

    const legacyUserFlow = (v2.execution?.workflow || []).map((wf) => ({
      stepNumber: wf.stepNumber || 1,
      stepName: wf.stepName || 'Step',
      description: wf.description || '',
    }));

    const legacyTechArch = {
      architecturePattern: v2.architecture?.architecturePattern || 'Modular Architecture',
      components: v2.architecture?.components || [],
      dataFlowDescription: v2.architecture?.dataFlowDescription || '',
    };

    const legacyDbDesign = {
      primaryDatabase: v2.architecture?.dataArchitecture?.primaryDatabase || 'Firebase Realtime Database',
      entities: (v2.architecture?.dataArchitecture?.entities || []).map((ent) => ({
        entityName: ent.entityName || 'Entity',
        entityType: ent.entityType || (ent.isOptional ? 'Optional Entity' : 'Necessary Entity'),
        isOptional: Boolean(ent.isOptional),
        fields: Array.isArray(ent.fields) ? ent.fields : [],
        optionalFields: Array.isArray(ent.optionalFields) ? ent.optionalFields : [],
      })),
    };

    const legacyTeamAllocation = (v2.execution?.roles || []).map((r) => {
      const assignedTasks = (v2.execution?.tasks || [])
        .filter((t) => t.recommendedRoleId === r.id || t.assignedUserId === r.recommendedUserId)
        .map((t) => t.title);

      return {
        memberId: r.recommendedUserId || undefined,
        memberName: r.recommendedUserName || r.roleName,
        assignedRole: r.roleName,
        recommendedTasks: assignedTasks.length > 0 ? assignedTasks : ['General development & review.'],
      };
    });

    const legacyChallenges = (v2.quality?.risks || []).map((r) => ({
      challenge: r.title || 'Challenge',
      severity: r.severity || 'Medium',
      mitigationStrategy: r.mitigation || '',
    }));

    const legacyRoadmap = (v2.execution?.timeline?.milestones || []).map((m) => ({
      phase: m.name || 'Milestone',
      duration: m.duration || 'Sprint',
      deliverables: m.deliverables || [],
    }));

    const legacySuggestions = (v2.intelligence?.discussionIntelligence?.acceptedSuggestions || []).map((s) => ({
      id: s.id,
      content: s.content,
      relevance: s.relevance || 'medium',
      reason: 'Accepted suggestion integrated into blueprint requirements.',
      impact: s.impact || 'medium',
      recommendation: s.recommendation || '',
    }));

    const legacyComments = (v2.intelligence?.discussionIntelligence?.importantComments || []).map((c) => ({
      id: c.id,
      content: c.content,
      relevance: c.relevance || 'medium',
      reason: 'Key discussion insight.',
      insight: c.insight || '',
      recommendation: 'Maintain alignment during implementation.',
    }));

    const legacyQuestions = (v2.intelligence?.discussionIntelligence?.unresolvedQuestions || []).map((q) => ({
      id: q.id,
      content: q.question,
      relevance: q.severity === 'high' ? 'high' : 'medium',
      reason: 'Unresolved technical inquiry.',
      area: q.area || 'architecture',
      recommendation: q.suggestedResolution || '',
    }));

    const legacyNormalizedContent = {
      projectOverview: legacyProjectOverview,
      mvpScope: legacyMvpScope,
      recommendedTechStack: legacyTechStack,
      coreFeatures: legacyCoreFeatures,
      userFlow: legacyUserFlow,
      technicalArchitecture: legacyTechArch,
      databaseDesign: legacyDbDesign,
      teamAllocation: legacyTeamAllocation,
      challengesAndDifficulties: legacyChallenges,
      innovationAndDifferentiation: {
        keyDifferentiators: [v2.projectUnderstanding?.valueProposition || 'AI-Assisted Technical Architecture'],
        marketAdvantage: v2.projectUnderstanding?.valueProposition || '',
      },
      developmentRoadmap: legacyRoadmap,
      suggestionsAnalysis: legacySuggestions,
      commentsAnalysis: legacyComments,
      questionsAnalysis: legacyQuestions,
      communityInsightsSummary: {
        summary: v2.intelligence?.discussionIntelligence?.summary || 'Community feedback analysis complete.',
        keyTakeaways: (v2.intelligence?.recommendations || []).map((r) => r.title),
      },
      projectReadiness: {
        score: v2.quality?.readiness?.score || 85,
        readinessLevel: v2.quality?.readiness?.level || 'Ready for Development',
        keyGaps: v2.quality?.readiness?.gaps || [],
      },
      // Keep reference to rich V2 data
      __v2Content: v2,
      __isV2: true,
      __schemaVersion: SCHEMA_VERSIONS.CANONICAL_V2,
      derivedExecution: {
        executionWaves: deriveExecutionWaves(v2.execution?.tasks || [], v2.execution?.dependencies || []),
        criticalPath: calculateCriticalPath(v2.execution?.tasks || [], v2.execution?.dependencies || []),
        topologicalOrder: deriveTopologicalOrder(v2.execution?.tasks || [], v2.execution?.dependencies || []).executionOrder,
        blockedTasks: deriveBlockedTasks(v2.execution?.tasks || [], v2.execution?.dependencies || []),
      },
    };

    return {
      ...blueprintDoc,
      schemaVersion: SCHEMA_VERSIONS.CANONICAL_V2,
      content: legacyNormalizedContent,
      rawV2Content: v2,
      derivedExecution: legacyNormalizedContent.derivedExecution,
    };
  }

  // If already Schema V1, return with schemaVersion metadata
  return {
    ...blueprintDoc,
    schemaVersion: blueprintDoc.schemaVersion || SCHEMA_VERSIONS.LEGACY_V1,
    content: rawContent,
  };
}
