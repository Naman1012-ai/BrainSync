import { useContext } from 'react';
import { TaskContext } from '../contexts/TaskContext';

/**
 * Access real-time task state, filter controls, and mutations.
 */
export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
}
