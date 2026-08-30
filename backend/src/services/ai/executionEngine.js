/**
 * Convia Blueprint 2.0 — Execution Planning Engine (Phase 4)
 * Deterministic graph algorithms, dependency validation, cycle detection,
 * topological sorting, parallel execution waves, critical path calculation,
 * and requirement/feature traceability validation.
 */

import {
  TASK_CATEGORIES,
  PRIORITY_LEVELS,
  TASK_STATUSES,
  DEPENDENCY_TYPES,
} from '../../constants/blueprintSchema.js';
import {
  normalizeRequiredCapability,
  calculateTeamWorkloadSummary,
  analyzeTeamCapabilityGaps,
  generateTaskAssignmentRecommendations,
} from './teamMatchingEngine.js';

/**
 * Validates task dependencies, checking for:
 * - Duplicate IDs
 * - Self-references (sourceTaskId === targetTaskId)
 * - Unknown task references
 * - Circular dependencies (cycles) using Depth-First Search
 * - Directional normalization (e.g. 'dependsOn' normalized to canonical 'blocks')
 */
export function validateTaskDependencies(tasks = [], dependencies = []) {
  const taskIds = new Set(tasks.map((t) => t.id));
  const cleanDependencies = [];
  const errors = [];
  const warnings = [];

  const depIdSet = new Set();
  const edgeSet = new Set();

  for (const dep of dependencies) {
    if (!dep || typeof dep !== 'object') continue;
    const id = dep.id || `DEP-${String(cleanDependencies.length + 1).padStart(2, '0')}`;
    if (depIdSet.has(id)) {
      errors.push(`Duplicate dependency ID '${id}' detected.`);
      continue;
    }
    depIdSet.add(id);

    let source = dep.sourceTaskId;
    let target = dep.targetTaskId;
    const rawType = dep.type || 'blocks';

    // Normalize directional semantics
    if (rawType === 'dependsOn' || rawType === 'blockedBy') {
      // In 'dependsOn': target depends on source, or source depends on target?
      // Standard: targetTaskId depends on sourceTaskId => sourceTaskId blocks targetTaskId
      // Keep source as prerequisite and target as dependent
    }

    if (!source || !target) {
      errors.push(`Dependency '${id}' is missing sourceTaskId or targetTaskId.`);
      continue;
    }

    if (source === target) {
      errors.push(`Self-referencing dependency '${id}' on task '${source}' is invalid.`);
      continue;
    }

    if (!taskIds.has(source)) {
      errors.push(`Dependency '${id}' references non-existent prerequisite task '${source}'.`);
      continue;
    }

    if (!taskIds.has(target)) {
      errors.push(`Dependency '${id}' references non-existent dependent task '${target}'.`);
      continue;
    }

    const edgeKey = `${source}->${target}`;
    const reverseEdgeKey = `${target}->${source}`;

    if (edgeSet.has(edgeKey)) {
      warnings.push(`Duplicate dependency edge '${edgeKey}' ignored.`);
      continue;
    }

    if (edgeSet.has(reverseEdgeKey)) {
      errors.push(`Contradictory bidirectional dependency detected between '${source}' and '${target}'.`);
      continue;
    }

    edgeSet.add(edgeKey);

    cleanDependencies.push({
      id,
      sourceTaskId: source,
      targetTaskId: target,
      type: DEPENDENCY_TYPES.includes(dep.type) ? dep.type : 'blocks',
      reason: dep.reason || 'Prerequisite execution requirement.',
    });
  }

  // Cycle Detection via Depth-First Search with full path tracking
  const adjList = new Map();
  for (const taskId of taskIds) {
    adjList.set(taskId, []);
  }
  for (const dep of cleanDependencies) {
    if (adjList.has(dep.sourceTaskId)) {
      adjList.get(dep.sourceTaskId).push(dep.targetTaskId);
    }
  }

  const visited = new Map(); // 0: unvisited, 1: visiting (in stack), 2: visited
  for (const taskId of taskIds) {
    visited.set(taskId, 0);
  }

  let hasCycle = false;
  const cyclePaths = [];

  const detectCycleDFS = (curr, path = []) => {
    visited.set(curr, 1);
    const neighbors = adjList.get(curr) || [];
    for (const neighbor of neighbors) {
      if (visited.get(neighbor) === 1) {
        hasCycle = true;
        const cycleSegment = [...path, curr, neighbor];
        const cycleStr = cycleSegment.join(' -> ');
        cyclePaths.push(cycleStr);
        errors.push(`Circular dependency cycle detected: ${cycleStr}`);
      } else if (visited.get(neighbor) === 0) {
        detectCycleDFS(neighbor, [...path, curr]);
      }
    }
    visited.set(curr, 2);
  };

  for (const taskId of taskIds) {
    if (visited.get(taskId) === 0) {
      detectCycleDFS(taskId, []);
    }
  }

  return {
    valid: errors.length === 0,
    hasCycle,
    cyclePaths,
    errors,
    warnings,
    cleanDependencies,
  };
}

