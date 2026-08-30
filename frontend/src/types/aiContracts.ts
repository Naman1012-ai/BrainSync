/**
 * Convia AI Blueprint — Data Contracts & Schemas
 * Re-exports canonical Blueprint 2.0 contracts while preserving legacy 1.x type compatibility.
 */

export * from './blueprint2Contracts';

// ============================================================================
// 1. AI INPUT CONTRACT (Payload sent to Gemini API)
// ============================================================================

export interface TeamMemberContext {
  id: string;
  name: string;
  role: string;
}

export interface CommunityItemContext {
  id: string;
  authorName: string;
  message: string;
  isAccepted?: boolean;
  createdAt?: number;
}

export interface AiBlueprintInputContract {
  // Required Core Context
  ideaTitle: string;
  problemStatement: string;
  description: string;
  teamMembers: TeamMemberContext[];

  // Conditional Context
  techStack?: string;

  // Supporting Community Context
  suggestions: CommunityItemContext[];
  comments: CommunityItemContext[];
  questions: CommunityItemContext[];

  // Regeneration Controls
  isRegeneration?: boolean;
  nextVersion?: string;
}

// ============================================================================
// 2. LEGACY AI OUTPUT CONTRACT (16-Section Schema V1)
// ============================================================================

export type RelevanceLevel = 'high' | 'medium' | 'low' | 'irrelevant';

export interface SuggestionAnalysis {
  id: string;
  content: string;
  relevance: RelevanceLevel;
  reason: string;
  impact: string;
  recommendation: string;
}

export interface CommentAnalysis {
  id: string;
  content: string;
  relevance: RelevanceLevel;
  reason: string;
  insight: string;
  recommendation: string;
}

export interface QuestionAnalysis {
  id: string;
  content: string;
  relevance: RelevanceLevel;
  reason: string;
  area: string;
  recommendation: string;
}

export interface AiBlueprintOutputContract {
  // 1. Project Overview
  projectOverview: {
    summary: string;
    vision: string;
    targetAudience: string;
  };

  // 2. MVP Scope
  mvpScope: {
    inScope: string[];
    outOfScope: string[];
    successCriteria: string[];
  };

  // 3. Recommended Tech Stack
  recommendedTechStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    hosting: string[];
    thirdPartyApis: string[];
    evaluationReason: string;
  };

  // 4. Core Features
  coreFeatures: Array<{
    featureName: string;
    description: string;
    priority: 'Must Have' | 'Should Have' | 'Nice to Have';
  }>;

  // 5. User Flow
  userFlow: Array<{
    stepNumber: number;
    stepName: string;
    description: string;
  }>;

  // 6. Technical Architecture
  technicalArchitecture: {
    architecturePattern: string;
    components: string[];
    dataFlowDescription: string;
  };

  // 7. Database Design
  databaseDesign: {
    primaryDatabase: string;
    entities: Array<{
      entityName: string;
      entityType?: string;
      isOptional?: boolean;
      fields: string[];
      optionalFields?: string[];
    }>;
  };

  // 8. Team Allocation
  teamAllocation: Array<{
    memberId: string;
    memberName: string;
    assignedRole: string;
    recommendedTasks: string[];
  }>;

  // 9. Challenges & Difficulties
  challengesAndDifficulties: Array<{
    challenge: string;
    severity: 'High' | 'Medium' | 'Low';
    mitigationStrategy: string;
  }>;

  // 10. Innovation / Differentiation
  innovationAndDifferentiation: {
    keyDifferentiators: string[];
    marketAdvantage: string;
  };

  // 11. Development Roadmap
  developmentRoadmap: Array<{
    phase: string;
    duration: string;
    deliverables: string[];
  }>;

  // 12-14. Community Analysis
  suggestionsAnalysis: SuggestionAnalysis[];
  commentsAnalysis: CommentAnalysis[];
  questionsAnalysis: QuestionAnalysis[];

  // 15. Community Insights Summary
  communityInsightsSummary: any;

  // 16. Project Readiness
  projectReadiness: {
    score: number; // 0 - 100
    readinessLevel: 'Ready for Development' | 'Needs Refinement' | 'Incomplete Concept' | string;
    reasons?: string[];
    keyGaps?: string[];
  };
}

// ============================================================================
// 3. BLUEPRINT DOCUMENT SCHEMA (Stored in Realtime Database)
// ============================================================================

export type BlueprintStatus =
  | 'not_created'
  | 'draft'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'stale';

export interface BlueprintDocument {
  blueprintId: string;
  workspaceId: string;
  orgId?: string;
  mvpIdeaId: string;
  ideaId?: string;
  versionId?: string;
  activeVersionId?: string;
  activeVersionKey?: string;
  version: string; // e.g. "1.0", "2.0"
  schemaVersion?: number; // 1 (legacy) or 2 (canonical 2.0)
  status: BlueprintStatus;
  lastModifiedSource?: string;
  
  // Metadata fields
  aiProvider: string | null;
  aiModel: string | null;
  generatedAt: number | null;
  updatedAt: number;
  createdAt: number;
  generatedBy: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  lastError?: string | null;

  // Idea Snapshot Data
  ideaTitle: string;
  problemStatement: string;
  description: string;
  techStack?: string;
  authorId: string;
  authorName: string;

  // Structured Content (Union of legacy 16-section contract and Blueprint 2.0 content)
  content?: AiBlueprintOutputContract | any;

  // Pre-AI Discussion Summary
  discussionSummary?: {
    commentCount: number;
    suggestionCount: number;
    questionCount?: number;
    acceptedSuggestionsCount: number;
    acceptedSuggestionsList: Array<{
      message: string;
      authorName: string;
    }>;
  };

  // Community Intelligence analysis
  communityIntelligence?: any;
  communityIntelligenceStatus?: string;
  communityIntelligenceUpdatedAt?: number;

  // Embedded Version History
  versions?: Record<string, any>;
}
