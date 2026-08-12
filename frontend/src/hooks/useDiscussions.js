import { useContext } from 'react';
import { DiscussionContext } from '../contexts/DiscussionContext';

/**
 * Access real-time discussion state, replies, and mutations.
 */
export function useDiscussions() {
  const context = useContext(DiscussionContext);
  if (!context) {
    throw new Error('useDiscussions must be used within a DiscussionProvider');
  }
  return context;
}