/**
 * Derives a deterministic topological execution order for tasks using Kahn's Algorithm.
 */
export function deriveTopologicalOrder(tasks = [], dependencies = []) {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map();
  const adjList = new Map();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adjList.set(t.id, []);
  }

  for (const dep of dependencies) {
    if (inDegree.has(dep.targetTaskId) && adjList.has(dep.sourceTaskId)) {
      inDegree.set(dep.targetTaskId, inDegree.get(dep.targetTaskId) + 1);
      adjList.get(dep.sourceTaskId).push(dep.targetTaskId);
    }
  }

  // Queue of nodes with 0 in-degree (ready to execute immediately in parallel)
  const queue = [];
  for (const [taskId, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(taskId);
    }
  }

  // Sort queue by task priority / ID for deterministic stable ordering
  queue.sort();

  const executionOrder = [];
  while (queue.length > 0) {
    const current = queue.shift();
    executionOrder.push(current);

    const neighbors = adjList.get(current) || [];
    // Sort neighbors deterministically
    neighbors.sort();

    for (const neighbor of neighbors) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
        queue.sort();
      }
    }
  }

  const isComplete = executionOrder.length === tasks.length;
  return {
    isValid: isComplete,
    executionOrder,
    unprocessedTaskIds: isComplete ? [] : tasks.map((t) => t.id).filter((id) => !executionOrder.includes(id)),
  };
}

/**
 * Derives execution waves / tiers.
 * Wave 0: Tasks with no dependencies (run in parallel).
 * Wave 1: Tasks that only depend on Wave 0 tasks.
 * Wave N: Tasks dependent on Wave <= N-1.
 */
