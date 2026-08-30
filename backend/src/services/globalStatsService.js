/**
 * Global Statistics Aggregation Service (Backend)
 * Reads private collections securely using Firebase Admin SDK and writes
 * aggregated, non-sensitive telemetry counters to the public 'globalStats' node.
 * Strictly avoids exposing individual user profiles, workspace IDs, or proposal contents.
 */

import { rtdbService } from './rtdbService.js';

export const globalStatsService = {
  /**
   * Reads raw collections via Firebase Admin SDK, computes aggregates,
   * and idempotently persists the public 'globalStats' document in RTDB.
   */
  calculateAndSyncGlobalStats: async () => {
    try {
      console.log('🔄 [globalStatsService] Aggregating platform telemetry from private roots...');

      // Fetch private collections in parallel via Firebase Admin SDK
      const [
        usersMap,
        orgsMap,
        wsMap,
        ideasMap,
        publicIdeasMap,
        votesMap,
        discussionsMap,
        tasksMap,
        blueprintsMap,
        announcementsMap,
      ] = await Promise.all([
        rtdbService.getData('users').catch(() => ({})),
        rtdbService.getData('organizations').catch(() => ({})),
        rtdbService.getData('workspaces').catch(() => ({})),
        rtdbService.getData('ideas').catch(() => ({})),
        rtdbService.getData('publicIdeas').catch(() => ({})),
        rtdbService.getData('votes').catch(() => ({})),
        rtdbService.getData('discussions').catch(() => ({})),
        rtdbService.getData('tasks').catch(() => ({})),
        rtdbService.getData('blueprints').catch(() => ({})),
        rtdbService.getData('announcements').catch(() => ({})),
      ]);

      // 1. Registered Users Count
      const usersCount = usersMap && typeof usersMap === 'object' ? Object.keys(usersMap).length : 0;

      // 2. Unique Active Workspaces Count
      const allWsIds = new Set();
      Object.entries(orgsMap || {}).forEach(([id, val]) => {
        if (val && !val.isDeleted) allWsIds.add(id);
      });
      Object.entries(wsMap || {}).forEach(([id, val]) => {
        if (val && !val.isDeleted) allWsIds.add(id);
      });
      const workspacesCount = allWsIds.size;

      // 3. Workspace Ideas, MVPs & Calculated Votes
      let workspaceIdeasCount = 0;
      let mvpsCount = 0;
      let calculatedVotes = 0;

      Object.values(ideasMap || {}).forEach((wsIdeas) => {
        if (wsIdeas && typeof wsIdeas === 'object') {
          Object.values(wsIdeas).forEach((idea) => {
            if (idea && !idea.isDeleted) {
              workspaceIdeasCount++;
              if (idea.isSelected || idea.projectStatus === 'Selected MVP' || idea.status === 'selected') {
                mvpsCount++;
              }
              if (idea.voteCount) {
                calculatedVotes += Number(idea.voteCount) || 0;
              } else if (idea.upvotedBy && typeof idea.upvotedBy === 'object') {
                calculatedVotes += Object.keys(idea.upvotedBy).length;
              }
            }
          });
        }
      });

      // 4. Public Ideas Count
      let publicIdeasCount = 0;
      Object.values(publicIdeasMap || {}).forEach((idea) => {
        if (idea && !idea.isDeleted) {
          publicIdeasCount++;
          if (idea.voteCount) calculatedVotes += Number(idea.voteCount) || 0;
        }
      });
      const totalProposalCount = workspaceIdeasCount + publicIdeasCount;

      // 5. Total Votes (Direct nodes vs idea counters)
      let directVotesCount = 0;
      Object.values(votesMap || {}).forEach((item) => {
        if (item && typeof item === 'object') {
          directVotesCount += Object.keys(item).length;
        } else if (item) {
          directVotesCount++;
        }
      });
      const totalVotes = Math.max(calculatedVotes, directVotesCount);

      // 6. Comments & Suggestions Count (Supports 2-level and 3-level tree schemas)
      let commentsCount = 0;
      function countDiscussionLeaves(node) {
        if (!node || typeof node !== 'object') return;
        if (node.discussionId || (node.message && node.authorId)) {
          if (!node.isDeleted) commentsCount++;
          return;
        }
        Object.values(node).forEach((child) => countDiscussionLeaves(child));
      }
      countDiscussionLeaves(discussionsMap);

      // 7. Tasks Count
      let tasksCount = 0;
      Object.values(tasksMap || {}).forEach((wsTasks) => {
        if (wsTasks && typeof wsTasks === 'object') {
          Object.values(wsTasks).forEach((t) => {
            if (t && !t.isDeleted) tasksCount++;
          });
        }
      });

      // 8. Blueprints Count
      let blueprintsCount = 0;
      Object.values(blueprintsMap || {}).forEach((wsBp) => {
        if (wsBp && typeof wsBp === 'object') {
          Object.values(wsBp).forEach((bp) => {
            if (bp && typeof bp === 'object' && (bp.blueprintId || bp.status || bp.content || bp.ideaTitle || bp.version)) {
              blueprintsCount++;
            }
          });
        }
      });

      // 9. Announcements Count
      const announcementsCount = announcementsMap && typeof announcementsMap === 'object' ? Object.keys(announcementsMap).length : 0;

      const timestamp = Date.now();

      const statsPayload = {
        totalUsers: usersCount,
        totalWorkspaces: workspacesCount,
        totalIdeas: totalProposalCount,
        totalPublicIdeas: publicIdeasCount,
        totalMvps: mvpsCount,
        totalVotes: totalVotes,
        totalComments: commentsCount,
        totalTasks: tasksCount,
        totalBlueprints: blueprintsCount,
        totalAnnouncements: announcementsCount,

        // Direct alias properties for seamless consumption
        users: usersCount,
        workspaces: workspacesCount,
        proposals: totalProposalCount,
        publicIdeas: publicIdeasCount,
        mvps: mvpsCount,
        votes: totalVotes,
        comments: commentsCount,
        tasks: tasksCount,
        blueprints: blueprintsCount,
        announcements: announcementsCount,

        updatedAt: timestamp,
      };

      await rtdbService.setData('globalStats', statsPayload);
      console.log(`✅ [globalStatsService] 'globalStats' successfully synchronized (Users: ${usersCount}, Workspaces: ${workspacesCount}, Proposals: ${totalProposalCount}, Tasks: ${tasksCount})`);

      return statsPayload;
    } catch (err) {
      console.error('🚨 [globalStatsService] Failed to calculate and sync globalStats:', err.message);
      return null;
    }
  },

  /**
   * Retrieves the current 'globalStats' document snapshot.
   */
  getGlobalStats: async () => {
    try {
      const stats = await rtdbService.getData('globalStats');
      if (stats && typeof stats === 'object') {
        return stats;
      }
      // Fallback default structure
      return {
        totalUsers: 0,
        totalWorkspaces: 0,
        totalIdeas: 0,
        totalPublicIdeas: 0,
        totalMvps: 0,
        totalVotes: 0,
        totalComments: 0,
        totalTasks: 0,
        totalBlueprints: 0,
        totalAnnouncements: 0,
        users: 0,
        workspaces: 0,
        proposals: 0,
        publicIdeas: 0,
        mvps: 0,
        votes: 0,
        comments: 0,
        tasks: 0,
        blueprints: 0,
        announcements: 0,
        updatedAt: Date.now(),
      };
    } catch (err) {
      console.error('🚨 [globalStatsService] Failed to get globalStats:', err.message);
      return null;
    }
  },
};
