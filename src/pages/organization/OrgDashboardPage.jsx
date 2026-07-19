import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { Spinner } from '../../components/feedback/Spinner';

export default function OrgDashboardPage() {
  const { orgId } = useParams();
  const { org, loading } = useOrg();

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const isProjectPhase = org?.status === 'project';

  if (isProjectPhase && org?.activeProjectId) {
    return <Navigate to={`/workspaces/${orgId}/ideas/${org.activeProjectId}/blueprint`} replace />;
  }

  return <Navigate to={`/workspaces/${orgId}/ideas`} replace />;
}
