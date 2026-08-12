import { rtdbService } from './rtdbService.js';

/**
 * Backend AI Blueprint Context Preparation Helper.
 */
export const aiBlueprintService = {
  prepareAiInputContext: async (workspaceId, mvpIdea) => {
    if (!workspaceId || !mvpIdea) {
      throw new Error('Workspace ID and MVP Idea snapshot are required.');
    }

    try {
      const membersObj = (await rtdbService.getData(`organization_members/${workspaceId}`)) || {};
      const memberUids = Object.keys(membersObj);

      const teamMembers = [];
      for (const uid of memberUids) {
        const userProfile = (await rtdbService.getData(`users/${uid}`)) || {};
        const memberMeta = membersObj[uid] || {};
        teamMembers.push({
          id: uid,
          name: userProfile.displayName || userProfile.email || 'Team Member',
          role: memberMeta.role || 'Contributor',
        });
      }

      const discussionsObj = (await rtdbService.getData(`discussions/${mvpIdea.ideaId}`)) || {};
      const allDiscussions = Object.values(discussionsObj).filter((d) => d && !d.isDeleted);

      const suggestions = [];
      const comments = [];
      const questions = [];

      for (const item of allDiscussions) {
        const cleanItem = {
          id: item.discussionId || item.id,
          authorName: item.authorName || 'Collaborator',
          message: (item.message || '').trim(),
          isAccepted: Boolean(item.isAccepted),
          createdAt: item.createdAt || Date.now(),
        };

        if (item.type === 'suggestion') {
          suggestions.push(cleanItem);
        } else if (item.type === 'question') {
          questions.push(cleanItem);
        } else {
          comments.push(cleanItem);
        }
      }

      return {
        ideaTitle: (mvpIdea.title || '').trim(),
        problemStatement: (mvpIdea.problemStatement || '').trim(),
        description: (mvpIdea.proposedSolution || mvpIdea.description || mvpIdea.problemStatement || '').trim(),
        techStack: (mvpIdea.techStack || '').trim() || undefined,
        teamMembers,
        suggestions,
        comments,
        questions,
      };
    } catch (error) {
      console.error('[backend aiBlueprintService] prepareAiInputContext error:', error);
      throw error;
    }
  },
};
