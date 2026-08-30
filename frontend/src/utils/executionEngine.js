/**
 * Convia Blueprint 2.0 — Client-Side Execution Graph & Planning Utilities (Phase 4)
 * Provides deterministic cycle detection, topological sorting, execution waves,
 * dynamic blocked task detection, and critical path derivation for UI consumers.
 */

/**
 * Derives topological execution order of tasks using Kahn's algorithm.
 */
export function deriveTopologicalOrder(tasks = [], dependencies = []) {
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

  const queue = [];
  for (const [taskId, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(taskId);
  }
  queue.sort();

  const executionOrder = [];
  while (queue.length > 0) {
    const curr = queue.shift();
    executionOrder.push(curr);

    const neighbors = adjList.get(curr) || [];
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

  return {
    isValid: executionOrder.length === tasks.length,
    executionOrder,
  };
}

/**
 * Derives execution waves / tiers (Wave 0: roots, Wave 1: dependent tier 1, etc.)
 */
export function deriveExecutionWaves(tasks = [], dependencies = []) {
  const prereqMap = new Map();

  for (const t of tasks) {
    prereqMap.set(t.id, []);
  }
  for (const dep of dependencies) {
    if (prereqMap.has(dep.targetTaskId)) {
      prereqMap.get(dep.targetTaskId).push(dep.sourceTaskId);
    }
  }

  const depthMap = new Map();
  const computeDepth = (taskId, visitedInPath = new Set()) => {
    if (depthMap.has(taskId)) return depthMap.get(taskId);
    if (visitedInPath.has(taskId)) return 0;

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

  const waveMap = new Map();
  for (const t of tasks) {
    const depth = depthMap.get(t.id) || 0;
    if (!waveMap.has(depth)) {
      waveMap.set(depth, []);
    }
    waveMap.get(depth).push(t);
  }

  const sortedDepths = Array.from(waveMap.keys()).sort((a, b) => a - b);
  return sortedDepths.map((depth) => {
    const waveTasks = waveMap.get(depth) || [];
    return {
      waveIndex: depth,
      waveName: depth === 0 ? 'Wave 0: Foundation & Independent Roots' : `Wave ${depth}: Execution Tier ${depth}`,
      taskIds: waveTasks.map((t) => t.id),
      tasks: waveTasks,
      parallelCapacity: waveTasks.length,
    };
  });
}

/**
 * Calculates Critical Path from task effort hours.
 */
export function calculateCriticalPath(tasks = [], dependencies = []) {
  if (!tasks || tasks.length === 0) {
    return {
      isAvailable: false,
      reason: 'No tasks available.',
      criticalPathTaskIds: [],
      criticalDurationHours: 0,
    };
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const prereqMap = new Map();

  let hasValidEffort = false;
  for (const t of tasks) {
    prereqMap.set(t.id, []);
    if (typeof t.estimatedEffortHours === 'number' && t.estimatedEffortHours > 0) {
      hasValidEffort = true;
    }
  }

  if (!hasValidEffort) {
    return {
      isAvailable: false,
      reason: 'Effort estimates not provided; relative topological sequencing maintained.',
      criticalPathTaskIds: [],
      criticalDurationHours: 0,
    };
  }

  for (const dep of dependencies) {
    if (prereqMap.has(dep.targetTaskId)) {
      prereqMap.get(dep.targetTaskId).push(dep.sourceTaskId);
    }
  }

  const earliestFinish = new Map();
  const parentNode = new Map();

  const { executionOrder } = deriveTopologicalOrder(tasks, dependencies);

  for (const taskId of executionOrder) {
    const task = taskMap.get(taskId);
    const duration = task && typeof task.estimatedEffortHours === 'number' && task.estimatedEffortHours > 0
      ? task.estimatedEffortHours
      : 4;

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

  let maxTotalDuration = 0;
  let terminalTaskId = null;
  for (const [taskId, finishTime] of earliestFinish.entries()) {
    if (finishTime > maxTotalDuration) {
      maxTotalDuration = finishTime;
      terminalTaskId = taskId;
    }
  }

  const criticalPathReversed = [];
  let curr = terminalTaskId;
  while (curr) {
    criticalPathReversed.push(curr);
    curr = parentNode.get(curr);
  }

  return {
    isAvailable: true,
    criticalPathTaskIds: criticalPathReversed.reverse(),
    criticalDurationHours: maxTotalDuration,
  };
}

/**
 * Calculates dynamic blocked state for tasks.
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
    const unmet = prereqs.filter((pId) => taskStatusMap.get(pId) !== 'Completed');
    blockedMap[t.id] = {
      isBlocked: unmet.length > 0 && t.status !== 'Completed',
      unmetPrerequisiteIds: unmet,
    };
  }

  return blockedMap;
}
