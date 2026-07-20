import { rtdbService } from './rtdbService';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Service Layer for MVP Selection & Project Blueprint Generation.
 * Manages atomic transition from Ideation Phase to Project Phase.
 */
export const blueprintService = {
  /**
   * Select winning MVP idea and execute atomic multi-path phase transition (Owner only).
   */
  selectWinningIdea: async (leaderUid, orgId, winningIdeaId) => {
    if (!leaderUid || !orgId || !winningIdeaId) {
      throw new Error('Leader UID, Organization ID, and Winning Idea ID are required.');
    }

    // Enforce Platform Settings Validation
    const platformSettings = await rtdbService.getData('platform_settings');
    if (platformSettings?.ideas?.enableMvpSelection === false) {
      throw new Error('MVP Selection workflow has been disabled by the platform administrator.');
    }
    if (platformSettings?.ideas?.enableBlueprint === false || platformSettings?.featureFlags?.blueprint === false) {
      throw new Error('AI Blueprint generation has been disabled by the platform administrator.');
    }

    try {
      // 1. Verify Leader permission & current Org status
      const org = await rtdbService.getData(`organizations/${orgId}`);
      if (!org) throw new Error('Organization not found.');
      if (org.ownerId !== leaderUid) {
        throw new Error('Only the Organization Owner can select the winning MVP.');
      }
      if (org.status === 'project') {
        throw new Error('An active project has already been selected for this workspace.');
      }

      // 2. Fetch winning idea snapshot
      const winningIdea = await rtdbService.getData(`ideas/${orgId}/${winningIdeaId}`);
      if (!winningIdea) throw new Error('Selected idea not found.');

      // 3. Fetch discussions for blueprint summary
      const discussionsObj = (await rtdbService.getData(`discussions/${winningIdeaId}`)) || {};
      const activeDiscussions = Object.values(discussionsObj).filter((d) => d && !d.isDeleted);

      const commentCount = activeDiscussions.filter((d) => d.type === 'comment' || !d.type).length;
      const suggestionCount = activeDiscussions.filter((d) => d.type === 'suggestion').length;
      const acceptedSuggestions = activeDiscussions.filter((d) => d.type === 'suggestion' && d.isAccepted);

      const timestamp = Date.now();

      // 4. Build Blueprint Document
      const blueprintData = {
        blueprintId: orgId,
        orgId,
        ideaId: winningIdeaId,
        ideaTitle: winningIdea.title,
        problemStatement: winningIdea.problemStatement,
        proposedSolution: winningIdea.proposedSolution || '',
        techStack: winningIdea.techStack || '',
        difficultyLevel: winningIdea.difficultyLevel || 'Medium',
        authorId: winningIdea.authorId,
        authorName: winningIdea.authorName,
        selectedBy: leaderUid,
        selectedAt: timestamp,
        status: 'Planning', // 'Planning' | 'In Progress' | 'Completed'
        voteSummary: {
          totalVotes: winningIdea.voteCount || 0,
        },
        discussionSummary: {
          commentCount,
          suggestionCount,
          acceptedSuggestionsCount: acceptedSuggestions.length,
          acceptedSuggestionsList: acceptedSuggestions.map((s) => ({
            message: s.message,
            authorName: s.authorName,
          })),
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // 5. Save Blueprint
      await rtdbService.setData(`blueprints/${orgId}`, blueprintData);

      // 6. Archive other organization ideas & mark winning idea as selected
      const allOrgIdeas = (await rtdbService.getData(`ideas/${orgId}`)) || {};
      for (const [id, ideaObj] of Object.entries(allOrgIdeas)) {
        if (id === winningIdeaId) {
          await rtdbService.updateData(`ideas/${orgId}/${id}`, {
            isSelected: true,
            status: 'selected',
            updatedAt: timestamp,
          });
        } else {
          await rtdbService.updateData(`ideas/${orgId}/${id}`, {
            status: 'archived',
            updatedAt: timestamp,
          });
        }
      }

      // 7. Atomic Phase Shift on Organization Document
      await rtdbService.updateData(`organizations/${orgId}`, {
        status: 'project',
        activeProjectId: winningIdeaId,
        updatedAt: timestamp,
      });

      return blueprintData;
    } catch (error) {
      console.error('[blueprintService] selectWinningIdea error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Fetch single Project Blueprint snapshot.
   */
  getBlueprint: async (orgId) => {
    if (!orgId) return null;
    return await rtdbService.getData(`blueprints/${orgId}`);
  },

  /**
   * Real-time subscription to Project Blueprint document.
   */
  subscribeToBlueprint: (orgId, callback) => {
    if (!orgId) {
      callback(null);
      return () => {};
    }
    return rtdbService.subscribe(`blueprints/${orgId}`, callback);
  },
};
