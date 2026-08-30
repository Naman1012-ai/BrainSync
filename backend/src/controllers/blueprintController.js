import { rtdbService } from '../services/rtdbService.js';
import { aiBlueprintService } from '../services/aiBlueprintService.js';
import { geminiService } from '../services/ai/geminiService.js';
import { validateBlueprintOutput } from '../services/ai/blueprintValidator.js';
import { taskSyncService } from '../services/ai/taskSyncService.js';
import { blueprintStalenessEngine } from '../services/ai/blueprintStalenessEngine.js';
import { blueprintComparisonEngine } from '../services/ai/blueprintComparisonEngine.js';
import { blueprintApprovalEngine } from '../services/ai/blueprintApprovalEngine.js';
import { aiConcurrencyGuard } from '../services/aiConcurrencyGuard.js';
import {
  extractCanonicalVersionKey,
  extractCanonicalVersionNumber,
  validatePathSegment,
} from '../utils/blueprintPathBuilder.js';

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

    // Check if stuck in 'generating' state for > 300 seconds (5 minutes)
    const STALE_THRESHOLD_MS = 300000;
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

    // Authoritative In-Flight Mutex Lock Acquisition (Prevents duplicate parallel requests)
    const activeLock = aiConcurrencyGuard.acquireLock(workspaceId, userUid, 'generate');

    try {
      const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || 
                         (await rtdbService.getData(`blueprints/${workspaceId}`));

      const rawVersions = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`)) ||
                          (await rtdbService.getData(`blueprints/${workspaceId}/versions`)) ||
                          existingBp?.versions ||
                          {};

      const versionNumbers = [];
      if (existingBp?.version && existingBp?.content) {
        const v = parseFloat(existingBp.version);
        if (!isNaN(v)) versionNumbers.push(v);
      }
      Object.keys(rawVersions || {}).forEach((k) => {
        const verObj = rawVersions[k];
        if (verObj && (verObj.content || verObj.projectOverview)) {
          const verStr = verObj?.version || k.replace(/^v/, '').replace(/_/g, '.');
          const v = parseFloat(verStr);
          if (!isNaN(v)) versionNumbers.push(v);
        }
      });

      const maxVersion = versionNumbers.length > 0 ? Math.max(...versionNumbers) : 0;
      const nextVersion = maxVersion > 0 ? (maxVersion + 1.0).toFixed(1) : '1.0';
      const parentVersion = maxVersion > 0 ? maxVersion.toFixed(1) : null;
      const isRegeneration = maxVersion >= 1.0;

      if (existingBp?.status === 'generating') {
        const isStaleLock = Date.now() - (existingBp.updatedAt || existingBp.generationStartedAt || 0) > 300000;
        if (!isStaleLock) {
          console.warn(`🔒 [Duplicate Generation Prevented] Generation already in progress for workspace ${workspaceId}`);
          const err = new Error('Blueprint generation is already in progress for this workspace.');
          err.statusCode = 409;
          err.code = 'AI_OPERATION_IN_PROGRESS';
          throw err;
        }
      }

      const timestamp = Date.now();
      const attemptId = activeLock.attemptId;

      let currentStage = 'context_preparing';

    await Promise.all([
      rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
        status: 'generating',
        generationStage: 'context_preparing',
        version: nextVersion,
        activeVersionId: nextVersion,
        updatedAt: timestamp,
        generationStartedAt: timestamp,
        generationAttemptId: attemptId,
      }),
      rtdbService.updateData(`blueprints/${workspaceId}/current`, {
        status: 'generating',
        generationStage: 'context_preparing',
        version: nextVersion,
        activeVersionId: nextVersion,
        updatedAt: timestamp,
        generationStartedAt: timestamp,
        generationAttemptId: attemptId,
      }),
      rtdbService.updateData(`blueprints/${workspaceId}/active`, {
        status: 'generating',
        generationStage: 'context_preparing',
        version: nextVersion,
        activeVersionId: nextVersion,
        updatedAt: timestamp,
        generationStartedAt: timestamp,
        generationAttemptId: attemptId,
      }),
    ]);

    // Stage 1: Context Preparation & Intelligence Assembly
    const aiInputPayload = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);
    aiInputPayload.isRegeneration = isRegeneration;
    aiInputPayload.nextVersion = nextVersion;

      // Transition to Stage 2: AI Synthesis (Google Gemini)
      currentStage = 'ai_synthesis';
      await rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
        generationStage: 'ai_synthesis',
        updatedAt: Date.now(),
      });

      console.log(`🤖 [AI Generation Requested] Model: ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'} | Version: ${nextVersion} (Regeneration: ${isRegeneration}) | Workspace: ${workspaceId}`);

      const geminiResult = await geminiService.generateBlueprintFromContext(aiInputPayload);

      // Transition to Stage 3: Schema 2 & Dependency Graph Validation
      currentStage = 'validating_schema';
      await rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
        generationStage: 'validating_schema',
        updatedAt: Date.now(),
      });

      console.log(`✨ [AI Response Received & Schema Validated] Canonical Blueprint 2.0 (8 Components) confirmed for workspace ${workspaceId} (v${nextVersion})`);

      // Phase 9: Pre-commit compare-and-set to guarantee generation lock ownership and prevent race overwrite
      const currentLock = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || {};
      if (currentLock.generationAttemptId && currentLock.generationAttemptId !== attemptId) {
        console.warn(`⚠️ [Generation Race Prevented] Attempt ${attemptId} superseded by ${currentLock.generationAttemptId}. Discarding stale result.`);
        return {
          success: false,
          reason: 'superseded',
          message: 'A newer Blueprint generation attempt was started. Stale generation result safely discarded.',
        };
      }

      // Transition to Stage 4: Version Snapshotting & Database Persistence
      currentStage = 'persisting';
      await rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
        generationStage: 'persisting',
        updatedAt: Date.now(),
      });

      const sourceContextHash = blueprintStalenessEngine.computeSourceContextHash(aiInputPayload);
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
        parentVersion,
        generationId: attemptId,
        sourceContextHash,
        lineage: {
          parentVersion,
          generationId: attemptId,
          generatedBy: userUid,
          generatedAt: timestamp,
        },
        schemaVersion: geminiResult.blueprintContent?.schemaVersion || 2,
        status: 'completed',
        lifecycleState: 'ready_for_review',
        approvalStatus: 'pending_approval',
        approvedAt: null,
        approvedBy: null,
        generationStage: 'completed',
        timestamp: Date.now(),
        generatedAt: timestamp,
        updatedAt: Date.now(),
        lastModifiedSource: 'ai_generation',
        aiProvider: 'google_gemini',
        aiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

        ideaTitle: mvpIdea.title,
        problemStatement: mvpIdea.problemStatement || '',
        description: mvpIdea.description || '',

        content: geminiResult.blueprintContent,
        communityIntelligenceStatus: geminiResult.communityIntelligence ? 'completed' : 'not_available',
        executionTimeline: {
          totalTasks: geminiResult.blueprintContent?.execution?.tasks?.length || 0,
          criticalPathLength: geminiResult.blueprintContent?.execution?.criticalPathTaskIds?.length || 0,
          wavesCount: geminiResult.blueprintContent?.execution?.executionWaves?.length || 0,
          waves: (geminiResult.blueprintContent?.execution?.executionWaves || []).map((w) => ({
            waveIndex: w.waveIndex,
            waveName: w.waveName,
            taskCount: w.taskIds?.length || 0,
            estimatedHours: w.estimatedHours || 0,
          })),
        },
      };

      // Only attach optional communityIntelligence if explicitly provided by intelligence engine
      if (geminiResult.communityIntelligence) {
        completeBlueprintDocument.communityIntelligence = geminiResult.communityIntelligence;
      }

      // Validate required Canonical Blueprint 2.0 fields before initiating persistence
      const requiredFields = ['blueprintId', 'workspaceId', 'mvpIdeaId', 'version', 'status', 'content', 'schemaVersion'];
      for (const field of requiredFields) {
        if (!completeBlueprintDocument[field]) {
          console.error(`🚨 [Blueprint Persistence Validation Failed] Missing required field '${field}' for workspace ${workspaceId} (v${nextVersion})`);
          throw new Error(`Missing required Blueprint field: '${field}' for workspace ${workspaceId} (v${nextVersion}) at persistence stage.`);
        }
      }
      console.log(`✅ [Blueprint Persistence Validation] Canonical object validated for workspace ${workspaceId} (v${nextVersion})`);

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
        rtdbService.setData(`blueprints/${workspaceId}/active`, completeBlueprintDocument),
        rtdbService.updateData(`organizations/${workspaceId}`, {
          activeProjectId: activeMvpId,
          activeBlueprintId: completeBlueprintDocument.blueprintId,
          updatedAt: Date.now(),
        }),
        rtdbService.updateData(`workspaces/${workspaceId}/metadata`, {
          activeProjectId: activeMvpId,
          selectedIdeaId: activeMvpId,
          activeBlueprintId: completeBlueprintDocument.blueprintId,
          updatedAt: Date.now(),
        }),
      ];

      for (const [vKey, vSnap] of Object.entries(existingVersions)) {
        savePromises.push(rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${vKey}`, vSnap));
        savePromises.push(rtdbService.setData(`blueprints/${workspaceId}/versions/${vKey}`, vSnap));
      }

      await Promise.all(savePromises);

      console.log(`🎉 [Blueprint Generation Completed] Version ${nextVersion} successfully saved to version history for workspace ${workspaceId}`);

      // Phase 11 / Post-Phase-11: Automatically synchronize Blueprint planned tasks to Task Board
      await taskSyncService.synchronizeBlueprintTasks(workspaceId, completeBlueprintDocument, userUid).catch((syncErr) => {
        console.warn('⚠️ [TaskSync Auto-trigger Warning]', syncErr.message);
      });

      return {
        success: true,
        blueprint: completeBlueprintDocument,
      };
    } catch (error) {
      console.error(`💥 [Blueprint Generation Failed] Workspace: ${workspaceId} | Reason:`, error.message);

      const errTimestamp = Date.now();
      const friendlyError = error.message?.includes('set failed') || error.message?.includes('undefined in property')
        ? 'Blueprint generation could not be saved to workspace database. Previous version preserved.'
        : (error.message || 'Blueprint generation failed. Previous version preserved.');

      if (existingBp && existingBp.status === 'completed' && existingBp.content) {
        await Promise.all([
          rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
            status: 'completed',
            generationStage: 'failed',
            failedStage: currentStage,
            version: existingBp.version,
            activeVersionId: existingBp.version,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
          rtdbService.updateData(`blueprints/${workspaceId}/current`, {
            status: 'completed',
            generationStage: 'failed',
            failedStage: currentStage,
            version: existingBp.version,
            activeVersionId: existingBp.version,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
          rtdbService.updateData(`blueprints/${workspaceId}/active`, {
            status: 'completed',
            generationStage: 'failed',
            failedStage: currentStage,
            version: existingBp.version,
            activeVersionId: existingBp.version,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
        ]);
        console.log(`🛡️ [Fail-Safe Preservation] Preserved existing Version ${existingBp.version} for workspace ${workspaceId}`);
      } else {
        await Promise.all([
          rtdbService.updateData(`blueprints/${workspaceId}/${activeMvpId}`, {
            status: 'failed',
            generationStage: 'failed',
            failedStage: currentStage,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
          rtdbService.updateData(`blueprints/${workspaceId}/current`, {
            status: 'failed',
            generationStage: 'failed',
            failedStage: currentStage,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
          rtdbService.updateData(`blueprints/${workspaceId}/active`, {
            status: 'failed',
            generationStage: 'failed',
            failedStage: currentStage,
            updatedAt: errTimestamp,
            generationFailedAt: errTimestamp,
            lastError: friendlyError,
          }),
        ]);
      }

      throw new Error(`Blueprint generation failed: ${friendlyError}`);
    } finally {
      aiConcurrencyGuard.releaseLock(activeLock.lockKey, activeLock.attemptId);
    }
  },

  /**
   * Phase 5 & Phase 9: Protected Endpoint Handler for Saving Manual Blueprint Edits with Optimistic Concurrency.
   */
  updateBlueprintHandler: async (workspaceId, userUid, payload) => {
    if (!workspaceId || !userUid || !payload) {
      throw new Error('Workspace ID, User UID, and Updated Content payload are required.');
    }

    console.log(`✏️ [Blueprint Manual Update Started] Workspace: ${workspaceId} | User: ${userUid}`);

    const { bp: existingBp, activeMvpId } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    let rawContent = payload;
    let expectedUpdatedAt = null;
    let expectedVersion = null;

    if (payload && typeof payload === 'object' && payload.content) {
      rawContent = payload.content;
      expectedUpdatedAt = payload.expectedUpdatedAt;
      expectedVersion = payload.expectedVersion;
    }

    // Phase 9: Optimistic Concurrency Validation
    if (expectedUpdatedAt && existingBp.updatedAt && existingBp.updatedAt > expectedUpdatedAt) {
      console.warn(`⚠️ [Concurrency Conflict] Blueprint was modified at ${existingBp.updatedAt}, but client expected ${expectedUpdatedAt}`);
      const err = new Error('Blueprint has been modified by another collaborator or a newer version was generated since you opened it. Please review latest changes before saving.');
      err.statusCode = 409;
      err.code = 'VERSION_CONFLICT';
      throw err;
    }
    if (expectedVersion && existingBp.version && String(existingBp.version) !== String(expectedVersion)) {
      console.warn(`⚠️ [Concurrency Conflict] Active version is ${existingBp.version}, but client expected ${expectedVersion}`);
      const err = new Error('Active Blueprint version changed since you opened it. Please reload the latest version.');
      err.statusCode = 409;
      err.code = 'VERSION_CONFLICT';
      throw err;
    }

    const validatedContent = validateBlueprintOutput(rawContent);
    const timestamp = Date.now();

    const updatedBlueprintDocument = {
      ...existingBp,
      updatedAt: timestamp,
      updatedBy: userUid,
      schemaVersion: validatedContent.schemaVersion || existingBp.schemaVersion || 2,
      lastModifiedSource: 'manual',
      content: validatedContent,
    };

    console.log(`💾 [Blueprint Manual Update Persistence] Saving edits for MVP ${activeMvpId}...`);

    const versionKey = `v${String(existingBp.version || '1.0').replace(/\./g, '_')}`;

    await Promise.all([
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, updatedBlueprintDocument),
      rtdbService.setData(`blueprints/${workspaceId}/current`, updatedBlueprintDocument),
      rtdbService.setData(`blueprints/${workspaceId}/active`, updatedBlueprintDocument),
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${versionKey}`, updatedBlueprintDocument),
      rtdbService.setData(`blueprints/${workspaceId}/versions/${versionKey}`, updatedBlueprintDocument),
      rtdbService.updateData(`organizations/${workspaceId}`, {
        activeProjectId: activeMvpId,
        activeBlueprintId: updatedBlueprintDocument.blueprintId,
        updatedAt: timestamp,
      }),
      rtdbService.updateData(`workspaces/${workspaceId}/metadata`, {
        activeProjectId: activeMvpId,
        selectedIdeaId: activeMvpId,
        activeBlueprintId: updatedBlueprintDocument.blueprintId,
        updatedAt: timestamp,
      }),
    ]);

    console.log(`✅ [Blueprint Manual Update Completed] Changes saved successfully for workspace ${workspaceId}`);

    // Automatically synchronize updated Blueprint tasks to Task Board
    await taskSyncService.synchronizeBlueprintTasks(workspaceId, updatedBlueprintDocument, userUid).catch((syncErr) => {
      console.warn('⚠️ [TaskSync Auto-trigger Warning]', syncErr.message);
    });

    return {
      success: true,
      blueprint: updatedBlueprintDocument,
    };
  },

  /**
   * Phase 11 / Post-Phase-11: Authoritative Endpoint for Retrieving the Active or Snapshot Blueprint Document.
   */
  getActiveBlueprintHandler: async (workspaceId, userUid, targetVersion = null) => {
    if (!workspaceId || !userUid) throw new Error('Workspace ID and User UID are required.');

    const memberRecord = (await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`)) ||
                         (await rtdbService.getData(`workspace_members/${workspaceId}/${userUid}`));
    const org = (await rtdbService.getData(`organizations/${workspaceId}`)) ||
                (await rtdbService.getData(`workspaces/${workspaceId}`));

    if (!org) throw new Error('Workspace does not exist.');
    const isOwner = org.ownerId === userUid || org.createdBy === userUid || org.ownerUid === userUid;
    const isMember = Boolean(memberRecord || isOwner || (org.members && org.members[userUid]));
    if (!isMember) {
      throw new Error('Unauthorized. You must be a member of this workspace to view the Blueprint.');
    }

    let activeMvpId = org.activeProjectId || org.selectedIdeaId || org.activeMvpId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId || meta?.activeMvpId;
    }

    let bp = null;
    if (activeMvpId) {
      bp = await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`);
    }
    if (!bp) {
      bp = (await rtdbService.getData(`blueprints/${workspaceId}/current`)) ||
           (await rtdbService.getData(`blueprints/${workspaceId}/active`));
    }
    if (!bp) {
      const rawRoot = await rtdbService.getData(`blueprints/${workspaceId}`);
      if (rawRoot && (rawRoot.content || rawRoot.projectOverview || rawRoot.schemaVersion)) {
        bp = rawRoot;
      }
    }

    if (!bp) return { blueprint: null };

    // Fallback: If root document has no content or status is stale generating, recover latest completed version
    if ((!bp.content || bp.status === 'generating') && (!targetVersion || targetVersion === 'current')) {
      const allVersions = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`)) ||
                          (await rtdbService.getData(`blueprints/${workspaceId}/versions`)) ||
                          bp.versions ||
                          {};
      const validVersions = Object.values(allVersions).filter((v) => v && (v.content || v.projectOverview));
      if (validVersions.length > 0) {
        validVersions.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
        const latestValid = validVersions[0];
        bp = {
          ...latestValid,
          status: 'completed',
          versions: allVersions,
        };
      }
    }

    // If targetVersion requested, look up specific version snapshot
    if (targetVersion && targetVersion !== 'current' && String(targetVersion) !== String(bp.version)) {
      const vKey = `v${String(targetVersion).replace(/\./g, '_')}`;
      const vSnap = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${vKey}`)) ||
                    (await rtdbService.getData(`blueprints/${workspaceId}/versions/${vKey}`)) ||
                    bp.versions?.[vKey];
      if (vSnap) {
        return { blueprint: vSnap, isVersionSnapshot: true };
      }
    }

    return { blueprint: bp, isVersionSnapshot: false };
  },

  /**
   * Phase 11 / Post-Phase-11: Authoritative Endpoint for Retrieving all Persisted Blueprint Versions.
   */
  getBlueprintVersionsHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) throw new Error('Workspace ID and User UID are required.');

    const memberRecord = (await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`)) ||
                         (await rtdbService.getData(`workspace_members/${workspaceId}/${userUid}`));
    const org = (await rtdbService.getData(`organizations/${workspaceId}`)) ||
                (await rtdbService.getData(`workspaces/${workspaceId}`));

    if (!org) throw new Error('Workspace does not exist.');
    const isOwner = org.ownerId === userUid || org.createdBy === userUid || org.ownerUid === userUid;
    const isMember = Boolean(memberRecord || isOwner || (org.members && org.members[userUid]));
    if (!isMember) {
      throw new Error('Unauthorized. You must be a member of this workspace to view versions.');
    }

    let activeMvpId = org.activeProjectId || org.selectedIdeaId || org.activeMvpId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId || meta?.activeMvpId;
    }

    const versionsMap = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`)) ||
                        (await rtdbService.getData(`blueprints/${workspaceId}/versions`)) ||
                        {};

    const list = Object.entries(versionsMap).map(([k, v]) => ({
      key: k,
      version: String(v.version || v.versionId || k.replace(/^v/, '').replace(/_/g, '.') || '1.0'),
      versionId: v.versionId || v.version || k,
      status: v.status || 'completed',
      createdAt: v.createdAt || v.generatedAt || Date.now(),
      updatedAt: v.updatedAt || Date.now(),
      lastModifiedSource: v.lastModifiedSource || 'ai_generation',
      summary: v.summary || `Version ${v.version || '1.0'}`,
    }));

    list.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
    return { versions: list };
  },

  /**
   * Phase 9: Explicit Blueprint Version Activation Handler.
   * Authoritatively promotes a historical version snapshot to become the active approved Blueprint.
   */
  activateBlueprintVersionHandler: async (workspaceId, userUid, payload = {}) => {
    const cleanVerKey = extractCanonicalVersionKey(payload);
    if (!workspaceId || !userUid || !cleanVerKey) {
      throw new Error('Workspace ID, User UID, and a valid Target Version Key (e.g. "1.0" or "v1_0") are required.');
    }

    console.log(`⭐ [Blueprint Version Activation Requested] Workspace: ${workspaceId} | Target: ${cleanVerKey} | Caller: ${userUid}`);

    const memberRecord = (await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`)) ||
                         (await rtdbService.getData(`workspace_members/${workspaceId}/${userUid}`));
    const org = (await rtdbService.getData(`organizations/${workspaceId}`)) ||
                (await rtdbService.getData(`workspaces/${workspaceId}`));

    if (!org) throw new Error('Workspace does not exist.');
    const isOwner = org.ownerId === userUid || org.createdBy === userUid || org.ownerUid === userUid;
    const isMember = Boolean(memberRecord || isOwner || (org.members && org.members[userUid]));
    if (!isMember) {
      throw new Error('Unauthorized. You must be a member of this workspace to activate a Blueprint version.');
    }

    let activeMvpId = org.activeProjectId || org.selectedIdeaId || org.activeMvpId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId || meta?.activeMvpId;
    }

    const targetVersionDoc = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`)) ||
                             (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`));

    if (!targetVersionDoc || (!targetVersionDoc.content && !targetVersionDoc.projectOverview)) {
      throw new Error(`Target Blueprint version '${cleanVerKey}' was not found or is invalid.`);
    }

    const currentBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) ||
                      (await rtdbService.getData(`blueprints/${workspaceId}/current`)) ||
                      {};

    const timestamp = Date.now();
    const verNumber = String(targetVersionDoc.version || targetVersionDoc.versionId || cleanVerKey.replace(/^v/, '').replace(/_/g, '.') || '1.0');

    // Build activated document
    const activatedDocument = {
      ...targetVersionDoc,
      status: 'completed',
      activeVersionId: verNumber,
      version: verNumber,
      updatedAt: timestamp,
      activatedAt: timestamp,
      activatedBy: userUid,
      lastModifiedSource: targetVersionDoc.lastModifiedSource || 'version_activation',
    };

    // If current was a different version, record superseded metadata on old version snapshot
    if (currentBp.version && String(currentBp.version) !== verNumber) {
      const oldVerKey = `v${String(currentBp.version).replace(/\./g, '_')}`;
      const oldSnapshot = {
        ...currentBp,
        status: 'superseded',
        supersededAt: timestamp,
        supersededBy: userUid,
      };
      await Promise.all([
        rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${oldVerKey}`, oldSnapshot),
        rtdbService.setData(`blueprints/${workspaceId}/versions/${oldVerKey}`, oldSnapshot),
      ]).catch((e) => console.warn('[Version Superseded Stamp Warning]', e.message));
    }

    // Persist activated snapshot to all authoritative active locations
    await Promise.all([
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, activatedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/current`, activatedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/active`, activatedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`, activatedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/versions/${cleanVerKey}`, activatedDocument),
      rtdbService.updateData(`organizations/${workspaceId}`, {
        activeProjectId: activeMvpId,
        activeBlueprintId: activatedDocument.blueprintId,
        updatedAt: timestamp,
      }),
      rtdbService.updateData(`workspaces/${workspaceId}/metadata`, {
        activeProjectId: activeMvpId,
        selectedIdeaId: activeMvpId,
        activeBlueprintId: activatedDocument.blueprintId,
        updatedAt: timestamp,
      }),
    ]);

    console.log(`✅ [Blueprint Version Activated] Version ${verNumber} is now the active authoritative Blueprint for workspace ${workspaceId}`);

    return {
      success: true,
      activatedVersion: verNumber,
      blueprint: activatedDocument,
    };
  },

  /**
   * Phase 9: Check Blueprint Staleness & Change Impact Handler.
   */
  checkBlueprintStalenessHandler: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const { bp: existingBp, activeMvpId } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    const mvpIdea = (await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`)) || {};

    const aiInputPayload = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);
    const stalenessResult = blueprintStalenessEngine.evaluateProjectChanges(aiInputPayload, existingBp);

    return {
      success: true,
      ...stalenessResult,
    };
  },

  /**
   * Phase 9: Compare Two Blueprint Versions Handler.
   */
  compareBlueprintVersionsHandler: async (workspaceId, userUid, payload = {}) => {
    const { versionA: verAInput, versionB: verBInput } = payload;
    const cleanKeyA = extractCanonicalVersionKey(verAInput || payload.versionKeyA || payload.verAKey || payload.verA);
    const cleanKeyB = extractCanonicalVersionKey(verBInput || payload.versionKeyB || payload.verBKey || payload.verB);

    if (!workspaceId || !userUid || !cleanKeyA || !cleanKeyB) {
      throw new Error('Workspace ID, User UID, versionA, and versionB keys are required.');
    }

    const { activeMvpId } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    const [docA, docB] = await Promise.all([
      (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanKeyA}`)) ||
      (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanKeyA}`)),
      (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanKeyB}`)) ||
      (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanKeyB}`)),
    ]);

    if (!docA || !docB) {
      throw new Error('One or both specified Blueprint versions could not be found.');
    }

    const comparison = blueprintComparisonEngine.compareVersions(docA, docB);
    return {
      success: true,
      comparison,
    };
  },

  /**
   * Phase 11: Formal Blueprint Version Approval Handler.
   * Enforces readiness checklist verification, blocking precondition evaluation,
   * stamps approval metadata, promotes target version to active, marks previous version superseded,
   * and automatically synchronizes tasks into the Task Board.
   */
  approveBlueprintVersionHandler: async (workspaceId, userUid, payload = {}) => {
    const cleanVerKey = extractCanonicalVersionKey(payload);
    if (!workspaceId || !userUid || !cleanVerKey) {
      throw new Error('Workspace ID, User UID, and a valid Target Version Key (e.g. "1.0" or "v1_0") are required.');
    }

    console.log(`⭐ [Blueprint Approval Requested] Workspace: ${workspaceId} | Target: ${cleanVerKey} | Caller: ${userUid}`);

    const memberRecord = (await rtdbService.getData(`organization_members/${workspaceId}/${userUid}`)) ||
                         (await rtdbService.getData(`workspace_members/${workspaceId}/${userUid}`));
    const org = (await rtdbService.getData(`organizations/${workspaceId}`)) ||
                (await rtdbService.getData(`workspaces/${workspaceId}`));

    if (!org) throw new Error('Workspace does not exist.');
    const isOwner = org.ownerId === userUid || org.createdBy === userUid || org.ownerUid === userUid;
    const isMember = Boolean(memberRecord || isOwner || (org.members && org.members[userUid]));
    if (!isMember) {
      throw new Error('Unauthorized. You must be a member of this workspace to approve a Blueprint.');
    }

    let activeMvpId = org.activeProjectId || org.selectedIdeaId || org.activeMvpId;
    if (!activeMvpId) {
      const meta = await rtdbService.getData(`workspaces/${workspaceId}/metadata`);
      activeMvpId = meta?.selectedIdeaId || meta?.activeMvpId;
    }

    const targetVersionDoc = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`)) ||
                             (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`));

    if (!targetVersionDoc || (!targetVersionDoc.content && !targetVersionDoc.projectOverview)) {
      throw new Error(`Target Blueprint version '${cleanVerKey}' was not found or is invalid.`);
    }

    // Prepare realtime project context for staleness & approval readiness verification
    const mvpIdea = (await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`)) || {};
    const projectContext = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);

    // Evaluate approval preconditions
    const readiness = blueprintApprovalEngine.evaluateApprovalReadiness(targetVersionDoc, projectContext);
    if (!readiness.canApprove) {
      const errorMsg = `Approval Preconditions Failed: ${readiness.blockingErrors.join('; ')}`;
      console.warn(`❌ [Blueprint Approval Blocked] ${errorMsg}`);
      const err = new Error(errorMsg);
      err.statusCode = 422;
      err.blockingErrors = readiness.blockingErrors;
      err.checklist = readiness.checklist;
      throw err;
    }

    const currentBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) ||
                      (await rtdbService.getData(`blueprints/${workspaceId}/current`)) ||
                      {};

    const timestamp = Date.now();
    const verNumber = String(targetVersionDoc.version || targetVersionDoc.versionId || cleanVerKey.replace(/^v/, '').replace(/_/g, '.') || '1.0');

    // Idempotency check: if version is already approved and active, return safely
    if (targetVersionDoc.approvalStatus === 'approved' && currentBp.version === verNumber && currentBp.approvalStatus === 'approved') {
      console.log(`ℹ️ [Blueprint Approval Idempotent] Version ${verNumber} is already approved and active for workspace ${workspaceId}`);
      return {
        success: true,
        approvedVersion: verNumber,
        blueprint: currentBp,
        readiness,
      };
    }

    // Build approved document
    const approvedDocument = {
      ...targetVersionDoc,
      status: 'completed',
      lifecycleState: 'active',
      approvalStatus: 'approved',
      activeVersionId: verNumber,
      version: verNumber,
      updatedAt: timestamp,
      approvedAt: timestamp,
      approvedBy: userUid,
      activatedAt: timestamp,
      activatedBy: userUid,
      readinessScore: readiness.readinessScore,
      lastModifiedSource: targetVersionDoc.lastModifiedSource || 'human_approval',
    };

    // If previous active version was different, mark as superseded
    if (currentBp.version && String(currentBp.version) !== verNumber) {
      const oldVerKey = `v${String(currentBp.version).replace(/\./g, '_')}`;
      const oldSnapshot = {
        ...currentBp,
        status: 'superseded',
        lifecycleState: 'superseded',
        supersededAt: timestamp,
        supersededBy: userUid,
      };
      await Promise.all([
        rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${oldVerKey}`, oldSnapshot),
        rtdbService.setData(`blueprints/${workspaceId}/versions/${oldVerKey}`, oldSnapshot),
      ]).catch((e) => console.warn('[Version Superseded Stamp Warning]', e.message));
    }

    // Persist approved document across all active authoritative locations
    await Promise.all([
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, approvedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/current`, approvedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/active`, approvedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`, approvedDocument),
      rtdbService.setData(`blueprints/${workspaceId}/versions/${cleanVerKey}`, approvedDocument),
      rtdbService.updateData(`organizations/${workspaceId}`, {
        activeProjectId: activeMvpId,
        activeBlueprintId: approvedDocument.blueprintId,
        updatedAt: timestamp,
      }),
      rtdbService.updateData(`workspaces/${workspaceId}/metadata`, {
        activeProjectId: activeMvpId,
        selectedIdeaId: activeMvpId,
        activeBlueprintId: approvedDocument.blueprintId,
        updatedAt: timestamp,
      }),
    ]);

    console.log(`✅ [Blueprint Approved & Activated] Version ${verNumber} is now the formally approved execution plan for workspace ${workspaceId}`);

    // Automatically synchronize planned tasks into Task Board
    await taskSyncService.synchronizeBlueprintTasks(workspaceId, approvedDocument, userUid).catch((syncErr) => {
      console.warn('⚠️ [TaskSync on Approval Warning]', syncErr.message);
    });

    return {
      success: true,
      approvedVersion: verNumber,
      blueprint: approvedDocument,
      readiness,
    };
  },

  /**
   * Phase 11: Check Approval Readiness Handler.
   */
  checkApprovalReadinessHandler: async (workspaceId, userUid, payload = {}) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const cleanVerKey = extractCanonicalVersionKey(payload);
    const { bp: existingBp, activeMvpId } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    let targetDoc = existingBp;

    if (cleanVerKey) {
      targetDoc = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`)) ||
                  (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`)) ||
                  existingBp;
    }

    const mvpIdea = (await rtdbService.getData(`ideas/${workspaceId}/${activeMvpId}`)) || {};
    const projectContext = await aiBlueprintService.prepareAiInputContext(workspaceId, mvpIdea);

    const readiness = blueprintApprovalEngine.evaluateApprovalReadiness(targetDoc, projectContext);

    return {
      success: true,
      version: targetDoc.version || '1.0',
      ...readiness,
    };
  },

  /**
   * Phase 6: Server Endpoint Handler for Exporting Structured Blueprint JSON.
   */
  exportJsonHandler: async (workspaceId, userUid, targetVersion = null) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User context are required for export.');
    }

    const cleanVerKey = extractCanonicalVersionKey(targetVersion);
    console.log(`📥 [Blueprint JSON Export Requested] Workspace: ${workspaceId} | User: ${userUid} | Target Version: ${cleanVerKey || 'Latest'}`);

    const { bp, activeMvpId, org } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    let targetDoc = bp;

    // Try loading specific target version if requested
    if (cleanVerKey && cleanVerKey !== 'current' && (!targetDoc.version || cleanVerKey !== extractCanonicalVersionKey(targetDoc.version))) {
      const versionDoc = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`)) ||
                         (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`)) ||
                         targetDoc.versions?.[cleanVerKey];
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

    // Authoritative In-Flight Mutex Lock Acquisition
    const activeLock = aiConcurrencyGuard.acquireLock(workspaceId, userUid, 'analyze_community');

    const existingBp = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`)) || {};
    if (existingBp.communityIntelligenceStatus === 'analyzing') {
      const isStale = Date.now() - (existingBp.communityIntelligenceUpdatedAt || 0) > 300000;
      if (!isStale) {
        const err = new Error('Community feedback analysis is already in progress.');
        err.statusCode = 409;
        err.code = 'AI_OPERATION_IN_PROGRESS';
        throw err;
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
    } finally {
      aiConcurrencyGuard.releaseLock(activeLock.lockKey, activeLock.attemptId);
    }
  },

  /**
   * Canonical Helper: Authoritatively resolve the active workspace, active MVP idea ID, and active Blueprint document.
   */
  resolveActiveBlueprintRecord: async (workspaceId, userUid) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const [memberRecord, org, wsMeta, userRecord] = await Promise.all([
      rtdbService.getData(`organization_members/${workspaceId}/${userUid}`),
      rtdbService.getData(`organizations/${workspaceId}`),
      rtdbService.getData(`workspaces/${workspaceId}/metadata`),
      rtdbService.getData(`users/${userUid}`),
    ]);

    const resolvedOrg = org || (await rtdbService.getData(`workspaces/${workspaceId}`));
    if (!resolvedOrg) {
      throw new Error('Workspace does not exist.');
    }

    const isOwner = resolvedOrg.ownerId === userUid || resolvedOrg.createdBy === userUid || resolvedOrg.ownerUid === userUid;
    const isMember = Boolean(memberRecord || isOwner || (resolvedOrg.members && resolvedOrg.members[userUid]));
    if (!isMember) {
      throw new Error('Unauthorized. You must be a member of this workspace to perform this action.');
    }

    // Resolve Active MVP ID
    let activeMvpId = resolvedOrg.activeProjectId || resolvedOrg.selectedIdeaId || resolvedOrg.activeMvpId || wsMeta?.selectedIdeaId || wsMeta?.activeProjectId;

    if (!activeMvpId) {
      // Check ideas collection for selected MVP idea
      const allIdeas = (await rtdbService.getData(`ideas/${workspaceId}`)) || {};
      const selectedIdea = Object.values(allIdeas).find(
        (i) => i && (i.isSelected === true || i.status === 'Selected MVP' || i.isMvp === true)
      );
      if (selectedIdea) {
        activeMvpId = selectedIdea.id || selectedIdea.ideaId;
      }
    }

    // Fetch Blueprint candidate from all authoritative locations
    let bp = null;
    if (activeMvpId) {
      bp = await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}`);
    }
    if (!bp || !bp.content) {
      const curBp = (await rtdbService.getData(`blueprints/${workspaceId}/current`)) ||
                    (await rtdbService.getData(`blueprints/${workspaceId}/active`));
      if (curBp && curBp.content) {
        bp = curBp;
      }
    }
    if (!bp || !bp.content) {
      const rawRoot = await rtdbService.getData(`blueprints/${workspaceId}`);
      if (rawRoot && typeof rawRoot === 'object') {
        if (rawRoot.content || rawRoot.projectOverview) {
          bp = rawRoot;
        } else if (activeMvpId && rawRoot[activeMvpId] && (rawRoot[activeMvpId].content || rawRoot[activeMvpId].projectOverview)) {
          bp = rawRoot[activeMvpId];
        } else if (rawRoot.current && (rawRoot.current.content || rawRoot.current.projectOverview)) {
          bp = rawRoot.current;
        }
      }
    }

    // Fallback: If retrieved document has no content or is in a stale lock, recover latest completed version snapshot
    if (!bp || !bp.content) {
      const allVersions = (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions`)) ||
                          (await rtdbService.getData(`blueprints/${workspaceId}/versions`)) ||
                          bp?.versions ||
                          {};
      const validVersions = Object.values(allVersions).filter((v) => v && (v.content || v.projectOverview));
      if (validVersions.length > 0) {
        validVersions.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
        bp = {
          ...validVersions[0],
          status: 'completed',
          versions: allVersions,
        };
      }
    }

    if (!bp || !bp.content) {
      throw new Error('No active Blueprint found for this workspace. Please generate a Blueprint first.');
    }

    const userName = userRecord?.displayName || userRecord?.name || userRecord?.email?.split('@')[0] || 'Team Lead';

    return {
      bp,
      activeMvpId: activeMvpId || bp.mvpIdeaId || bp.ideaId || 'mvp',
      org: resolvedOrg,
      userRecord,
      userName,
      isOwner,
    };
  },

  /**
   * Canonical Helper: Atomically persist updated Blueprint document across all authoritative paths.
   */
  persistBlueprintUpdate: async (workspaceId, activeMvpId, updatedBp) => {
    const versionKey = `v${String(updatedBp.version || '1.0').replace(/\./g, '_')}`;
    await Promise.all([
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}`, updatedBp),
      rtdbService.setData(`blueprints/${workspaceId}/current`, updatedBp),
      rtdbService.setData(`blueprints/${workspaceId}/active`, updatedBp),
      rtdbService.setData(`blueprints/${workspaceId}/${activeMvpId}/versions/${versionKey}`, updatedBp),
      rtdbService.setData(`blueprints/${workspaceId}/versions/${versionKey}`, updatedBp),
    ]);
  },

  /**
   * Phase 5: Assign Team Member to Blueprint Execution Task Handler.
   */
  assignBlueprintTaskHandler: async (workspaceId, userUid, assignmentData = {}) => {
    const { taskId, assignedUserId } = assignmentData;
    if (!taskId) {
      throw new Error('Task ID is required for assignment.');
    }

    console.log(`👤 [Task Assignment Requested] Workspace: ${workspaceId} | Task: ${taskId} | Target User: ${assignedUserId || 'Unassigned'} | Caller: ${userUid}`);

    const { bp: existingBp, activeMvpId, org } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    let targetUserName = 'Unassigned';
    if (assignedUserId) {
      const [targetMember, targetUser] = await Promise.all([
        rtdbService.getData(`organization_members/${workspaceId}/${assignedUserId}`),
        rtdbService.getData(`users/${assignedUserId}`),
      ]);

      if (!targetMember && org.ownerId !== assignedUserId) {
        throw new Error('Target user is not a member of this workspace.');
      }

      targetUserName = targetUser?.displayName || targetUser?.name || targetUser?.email?.split('@')[0] || 'Team Member';
    }

    const content = existingBp.content;
    const tasks = content.execution?.tasks || [];
    const targetTask = tasks.find((t) => t.id === taskId);

    if (!targetTask) {
      throw new Error(`Task '${taskId}' not found in Blueprint execution plan.`);
    }

    // Update authoritative assignment fields
    targetTask.assignedUserId = assignedUserId || null;
    targetTask.assignedUserName = assignedUserId ? targetUserName : null;

    // Update connected live task if exists
    if (targetTask.convertedTaskId) {
      await rtdbService.updateData(`tasks/${workspaceId}/${targetTask.convertedTaskId}`, {
        assignedTo: assignedUserId || '',
        assignedToName: assignedUserId ? targetUserName : 'Unassigned',
        updatedAt: Date.now(),
      }).catch((err) => console.warn('[TaskSync Warning]', err.message));
    }

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`✅ [Task Assignment Completed] Task ${taskId} successfully assigned to ${targetUserName} (${assignedUserId || 'null'})`);

    return {
      success: true,
      taskId,
      assignedUserId: assignedUserId || null,
      assignedUserName: assignedUserId ? targetUserName : null,
      blueprint: updatedBp,
    };
  },

  /**
   * Phase 7: Approve Proposed Decision Handler.
   */
  approveDecisionHandler: async (workspaceId, userUid, payload = {}) => {
    const decisionId = payload.decisionId || payload;
    if (!workspaceId || !userUid || !decisionId) {
      throw new Error('Workspace ID, User UID, and Decision ID are required.');
    }

    const { bp: existingBp, activeMvpId, userName } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    const content = existingBp.content;
    const discIntel = content.intelligence?.discussionIntelligence || {};
    const decisions = discIntel.decisions || [];
    const targetDec = decisions.find((d) => d.id === decisionId);

    if (!targetDec) {
      throw new Error(`Decision '${decisionId}' not found in Blueprint.`);
    }

    targetDec.status = 'approved';
    targetDec.approvedBy = userUid;
    targetDec.approvedByName = userName;
    targetDec.approvedAt = Date.now();

    // Auto-resolve any referenced questions
    if (Array.isArray(targetDec.sourceQuestionIds) && discIntel.unresolvedQuestions) {
      discIntel.unresolvedQuestions.forEach((q) => {
        if (targetDec.sourceQuestionIds.includes(q.id)) {
          q.status = 'resolved';
          q.resolvedByDecisionId = targetDec.id;
        }
      });
    }

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`✅ [Decision Approved] ${decisionId} approved by ${userName} in workspace ${workspaceId}`);
    return { success: true, decision: targetDec, blueprint: updatedBp };
  },

  /**
   * Phase 7: Reject Proposed Decision Handler.
   */
  rejectDecisionHandler: async (workspaceId, userUid, payload = {}) => {
    const decisionId = payload.decisionId || payload;
    if (!workspaceId || !userUid || !decisionId) {
      throw new Error('Workspace ID, User UID, and Decision ID are required.');
    }

    const { bp: existingBp, activeMvpId, userName } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    const content = existingBp.content;
    const discIntel = content.intelligence?.discussionIntelligence || {};
    const decisions = discIntel.decisions || [];
    const targetDec = decisions.find((d) => d.id === decisionId);

    if (!targetDec) {
      throw new Error(`Decision '${decisionId}' not found in Blueprint.`);
    }

    targetDec.status = 'rejected';
    targetDec.approvedBy = userUid;
    targetDec.approvedByName = userName;
    targetDec.approvedAt = Date.now();

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`⛔ [Decision Rejected] ${decisionId} rejected by ${userName} in workspace ${workspaceId}`);
    return { success: true, decision: targetDec, blueprint: updatedBp };
  },

  /**
   * Phase 7: Create Authoritative Project Decision Handler.
   */
  createDecisionHandler: async (workspaceId, userUid, decisionData = {}) => {
    if (!workspaceId || !userUid || !decisionData.decision) {
      throw new Error('Workspace ID, User UID, and decision text are required.');
    }

    const { bp: existingBp, activeMvpId, userName } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    const content = existingBp.content;
    if (!content.intelligence) content.intelligence = {};
    if (!content.intelligence.discussionIntelligence) content.intelligence.discussionIntelligence = { decisions: [] };

    const discIntel = content.intelligence.discussionIntelligence;
    if (!Array.isArray(discIntel.decisions)) discIntel.decisions = [];

    const newId = `DEC-${String(discIntel.decisions.length + 1).padStart(2, '0')}`;
    const timestamp = Date.now();

    const newDecision = {
      id: newId,
      title: decisionData.title || decisionData.decision.substring(0, 50),
      decision: decisionData.decision.trim(),
      rationale: decisionData.rationale || 'Authoritative decision recorded by project lead.',
      category: decisionData.category || 'technology',
      status: 'approved',
      confidence: 'high',
      sourceDiscussionIds: decisionData.sourceDiscussionIds || [],
      affectedRequirementIds: decisionData.affectedRequirementIds || [],
      affectedFeatureIds: decisionData.affectedFeatureIds || [],
      affectedTaskIds: decisionData.affectedTaskIds || [],
      affectedRiskIds: decisionData.affectedRiskIds || [],
      affectedTestIds: decisionData.affectedTestIds || [],
      createdBy: userUid,
      createdByName: userName,
      approvedBy: userUid,
      approvedByName: userName,
      approvedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      source: 'user_defined',
    };

    discIntel.decisions.push(newDecision);

    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`✅ [Decision Created] ${newId} created and approved by ${userName} in workspace ${workspaceId}`);
    return { success: true, decision: newDecision, blueprint: updatedBp };
  },

  /**
   * Phase 7: Approve Change Recommendation Handler.
   */
  approveChangeRecommendationHandler: async (workspaceId, userUid, payload = {}) => {
    const recommendationId = payload.recommendationId || payload;
    if (!workspaceId || !userUid || !recommendationId) {
      throw new Error('Workspace ID, User UID, and recommendation ID are required.');
    }

    const { bp: existingBp, activeMvpId, userName } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    const content = existingBp.content;
    const discIntel = content.intelligence?.discussionIntelligence || {};
    const recs = discIntel.changeRecommendations || [];
    const targetRec = recs.find((r) => r.id === recommendationId);

    if (!targetRec) {
      throw new Error(`Change recommendation '${recommendationId}' not found in Blueprint.`);
    }

    targetRec.status = 'approved';
    targetRec.reviewedBy = userUid;
    targetRec.reviewedByName = userName;
    targetRec.reviewedAt = Date.now();

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`✅ [Change Recommendation Approved] ${recommendationId} approved by ${userName}`);
    return { success: true, changeRecommendation: targetRec, blueprint: updatedBp };
  },

  /**
   * Phase 7: Reject Change Recommendation Handler.
   */
  rejectChangeRecommendationHandler: async (workspaceId, userUid, payload = {}) => {
    const recommendationId = payload.recommendationId || payload;
    if (!workspaceId || !userUid || !recommendationId) {
      throw new Error('Workspace ID, User UID, and recommendation ID are required.');
    }

    const { bp: existingBp, activeMvpId, userName } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);

    const content = existingBp.content;
    const discIntel = content.intelligence?.discussionIntelligence || {};
    const recs = discIntel.changeRecommendations || [];
    const targetRec = recs.find((r) => r.id === recommendationId);

    if (!targetRec) {
      throw new Error(`Change recommendation '${recommendationId}' not found in Blueprint.`);
    }

    targetRec.status = 'rejected';
    targetRec.reviewedBy = userUid;
    targetRec.reviewedByName = userName;
    targetRec.reviewedAt = Date.now();

    const timestamp = Date.now();
    const updatedBp = {
      ...existingBp,
      updatedAt: timestamp,
      content,
    };

    await blueprintController.persistBlueprintUpdate(workspaceId, activeMvpId, updatedBp);

    console.log(`⛔ [Change Recommendation Rejected] ${recommendationId} rejected by ${userName}`);
    return { success: true, changeRecommendation: targetRec, blueprint: updatedBp };
  },

  /**
   * Dedicated On-Demand Task Synchronization Handler.
   * Synchronizes Blueprint planned tasks into the Task Board execution layer.
   */
  syncBlueprintTasksHandler: async (workspaceId, userUid, payload = {}) => {
    if (!workspaceId || !userUid) {
      throw new Error('Workspace ID and User UID are required.');
    }

    const { bp: existingBp, activeMvpId } = await blueprintController.resolveActiveBlueprintRecord(workspaceId, userUid);
    let targetDoc = existingBp;

    const cleanVerKey = extractCanonicalVersionKey(payload);
    if (cleanVerKey) {
      const versionSnapshot =
        (await rtdbService.getData(`blueprints/${workspaceId}/${activeMvpId}/versions/${cleanVerKey}`)) ||
        (await rtdbService.getData(`blueprints/${workspaceId}/versions/${cleanVerKey}`));
      if (versionSnapshot && (versionSnapshot.content || versionSnapshot.projectOverview)) {
        targetDoc = versionSnapshot;
      }
    }

    const syncResults = await taskSyncService.synchronizeBlueprintTasks(workspaceId, targetDoc, userUid);
    return syncResults;
  },
};

export default blueprintController;


