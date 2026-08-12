import React, { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { useOrg } from '../hooks/useOrg';
import { rtdbService } from '../services/rtdbService';
import { dashboardService } from '../services/dashboardService';

export const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { orgId: routeOrgId, ideaId } = useParams();
  const { org, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const orgId = routeOrgId || org?.orgId;

  useEffect(() => {
    if (orgLoading || !orgId) {
      return;
    }

    setLoading(true);

    const loadData = async () => {
      try {
        const aggregatedStats = await dashboardService.getDashboardStats(orgId, ideaId);
        const timeline = await dashboardService.getRecentActivity(orgId, ideaId);

        setStats(aggregatedStats);
        setRecentActivity(timeline);
      } catch (err) {
        console.error('[DashboardProvider] Subscription evaluation error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const unsubscribeTasks = rtdbService.subscribe(`tasks/${orgId}`, async () => {
      try {
        const aggregatedStats = await dashboardService.getDashboardStats(orgId, ideaId);
        const timeline = await dashboardService.getRecentActivity(orgId, ideaId);

        setStats(aggregatedStats);
        setRecentActivity(timeline);
      } catch (err) {
        console.error('[DashboardProvider] Subscription evaluation error:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeTasks();
  }, [orgId, ideaId, orgLoading]);

  return (
    <DashboardContext.Provider value={{ stats, recentActivity, loading: loading || orgLoading }}>
      {children}
    </DashboardContext.Provider>
  );
}

DashboardProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
