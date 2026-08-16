import React, { useState, useEffect } from 'react';
import { rtdbService } from '../../services/rtdbService';
import { Users, Briefcase, Globe, ThumbsUp, MessageSquare, CheckSquare, Zap, Megaphone } from 'lucide-react';

export function RealtimePlatformStats() {
  const [counts, setCounts] = useState({
    users: 0,
    workspaces: 0,
    proposals: 0,
    votes: 0,
    comments: 0,
    tasks: 0,
    blueprints: 0,
    announcements: 0,
  });

  useEffect(() => {
    let usersCount = 0;
    let orgsMap = {};
    let wsMap = {};
    let ideasMap = {};
    let publicIdeasMap = {};
    let votesMap = {};
    let discussionsMap = {};
    let tasksMap = {};
    let blueprintsMap = {};
    let announcementsCount = 0;

    const updateStats = () => {
      // 1. Unique Workspaces count
      const allWsIds = new Set();
      Object.entries(orgsMap || {}).forEach(([id, val]) => {
        if (val && !val.isDeleted) allWsIds.add(id);
      });
      Object.entries(wsMap || {}).forEach(([id, val]) => {
        if (val && !val.isDeleted) allWsIds.add(id);
      });

      // 2. Proposals count (workspace ideas + public ideas)
      let proposalCount = 0;
      let calculatedVotes = 0;

      Object.values(ideasMap || {}).forEach((wsIdeas) => {
        if (wsIdeas && typeof wsIdeas === 'object') {
          Object.values(wsIdeas).forEach((idea) => {
            if (idea && !idea.isDeleted) {
              proposalCount++;
              if (idea.voteCount) calculatedVotes += idea.voteCount;
              else if (idea.upvotedBy && typeof idea.upvotedBy === 'object') {
                calculatedVotes += Object.keys(idea.upvotedBy).length;
              }
            }
          });
        }
      });

      Object.values(publicIdeasMap || {}).forEach((idea) => {
        if (idea && !idea.isDeleted) {
          proposalCount++;
          if (idea.voteCount) calculatedVotes += idea.voteCount;
        }
      });

      // 3. Direct Votes node count
      let directVotesCount = 0;
      Object.values(votesMap || {}).forEach((item) => {
        if (item && typeof item === 'object') {
          directVotesCount += Object.keys(item).length;
        } else if (item) {
          directVotesCount++;
        }
      });
      const totalVotes = Math.max(calculatedVotes, directVotesCount);

      // 4. Comments count
      let commentsCount = 0;
      Object.values(discussionsMap || {}).forEach((itemMap) => {
        if (itemMap && typeof itemMap === 'object') {
          commentsCount += Object.keys(itemMap).length;
        }
      });

      // 5. Tasks count
      let tasksCount = 0;
      Object.values(tasksMap || {}).forEach((wsTasks) => {
        if (wsTasks && typeof wsTasks === 'object') {
          Object.values(wsTasks).forEach((t) => {
            if (t && !t.isDeleted) tasksCount++;
          });
        }
      });

      // 6. Blueprints count
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

      setCounts({
        users: usersCount,
        workspaces: allWsIds.size,
        proposals: proposalCount,
        votes: totalVotes,
        comments: commentsCount,
        tasks: tasksCount,
        blueprints: blueprintsCount,
        announcements: announcementsCount,
      });
    };

    // Subscriptions
    const unsubUsers = rtdbService.subscribe('users', (data) => {
      usersCount = data && typeof data === 'object' ? Object.keys(data).length : 0;
      updateStats();
    });

    const unsubOrgs = rtdbService.subscribe('organizations', (data) => {
      orgsMap = data || {};
      updateStats();
    });

    const unsubWs = rtdbService.subscribe('workspaces', (data) => {
      wsMap = data || {};
      updateStats();
    });

    const unsubIdeas = rtdbService.subscribe('ideas', (data) => {
      ideasMap = data || {};
      updateStats();
    });

    const unsubPublicIdeas = rtdbService.subscribe('publicIdeas', (data) => {
      publicIdeasMap = data || {};
      updateStats();
    });

    const unsubVotes = rtdbService.subscribe('votes', (data) => {
      votesMap = data || {};
      updateStats();
    });

    const unsubDiscussions = rtdbService.subscribe('discussions', (data) => {
      discussionsMap = data || {};
      updateStats();
    });

    const unsubTasks = rtdbService.subscribe('tasks', (data) => {
      tasksMap = data || {};
      updateStats();
    });

    const unsubBlueprints = rtdbService.subscribe('blueprints', (data) => {
      blueprintsMap = data || {};
      updateStats();
    });

    const unsubAnnouncements = rtdbService.subscribe('announcements', (data) => {
      announcementsCount = data && typeof data === 'object' ? Object.keys(data).length : 0;
      updateStats();
    });

    return () => {
      if (typeof unsubUsers === 'function') unsubUsers();
      if (typeof unsubOrgs === 'function') unsubOrgs();
      if (typeof unsubWs === 'function') unsubWs();
      if (typeof unsubIdeas === 'function') unsubIdeas();
      if (typeof unsubPublicIdeas === 'function') unsubPublicIdeas();
      if (typeof unsubVotes === 'function') unsubVotes();
      if (typeof unsubDiscussions === 'function') unsubDiscussions();
      if (typeof unsubTasks === 'function') unsubTasks();
      if (typeof unsubBlueprints === 'function') unsubBlueprints();
      if (typeof unsubAnnouncements === 'function') unsubAnnouncements();
    };
  }, []);

  const ALL_ITEMS = [
    { label: 'Active Users', val: counts.users, icon: Users, color: 'text-indigo-400' },
    { label: 'Workspaces', val: counts.workspaces, icon: Briefcase, color: 'text-purple-400' },
    { label: 'Proposals', val: counts.proposals, icon: Globe, color: 'text-sky-400' },
    { label: 'Upvotes Cast', val: counts.votes, icon: ThumbsUp, color: 'text-emerald-400' },
    { label: 'Comments', val: counts.comments, icon: MessageSquare, color: 'text-amber-400' },
    { label: 'Tasks Created', val: counts.tasks, icon: CheckSquare, color: 'text-rose-400' },
    { label: 'AI Blueprints', val: counts.blueprints, icon: Zap, color: 'text-purple-300' },
    { label: 'Announcements', val: counts.announcements, icon: Megaphone, color: 'text-indigo-300' },
  ];

  // Display ONLY items with REAL active data (> 0)
  const activeItems = ALL_ITEMS.filter((item) => item.val > 0);
  const itemsToRender = activeItems.length > 0 ? activeItems : ALL_ITEMS.filter(item => item.val > 0);

  if (itemsToRender.length === 0) {
    return null; // Don't render empty zeros section if no telemetry data
  }

  return (
    <section id="stats" className="py-20 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
            Live Platform Telemetry
          </span>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Realtime Platform Statistics
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Live activity telemetry metrics from active workspaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 max-w-5xl mx-auto">
          {itemsToRender.map((item) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.label}
                className="w-36 sm:w-44 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center text-center space-y-3 shadow-xl hover:border-purple-500/40 transition-all"
              >
                <div className={`p-2.5 rounded-xl bg-slate-950 border border-slate-800 ${item.color}`}>
                  <IconComp className="h-5 w-5" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
                  {item.val}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
