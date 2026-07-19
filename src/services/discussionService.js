import { rtdbService } from './rtdbService';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Service Layer for Unified Discussion System (Comments, Suggestions, Questions, Replies).
 * Operates on nodes: discussions/{ideaId}/{discussionId}
 */
export const discussionService = {
  /**
   * Post a new discussion item or threaded reply.
   */
  createDiscussion: async (author, discussionData) => {
    const { ideaId, orgId, isPublic, type, message, parentId = null } = discussionData;

    if (!author || !author.uid) throw new Error('User authentication required.');
    if (!ideaId || !message.trim()) throw new Error('Idea ID and message content are required.');

    const discussionId = `disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const newDiscussion = {
      discussionId,
      ideaId,
      orgId: orgId || null,
      authorId: author.uid,
      authorName: author.displayName || 'Contributor',
      type: type || 'comment', // 'comment' | 'suggestion' | 'question'
      message: message.trim(),
      parentId,
      isAccepted: false, // For suggestions accepted by idea owner
      createdAt: timestamp,
      updatedAt: timestamp,
      isDeleted: false,
    };

    try {
      // Save discussion document
      await rtdbService.setData(`discussions/${ideaId}/${discussionId}`, newDiscussion);

      // Recalculate and update type counters on parent idea
      await discussionService.recalculateCounters(ideaId, isPublic, orgId);

      return newDiscussion;
    } catch (error) {
      console.error('[discussionService] createDiscussion error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Real-time subscription to discussions for an idea.
   */
  subscribeToDiscussions: (ideaId, callback) => {
    if (!ideaId) {
      callback([]);
      return () => {};
    }

    return rtdbService.subscribe(`discussions/${ideaId}`, (discussionsObj) => {
      if (!discussionsObj) {
        callback([]);
        return;
      }

      const allItems = Object.values(discussionsObj).filter((d) => d && !d.isDeleted);

      // Separate top-level items and replies
      const topLevel = allItems.filter((d) => !d.parentId);
      const replies = allItems.filter((d) => d.parentId);

      // Attach nested replies to top-level parents
      topLevel.forEach((item) => {
        item.replies = replies
          .filter((r) => r.parentId === item.discussionId)
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      });

      topLevel.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(topLevel);
    });
  },

  /**
   * Update an existing discussion item (Author only).
   */
  updateDiscussion: async (ideaId, discussionId, updates) => {
    try {
      await rtdbService.updateData(`discussions/${ideaId}/${discussionId}`, {
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[discussionService] updateDiscussion error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Soft-delete a discussion item.
   */
  deleteDiscussion: async (ideaId, discussionId, isPublic = false, orgId = null) => {
    try {
      await rtdbService.updateData(`discussions/${ideaId}/${discussionId}`, {
        isDeleted: true,
        updatedAt: Date.now(),
      });

      await discussionService.recalculateCounters(ideaId, isPublic, orgId);
    } catch (error) {
      console.error('[discussionService] deleteDiscussion error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Toggle suggestion acceptance state (Idea Owner action).
   */
  toggleAcceptSuggestion: async (ideaId, discussionId, currentAccepted) => {
    try {
      await rtdbService.updateData(`discussions/${ideaId}/${discussionId}`, {
        isAccepted: !currentAccepted,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[discussionService] toggleAcceptSuggestion error:', error);
      throw error;
    }
  },

  /**
   * Recalculate type counters on target idea.
   */
  recalculateCounters: async (ideaId, isPublic, orgId) => {
    try {
      const discObj = (await rtdbService.getData(`discussions/${ideaId}`)) || {};
      const activeItems = Object.values(discObj).filter((d) => d && !d.isDeleted);

      let commentCount = 0;
      let suggestionCount = 0;
      let questionCount = 0;

      activeItems.forEach((item) => {
        if (item.type === 'suggestion') suggestionCount++;
        else if (item.type === 'question') questionCount++;
        else commentCount++;
      });

      const ideaPath = isPublic
        ? `publicIdeas/${ideaId}`
        : `ideas/${orgId}/${ideaId}`;

      await rtdbService.updateData(ideaPath, {
        commentCount,
        suggestionCount,
        questionCount,
      });
    } catch (error) {
      console.error('[discussionService] recalculateCounters error:', error);
    }
  },
};
