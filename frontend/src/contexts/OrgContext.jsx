import React, { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { orgService } from '../services/orgService';

export const OrgContext = createContext({
  org: null,
  members: [],
  isLeader: false,
  isFrozen: false,
  loading: true,
  error: null,
});

export function OrgProvider({ orgId, children }) {
  const { user } = useAuth();
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time Org metadata
    const unsubscribeOrg = orgService.subscribeToOrganization(orgId, (orgData) => {
      if (!orgData) {
        setError('Organization not found.');
        setOrg(null);
      } else if (orgData.isDeleted && user && orgData.ownerId !== user.uid) {
        setError('This workspace has been deleted by the owner.');
        setOrg(null);
      } else {
        setOrg(orgData);
      }
      setLoading(false);
    });

    // Subscribe to real-time Member Roster
    const unsubscribeMembers = orgService.subscribeToOrgMembers(orgId, (membersList) => {
      setMembers(membersList);
    });

    return () => {
      unsubscribeOrg();
      unsubscribeMembers();
    };
  }, [orgId]);

  const isLeader = Boolean(user && org && org.ownerId === user.uid);
  const isFrozen = Boolean(org && org.status === 'project');

  return (
    <OrgContext.Provider value={{ org, members, isLeader, isFrozen, loading, error }}>
      {children}
    </OrgContext.Provider>
  );
}

OrgProvider.propTypes = {
  orgId: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
