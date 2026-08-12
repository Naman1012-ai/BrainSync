import { rtdbService } from './rtdbService';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Complete Service Layer for Task Management & Project Execution Module.
 * Manages operations under: tasks/{orgId}/{taskId}
 */
export const taskService = {
  /**
   * Create a new task under the organization's active project.
   */
  createTask: async (user, orgId, taskData) => {
    if (!user || !orgId) throw new Error('User and Organization ID are required.');
    if (!taskData.title || !taskData.title.trim()) {
      throw new Error('Task title is required.');
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const newTask = {
      taskId,
      projectId: taskData.projectId || 'active_project',
      orgId,
      title: taskData.title.trim(),
      description: taskData.description ? taskData.description.trim() : '',
      createdBy: user.uid,
      createdByName: user.displayName || user.email || 'Team Member',
      assignedTo: taskData.assignedTo || '',
      assignedToName: taskData.assignedToName || 'Unassigned',
      priority: taskData.priority || 'Medium', // 'Low' | 'Medium' | 'High' | 'Critical'
      status: taskData.status || 'Todo', // 'Todo' | 'In Progress' | 'Review' | 'Completed'
      dueDate: taskData.dueDate || '',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: taskData.status === 'Completed' ? timestamp : null,
      isDeleted: false,
    };

    try {
      await rtdbService.setData(`tasks/${orgId}/${taskId}`, newTask);
      return newTask;
    } catch (error) {
      console.error('[taskService] createTask error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Fetch all non-deleted tasks for an organization once.
   */
  getTasks: async (orgId) => {
    if (!orgId) return [];
    try {
      const tasksObj = (await rtdbService.getData(`tasks/${orgId}`)) || {};
      return Object.values(tasksObj).filter((t) => t && !t.isDeleted);
    } catch (error) {
      console.error('[taskService] getTasks error:', error);
      return [];
    }
  },

  /**
   * Update task fields (Title, Description, Priority, Due Date).
   */
  updateTask: async (orgId, taskId, updates) => {
    if (!orgId || !taskId) return;
    const timestamp = Date.now();
    const patch = {
      ...updates,
      updatedAt: timestamp,
    };

    if (updates.status === 'Completed') {
      patch.completedAt = timestamp;
    } else if (updates.status && updates.status !== 'Completed') {
      patch.completedAt = null;
    }

    try {
      await rtdbService.updateData(`tasks/${orgId}/${taskId}`, patch);
    } catch (error) {
      console.error('[taskService] updateTask error:', error);
      throw error;
    }
  },

  /**
   * Quick status update helper (e.g. dragging or changing status select).
   */
  updateTaskStatus: async (orgId, taskId, newStatus) => {
    return await taskService.updateTask(orgId, taskId, { status: newStatus });
  },

  /**
   * Assign or reassign a task to an organization member.
   */
  assignTask: async (orgId, taskId, assignedToUid, assignedToName) => {
    return await taskService.updateTask(orgId, taskId, {
      assignedTo: assignedToUid || '',
      assignedToName: assignedToName || 'Unassigned',
    });
  },

  /**
   * Soft delete a task.
   */
  deleteTask: async (orgId, taskId) => {
    if (!orgId || !taskId) return;
    try {
      await rtdbService.updateData(`tasks/${orgId}/${taskId}`, {
        isDeleted: true,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[taskService] deleteTask error:', error);
      throw error;
    }
  },

  /**
   * Real-time subscription to tasks for an organization.
   */
  subscribeToTasks: (orgId, callback) => {
    if (!orgId) {
      callback([]);
      return () => {};
    }

    return rtdbService.subscribe(`tasks/${orgId}`, (tasksObj) => {
      if (!tasksObj) {
        callback([]);
        return;
      }
      const activeList = Object.values(tasksObj).filter((t) => t && !t.isDeleted);
      callback(activeList);
    });
  },
};
