import React, { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useOrg } from '../hooks/useOrg';
import { rtdbService } from '../services/rtdbService';
import { dashboardService } from '../services/dashboardService';

export const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { org, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const orgId = org?.orgId;

  useEffect(() => {
    if (orgLoading || !orgId) {
      return;
    }

    setLoading(true);

    const unsubscribeTasks = rtdbService.subscribe(`tasks/${orgId}`, async () => {
      try {
        const aggregatedStats = await dashboardService.getDashboardStats(orgId);
        const timeline = await dashboardService.getRecentActivity(orgId);

        setStats(aggregatedStats);
        setRecentActivity(timeline);
      } catch (err) {
        console.error('[DashboardProvider] Subscription evaluation error:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeTasks();
  }, [orgId, orgLoading]);

  return (
    <DashboardContext.Provider value={{ stats, recentActivity, loading: loading || orgLoading }}>
      {children}
    </DashboardContext.Provider>
  );
}

DashboardProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