export function deriveExecutionWaves(tasks = [], dependencies = []) {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map();
  const prereqMap = new Map();
  const dependentsMap = new Map();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    prereqMap.set(t.id, []);
    dependentsMap.set(t.id, []);
  }

  for (const dep of dependencies) {
    if (prereqMap.has(dep.targetTaskId) && dependentsMap.has(dep.sourceTaskId)) {
      prereqMap.get(dep.targetTaskId).push(dep.sourceTaskId);
      dependentsMap.get(dep.sourceTaskId).push(dep.targetTaskId);
      inDegree.set(dep.targetTaskId, inDegree.get(dep.targetTaskId) + 1);
    }
  }

  // Compute depth for each task using Dynamic Programming on DAG
  const depthMap = new Map();

  const computeDepth = (taskId, visitedInPath = new Set()) => {
    if (depthMap.has(taskId)) return depthMap.get(taskId);
    if (visitedInPath.has(taskId)) return 0; // Guard against cycles

    visitedInPath.add(taskId);
    const prereqs = prereqMap.get(taskId) || [];
    if (prereqs.length === 0) {
      depthMap.set(taskId, 0);
      return 0;
    }

    let maxPrereqDepth = 0;
    for (const p of prereqs) {
      const pDepth = computeDepth(p, new Set(visitedInPath));
      if (pDepth + 1 > maxPrereqDepth) {
        maxPrereqDepth = pDepth + 1;
      }
    }

    depthMap.set(taskId, maxPrereqDepth);
    return maxPrereqDepth;
  };

  for (const t of tasks) {
    computeDepth(t.id);
  }

  // Group into waves by depth
  const waveMap = new Map();
  for (const t of tasks) {
    const depth = depthMap.get(t.id) || 0;
    if (!waveMap.has(depth)) {
      waveMap.set(depth, []);
    }
    waveMap.get(depth).push(t);
  }

  const sortedDepths = Array.from(waveMap.keys()).sort((a, b) => a - b);
  const waves = sortedDepths.map((depth) => {
    const waveTasks = waveMap.get(depth) || [];
    return {
      waveIndex: depth,
      waveName: depth === 0 ? 'Wave 0: Foundation & Independent Roots' : `Wave ${depth}: Dependent Tier ${depth}`,
      taskIds: waveTasks.map((t) => t.id),
      tasks: waveTasks,
      parallelCapacity: waveTasks.length,
    };
  });

  return waves;
}

/**
 * Calculates Critical Path through the Task Dependency Graph.
 * Uses estimated effort hours as weights to find the longest path from source to sink.
 */
