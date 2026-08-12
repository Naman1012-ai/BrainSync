import React, { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { discussionService } from '../services/discussionService';

export const DiscussionContext = createContext({
  discussions: [],
  loading: true,
  createDiscussion: async () => {},
  replyToDiscussion: async () => {},
  updateDiscussion: async () => {},
  deleteDiscussion: async () => {},
  toggleAcceptSuggestion: async () => {},
});

export function DiscussionProvider({ ideaId, isPublic = false, orgId = null, children }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ideaId) {
      setDiscussions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = discussionService.subscribeToDiscussions(ideaId, (items) => {
      setDiscussions(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ideaId]);

  const createDiscussion = useCallback(
    async (type, message) => {
      if (!user || !ideaId) return;
      try {
        const res = await discussionService.createDiscussion(user, {
          ideaId,
          orgId,
          isPublic,
          type,
          message,
          parentId: null,
        });
        toast.success(type === 'suggestion' ? 'Suggestion posted!' : 'Comment posted!');
        return res;
      } catch (err) {
        toast.error(err.message || 'Failed to post message.');
      }
    },
    [user, ideaId, orgId, isPublic, toast]
  );

  const replyToDiscussion = useCallback(
    async (parentId, message) => {
      if (!user || !ideaId || !parentId) return;
      try {
        const res = await discussionService.createDiscussion(user, {
          ideaId,
          orgId,
          isPublic,
          type: 'comment',
          message,
          parentId,
        });
        toast.success('Reply added!');
        return res;
      } catch (err) {
        toast.error(err.message || 'Failed to post reply.');
      }
    },
    [user, ideaId, orgId, isPublic, toast]
  );

  const updateDiscussion = useCallback(
    async (discussionId, updates) => {
      if (!ideaId) return;
      try {
        await discussionService.updateDiscussion(ideaId, discussionId, updates);
        toast.success('Updated successfully.');
      } catch (err) {
        toast.error(err.message || 'Failed to update.');
      }
    },
    [ideaId, toast]
  );

  const deleteDiscussion = useCallback(
    async (discussionId) => {
      if (!ideaId) return;
      try {
        await discussionService.deleteDiscussion(ideaId, discussionId, isPublic, orgId);
        toast.info('Item deleted.');
      } catch (err) {
        toast.error(err.message || 'Failed to delete.');
      }
    },
    [ideaId, isPublic, orgId, toast]
  );

  const toggleAcceptSuggestion = useCallback(
    async (discussionId, currentAccepted) => {
      if (!ideaId) return;
      try {
        await discussionService.toggleAcceptSuggestion(ideaId, discussionId, currentAccepted);
        toast.success(!currentAccepted ? 'Suggestion accepted!' : 'Suggestion unmarked.');
      } catch (err) {
        toast.error(err.message || 'Failed to update suggestion status.');
      }
    },
    [ideaId, toast]
  );

  return (
    <DiscussionContext.Provider
      value={{
        discussions,
        loading,
        createDiscussion,
        replyToDiscussion,
        updateDiscussion,
        deleteDiscussion,
        toggleAcceptSuggestion,
      }}
    >
      {children}
    </DiscussionContext.Provider>
  );
}

DiscussionProvider.propTypes = {
  ideaId: PropTypes.string.isRequired,
  isPublic: PropTypes.bool,
  orgId: PropTypes.string,
  children: PropTypes.node.isRequired,
};
