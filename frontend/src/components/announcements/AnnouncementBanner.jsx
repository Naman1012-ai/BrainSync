import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import { formatTimestamp } from '../../utils/formatting';
import {
  Megaphone,
  Pin,
  X,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Wrench,
  Clock,
  Info,
} from 'lucide-react';

export function AnnouncementBanner() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (!user) {
      setAnnouncements([]);
      return;
    }

    const unsubscribe = adminService.subscribeToUserAnnouncements(user.uid, user, (data) => {
      setAnnouncements(data || []);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDismiss = async (id) => {
    if (!user) return;
    try {
      await adminService.dismissAnnouncementForUser(user.uid, id);
    } catch (e) {
      console.warn('[AnnouncementBanner] Dismissal error:', e);
    }
  };

  if (!user || announcements.length === 0) return null;

  return (
    <div className="space-y-4 mb-8" role="region" aria-label="Global System Announcements">
      {announcements.map((anc) => {
        const isCritical = anc.priority === 'Critical' || anc.category === 'Security Alert';
        const isMaintenance = anc.category === 'Maintenance';
        const isEvent = anc.category === 'Hackathon Event';

        let cardBorder = 'border-slate-800 hover:border-purple-500/40';
        let categoryBadge = 'bg-purple-950/80 text-purple-300 border-purple-800/80';
        let IconComponent = Megaphone;
        let iconBg = 'bg-purple-500/10 text-purple-400 border-purple-500/20';

        if (isCritical) {
          cardBorder = 'border-rose-900/80 ring-1 ring-rose-500/20 hover:border-rose-700';
          categoryBadge = 'bg-rose-950/80 text-rose-300 border-rose-800/80';
          IconComponent = ShieldAlert;
          iconBg = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        } else if (isMaintenance) {
          cardBorder = 'border-amber-900/80 ring-1 ring-amber-500/20 hover:border-amber-700';
          categoryBadge = 'bg-amber-950/80 text-amber-300 border-amber-800/80';
          IconComponent = Wrench;
          iconBg = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        } else if (isEvent) {
          cardBorder = 'border-indigo-900/80 ring-1 ring-indigo-500/20 hover:border-indigo-700';
          categoryBadge = 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80';
          IconComponent = Sparkles;
          iconBg = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
        }

        return (
          <article
            key={anc.id}
            aria-label={`Announcement: ${anc.title}`}
            className={`p-5 sm:p-6 rounded-2xl bg-slate-900/95 border ${cardBorder} shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2 relative overflow-hidden`}
          >
            {/* Top Meta Bar: Icon + Category Badge + Pinned + Dismiss Button */}
            <div className="flex items-center justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className={`p-1.5 rounded-lg border ${iconBg} shrink-0`}>
                  <IconComponent className="h-4 w-4" aria-hidden="true" />
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase border ${categoryBadge}`}
                >
                  {anc.category}
                </span>

                {anc.isPinned && (
                  <span
                    className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                  >
                    <Pin className="h-3 w-3 fill-current" aria-hidden="true" />
                    <span>Pinned</span>
                  </span>
                )}
              </div>

              {/* Accessible Dismiss Button */}
              <button
                onClick={() => handleDismiss(anc.id)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all duration-150 shrink-0"
                aria-label="Dismiss announcement"
                title="Dismiss announcement"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Announcement Title (Large, Bold, Primary High Contrast) */}
            <h3 className="text-base sm:text-lg md:text-xl font-extrabold text-white tracking-tight leading-snug line-clamp-2 mb-3">
              {anc.title}
            </h3>

            {/* Announcement Content (Readable Body Text) */}
            <p className="text-sm text-slate-300 leading-relaxed font-normal whitespace-pre-line mb-4">
              {anc.description}
            </p>

            {/* Relative Timestamp (No Publisher Text) */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 pt-1 border-t border-slate-800/60">
              <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>{formatTimestamp(anc.createdAt)}</span>

              {anc.expiresAt && (
                <>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-amber-400/90 font-mono text-[11px]">
                    Expires {formatTimestamp(anc.expiresAt)}
                  </span>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
