import { useContext } from 'react';
import { ProjectContext } from '../contexts/ProjectContext';

/**
 * Access real-time Project Blueprint state and handlers.
 */
export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
