import { useContext } from 'react';
import { OrgContext } from '../contexts/OrgContext';

/**
 * Access the real-time OrgContext state and properties (org, members, isLeader, isFrozen).
 */
export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
