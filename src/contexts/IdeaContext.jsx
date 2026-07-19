import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { useOrg } from '../hooks/useOrg';
import { ideaService } from '../services/ideaService';

export const IdeaContext = createContext({
  ideas: [],
  filteredIdeas: [],
  loading: true,
  searchQuery: '',
  setSearchQuery: () => {},
  sortBy: 'most_voted',
  setSortBy: () => {},
  createIdea: async () => {},
  updateIdea: async () => {},
  deleteIdea: async () => {},
});

export function IdeaProvider({ children }) {
  const { user } = useAuth();
  const { org } = useOrg();

  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('most_voted'); // 'most_voted' | 'newest'

  const orgId = org?.orgId;

  useEffect(() => {
    if (!orgId) {
      setIdeas([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = ideaService.subscribeToIdeas(orgId, (ideasArray) => {
      setIdeas(ideasArray);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orgId]);

  const createIdea = useCallback(
    async (ideaData) => {
      if (!orgId || !user) return;
      return await ideaService.createIdea(orgId, user, ideaData);
    },
    [orgId, user]
  );

  const updateIdea = useCallback(
    async (ideaId, updates) => {
      if (!orgId) return;
      await ideaService.updateIdea(orgId, ideaId, updates);
    },
    [orgId]
  );

  const deleteIdea = useCallback(
    async (ideaId, isMvp = false) => {
      if (!orgId) return;
      await ideaService.deleteIdea(orgId, ideaId, isMvp);
    },
    [orgId]
  );

  const updateIdeaStatus = useCallback(
    async (ideaId, newStatus) => {
      if (!orgId) return;
      return await ideaService.updateIdeaStatus(orgId, ideaId, newStatus);
    },
    [orgId]
  );

  // Client-side filtering & sorting
  const filteredIdeas = useMemo(() => {
    let list = [...ideas];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (idea) =>
          idea.title.toLowerCase().includes(q) ||
          idea.problemStatement.toLowerCase().includes(q) ||
          (idea.proposedSolution && idea.proposedSolution.toLowerCase().includes(q)) ||
          (idea.techStack && idea.techStack.toLowerCase().includes(q))
      );
    }

    // Sort order
    if (sortBy === 'newest') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else {
      // Default: Most Voted (secondary: newest)
      list.sort((a, b) => {
        const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
        if (voteDiff !== 0) return voteDiff;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }

    return list;
  }, [ideas, searchQuery, sortBy]);

  return (
    <IdeaContext.Provider
      value={{
        ideas,
        filteredIdeas,
        loading,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        createIdea,
        updateIdea,
        deleteIdea,
        updateIdeaStatus,
      }}
    >
      {children}
    </IdeaContext.Provider>
  );
}

IdeaProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
