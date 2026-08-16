import { rtdbService } from './rtdbService';
import { apiClient } from './apiClient';
import { getErrorMessage } from '../utils/errorMessages';
import { generateBlueprintPdf } from './blueprintPdfGenerator.js';

/**
 * Helper to deliver a generated Blob file across Desktop and Mobile Browsers safely.
 */
async function deliverFile(blob, filename, mimeType) {
  try {
    const file = new File([blob], filename, { type: mimeType });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return { success: true, method: 'share' };
    }
  } catch (shareErr) {
    if (shareErr.name === 'AbortError') {
      return { success: true, method: 'cancelled' };
    }
    console.warn('[aiBlueprintService] Web Share API skipped/failed:', shareErr);
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    setTimeout(() => {
      try {
        const newWin = window.open(url, '_blank');
        if (!newWin) {
          window.location.href = url;
        }
      } catch (e) {
        console.warn('[aiBlueprintService] Mobile window open fallback:', e);
      }
    }, 300);
  }

  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 10000);

  return { success: true, method: 'download' };
}

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
  /**
   * Phase 6: Client-facing method to export validated Blueprint JSON.
   */
  exportBlueprintJson: async (workspaceId, userUid, targetVersion = null, localBlueprint = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }
    let jsonString = '';
    let filename = '';

    if (localBlueprint && localBlueprint.content) {
      jsonString = JSON.stringify(localBlueprint, null, 2);
      const safeTitle = String(localBlueprint.ideaTitle || 'project')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'project';
      filename = `convia-blueprint-${safeTitle}-v${localBlueprint.version || '1.0'}.json`;
    } else {
      const result = await apiClient.post('/api/blueprint/export-json', { workspaceId, userUid, targetVersion });
      jsonString = result.jsonString || JSON.stringify(result.exportData, null, 2);
      filename = result.filename || 'convia-blueprint.json';
    }

    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    await deliverFile(blob, filename, 'application/json');

    return { success: true, filename };
  },

  /**
   * Phase 6: Client-facing method to export validated Blueprint PDF.
   */
  exportBlueprintPdf: async (workspaceId, userUid, orgName = 'Workspace', targetVersion = null, localBlueprint = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    let blueprintDoc = localBlueprint;
    let filename = '';

    if (!blueprintDoc || !blueprintDoc.content) {
      const jsonResult = await apiClient.post('/api/blueprint/export-json', { workspaceId, userUid, targetVersion });
      blueprintDoc = jsonResult.exportData;
    }

    const pdfResult = generateBlueprintPdf(blueprintDoc, orgName);
    const doc = pdfResult.doc;
    filename = pdfResult.filename;

    const pdfBlob = doc.output('blob');
    await deliverFile(pdfBlob, filename, 'application/pdf');

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
