import React, { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { voteService } from '../services/voteService';

export const VotingContext = createContext({
  userVotes: {}, // Map of ideaId -> boolean (voted)
  toggleVote: async () => {},
  hasVoted: () => false,
});

export function VotingProvider({ children }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userVotes, setUserVotes] = useState({});

  const toggleVote = useCallback(
    async (ideaId, isPublic = false, orgId = null) => {
      if (!user || !ideaId) return;
      try {
        const result = await voteService.toggleVote(ideaId, user.uid, isPublic, orgId);
        setUserVotes((prev) => ({
          ...prev,
          [ideaId]: result.voted,
        }));
        if (result.voted) {
          toast.success('Vote recorded!');
        } else {
          toast.info('Vote removed.');
        }
        return result;
      } catch (err) {
        toast.error(err.message || 'Failed to record vote.');
      }
    },
    [user, toast]
  );

  const hasVoted = useCallback(
    (ideaId) => Boolean(userVotes[ideaId]),
    [userVotes]
  );

  return (
    <VotingContext.Provider value={{ userVotes, toggleVote, hasVoted }}>
      {children}
    </VotingContext.Provider>
  );
}

VotingProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
