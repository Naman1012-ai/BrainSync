/**
 * Convia Blueprint 2.0 — Task Board Adapter (Phase 4)
 * Bridges Blueprint Execution Tasks (TASK-xx) with Task Board Entities (tasks/{orgId}/{taskId}).
 * Ensures bidirectional traceability without premature duplicate synchronization.
 */

/**
 * Converts a Blueprint Execution Task (TASK-xx) into a Task Board Entity.
 */
export function convertBlueprintTaskToTaskBoardTask(blueprintTask, workspaceId, mvpIdeaId, creatorUser = {}) {
  if (!blueprintTask || !workspaceId) {
    throw new Error('Blueprint task and Workspace ID are required for conversion.');
  }

  const timestamp = Date.now();
  const taskId = `task_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    taskId,
    projectId: mvpIdeaId || 'active_project',
    orgId: workspaceId,
    title: blueprintTask.title ? String(blueprintTask.title).trim() : 'Execution Task',
    description: blueprintTask.description ? String(blueprintTask.description).trim() : '',
    createdBy: creatorUser.uid || 'system',
    createdByName: creatorUser.displayName || creatorUser.name || 'Blueprint Generator',
    assignedTo: blueprintTask.assignedUserId || '',
    assignedToName: blueprintTask.assignedUserName || 'Unassigned',
    priority: blueprintTask.priority || 'Medium',
    status: blueprintTask.status === 'Completed' ? 'Completed' : 'Todo',
    dueDate: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: blueprintTask.status === 'Completed' ? timestamp : null,
    isDeleted: false,

    // Blueprint 2.0 Traceability Metadata
    blueprintTaskId: blueprintTask.id,
    originatingBlueprintId: `bp_${workspaceId}_${mvpIdeaId}`,
    featureId: blueprintTask.featureId || null,
    category: blueprintTask.category || 'general',
    estimatedEffortHours: blueprintTask.estimatedEffortHours || null,
    source: 'blueprint_converted',
  };
}

/**
 * Maps a live Task Board task back to a Blueprint TaskItem structure.
 */
export function convertTaskBoardTaskToBlueprintTask(taskBoardTask) {
  if (!taskBoardTask) return null;

  return {
    id: taskBoardTask.blueprintTaskId || `TASK_${taskBoardTask.taskId.slice(-4)}`,
    title: taskBoardTask.title,
    description: taskBoardTask.description || '',
    category: taskBoardTask.category || 'general',
    priority: taskBoardTask.priority || 'Medium',
    status: taskBoardTask.status || 'Todo',
    featureId: taskBoardTask.featureId || null,
    requirementIds: [],
    workflowStepId: null,
    recommendedRoleId: null,
    assignedUserId: taskBoardTask.assignedTo || null,
    assignedUserName: taskBoardTask.assignedToName || null,
    dependencyIds: [],
    acceptanceCriteriaIds: [],
    estimatedEffortHours: taskBoardTask.estimatedEffortHours || null,
    milestoneId: null,
    source: 'taskboard_synced',
    isConvertedToTask: true,
    convertedTaskId: taskBoardTask.taskId,
  };
}
