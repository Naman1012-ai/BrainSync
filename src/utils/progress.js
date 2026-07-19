import { TASK_STATUS } from '../config/constants';

/**
 * Calculates task completion progress stats for the Project Blueprint and Task Board.
 */
export function calculateProgress(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      total: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      percentage: null, // Signals "No tasks created yet" per PRD
    };
  }

  const total = tasks.length;
  let todo = 0;
  let inProgress = 0;
  let done = 0;

  tasks.forEach((task) => {
    if (task.status === TASK_STATUS.DONE) {
      done += 1;
    } else if (task.status === TASK_STATUS.IN_PROGRESS) {
      inProgress += 1;
    } else {
      todo += 1;
    }
  });

  const percentage = Math.round((done / total) * 100);

  return {
    total,
    todo,
    inProgress,
    done,
    percentage,
  };
}
