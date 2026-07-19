import { rtdbService } from './rtdbService';
import { orgService } from './orgService';
import { ideaService } from './ideaService';
import { taskService } from './taskService';
import { blueprintService } from './blueprintService';

const CACHE_PREFIX = 'brainsync_dashboard_cache_';

export const dashboardService = {
  /**
   * Synchronously read last known snapshot from localStorage.
   */
  getCachedDashboardData: (userId) => {
    if (!userId) return null;
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[dashboardService] Failed to parse localStorage cache:', e);
    }
    return null;
  },

  /**
   * Write fresh snapshot to localStorage cache.
   */
  setCachedDashboardData: (userId, data) => {
    if (!userId || !data) return;
    try {
      localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(data));
    } catch (e) {
      console.warn('[dashboardService] Failed to write localStorage cache:', e);
    }
  },

  /**
   * Real-time Database Data Pipeline: Fetch direct, accurate stats from Firebase RTDB.
   */
  fetchFreshDashboardData: async (user) => {
    if (!user || !user.uid) return null;

    const userId = user.uid;

    try {
      // 1. Fetch user's active workspaces, global public ideas, and votes in parallel
      const [allOrgs, publicIdeasObj, votesObj] = await Promise.all([
        orgService.getUserOrganizations(userId),
        rtdbService.getData('publicIdeas'),
        rtdbService.getData('votes'),
      ]);

      // Filter workspaces where user is an active member or owner and not deleted
      const userOrgs = (allOrgs || []).filter((org) => org && org.isMember && !org.isDeleted);

      // Filter public ideas created by user
      const publicIdeas = Object.values(publicIdeasObj || {}).filter((i) => i && !i.isDeleted);
      const userPublicIdeas = publicIdeas.filter(
        (i) => i.authorId === userId || i.createdBy === userId
      );

      // Filter votes cast by user
      const userVotes = Object.values(votesObj || {}).filter(
        (v) => v && (v.uid === userId || v.userId === userId)
      );

      // 2. Fetch workspace-level ideas and tasks for all user workspaces in parallel
      const orgDataPromises = userOrgs.map(async (org) => {
        const [ideas, tasks] = await Promise.all([
          ideaService.getIdeas(org.orgId),
          taskService.getTasks(org.orgId),
        ]);

        const myWorkspaceIdeas = (ideas || []).filter(
          (i) => i && !i.isDeleted && (i.authorId === userId || i.createdBy === userId)
        );
        const assignedTasks = (tasks || []).filter(
          (t) => t && !t.isDeleted && t.assignedTo === userId
        );

        return {
          orgId: org.orgId,
          myWorkspaceIdeas,
          allOrgTasks: (tasks || []).filter((t) => t && !t.isDeleted),
          assignedTasks,
        };
      });

      const orgResults = await Promise.all(orgDataPromises);

      // 3. Aggregate Stats & Activity Logs
      let totalWorkspaceIdeasCount = 0;
      let allUserAssignedTasks = [];
      let activityLog = [];

      userPublicIdeas.forEach((idea) => {
        activityLog.push({
          type: 'idea_public',
          title: `You proposed public idea: "${idea.title}"`,
          timestamp: idea.createdAt || Date.now(),
        });
      });

      userVotes.forEach((v) => {
        activityLog.push({
          type: 'vote',
          title: `You voted on a proposal`,
          timestamp: v.createdAt || Date.now(),
        });
      });

      orgResults.forEach((res) => {
        totalWorkspaceIdeasCount += res.myWorkspaceIdeas.length;

        const targetOrg = userOrgs.find((o) => o.orgId === res.orgId);
        const orgName = targetOrg ? targetOrg.name : 'Workspace';

        res.myWorkspaceIdeas.forEach((idea) => {
          activityLog.push({
            type: 'idea_workspace',
            title: `You proposed idea: "${idea.title}" in ${orgName}`,
            timestamp: idea.createdAt || Date.now(),
          });
        });

        res.assignedTasks.forEach((task) => {
          allUserAssignedTasks.push(task);
          if (task.status === 'Completed' || task.status === 'completed') {
            activityLog.push({
              type: 'task_complete',
              title: `You completed task: "${task.title}"`,
              timestamp: task.completedAt || task.updatedAt || Date.now(),
            });
          } else {
            activityLog.push({
              type: 'task_assigned',
              title: `Assigned task: "${task.title}"`,
              timestamp: task.createdAt || Date.now(),
            });
          }
        });
      });

      const completedTasksCount = allUserAssignedTasks.filter(
        (t) => t.status === 'Completed' || t.status === 'completed'
      ).length;

      // 4. Primary Active Workspace Specs
      const primaryOrg = userOrgs.length > 0 ? userOrgs[0] : null;
      let activeOrgMembers = 0;
      let activeOrgBlueprint = null;
      let activeOrgProgress = 0;

      if (primaryOrg) {
        const primaryResult = orgResults.find((r) => r.orgId === primaryOrg.orgId);
        const primaryTasks = primaryResult ? primaryResult.allOrgTasks : [];

        const [membersList, bp] = await Promise.all([
          orgService.getOrganizationMembers(primaryOrg.orgId),
          primaryOrg.status === 'project'
            ? blueprintService.getBlueprint(primaryOrg.orgId)
            : Promise.resolve(null),
        ]);

        activeOrgMembers = membersList.length;
        activeOrgBlueprint = bp;

        if (primaryTasks.length > 0) {
          const done = primaryTasks.filter(
            (t) => t.status === 'Completed' || t.status === 'completed'
          ).length;
          activeOrgProgress = Math.round((done / primaryTasks.length) * 100);
        }
      }

      // Sort Activity & Upcoming Deadlines
      activityLog.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const recentActivity = activityLog.slice(0, 6);

      const upcomingDeadlines = allUserAssignedTasks
        .filter((t) => t.status !== 'Completed' && t.status !== 'completed' && t.dueDate)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 4);

      const freshPayload = {
        organizations: userOrgs,
        stats: {
          totalWorkspaces: userOrgs.length,
          ideasCreated: userPublicIdeas.length + totalWorkspaceIdeasCount,
          ideasVoted: userVotes.length,
          assignedTasks: allUserAssignedTasks.length,
          completedTasks: completedTasksCount,
        },
        activeOrg: primaryOrg,
        activeOrgMembers,
        activeOrgBlueprint,
        activeOrgProgress,
        recentActivity,
        upcomingDeadlines,
        timestamp: Date.now(),
      };

      return freshPayload;
    } catch (error) {
      console.error('[dashboardService] fetchFreshDashboardData error:', error);
      throw error;
    }
  },
};
