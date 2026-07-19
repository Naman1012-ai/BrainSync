import { useContext } from 'react';
import { IdeaContext } from '../contexts/IdeaContext';

/**
 * Access the real-time Idea Board state, filtered ideas, search, and mutations.
 */
export function useIdeas() {
  const context = useContext(IdeaContext);
  if (!context) {
    throw new Error('useIdeas must be used within an IdeaProvider');
  }
  return context;
}
