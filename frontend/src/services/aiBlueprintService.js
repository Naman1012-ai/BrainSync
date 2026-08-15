import { rtdbService } from './rtdbService';
import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorMessages';
import { generateBlueprintPdf } from './blueprintPdfGenerator.js';

/**
 * Service Layer for AI Blueprint Preparation & Context Formatting.
 * Acts as the boundary between Frontend UI and Backend Express Server.
 */
export const aiBlueprintService = {
  /**
   * Client-facing method to trigger AI Blueprint Generation via backend endpoint.
   */
  generateBlueprint: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/generate', { workspaceId, userUid });
  },

  /**
   * Phase 7: Client-facing method to rescue/recover stale generation attempts.
   */
  recoverStaleGeneration: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/recover', { workspaceId, userUid });
  },

  /**
   * Client-facing method to save manual Blueprint updates via backend endpoint.
   */
  updateBlueprint: async (workspaceId, userUid, updatedContent) => {
    if (!workspaceId || !userUid || !updatedContent) {
      throw new Error('Workspace ID, User UID, and Updated Content payload are required.');
    }
    return await apiClient.put('/api/blueprint/update', { workspaceId, userUid, updatedContent });
  },

  /**
   * Phase 6: Client-facing method to export validated Blueprint JSON.
   */
  exportBlueprintJson: async (workspaceId, userUid, targetVersion = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    const result = await apiClient.post('/api/blueprint/export-json', { workspaceId, userUid, targetVersion });

    const blob = new Blob([result.jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', result.filename);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1000);

    return result;
  },

  /**
   * Phase 6: Client-facing method to export validated Blueprint PDF.
   */
  exportBlueprintPdf: async (workspaceId, userUid, orgName = 'Workspace', targetVersion = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const jsonResult = await apiClient.post('/api/blueprint/export-json', { workspaceId, userUid, targetVersion });
    const blueprintDoc = jsonResult.exportData;

    const { doc, filename } = generateBlueprintPdf(blueprintDoc, orgName);

    try {
      doc.save(filename);
    } catch (err) {
      console.warn('[aiBlueprintService] standard doc.save failed, using blob fallback for mobile:', err);
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 1000);
    }

    return {
      success: true,
      filename,
    };
  },

  /**
   * Client-facing method to trigger standalone Community Intelligence Analysis.
   */
  analyzeCommunityIntelligence: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    return await apiClient.post('/api/blueprint/analyze-community', { workspaceId, userUid });
  },

  /**
   * Extract & sanitize context from workspace, members, and discussions
   * to conform strictly to the AiBlueprintInputContract.
   */
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

      const inputContractPayload = {
        ideaTitle: (mvpIdea.title || '').trim(),
        problemStatement: (mvpIdea.problemStatement || '').trim(),
        description: (mvpIdea.proposedSolution || mvpIdea.description || mvpIdea.problemStatement || '').trim(),
        techStack: (mvpIdea.techStack || '').trim() || undefined,
        teamMembers,
        suggestions,
        comments,
        questions,
      };

      return inputContractPayload;
    } catch (error) {
      console.error('[aiBlueprintService] prepareAiInputContext error:', error);
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Create or update initial Blueprint metadata record (state: 'not_created').
   */
  initializeBlueprintRecord: async (workspaceId, mvpIdea, userUid) => {
    if (!workspaceId || !mvpIdea) return null;

    const timestamp = Date.now();
    const blueprintData = {
      blueprintId: `bp_${workspaceId}_${mvpIdea.ideaId}`,
      workspaceId,
      orgId: workspaceId,
      mvpIdeaId: mvpIdea.ideaId,
      ideaId: mvpIdea.ideaId,
      version: '1.0',
      status: 'not_created',
      
      aiProvider: null,
      aiModel: null,
      generatedAt: null,
      updatedAt: timestamp,
      generatedBy: null,
      createdBy: userUid || null,
      createdAt: timestamp,

      ideaTitle: mvpIdea.title || '',
      problemStatement: mvpIdea.problemStatement || '',
      description: mvpIdea.proposedSolution || mvpIdea.description || '',
      techStack: mvpIdea.techStack || '',
      authorId: mvpIdea.authorId || mvpIdea.createdBy || '',
      authorName: mvpIdea.authorName || 'Team Member',

      discussionSummary: {
        commentCount: mvpIdea.commentCount || 0,
        suggestionCount: mvpIdea.suggestionCount || 0,
        acceptedSuggestionsCount: 0,
        acceptedSuggestionsList: [],
      },
    };

    await Promise.all([
      rtdbService.setData(`blueprints/${workspaceId}/${mvpIdea.ideaId}`, blueprintData),
      rtdbService.setData(`blueprints/${workspaceId}/current`, blueprintData),
      rtdbService.setData(`blueprints/${workspaceId}`, blueprintData),
    ]);

    return blueprintData;
  },
};
