import { useContext } from 'react';
import { DashboardContext } from '../contexts/DashboardContext';

/**
 * Access real-time Dashboard aggregations and analytics metrics.
 */
export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
