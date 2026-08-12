/**
 * Server-Side AI Blueprint & Community Intelligence JSON Validator
 * Validates raw Gemini AI output against Blueprint and Community Intelligence contracts.
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
 */
export function safeParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI response is empty or non-string.');
  }

  let cleanText = rawText.trim();

  // Strip markdown code fences if Gemini returned markdown formatting
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('[blueprintValidator] JSON parse error:', err.message, 'Raw Snippet:', cleanText.slice(0, 200));
    throw new Error('AI response is not valid JSON.');
  }
}

/**
 * Validate parsed JSON object against the strict Blueprint output contract.
 */
export function validateBlueprintOutput(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) {
    throw new Error('Validated Blueprint output must be a non-null object.');
  }

  // Auto-populate default empty structures for community feedback sections if omitted (e.g. when idea has 0 comments)
  if (!jsonObj.suggestionsAnalysis) jsonObj.suggestionsAnalysis = [];
  if (!jsonObj.commentsAnalysis) jsonObj.commentsAnalysis = [];
  if (!jsonObj.questionsAnalysis) jsonObj.questionsAnalysis = [];
  if (!jsonObj.communityInsightsSummary) {
    jsonObj.communityInsightsSummary = {
      summary: 'No community feedback recorded yet for this idea proposal.',
      keyTakeaways: [],
    };
  }

  const missingSections = [];
  for (const section of REQUIRED_SECTIONS) {
    if (!(section in jsonObj) || jsonObj[section] === null || jsonObj[section] === undefined) {
      missingSections.push(section);
    }
  }

  if (missingSections.length > 0) {
    throw new Error(`AI Blueprint validation failed. Missing required sections: ${missingSections.join(', ')}`);
  }

  // Validate Project Overview
  if (!jsonObj.projectOverview.summary || !jsonObj.projectOverview.vision) {
    throw new Error('Invalid projectOverview section.');
  }

  // Validate MVP Scope
  if (!Array.isArray(jsonObj.mvpScope.inScope) || !Array.isArray(jsonObj.mvpScope.outOfScope)) {
    throw new Error('Invalid mvpScope section arrays.');
  }

  // Validate Recommended Tech Stack
  if (!Array.isArray(jsonObj.recommendedTechStack.frontend) || !Array.isArray(jsonObj.recommendedTechStack.backend)) {
    throw new Error('Invalid recommendedTechStack section.');
  }

  // Validate Core Features
  if (!Array.isArray(jsonObj.coreFeatures)) {
    throw new Error('coreFeatures must be an array.');
  }

  // Validate Community Analyses relevance enums
  const validateCommunityAnalysisList = (listName, list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (item && item.relevance) {
        const norm = String(item.relevance).toLowerCase();
        if (!VALID_RELEVANCE_LEVELS.has(norm)) {
          item.relevance = 'medium'; // Safe fallback for enum out-of-bounds
        } else {
          item.relevance = norm;
        }
      }
    }
  };

  validateCommunityAnalysisList('suggestionsAnalysis', jsonObj.suggestionsAnalysis);
  validateCommunityAnalysisList('commentsAnalysis', jsonObj.commentsAnalysis);
  validateCommunityAnalysisList('questionsAnalysis', jsonObj.questionsAnalysis);

  // Validate Project Readiness score range
  if (jsonObj.projectReadiness) {
    const score = Number(jsonObj.projectReadiness.score);
    if (isNaN(score)) {
      jsonObj.projectReadiness.score = 75;
    } else {
      jsonObj.projectReadiness.score = Math.max(0, Math.min(100, score));
    }
  }

  // Normalize Database Schema Entities (Necessary vs Optional)
  if (jsonObj.databaseDesign && Array.isArray(jsonObj.databaseDesign.entities)) {
    jsonObj.databaseDesign.entities = jsonObj.databaseDesign.entities.map((ent) => {
      const isOpt = Boolean(ent.isOptional || (ent.entityType && String(ent.entityType).toLowerCase().includes('optional')));
      return {
        entityName: ent.entityName || 'Entity',
        entityType: ent.entityType || (isOpt ? 'Optional Entity' : 'Necessary Entity'),
        isOptional: isOpt,
        fields: Array.isArray(ent.fields) ? ent.fields : [],
        optionalFields: Array.isArray(ent.optionalFields) ? ent.optionalFields : [],
      };
    });
  }

  return jsonObj;
}

/**
 * Validate Community Intelligence output JSON for Phase 4.
 */
export function validateCommunityIntelligenceOutput(jsonObj) {
  if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) {
    throw new Error('Community Intelligence output must be a non-null object.');
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
      keyInsights: keyInsights.slice(0, 5),
    },
  };
}

/**
 * Convenience method combining safe parsing and validation for Blueprint.
 */
export function parseAndValidateBlueprint(rawText) {
  const parsed = safeParseJson(rawText);
  return validateBlueprintOutput(parsed);
}

/**
 * Convenience method combining safe parsing and validation for Community Intelligence.
 */
export function parseAndValidateCommunityIntelligence(rawText) {
  const parsed = safeParseJson(rawText);
  return validateCommunityIntelligenceOutput(parsed);
}
