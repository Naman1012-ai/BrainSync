import React from 'react';
import { MessageSquare, Sparkles, Users } from 'lucide-react';

export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 my-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 shadow-sm">
        <MessageSquare className="h-8 w-8" />
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center justify-center gap-1.5">
          Welcome to your workspace chat
          <Sparkles className="h-4 w-4 text-amber-500 fill-current" />
        </h3>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Start collaborating with your team in real time. Discuss project requirements, share ideas, or coordinate tasks in <strong className="text-slate-800">#general</strong>.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-600">
        <Users className="h-3.5 w-3.5 text-indigo-500" />
        <span>All workspace members have auto-joined</span>
      </div>
    </div>
  );
}
