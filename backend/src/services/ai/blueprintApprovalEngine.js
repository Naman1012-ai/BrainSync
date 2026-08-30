/**
 * Convia Blueprint 2.0 — Approval & Verification Engine (Phase 11)
 * Evaluates Approval Readiness Preconditions across all 8 canonical sections.
 * Strictly separates BLOCKING defects from non-blocking WARNINGS.
 */

import { blueprintStalenessEngine } from './blueprintStalenessEngine.js';
import { validateTaskDependencies } from './executionEngine.js';

export const blueprintApprovalEngine = {
  /**
   * Evaluates whether a Blueprint version is eligible for formal human approval.
   *
   * @param {Object} blueprintDoc - The Blueprint document snapshot to verify.
   * @param {Object} projectContext - Realtime project context (MVP idea, discussions, team).
   * @returns {Object} { canApprove, readinessScore, checklist, blockingErrors, warnings, isStale, stalenessInfo }
   */
  evaluateApprovalReadiness: (blueprintDoc, projectContext = {}) => {
    if (!blueprintDoc || !blueprintDoc.content) {
      return {
        canApprove: false,
        readinessScore: 0,
        checklist: [],
        blockingErrors: ['No Blueprint document or content provided for verification.'],
        warnings: [],
        isStale: false,
      };
    }

    const content = blueprintDoc.content || {};
    const blockingErrors = [];
    const warnings = [];
    const checklist = [];

    // 1. PROJECT IDENTITY & METADATA (BLOCKING)
    const hasProjectIdentity = Boolean(
      blueprintDoc.blueprintId &&
      blueprintDoc.workspaceId &&
      blueprintDoc.mvpIdeaId &&
      blueprintDoc.version
    );
    if (!hasProjectIdentity) {
      blockingErrors.push('Missing essential project identity, workspace ID, or version identifier.');
      checklist.push({ id: 'identity', label: 'Project Identity & Versioning', status: 'fail', message: 'Project or workspace metadata missing' });
    } else {
      checklist.push({ id: 'identity', label: 'Project Identity & Versioning', status: 'pass', message: `Version ${blueprintDoc.version} verified for MVP ${blueprintDoc.mvpIdeaId}` });
    }

    // 2. CANONICAL SCHEMA 2 CONTRACT (BLOCKING)
    const isSchema2 = Number(blueprintDoc.schemaVersion || content.schemaVersion) === 2;
    if (!isSchema2) {
      blockingErrors.push('Blueprint does not conform to Canonical Schema Version 2.');
      checklist.push({ id: 'schema', label: 'Canonical Schema 2 Contract', status: 'fail', message: 'Legacy Schema 1 detected' });
    } else {
      checklist.push({ id: 'schema', label: 'Canonical Schema 2 Contract', status: 'pass', message: 'Conforms to 8-Component Schema 2' });
    }

    // 3. PROJECT UNDERSTANDING & MVP SCOPE (BLOCKING)
    const understanding = content.projectUnderstanding || {};
    const hasProblem = Boolean(understanding.problemStatement || blueprintDoc.problemStatement);
    const hasSolution = Boolean(understanding.proposedSolution || blueprintDoc.description);
    if (!hasProblem || !hasSolution) {
      blockingErrors.push('Problem statement or proposed solution is missing from Project Understanding.');
      checklist.push({ id: 'understanding', label: 'Project Understanding & Scope', status: 'fail', message: 'Problem or solution undefined' });
    } else {
      checklist.push({ id: 'understanding', label: 'Project Understanding & Scope', status: 'pass', message: 'Problem statement and solution clearly defined' });
    }

    // 4. REQUIREMENTS SPECIFICATION (BLOCKING)
    const requirements = Array.isArray(content.requirements) ? content.requirements : [];
    if (requirements.length === 0) {
      blockingErrors.push('No requirements defined in Blueprint.');
      checklist.push({ id: 'requirements', label: 'Requirements Specification', status: 'fail', message: '0 requirements defined' });
    } else {
      const invalidReqs = requirements.filter((r) => !r.id || !r.title);
      if (invalidReqs.length > 0) {
        blockingErrors.push(`${invalidReqs.length} requirement(s) missing required ID or title.`);
        checklist.push({ id: 'requirements', label: 'Requirements Specification', status: 'fail', message: `${invalidReqs.length} invalid requirements` });
      } else {
        checklist.push({ id: 'requirements', label: 'Requirements Specification', status: 'pass', message: `${requirements.length} structured requirements validated` });
      }
    }

    // 5. ARCHITECTURE & TECH STACK (BLOCKING)
    const architecture = content.architecture || {};
    const hasTechStack = Boolean(
      (architecture.techStack && Object.keys(architecture.techStack).length > 0) ||
      (Array.isArray(architecture.components) && architecture.components.length > 0) ||
      architecture.architecturePattern
    );
    if (!hasTechStack) {
      blockingErrors.push('System Architecture and Technical Stack are undefined.');
      checklist.push({ id: 'architecture', label: 'System Architecture & Stack', status: 'fail', message: 'No architecture components or stack specified' });
    } else {
      checklist.push({ id: 'architecture', label: 'System Architecture & Stack', status: 'pass', message: 'Architecture components and tech stack confirmed' });
    }

    // 6. EXECUTION PLAN & TASKS (BLOCKING)
    const execution = content.execution || {};
    const tasks = Array.isArray(execution.tasks) ? execution.tasks : [];
    const dependencies = Array.isArray(execution.dependencies) ? execution.dependencies : [];

    if (tasks.length === 0) {
      blockingErrors.push('Execution plan contains 0 tasks.');
      checklist.push({ id: 'execution', label: 'Execution Plan & Task Graph', status: 'fail', message: '0 tasks generated' });
    } else {
      // Normalize and validate dependency graph for circular dependencies
      const normalizedDeps = dependencies.map((d) => ({
        ...d,
        sourceTaskId: d.sourceTaskId || d.fromTaskId || d.source,
        targetTaskId: d.targetTaskId || d.toTaskId || d.target,
      }));
      const depValidation = validateTaskDependencies(tasks, normalizedDeps);
      const isDepValid = depValidation.valid ?? depValidation.isValid ?? (depValidation.errors?.length === 0);

      if (!isDepValid) {
        blockingErrors.push(`Dependency graph validation failed: ${(depValidation.errors || []).join('; ')}`);
        checklist.push({ id: 'execution', label: 'Execution Plan & Task Graph', status: 'fail', message: 'Circular dependencies or invalid references found' });
      } else {
        checklist.push({ id: 'execution', label: 'Execution Plan & Task Graph', status: 'pass', message: `${tasks.length} tasks and ${dependencies.length} dependencies cycle-free` });
      }
    }

    // 7. TEAM CAPABILITIES & ROLE ALLOCATION (WARNING)
    const team = content.team || {};
    const roleRecommendations = Array.isArray(team.recommendedRoles || execution.roles) ? (team.recommendedRoles || execution.roles) : [];
    if (roleRecommendations.length === 0) {
      warnings.push('No team role allocations or skill profiles recommended.');
      checklist.push({ id: 'team', label: 'Team Roles & Allocation', status: 'warning', message: 'No explicit role breakdown' });
    } else {
      checklist.push({ id: 'team', label: 'Team Roles & Allocation', status: 'pass', message: `${roleRecommendations.length} roles and capability requirements mapped` });
    }

    // 8. RISKS, TESTING & PRODUCTION READINESS (WARNING)
    const quality = content.quality || {};
    const risks = Array.isArray(quality.risks) ? quality.risks : [];
    const qualityGates = Array.isArray(quality.qualityGates) ? quality.qualityGates : [];
    const testingStrategy = quality.testingStrategy || {};

    if (risks.length === 0) {
      warnings.push('No technical or delivery risks identified.');
    }
    if (qualityGates.length === 0 && !testingStrategy.testTypes) {
      warnings.push('Quality gates and testing strategy are not fully detailed.');
      checklist.push({ id: 'quality', label: 'Risks & Quality Intelligence', status: 'warning', message: `${risks.length} risks, basic testing strategy` });
    } else {
      checklist.push({ id: 'quality', label: 'Risks & Quality Intelligence', status: 'pass', message: `${risks.length} risks and ${qualityGates.length} quality gates evaluated` });
    }

    // 9. DISCUSSION & DECISION TRACEABILITY (WARNING)
    const intelligence = content.intelligence?.discussionIntelligence || {};
    const decisions = Array.isArray(intelligence.decisions) ? intelligence.decisions : [];
    checklist.push({
      id: 'decisions',
      label: 'Discussion Intelligence & Decisions',
      status: 'pass',
      message: `${decisions.length} decisions recorded and traceable`,
    });

    // 10. STALENESS & CONTEXT DRIFT EVALUATION (BLOCKING IF HIGH/CRITICAL)
    let isStale = false;
    let stalenessInfo = null;
    if (projectContext && projectContext.ideaId) {
      const stalenessResult = blueprintStalenessEngine.evaluateProjectChanges(projectContext, blueprintDoc);
      isStale = stalenessResult.isStale;
      stalenessInfo = stalenessResult;

      if (isStale && (stalenessResult.impactLevel === 'CRITICAL' || stalenessResult.impactLevel === 'HIGH_IMPACT')) {
        blockingErrors.push(`Project state changed materially since Blueprint was generated (${stalenessResult.staleReason}). Please regenerate before approving.`);
        checklist.push({
          id: 'staleness',
          label: 'Project Context Currency',
          status: 'fail',
          message: `Stale: ${stalenessResult.staleReason}`,
        });
      } else if (isStale) {
        warnings.push(`Minor project context changes detected (${stalenessResult.staleReason}).`);
        checklist.push({
          id: 'staleness',
          label: 'Project Context Currency',
          status: 'warning',
          message: `Minor shift: ${stalenessResult.staleReason}`,
        });
      } else {
        checklist.push({
          id: 'staleness',
          label: 'Project Context Currency',
          status: 'pass',
          message: 'Blueprint matches current project context',
        });
      }
    }

    const totalChecks = checklist.length;
    const passedChecks = checklist.filter((c) => c.status === 'pass').length;
    const warningChecks = checklist.filter((c) => c.status === 'warning').length;
    const readinessScore = Math.round(((passedChecks + warningChecks * 0.5) / Math.max(totalChecks, 1)) * 100);

    const canApprove = blockingErrors.length === 0;

    return {
      canApprove,
      readinessScore,
      checklist,
      blockingErrors,
      warnings,
      isStale,
      stalenessInfo,
    };
  },
};
