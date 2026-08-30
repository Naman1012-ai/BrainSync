import { rtdbService } from './rtdbService';
import {
  getWorkspaceDiscussionPath,
  getPublicDiscussionPath,
  getDiscussionPath,
} from '../constants/databasePaths';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Service Layer for Unified Discussion System (Comments, Suggestions, Questions, Replies).
 * Canonical Workspace Schema: discussions/{orgId}/{ideaId}/{discussionId}
 * Canonical Public Schema:    discussions/public/{ideaId}/{discussionId}
 * Legacy Schema (Fallback):   discussions/{ideaId}/{discussionId} (Requires ownership verification)
 */
export const discussionService = {
  /**
   * Verifies that the requested ideaId legitimately belongs to the declared boundary.
   * - Workspace scope: verifies that ideas/{orgId}/{ideaId} exists and is not deleted.
   * - Public scope: verifies that publicIdeas/{ideaId} exists and is not deleted.
   */
  verifyIdeaOwnership: async (orgId, ideaId, isPublic = false) => {
    if (!ideaId) return false;
    try {
      if (isPublic || orgId === 'public') {
        const publicIdea = await rtdbService.getData(`publicIdeas/${ideaId}`);
        return Boolean(publicIdea && typeof publicIdea === 'object' && !publicIdea.isDeleted);
      }
      if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
        return false;
      }
      const workspaceIdea = await rtdbService.getData(`ideas/${orgId.trim()}/${ideaId}`);
      return Boolean(workspaceIdea && typeof workspaceIdea === 'object' && !workspaceIdea.isDeleted);
    } catch (e) {
      console.warn('[discussionService] verifyIdeaOwnership check failed:', e.message);
      return false;
    }
  },

  /**
   * Post a new discussion item or threaded reply.
   */
  createDiscussion: async (author, discussionData) => {
    const { ideaId, orgId, isPublic = false, type, message, parentId = null } = discussionData;

    if (!author || !author.uid) throw new Error('User authentication required.');
    if (!ideaId || !message.trim()) throw new Error('Idea ID and message content are required.');

    // Enforce explicit workspace boundary requirement
    if (!isPublic && (!orgId || typeof orgId !== 'string' || !orgId.trim())) {
      throw new Error('Organization ID is required for workspace discussions.');
    }

    // Enforce Platform Settings Validation
    const platformSettings = await rtdbService.getData('platform_settings');
    const iSettings = platformSettings?.ideas || {};

    if (type === 'suggestion' && iSettings.enableSuggestions === false) {
      throw new Error('Community suggestions have been disabled by the platform administrator.');
    }
    if ((type === 'comment' || !type) && iSettings.enableComments === false) {
      throw new Error('Discussion comments have been disabled by the platform administrator.');
    }

    const discussionId = `disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const newDiscussion = {
      discussionId,
      ideaId,
      orgId: isPublic ? null : orgId.trim(),
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
      // Build canonical path explicitly without implicit fallback
      const canonicalPath = isPublic
        ? getPublicDiscussionPath(ideaId, discussionId)
        : getWorkspaceDiscussionPath(orgId, ideaId, discussionId);

      await rtdbService.setData(canonicalPath, newDiscussion);

      // Recalculate and update type counters on parent idea
      await discussionService.recalculateCounters(orgId, ideaId, isPublic);

      return newDiscussion;
    } catch (error) {
      console.error('[discussionService] createDiscussion error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Real-time subscription to discussions for an idea.
   * Signature: subscribeToDiscussions({ scope, orgId, ideaId, isPublic }, callback)
   * Or canonical 3-argument: subscribeToDiscussions(orgId, ideaId, callback, isPublic)
   */
  subscribeToDiscussions: (arg1, arg2, arg3, arg4 = false) => {
    let orgId = null;
    let ideaId = null;
    let callback = null;
    let isPublic = false;

    if (arg1 && typeof arg1 === 'object' && typeof arg2 === 'function') {
      // Configuration object signature
      orgId = arg1.orgId || null;
      ideaId = arg1.ideaId || null;
      isPublic = Boolean(arg1.isPublic || !arg1.orgId);
      callback = arg2;
    } else if (typeof arg2 === 'function') {
      // Legacy 2-argument signature: (ideaId, callback) -> treated as public
      ideaId = arg1;
      callback = arg2;
      isPublic = true;
    } else {
      // Canonical signature: (orgId, ideaId, callback, isPublic)
      orgId = arg1;
      ideaId = arg2;
      callback = arg3;
      isPublic = Boolean(arg4 || !arg1 || arg1 === 'public');
    }

    if (!ideaId || typeof callback !== 'function') {
      if (typeof callback === 'function') callback([]);
      return () => {};
    }

    const canonicalCollectionPath = isPublic
      ? getPublicDiscussionPath(ideaId)
      : getWorkspaceDiscussionPath(orgId, ideaId);

    return rtdbService.subscribe(canonicalCollectionPath, async (discussionsObj) => {
      let activeSource = discussionsObj;

      // Backward-compatibility: If canonical path is empty, verify ownership BEFORE reading legacy path
      if (!activeSource || Object.keys(activeSource).length === 0) {
        const isOwnershipVerified = await discussionService.verifyIdeaOwnership(orgId, ideaId, isPublic);
        if (isOwnershipVerified) {
          try {
            const legacyData = await rtdbService.getData(`discussions/${ideaId}`);
            if (legacyData && Object.keys(legacyData).length > 0) {
              activeSource = legacyData;
            }
          } catch (e) {
            // Ignore legacy fallback errors
          }
        }
      }

      if (!activeSource) {
        callback([]);
        return;
      }

      const allItems = Object.values(activeSource).filter((d) => d && typeof d === 'object' && !d.isDeleted);

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
   * Fetch discussions snapshot with verified ownership fallback.
   */
  getDiscussions: async (orgId, ideaId, isPublic = false) => {
    if (!ideaId) return [];
    try {
      const canonicalPath = isPublic || !orgId
        ? getPublicDiscussionPath(ideaId)
        : getWorkspaceDiscussionPath(orgId, ideaId);

      let discObj = await rtdbService.getData(canonicalPath);

      // Fallback check with verified ownership check
      if (!discObj || Object.keys(discObj).length === 0) {
        const isOwnershipVerified = await discussionService.verifyIdeaOwnership(orgId, ideaId, isPublic);
        if (isOwnershipVerified) {
          discObj = await rtdbService.getData(`discussions/${ideaId}`);
        }
      }

      if (!discObj) return [];
      return Object.values(discObj).filter((d) => d && typeof d === 'object' && !d.isDeleted);
    } catch (error) {
      console.error('[discussionService] getDiscussions error:', error);
      return [];
    }
  },

  /**
   * Update an existing discussion item (Author only).
   */
  updateDiscussion: async (orgId, ideaId, discussionId, updates, isPublic = false) => {
    try {
      const canonicalPath = isPublic || !orgId
        ? getPublicDiscussionPath(ideaId, discussionId)
        : getWorkspaceDiscussionPath(orgId, ideaId, discussionId);

      await rtdbService.updateData(canonicalPath, {
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
  deleteDiscussion: async (orgId, ideaId, discussionId, isPublic = false) => {
    try {
      const canonicalPath = isPublic || !orgId
        ? getPublicDiscussionPath(ideaId, discussionId)
        : getWorkspaceDiscussionPath(orgId, ideaId, discussionId);

      await rtdbService.updateData(canonicalPath, {
        isDeleted: true,
        updatedAt: Date.now(),
      });

      await discussionService.recalculateCounters(orgId, ideaId, isPublic);
    } catch (error) {
      console.error('[discussionService] deleteDiscussion error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Toggle suggestion acceptance state (Idea Owner action).
   */
  toggleAcceptSuggestion: async (orgId, ideaId, discussionId, currentAccepted, isPublic = false) => {
    try {
      const canonicalPath = isPublic || !orgId
        ? getPublicDiscussionPath(ideaId, discussionId)
        : getWorkspaceDiscussionPath(orgId, ideaId, discussionId);

      await rtdbService.updateData(canonicalPath, {
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
  recalculateCounters: async (orgId, ideaId, isPublic = false) => {
    try {
      const canonicalPath = isPublic || !orgId
        ? getPublicDiscussionPath(ideaId)
        : getWorkspaceDiscussionPath(orgId, ideaId);

      let discObj = (await rtdbService.getData(canonicalPath)) || {};

      // Fallback check with ownership verification
      if (Object.keys(discObj).length === 0) {
        const isOwnershipVerified = await discussionService.verifyIdeaOwnership(orgId, ideaId, isPublic);
        if (isOwnershipVerified) {
          discObj = (await rtdbService.getData(`discussions/${ideaId}`)) || {};
        }
      }

      const activeItems = Object.values(discObj).filter((d) => d && typeof d === 'object' && !d.isDeleted);

      let commentCount = 0;
      let suggestionCount = 0;
      let questionCount = 0;

      activeItems.forEach((item) => {
        if (item.type === 'suggestion') suggestionCount++;
        else if (item.type === 'question') questionCount++;
        else commentCount++;
      });

      const ideaPath = isPublic || !orgId
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
