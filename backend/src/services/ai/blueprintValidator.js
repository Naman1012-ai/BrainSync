/**
 * Server-Side AI Blueprint & Community Intelligence JSON Validator
 * Validates raw Gemini AI output against Blueprint and Community Intelligence contracts.
 * Auto-heals and normalizes missing or partially formatted fields.
 */

const REQUIRED_SECTIONS = [
  'projectOverview',
  'mvpScope',
  'recommendedTechStack',
  'coreFeatures',
  'userFlow',
  'technicalArchitecture',
  'databaseDesign',
  'teamAllocation',
  'challengesAndDifficulties',
  'innovationAndDifferentiation',
  'developmentRoadmap',
  'suggestionsAnalysis',
  'commentsAnalysis',
  'questionsAnalysis',
  'communityInsightsSummary',
  'projectReadiness',
];

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
 * Validate & auto-heal parsed JSON object against the Blueprint output contract.
 */
export function validateBlueprintOutput(jsonObj) {
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
 * Parse raw text and validate against Blueprint schema contract.
 */
export function parseAndValidateBlueprint(rawText) {
  const parsed = safeParseJson(rawText);
  return validateBlueprintOutput(parsed);
}

/**
 * Parse raw text and validate against Community Intelligence schema contract.
 */
export function parseAndValidateCommunityIntelligence(rawText) {
  const parsed = safeParseJson(rawText);
  return validateCommunityIntelligenceOutput(parsed);
}
