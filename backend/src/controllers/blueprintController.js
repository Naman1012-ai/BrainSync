import { rtdbService } from '../services/rtdbService.js';
import { aiBlueprintService } from '../services/aiBlueprintService.js';
import { geminiService } from '../services/ai/geminiService.js';
import { validateBlueprintOutput } from '../services/ai/blueprintValidator.js';

/**
 * Helper function to sanitize project title for safe filesystem download naming.
 */
function sanitizeFilename(title = 'Project', version = '1.0', ext = 'json') {
  const safeTitle = String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project';
  const safeVersion = String(version).replace(/[^a-zA-Z0-9.-]/g, '');
  return `convia-blueprint-${safeTitle}-v${safeVersion}.${ext}`;
}

/**
 * Backend Controller for Blueprint & Community Intelligence Operations (Phases 3, 4, 5, 6 & 7).
 * Manages server-side verification, dynamic MVP source-of-truth validation,
 * duplicate generation locks, stale generation recovery, versioning, manual editing persistence,
 * export validation, fail-safe error handling, and server logging.
 */
export const blueprintController = {
  /**
   * Phase 7: Stale Generation Recovery Handler.
   * Auto-detects and rescues generation attempts stuck in 'generating' state longer than 90s.
   */
  recoverStaleGenerationHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const memberRecord = (await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`)) ||
                         (await rtdbService.getData(`workspace_members/${workspaceId}/${userUid}`));
    const org = (await rtdbService.getData(`organizations/${workspaceId}`)) ||
                (await rtdbService.getData(`workspaces/${workspaceId}`));

    if (!org) {
      throw new Error('Workspace does not exist.');
    }
    const isOwner = org.ownerId === userUid || org.createdBy === userUid || org.ownerUid === userUid;
    const isMember = Boolean(memberRecord || isOwner || (org.members && org.members[userUid]));

    if (!isMember) {
      throw new Error('Unauthorized. You must be a member of this workspace to recover a Blueprint.');
    }

    let activeMvpId = org.activeProjectId || org.selectedIdeaId || org.activeMvpId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId || meta?.activeMvpId;
    }

    if (!activeMvpId) return { recovered: false, reason: 'No active MVP' };

    const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || 
                       (await rtdbService.getData(`blueprints/${workspaceId}`));

    if (!existingBp) return { recovered: false, reason: 'No blueprint record found' };

    // Check if stuck in 'generating' state for > 90 seconds
    const STALE_THRESHOLD_MS = 90000;
    const isStale = existingBp.status === 'generating' && (Date.now() - (existingBp.updatedAt || existingBp.generationStartedAt || 0)) > STALE_THRESHOLD_MS;

    if (isStale) {
      console.warn(`🩹 [Stale Generation Recovery] Rescuing stuck Blueprint generation for workspace ${workspaceId} (MVP: ${activeMvpId})`);

      const timestamp = Date.now();
      const hasPriorValidContent = Boolean(existingBp.content);
      const recoveredStatus = hasPriorValidContent ? 'completed' : 'failed';
      const recoveryMessage = 'Previous generation timed out or was interrupted. Click Regenerate to try again.';

      const recoveryPayload = {
        ...existingBp,
        status: recoveredStatus,
        updatedAt: timestamp,
        generationFailedAt: timestamp,
        lastError: recoveryMessage,
      };

      await Promise.all([
        rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, recoveryPayload),
        rtdbService.setData(`blueprints/${workspaceId}/current`, recoveryPayload),
        rtdbService.setData(`blueprints/${workspaceId}`, recoveryPayload),
      ]);

      console.log(`✅ [Stale Generation Rescued] Workspace ${workspaceId} Blueprint state transitioned to '${recoveredStatus}'.`);
      return { recovered: true, newStatus: recoveredStatus, blueprint: recoveryPayload };
    }

    return { recovered: false, status: existingBp.status };
  },

  /**
   * Protected endpoint handler for generating/regenerating AI Blueprints (Phase 3 & Phase 7).
   */
  generateBlueprintHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      console.warn('⚠️ [Blueprint Generation Failed] Missing workspaceId or userUid context');
      throw new Error('Workspace ID and User context are required.');
    }

    console.log(`🚀 [Blueprint Generation Started] Workspace: ${workspaceId} | Triggered By User: ${userUid}`);

    // Helper for retry/polling lookup to handle initial Firebase write latency
    const fetchOrgWithRetry = async (id, maxRetries = 3, delayMs = 500) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🔍 [Workspace Lookup] Querying RTDB paths 'organizations/${id}' & 'workspaces/${id}' (Attempt ${attempt}/${maxRetries})`);
        
        const orgData = (await rtdbService.getData(`organizations/${id}`)) ||
                        (await rtdbService.getData(`workspaces/${id}`));
        
        if (orgData) {
          console.log(`✅ [Workspace Found] Successfully resolved workspace snapshot for '${id}' on attempt ${attempt}`);
          return orgData;
        }

        if (attempt < maxRetries) {
          console.warn(`⏳ [Workspace Write Latency] Workspace '${id}' not found yet on attempt ${attempt}. Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      return null;
    };

    // 1. Verify User Membership in Workspace (with 3-attempt polling retry)
    const org = await fetchOrgWithRetry(workspaceId);

    if (!org) {
      console.warn(`❌ [Blueprint Generation Failed] Workspace '${workspaceId}' not found after 3 retries across paths: 'organizations/${workspaceId}' and 'workspaces/${workspaceId}' (404)`);
      throw new Error(`Workspace '${workspaceId}' does not exist or has not synchronized yet.`);
    }

    const memberRecord = (await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`)) ||
                         (await rtdbService.getData(`workspace_members/${workspaceId}/${userUid}`));

    const isOwner = org.ownerId === userUid || org.createdBy === userUid || org.ownerUid === userUid;
    const isMember = Boolean(memberRecord || isOwner || (org.members && org.members[userUid]));

    if (!isMember) {
      console.warn(`❌ [Blueprint Generation Denied] User ${userUid} is not a member of workspace ${workspaceId} (403)`);
      throw new Error('Unauthorized. You must be a member of this workspace to generate a Blueprint.');
    }

    // 2. Resolve Source of Truth Active MVP Idea from RTDB
    let activeMvpId = org.activeProjectId || org.selectedIdeaId || org.activeMvpId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId || meta?.activeMvpId;
    }

    if (!activeMvpId) {
      const ideasObj = (await rtdbService.getData(`ideas/${workspaceId}`)) || {};
      const selectedIdea = Object.values(ideasObj).find(
        (i) => i && !i.isDeleted && (i.isSelected || i.status === 'selected' || i.status === 'Selected MVP' || i.projectStatus === 'Selected MVP')
      );
      if (selectedIdea) {
        activeMvpId = selectedIdea.ideaId || selectedIdea.id;
      }
    }

    if (!activeMvpId) {
      console.warn(`⚠️ [Blueprint Generation Stopped] No selected MVP found for workspace ${workspaceId}`);
      throw new Error('No MVP selected for this workspace. Please select an idea as MVP on the Idea Board.');
    }

    let mvpIdea = await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`);
    if (!mvpIdea) {
      const ideasObj = (await rtdbService.getData(`ideas/${workspaceId}`)) || {};
      mvpIdea = ideasObj[activeMvpId] || Object.values(ideasObj).find((i) => i && (i.ideaId === activeMvpId || i.id === activeMvpId));
    }

    if (!mvpIdea || mvpIdea.isDeleted) {
      console.warn(`❌ [Blueprint Generation Stopped] Selected MVP ${activeMvpId} missing or deleted in workspace ${workspaceId}`);
      throw new Error('The selected MVP idea could not be found or has been deleted.');
    }

    console.log(`📌 [Selected MVP Identified] Idea ID: ${activeMvpId} | Title: "${mvpIdea.title}" | Workspace: ${workspaceId}`);

    const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || 
                       (await rtdbService.getData(`blueprints/${workspaceId}`));

    const rawVersions = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`)) ||
                        (await rtdbService.getData(`blueprints/${workspaceId}/versions`)) ||
                        existingBp?.versions ||
                        {};

    const versionNumbers = [];
    if (existingBp?.version) {
      const v = parseFloat(existingBp.version);
      if (!isNaN(v)) versionNumbers.push(v);
    }
    Object.keys(rawVersions || {}).forEach((k) => {
      const verStr = rawVersions[k]?.version || k.replace(/^v/, '').replace(/_/g, '.');
      const v = parseFloat(verStr);
      if (!isNaN(v)) versionNumbers.push(v);
    });

    const maxVersion = versionNumbers.length > 0 ? Math.max(...versionNumbers) : 0;
    const nextVersion = maxVersion > 0 ? (maxVersion + 1.0).toFixed(1) : '1.0';
    const isRegeneration = maxVersion >= 1.0;

    if (existingBp?.status === 'generating') {
      const isStaleLock = Date.now() - (existingBp.updatedAt || existingBp.generationStartedAt || 0) > 90000;
      if (!isStaleLock) {
        console.warn(`🔒 [Duplicate Generation Prevented] Generation already in progress for workspace ${workspaceId}`);
        throw new Error('Blueprint generation is already in progress for this workspace.');
      }
    }

    const timestamp = Date.now();
    const attemptId = `bp_gen_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    await Promise.all([
      rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
        status: 'generating',
        updatedAt: timestamp,
        generationStartedAt: timestamp,
        generationAttemptId: attemptId,
      }),
      rtdbService.updateData(`blueprints/${workspaceId}`, {
        status: 'generating',
        updatedAt: timestamp,
        generationStartedAt: timestamp,
        generationAttemptId: attemptId,
      }),
    ]);

    try {
      const aiInputPayload = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);
      aiInputPayload.isRegeneration = isRegeneration;
      aiInputPayload.nextVersion = nextVersion;

      console.log(`🤖 [AI Generation Requested] Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'} | Version: ${nextVersion} (Regeneration: ${isRegeneration}) | Workspace: ${workspaceId}`);

      const geminiResult = await geminiService.generateBlueprintFromContext(aiInputPayload);
      console.log(`✨ [AI Response Received & Schema Validated] 16 Sections confirmed for workspace ${workspaceId} (v${nextVersion})`);

      const versionKey = `v${nextVersion.replace(/\./g, '_')}`;

      const completeBlueprintDocument = {
        blueprintId: `bp_${workspaceId}_${activeMvpId}`,
        workspaceId,
        orgId: workspaceId,
        mvpIdeaId: activeMvpId,
        ideaId: activeMvpId,
        versionId: nextVersion,
        activeVersionId: nextVersion,
        activeVersionKey: versionKey,
        version: nextVersion,
        status: 'completed',
        timestamp: Date.now(),
        lastModifiedSource: 'ai_generation',
        
        aiProvider: geminiResult.aiProvider,
        aiModel: geminiResult.aiModel,
        generatedAt: Date.now(),
        updatedAt: Date.now(),
        generationCompletedAt: Date.now(),
        generatedBy: userUid,
        createdAt: existingBp?.createdAt || timestamp,

        ideaTitle: mvpIdea.title,
        problemStatement: mvpIdea.problemStatement,
        description: mvpIdea.proposedSolution || mvpIdea.description || '',
        techStack: mvpIdea.techStack || '',
        authorId: mvpIdea.authorId,
        authorName: mvpIdea.authorName,

        content: geminiResult.blueprintContent,
        communityIntelligence: existingBp?.communityIntelligence || null,
        communityIntelligenceStatus: existingBp?.communityIntelligenceStatus || 'not_analyzed',

        discussionSummary: {
          commentCount: aiInputPayload.comments.length,
          suggestionCount: aiInputPayload.suggestions.length,
          questionCount: aiInputPayload.questions.length,
          acceptedSuggestionsCount: aiInputPayload.suggestions.filter((s) => s.isAccepted).length,
          acceptedSuggestionsList: aiInputPayload.suggestions.filter((s) => s.isAccepted).map((s) => ({
            message: s.message,
            authorName: s.authorName,
          })),
        },
      };

      console.log(`💾 [Blueprint Persistence Started] Saving Version ${nextVersion} to RTDB version history...`);

      const existingVersions = { ...rawVersions };

      if (existingBp && existingBp.version && existingBp.content) {
        const prevVersionKey = `v${String(existingBp.version).replace(/\./g, '_')}`;
        const prevSnapshot = { ...existingBp };
        delete prevSnapshot.versions;
        existingVersions[prevVersionKey] = prevSnapshot;
      }

      const newSnapshot = { ...completeBlueprintDocument };
      delete newSnapshot.versions;
      existingVersions[versionKey] = newSnapshot;

      completeBlueprintDocument.versions = existingVersions;

      const savePromises = [
        rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, completeBlueprintDocument),
        rtdbService.setData(`blueprints/${workspaceId}/current`, completeBlueprintDocument),
        rtdbService.setData(`blueprints/${workspaceId}`, completeBlueprintDocument),
      ];

      for (const [vKey, vSnap] of Object.entries(existingVersions)) {
        savePromises.push(rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${vKey}`, vSnap));
        savePromises.push(rtdbService.setData(`blueprints/${workspaceId}/versions/${vKey}`, vSnap));
      }

      await Promise.all(savePromises);

      console.log(`🎉 [Blueprint Generation Completed] Version ${nextVersion} successfully saved to version history for workspace ${workspaceId}`);

      return {
        success: true,
        blueprint: completeBlueprintDocument,
      };
    } catch (error) {
      console.error(`💥 [Blueprint Generation Failed] Workspace: ${workspaceId} | Reason:`, error.message);

      const errTimestamp = Date.now();

      if (existingBp && existingBp.status === 'completed' && existingBp.content) {
        await Promise.all([
          rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
            status: 'completed',
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: error.message || 'Blueprint generation failed. Previous version preserved.',
          }),
          rtdbService.updateData(`blueprints/${workspaceId}`, {
            status: 'completed',
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: error.message || 'Blueprint generation failed. Previous version preserved.',
          }),
        ]);
        console.log(`🛡️ [Fail-Safe Preservation] Preserved existing Version ${existingBp.version} for workspace ${workspaceId}`);
      } else {
        await Promise.all([
          rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
            status: 'failed',
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: error.message || 'Blueprint generation failed.',
          }),
          rtdbService.updateData(`blueprints/${workspaceId}`, {
            status: 'failed',
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: error.message || 'Blueprint generation failed.',
          }),
        ]);
      }

      throw new Error('Blueprint generation failed. Please try again.');
    }
  },

  /**
   * Phase 5: Protected Endpoint Handler for Saving Manual Blueprint Edits.
   */
  updateBlueprintHandler: async (workspaceId, userUid, updatedContent) => {
    if (!workspaceId || !userUid || !updatedContent) {
      throw new Error('Workspace ID, User UID, and Updated Content payload are required.');
    }

    console.log(`✏️ [Blueprint Manual Update Started] Workspace: ${workspaceId} | User: ${userUid}`);

    const memberRecord = await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`);
    const org = await rtdbService.getData(`organizations/${workspaceId}`);

    if (!org) {
      throw new Error('Workspace does not exist.');
    }
    if (!memberRecord && org.ownerId !== userUid) {
      throw new Error('Unauthorized. You must be a member of this workspace to edit the Blueprint.');
    }

    let activeMvpId = org.activeProjectId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId;
    }

    if (!activeMvpId) {
      throw new Error('No MVP selected for this workspace.');
    }

    const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || 
                       (await rtdbService.getData(`blueprints/${workspaceId}`));

    if (!existingBp) {
      throw new Error('No existing Blueprint found to update.');
    }

    if (existingBp.mvpIdeaId && existingBp.mvpIdeaId !== activeMvpId) {
      throw new Error('Target blueprint does not correspond to the currently selected workspace MVP.');
    }

    const validatedContent = validateBlueprintOutput(updatedContent);
    const timestamp = Date.now();

    const updatedBlueprintDocument = {
      ...existingBp,
      updatedAt: timestamp,
      updatedBy: userUid,
      lastModifiedSource: 'manual',
      content: validatedContent,
    };

    console.log(`💾 [Blueprint Manual Update Persistence] Saving edits for MVP ${activeMvpId}...`);

    const versionKey = `v${String(existingBp.version || '1.0').replace(/\./g, '_')}`;

    await Promise.all([
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, updatedBlueprintDocument),
      rtdbService.setData(`blueprints/${workspaceId}/current`, updatedBlueprintDocument),
      rtdbService.setData(`blueprints/${workspaceId}`, updatedBlueprintDocument),
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${versionKey}`, updatedBlueprintDocument),
    ]);

    console.log(`✅ [Blueprint Manual Update Completed] Changes saved successfully for workspace ${workspaceId}`);

    return {
      success: true,
      blueprint: updatedBlueprintDocument,
    };
  },

  /**
   * Phase 6: Server Endpoint Handler for Exporting Structured Blueprint JSON.
   */
  exportJsonHandler: async (workspaceId, userUid, targetVersion = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User context are required for export.');
    }

    console.log(`📥 [Blueprint JSON Export Requested] Workspace: ${workspaceId} | User: ${userUid} | Target Version: ${targetVersion || 'Latest'}`);

    const memberRecord = await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`);
    const org = await rtdbService.getData(`organizations/${workspaceId}`);

    if (!org) {
      throw new Error('Workspace does not exist.');
    }
    if (!memberRecord && org.ownerId !== userUid) {
      throw new Error('Unauthorized. You must be a member of this workspace to export the Blueprint.');
    }

    let activeMvpId = org.activeProjectId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId;
    }

    if (!activeMvpId) {
      throw new Error('Export unavailable: No MVP selected for this workspace.');
    }

    let targetDoc = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || 
                    (await rtdbService.getData(`blueprints/${workspaceId}`));

    if (!targetDoc) {
      throw new Error('Export unavailable: No Blueprint found for the selected MVP.');
    }

    // Try loading specific target version if requested
    if (targetVersion) {
      const vKey = `v${String(targetVersion).replace(/\./g, '_')}`;
      const versionDoc = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${vKey}`)) ||
                         (await rtdbService.getData(`blueprints/${workspaceId}/versions/${vKey}`)) ||
                         targetDoc.versions?.[vKey];
      if (versionDoc && (versionDoc.content || versionDoc.projectOverview)) {
        targetDoc = versionDoc;
      }
    }

    // Fallback: If root document has no content or status is failed, recover latest completed version from history
    if ((!targetDoc.content || targetDoc.status === 'failed') && targetDoc.versions) {
      const validVersions = Object.values(targetDoc.versions).filter((v) => v && (v.content || v.projectOverview));
      if (validVersions.length > 0) {
        validVersions.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
        targetDoc = validVersions[0];
      }
    }

    const rawContent = targetDoc.content || (targetDoc.projectOverview ? targetDoc : null);

    if (!targetDoc || !rawContent) {
      throw new Error('Export unavailable: No valid completed Blueprint content found. Please click Regenerate to create a fresh Blueprint.');
    }

    const validatedContent = validateBlueprintOutput(rawContent);

    const exportDocument = {
      blueprintId: targetDoc.blueprintId || `bp_${workspaceId}_${activeMvpId}`,
      workspaceId: targetDoc.workspaceId || workspaceId,
      mvpIdeaId: targetDoc.mvpIdeaId || activeMvpId,
      version: targetDoc.version || '1.0',
      status: 'completed',
      lastModifiedSource: targetDoc.lastModifiedSource || 'ai_generation',
      aiProvider: targetDoc.aiProvider || 'google_gemini',
      aiModel: targetDoc.aiModel || 'gemini-2.0-flash',
      generatedAt: targetDoc.generatedAt || targetDoc.createdAt || Date.now(),
      updatedAt: targetDoc.updatedAt || Date.now(),

      ideaTitle: targetDoc.ideaTitle || org.name || 'Project Blueprint',
      problemStatement: targetDoc.problemStatement || '',
      description: targetDoc.description || '',

      content: validatedContent,
      communityIntelligence: targetDoc.communityIntelligence || null,
      communityIntelligenceStatus: targetDoc.communityIntelligenceStatus || 'not_analyzed',
    };

    const filename = sanitizeFilename(targetDoc.ideaTitle || org.name, targetDoc.version || '1.0', 'json');

    console.log(`✅ [Blueprint JSON Export Ready] Filename: "${filename}"`);

    return {
      success: true,
      filename,
      exportData: exportDocument,
      jsonString: JSON.stringify(exportDocument, null, 2),
    };
  },

  /**
   * Phase 4: Standalone Handler for Analyzing Community Intelligence
   */
  analyzeCommunityIntelligenceHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User context are required.');
    }

    console.log(`🔍 [Community Analysis Started] Workspace: ${workspaceId} | User: ${userUid}`);

    const memberRecord = await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`);
    const org = await rtdbService.getData(`organizations/${workspaceId}`);

    if (!org) {
      throw new Error('Workspace does not exist.');
    }
    if (!memberRecord && org.ownerId !== userUid) {
      throw new Error('Unauthorized. You must be a member of this workspace to analyze community feedback.');
    }

    let activeMvpId = org.activeProjectId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId;
    }

    if (!activeMvpId) {
      throw new Error('No MVP selected for this workspace.');
    }

    const mvpIdea = await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`);
    if (!mvpIdea || mvpIdea.isDeleted) {
      throw new Error('Selected MVP idea could not be found.');
    }

    const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || {};
    if (existingBp.communityIntelligenceStatus === 'analyzing') {
      const isStale = Date.now() - (existingBp.communityIntelligenceUpdatedAt || 0) > 90000;
      if (!isStale) {
        throw new Error('Community feedback analysis is already in progress.');
      }
    }

    await Promise.all([
      rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
        communityIntelligenceStatus: 'analyzing',
        communityIntelligenceUpdatedAt: Date.now(),
      }),
      rtdbService.updateData(`blueprints/${workspaceId}`, {
        communityIntelligenceStatus: 'analyzing',
        communityIntelligenceUpdatedAt: Date.now(),
      }),
    ]);

    try {
      const aiInputPayload = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);
      const totalFeedbackCount = aiInputPayload.suggestions.length + aiInputPayload.comments.length + aiInputPayload.questions.length;

      let communityIntelligenceData;

      if (totalFeedbackCount === 0) {
        console.log(`ℹ️ [Community Analysis] Zero feedback items found for MVP ${activeMvpId}. Returning empty analysis.`);
        communityIntelligenceData = {
          suggestionsAnalysis: [],
          commentsAnalysis: [],
          questionsAnalysis: [],
          communityInsightsSummary: 'No community discussions or feedback submitted yet for this MVP.',
          communityInsights: {
            statistics: {
              suggestionsAnalyzed: 0, suggestionsRelevant: 0,
              commentsAnalyzed: 0, commentsRelevant: 0,
              questionsAnalyzed: 0, questionsRelevant: 0,
            },
            keyInsights: [
              { insight: 'No community feedback present yet to analyze.', category: 'general', impact: 'low' },
            ],
          },
        };
      } else {
        const sanitizeList = (list) =>
          list.slice(0, 25).map((item) => ({
            id: item.id,
            authorName: item.authorName,
            content: (item.message || '').slice(0, 500),
          }));

        const truncatedPayload = {
          ideaTitle: aiInputPayload.ideaTitle,
          problemStatement: aiInputPayload.problemStatement,
          description: aiInputPayload.description,
          techStack: aiInputPayload.techStack,
          suggestions: sanitizeList(aiInputPayload.suggestions),
          comments: sanitizeList(aiInputPayload.comments),
          questions: sanitizeList(aiInputPayload.questions),
        };

        const result = await geminiService.analyzeCommunityIntelligenceFromContext(truncatedPayload);
        communityIntelligenceData = result.communityIntelligence;
      }

      const timestamp = Date.now();

      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          communityIntelligence: communityIntelligenceData,
          communityIntelligenceStatus: 'completed',
          communityIntelligenceUpdatedAt: timestamp,
        }),
        rtdbService.updateData(`blueprints/${workspaceId}/current`, {
          communityIntelligence: communityIntelligenceData,
          communityIntelligenceStatus: 'completed',
          communityIntelligenceUpdatedAt: timestamp,
        }),
        rtdbService.updateData(`blueprints/${workspaceId}`, {
          communityIntelligence: communityIntelligenceData,
          communityIntelligenceStatus: 'completed',
          communityIntelligenceUpdatedAt: timestamp,
        }),
      ]);

      console.log(`✅ [Community Analysis Completed] Analyzed ${totalFeedbackCount} items for workspace ${workspaceId}`);

      return {
        success: true,
        communityIntelligence: communityIntelligenceData,
      };
    } catch (error) {
      console.error(`💥 [Community Analysis Failed] Workspace: ${workspaceId} | Error:`, error.message);

      const fallbackStatus = existingBp.communityIntelligence ? 'completed' : 'failed';
      await Promise.all([
        rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
          communityIntelligenceStatus: fallbackStatus,
          communityIntelligenceUpdatedAt: Date.now(),
        }),
        rtdbService.updateData(`blueprints/${workspaceId}`, {
          communityIntelligenceStatus: fallbackStatus,
          communityIntelligenceUpdatedAt: Date.now(),
        }),
      ]);

      throw new Error('Community feedback analysis failed. Please try again.');
    }
  },
};
