/**
 * Single Authoritative Database Paths for Firebase Realtime Database.
 * Shared between backend services and frontend models.
 */
export const DB_PATHS = {
  USERS: 'users',
  USER_NOTIFICATIONS: 'user_notifications',
  ORGANIZATIONS: 'organizations',
  ORGANIZATION_MEMBERS: 'organization_members',
  WORKSPACES_METADATA: 'workspaces',
  IDEAS: 'ideas',
  DISCUSSIONS: 'discussions',
  BLUEPRINTS: 'blueprints',
  TASKS: 'tasks',
  PLATFORM_SETTINGS: 'platform_settings',
  ANNOUNCEMENTS: 'announcements',
  CHAT_MESSAGES: 'chat_messages',
  GLOBAL_STATS: 'globalStats',
};

/**
 * Builds the canonical RTDB path for workspace discussions: discussions/{orgId}/{ideaId}/{discussionId}
 * Strictly requires a non-empty orgId and ideaId. Never defaults to public!
 */
export const getWorkspaceDiscussionPath = (orgId, ideaId, discussionId = null) => {
  if (!orgId || typeof orgId !== 'string' || !orgId.trim()) {
    throw new Error('[databasePaths] orgId is required for workspace discussion path.');
  }
  if (!ideaId || typeof ideaId !== 'string' || !ideaId.trim()) {
    throw new Error('[databasePaths] ideaId is required for workspace discussion path.');
  }
  const cleanOrg = orgId.trim();
  const cleanIdea = ideaId.trim();
  if (!discussionId) return `discussions/${cleanOrg}/${cleanIdea}`;
  return `discussions/${cleanOrg}/${cleanIdea}/${String(discussionId).trim()}`;
};

/**
 * Builds the canonical RTDB path for public discussions: discussions/public/{ideaId}/{discussionId}
 * Strictly requires a non-empty ideaId.
 */
export const getPublicDiscussionPath = (ideaId, discussionId = null) => {
  if (!ideaId || typeof ideaId !== 'string' || !ideaId.trim()) {
    throw new Error('[databasePaths] ideaId is required for public discussion path.');
  }
  const cleanIdea = ideaId.trim();
  if (!discussionId) return `discussions/public/${cleanIdea}`;
  return `discussions/public/${cleanIdea}/${String(discussionId).trim()}`;
};

/**
 * Unified discussion path builder with explicit scope selection.
 * Supports:
 *   getDiscussionPath({ scope: 'workspace' | 'public', orgId, ideaId, discussionId })
 *   getDiscussionPath(orgId, ideaId, discussionId) -> workspace path (requires orgId)
 */
export const getDiscussionPath = (arg1, arg2 = null, arg3 = null) => {
  if (arg1 && typeof arg1 === 'object') {
    const { scope = 'workspace', orgId, ideaId, discussionId = null } = arg1;
    if (scope === 'public') {
      return getPublicDiscussionPath(ideaId, discussionId);
    }
    return getWorkspaceDiscussionPath(orgId, ideaId, discussionId);
  }

  const orgId = arg1;
  const ideaId = arg2;
  const discussionId = arg3;

  if (orgId === 'public' || orgId === null || orgId === undefined) {
    if (orgId === 'public') {
      return getPublicDiscussionPath(ideaId, discussionId);
    }
    throw new Error('[databasePaths] Missing orgId. For public discussions, explicitly use getPublicDiscussionPath(ideaId) or pass orgId = "public".');
  }

  return getWorkspaceDiscussionPath(orgId, ideaId, discussionId);
};
