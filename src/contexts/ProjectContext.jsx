import React, { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { useOrg } from '../hooks/useOrg';
import { blueprintService } from '../services/blueprintService';

export const ProjectContext = createContext({
  blueprint: null,
  loading: true,
  selectWinningIdea: async () => {},
});

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const { org } = useOrg();

  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);

  const orgId = org?.orgId;

  useEffect(() => {
    if (!orgId) {
      setBlueprint(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = blueprintService.subscribeToBlueprint(orgId, (bpData) => {
      setBlueprint(bpData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orgId]);

  const selectWinningIdea = useCallback(
    async (winningIdeaId) => {
      if (!user || !orgId) return;
      return await blueprintService.selectWinningIdea(user.uid, orgId, winningIdeaId);
    },
    [user, orgId]
  );

  return (
    <ProjectContext.Provider value={{ blueprint, loading, selectWinningIdea }}>
      {children}
    </ProjectContext.Provider>
  );
}

ProjectProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
