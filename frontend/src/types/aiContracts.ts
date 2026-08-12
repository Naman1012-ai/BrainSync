/**
 * BrainSync AI Blueprint - Data Contracts & Schemas (Phase 1)
 * Backend-ready TypeScript contracts for Gemini API integration.
 */

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
}

// ============================================================================
// 2. AI OUTPUT CONTRACT (Structured JSON Response from Gemini API)
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
      fields: string[];
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
  communityInsightsSummary: string;

  // 16. Project Readiness
  projectReadiness: {
    score: number; // 0 - 100
    readinessLevel: 'Ready for Development' | 'Needs Refinement' | 'Incomplete Concept';
    reasons: string[];
  };
}

// ============================================================================
// 3. BLUEPRINT DOCUMENT SCHEMA (Stored in Realtime Database)
// ============================================================================

export type BlueprintStatus = 'not_created' | 'generating' | 'completed' | 'failed';

export interface BlueprintDocument {
  blueprintId: string;
  workspaceId: string;
  mvpIdeaId: string;
  version: string; // e.g. "1.0"
  status: BlueprintStatus;
  
  // Metadata fields
  aiProvider: string | null; // Null in Phase 1
  aiModel: string | null;    // Null in Phase 1
  generatedAt: number | null;
  updatedAt: number;
  generatedBy: string | null;
  createdAt: number;

  // Idea Snapshot Data
  ideaTitle: string;
  problemStatement: string;
  description: string;
  techStack?: string;
  authorId: string;
  authorName: string;

  // Structured Content (Populated in Phase 2/3 when status === 'completed')
  content?: AiBlueprintOutputContract;

  // Pre-AI Discussion Summary (Phase 1 placeholder structure)
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
}
