import { rtdbService } from './rtdbService';

/**
 * Complete Service Layer for Voting & Consensus Engine.
 * Operates on nodes: votes/{ideaId}_{uid} and updates voteCount on target idea.
 */
export const voteService = {
  /**
   * Cast a vote on an idea.
   */
  castVote: async (ideaId, uid, isPublic = false, orgId = null, voteValue = 1) => {
    return await voteService.toggleVote(ideaId, uid, isPublic, orgId, voteValue);
  },

  /**
   * Update an existing vote (e.g. change voteValue or timestamp).
   */
  updateVote: async (ideaId, uid, updates) => {
    const voteKey = `${ideaId}_${uid}`;
    try {
      await rtdbService.updateData(`votes/${voteKey}`, {
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('[voteService] updateVote error:', error);
      throw error;
    }
  },

  /**
   * Remove a user vote explicitly.
   */
  removeVote: async (ideaId, uid, isPublic = false, orgId = null) => {
    if (!ideaId || !uid) return;
    const voteKey = `${ideaId}_${uid}`;
    const ideaPath = isPublic
      ? `publicIdeas/${ideaId}`
      : `ideas/${orgId}/${ideaId}`;

    try {
      await rtdbService.setData(`votes/${voteKey}`, null);
      const targetIdea = await rtdbService.getData(ideaPath);
      if (targetIdea) {
        const newCount = Math.max(0, (targetIdea.voteCount || 1) - 1);
        await rtdbService.updateData(ideaPath, { voteCount: newCount });
      }
    } catch (error) {
      console.error('[voteService] removeVote error:', error);
      throw error;
    }
  },

  /**
   * Get total votes count snapshot for an idea.
   */
  getVotes: async (ideaId, isPublic = false, orgId = null) => {
    const ideaPath = isPublic
      ? `publicIdeas/${ideaId}`
      : `ideas/${orgId}/${ideaId}`;
    const targetIdea = await rtdbService.getData(ideaPath);
    return targetIdea?.voteCount || 0;
  },

  /**
   * Get a user's single vote snapshot.
   */
  getUserVote: async (ideaId, uid) => {
    if (!ideaId || !uid) return null;
    return await rtdbService.getData(`votes/${ideaId}_${uid}`);
  },

  /**
   * Toggle user vote on an idea (public or org idea).
   */
  toggleVote: async (ideaId, uid, isPublic = false, orgId = null, voteValue = 1) => {
    if (!ideaId || !uid) throw new Error('Idea ID and User ID are required to vote.');

    const voteKey = `${ideaId}_${uid}`;
    const votePath = `votes/${voteKey}`;
    const ideaPath = isPublic
      ? `publicIdeas/${ideaId}`
      : `ideas/${orgId}/${ideaId}`;

    try {
      const existingVote = await rtdbService.getData(votePath);
      const targetIdea = await rtdbService.getData(ideaPath);

      if (!targetIdea) throw new Error('Idea not found.');

      const currentVoteCount = targetIdea.voteCount || 0;

      if (existingVote) {
        // Remove vote
        await rtdbService.setData(votePath, null);
        const newCount = Math.max(0, currentVoteCount - 1);
        await rtdbService.updateData(ideaPath, { voteCount: newCount, updatedAt: Date.now() });
        return { voted: false, voteCount: newCount };
      } else {
        // Cast vote
        const timestamp = Date.now();
        await rtdbService.setData(votePath, {
          voteId: voteKey,
          ideaId,
          orgId: orgId || null,
          uid,
          voteValue,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

        const newCount = currentVoteCount + 1;
        await rtdbService.updateData(ideaPath, { voteCount: newCount, updatedAt: timestamp });
        return { voted: true, voteCount: newCount };
      }
    } catch (error) {
      console.error('[voteService] toggleVote error:', error);
      throw error;
    }
  },

  /**
   * Check if user has voted on an idea.
   */
  hasUserVoted: async (ideaId, uid) => {
    if (!ideaId || !uid) return false;
    const vote = await rtdbService.getData(`votes/${ideaId}_${uid}`);
    return Boolean(vote);
  },

  /**
   * Subscribe to real-time user vote status for an idea.
   */
  subscribeToUserVote: (ideaId, uid, callback) => {
    if (!ideaId || !uid) {
      callback(false);
      return () => {};
    }
    return rtdbService.subscribe(`votes/${ideaId}_${uid}`, (voteData) => {
      callback(Boolean(voteData));
    });
  },
};