export function calculateCriticalPath(tasks = [], dependencies = []) {
  if (!tasks || tasks.length === 0) {
    return {
      isAvailable: false,
      reason: 'No tasks available for critical path analysis.',
      criticalPathTaskIds: [],
      criticalDependencies: [],
      criticalDurationHours: 0,
    };
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const prereqMap = new Map();
  const dependentsMap = new Map();

  let hasMissingEffort = false;
  for (const t of tasks) {
    prereqMap.set(t.id, []);
    dependentsMap.set(t.id, []);
    if (typeof t.estimatedEffortHours !== 'number' || isNaN(t.estimatedEffortHours) || t.estimatedEffortHours <= 0) {
      hasMissingEffort = true;
    }
  }

  for (const dep of dependencies) {
    if (prereqMap.has(dep.targetTaskId) && dependentsMap.has(dep.sourceTaskId)) {
      prereqMap.get(dep.targetTaskId).push(dep.sourceTaskId);
      dependentsMap.get(dep.sourceTaskId).push(dep.targetTaskId);
    }
  }

  // If critical durations are completely missing, do not fabricate numbers
  if (hasMissingEffort && tasks.every((t) => !t.estimatedEffortHours)) {
    return {
      isAvailable: false,
      reason: 'Task duration data is insufficient to compute exact critical path. Topological ordering preserved.',
      criticalPathTaskIds: [],
      criticalDependencies: [],
      criticalDurationHours: 0,
    };
  }

  // DP Longest Path Calculation on DAG
  const earliestFinish = new Map();
  const parentNode = new Map();

  const { executionOrder } = deriveTopologicalOrder(tasks, dependencies);

  for (const taskId of executionOrder) {
    const task = taskMap.get(taskId);
    const duration = (task && typeof task.estimatedEffortHours === 'number' && task.estimatedEffortHours > 0)
      ? task.estimatedEffortHours
      : 4; // Default fallback estimate for relative pathing

    const prereqs = prereqMap.get(taskId) || [];
    if (prereqs.length === 0) {
      earliestFinish.set(taskId, duration);
      parentNode.set(taskId, null);
    } else {
      let maxPrereqFinish = 0;
      let bestParent = null;
      for (const p of prereqs) {
        const pFinish = earliestFinish.get(p) || 0;
        if (pFinish > maxPrereqFinish) {
          maxPrereqFinish = pFinish;
          bestParent = p;
        }
      }
      earliestFinish.set(taskId, maxPrereqFinish + duration);
      parentNode.set(taskId, bestParent);
    }
  }

  // Find terminal task with maximum finish time
  let maxTotalDuration = 0;
  let terminalTaskId = null;
  for (const [taskId, finishTime] of earliestFinish.entries()) {
    if (finishTime > maxTotalDuration) {
      maxTotalDuration = finishTime;
      terminalTaskId = taskId;
    }
  }

  // Reconstruct critical path by backtracking
  const criticalPathReversed = [];
  let curr = terminalTaskId;
  while (curr) {
    criticalPathReversed.push(curr);
    curr = parentNode.get(curr);
  }

  const criticalPathTaskIds = criticalPathReversed.reverse();

  // Find critical dependency edges
  const criticalDependencies = [];
  for (let i = 0; i < criticalPathTaskIds.length - 1; i++) {
    const src = criticalPathTaskIds[i];
    const tgt = criticalPathTaskIds[i + 1];
    const matchedDep = dependencies.find((d) => d.sourceTaskId === src && d.targetTaskId === tgt);
    if (matchedDep) {
      criticalDependencies.push(matchedDep);
    }
  }

  return {
    isAvailable: true,
    criticalPathTaskIds,
    criticalDependencies,
    criticalDurationHours: maxTotalDuration,
    hasInferredDurations: hasMissingEffort,
  };
}

/**
 * Derives dynamic blocked status for each task based on incomplete prerequisites.
 */
export function deriveBlockedTasks(tasks = [], dependencies = []) {
  const taskStatusMap = new Map(tasks.map((t) => [t.id, t.status]));
  const prereqMap = new Map();

  for (const t of tasks) {
    prereqMap.set(t.id, []);
  }
  for (const dep of dependencies) {
    if (prereqMap.has(dep.targetTaskId)) {
      prereqMap.get(dep.targetTaskId).push(dep.sourceTaskId);
    }
  }

  const blockedMap = {};
  for (const t of tasks) {
    const prereqs = prereqMap.get(t.id) || [];
    const unmet = prereqs.filter((pId) => {
      const status = taskStatusMap.get(pId);
      return status !== 'Completed';
    });

    blockedMap[t.id] = {
      isBlocked: unmet.length > 0 && t.status !== 'Completed',
      unmetPrerequisiteIds: unmet,
    };
  }

  return blockedMap;
}

/**
 * Complete Execution Model Validation and Derived Plan Synthesizer.
 */
export function validateAndSynthesizeExecutionPlan(execution = {}, context = {}) {
  const errors = [];
  const warnings = [];

  const rawTasks = Array.isArray(execution.tasks) ? execution.tasks : [];
  const rawFeatures = Array.isArray(execution.features) ? execution.features : [];
  const rawWorkflow = Array.isArray(execution.workflow) ? execution.workflow : [];
  const rawRoles = Array.isArray(execution.roles) ? execution.roles : [];
  const rawMilestones = Array.isArray(execution.timeline?.milestones) ? execution.timeline.milestones : [];
  const rawAC = Array.isArray(context.acceptanceCriteria) ? context.acceptanceCriteria : [];

  const featureIdSet = new Set(rawFeatures.map((f) => f.id));
  const workflowIdSet = new Set(rawWorkflow.map((w) => w.id));
  const roleIdSet = new Set(rawRoles.map((r) => r.id));
  const milestoneIdSet = new Set(rawMilestones.map((m) => m.id));
  const reqIdSet = new Set((context.requirements || []).map((r) => r.id));

  // 1. Validate & Sanitize Tasks
  const seenTaskIds = new Set();
  const cleanTasks = [];

  rawTasks.forEach((task, idx) => {
    let id = task.id || `TASK-${String(idx + 1).padStart(2, '0')}`;
    if (seenTaskIds.has(id)) {
      errors.push(`Duplicate task ID '${id}' detected.`);
      id = `TASK-${String(idx + 1).padStart(2, '0')}_${Math.random().toString(36).slice(2, 5)}`;
    }
    seenTaskIds.add(id);

    // Cross-reference checks
    if (task.featureId && !featureIdSet.has(task.featureId)) {
      warnings.push(`Task '${id}' references unknown feature ID '${task.featureId}'.`);
    }
    if (task.workflowStepId && !workflowIdSet.has(task.workflowStepId)) {
      warnings.push(`Task '${id}' references unknown workflow step ID '${task.workflowStepId}'.`);
    }
    if (task.recommendedRoleId && !roleIdSet.has(task.recommendedRoleId)) {
      warnings.push(`Task '${id}' references unknown role ID '${task.recommendedRoleId}'.`);
    }
    if (task.milestoneId && !milestoneIdSet.has(task.milestoneId)) {
      warnings.push(`Task '${id}' references unknown milestone ID '${task.milestoneId}'.`);
    }

    const effortHours = typeof task.estimatedEffortHours === 'number' && !isNaN(task.estimatedEffortHours) && task.estimatedEffortHours > 0
      ? task.estimatedEffortHours
      : null;

    const rawReqCaps = Array.isArray(task.requiredCapabilities)
      ? task.requiredCapabilities.map(normalizeRequiredCapability).filter(Boolean)
      : [];

    cleanTasks.push({
      id,
      title: task.title ? String(task.title).trim() : `Task ${idx + 1}`,
      description: task.description ? String(task.description).trim() : 'Task implementation specification.',
      category: TASK_CATEGORIES.includes(task.category) ? task.category : 'general',
      priority: PRIORITY_LEVELS.includes(task.priority) ? task.priority : 'Medium',
      status: TASK_STATUSES.includes(task.status) ? task.status : 'Todo',
      featureId: task.featureId || null,
      requirementIds: Array.isArray(task.requirementIds) ? task.requirementIds.filter((r) => reqIdSet.has(r)) : [],
      workflowStepId: task.workflowStepId || null,
      recommendedRoleId: task.recommendedRoleId || null,
      assignedUserId: task.assignedUserId || null,
      assignedUserName: task.assignedUserName || null,
      dependencyIds: Array.isArray(task.dependencyIds) ? task.dependencyIds : [],
      acceptanceCriteriaIds: Array.isArray(task.acceptanceCriteriaIds) ? task.acceptanceCriteriaIds : [],
      requiredCapabilities: rawReqCaps,
      estimatedEffortHours: effortHours,
      milestoneId: task.milestoneId || null,
      source: task.source || 'ai_proposed',
      isConvertedToTask: Boolean(task.isConvertedToTask),
      convertedTaskId: task.convertedTaskId || null,
    });
  });

  // 2. Validate & Sanitize Dependencies
  const rawDependencies = Array.isArray(execution.dependencies) ? execution.dependencies : [];
  const depValidation = validateTaskDependencies(cleanTasks, rawDependencies);
  errors.push(...depValidation.errors);
  warnings.push(...depValidation.warnings);

  // Sync dependencyIds on task objects
  for (const t of cleanTasks) {
    const prereqs = depValidation.cleanDependencies
      .filter((d) => d.targetTaskId === t.id)
      .map((d) => d.sourceTaskId);
    t.dependencyIds = Array.from(new Set(prereqs));
  }

  // 3. Derive Execution Order & Graph Metrics
  const topo = deriveTopologicalOrder(cleanTasks, depValidation.cleanDependencies);
  const waves = deriveExecutionWaves(cleanTasks, depValidation.cleanDependencies);
  const criticalPath = calculateCriticalPath(cleanTasks, depValidation.cleanDependencies);
  const blockedTasks = deriveBlockedTasks(cleanTasks, depValidation.cleanDependencies);

  // Annotate tasks with graph flags
  const criticalSet = new Set(criticalPath.criticalPathTaskIds || []);
  const blockedMap = new Map();
  (blockedTasks.blockedTasks || []).forEach((b) => {
    blockedMap.set(b.taskId, b.unmetPrerequisites || []);
  });

  cleanTasks.forEach((t) => {
    t.isCriticalPath = criticalSet.has(t.id);
    t.isBlocked = blockedMap.has(t.id);
    if (blockedMap.has(t.id)) {
      t.unmetPrerequisites = blockedMap.get(t.id);
    }
  });

  // 4. Team Intelligence & Capability Matching (Phase 5)
  const teamMembers = Array.isArray(context.teamMembers) ? context.teamMembers : [];
  const workloadSummary = calculateTeamWorkloadSummary(cleanTasks, teamMembers);
  const capabilityGapSummary = analyzeTeamCapabilityGaps(cleanTasks, rawRoles, teamMembers);
  const recommendations = generateTaskAssignmentRecommendations(cleanTasks, rawRoles, teamMembers, workloadSummary);

  // Attach assignment recommendations to task objects
  const recMap = new Map();
  recommendations.forEach((r) => recMap.set(r.taskId, r));
  cleanTasks.forEach((t) => {
    if (recMap.has(t.id)) {
      t.assignmentRecommendation = recMap.get(t.id);
    }
  });

  // 5. Validate Milestones
  const cleanMilestones = rawMilestones.map((m, idx) => ({
    id: m.id || `MILE-${String(idx + 1).padStart(2, '0')}`,
    name: m.name ? String(m.name).trim() : `Milestone ${idx + 1}`,
    description: m.description ? String(m.description).trim() : 'Sprint deliverables.',
    order: Number(m.order) || idx + 1,
    duration: m.duration || `Sprint ${idx + 1}`,
    deliverables: Array.isArray(m.deliverables) ? m.deliverables : [],
    taskIds: Array.isArray(m.taskIds) ? m.taskIds.filter((tId) => seenTaskIds.has(tId)) : [],
    status: m.status || 'planned',
  }));

  const cleanTimeline = {
    planningAssumptions: Array.isArray(execution.timeline?.planningAssumptions)
      ? execution.timeline.planningAssumptions
      : ['Sprint capacity committed'],
    estimatedDuration: execution.timeline?.estimatedDuration || `${cleanMilestones.length} Sprints`,
    milestones: cleanMilestones,
    criticalPathTaskIds: criticalPath.criticalPathTaskIds,
  };

  const unassignedCriticalCount = cleanTasks.filter((t) => t.isCriticalPath && !t.assignedUserId).length;

  const teamExecutionSummary = {
    workloadConcentration: workloadSummary.concentrationWarnings,
    capabilityGaps: capabilityGapSummary.uncoveredSkills,
    uncoveredRoles: capabilityGapSummary.uncoveredRoles,
    unassignedCriticalTasksCount: unassignedCriticalCount,
    teamCoveragePercentage: capabilityGapSummary.coveragePercentage,
    strategicAdvice: capabilityGapSummary.strategicAdvice,
    membersWorkload: workloadSummary.membersWorkload,
    totalProjectHours: workloadSummary.totalProjectHours,
    unassignedTaskCount: workloadSummary.unassignedTaskCount,
  };

  const synthesizedExecution = {
    features: rawFeatures,
    workflow: rawWorkflow,
    roles: rawRoles,
    tasks: cleanTasks,
    dependencies: depValidation.cleanDependencies,
    timeline: cleanTimeline,
    teamExecutionSummary,
  };

  return {
    isValid: errors.length === 0,
    hasCycles: depValidation.hasCycles,
    errors,
    warnings,
    cleanExecution: synthesizedExecution,
    derived: {
      topologicalOrder: topo.executionOrder,
      executionWaves: waves,
      criticalPath,
      blockedTasks,
      totalTaskCount: cleanTasks.length,
      dependencyCount: depValidation.cleanDependencies.length,
    },
  };
}
