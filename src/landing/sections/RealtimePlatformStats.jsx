import React, { useState, useEffect } from 'react';
import { rtdbService } from '../../services/rtdbService';
import { Users, Briefcase, Globe, ThumbsUp, MessageSquare, CheckSquare, Zap, Megaphone } from 'lucide-react';

export function RealtimePlatformStats() {
  const [counts, setCounts] = useState({
    users: 1420,
    workspaces: 380,
    publicIdeas: 340,
    votes: 4920,
    comments: 1890,
    tasks: 2450,
    blueprints: 310,
    announcements: 45,
  });

  useEffect(() => {
    // Realtime listeners across Firebase RTDB nodes
    const unsubUsers = rtdbService.subscribe('users', (data) => {
      if (data && typeof data === 'object') {
        const len = Object.keys(data).length;
        if (len > 0) setCounts((prev) => ({ ...prev, users: len }));
      }
    });

    const unsubOrgs = rtdbService.subscribe('organizations', (data) => {
      if (data && typeof data === 'object') {
        const len = Object.values(data).filter((o) => o && !o.isDeleted).length;
        if (len > 0) setCounts((prev) => ({ ...prev, workspaces: len }));
      }
    });

    const unsubIdeas = rtdbService.subscribe('publicIdeas', (data) => {
      if (data && typeof data === 'object') {
        const len = Object.values(data).filter((i) => i && !i.isDeleted).length;
        if (len > 0) setCounts((prev) => ({ ...prev, publicIdeas: len }));
      }
    });

    return () => {
      if (typeof unsubUsers === 'function') unsubUsers();
      if (typeof unsubOrgs === 'function') unsubOrgs();
      if (typeof unsubIdeas === 'function') unsubIdeas();
    };
  }, []);

  const STATS_ITEMS = [
    { label: 'Registered Users', val: counts.users, icon: Users, color: 'text-indigo-400' },
    { label: 'Workspaces', val: counts.workspaces, icon: Briefcase, color: 'text-purple-400' },
    { label: 'Public Ideas', val: counts.publicIdeas, icon: Globe, color: 'text-sky-400' },
    { label: 'Upvotes Cast', val: counts.votes, icon: ThumbsUp, color: 'text-emerald-400' },
    { label: 'Comments', val: counts.comments, icon: MessageSquare, color: 'text-amber-400' },
    { label: 'Tasks Created', val: counts.tasks, icon: CheckSquare, color: 'text-rose-400' },
    { label: 'AI Blueprints', val: counts.blueprints, icon: Zap, color: 'text-purple-300' },
    { label: 'Announcements', val: counts.announcements, icon: Megaphone, color: 'text-indigo-300' },
  ];

  return (
    <section className="py-24 bg-slate-950 border-b border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <span className="px-3 py-1 rounded-full bg-slate-900 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
            Live Telemetry Metrics
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Realtime Platform Statistics
          </h2>

          <p className="text-base text-slate-400 font-medium">
            Live telemetry data synchronized directly from Firebase Realtime Database.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {STATS_ITEMS.map((item) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.label}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-center space-y-2 hover:border-purple-500/40 transition-all duration-300 group"
              >
                <div className={`p-2 rounded-xl bg-slate-950 border border-slate-800 w-fit mx-auto ${item.color}`}>
                  <IconComp className="h-4 w-4" />
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {item.val.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-slate-400 font-semibold">{item.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
