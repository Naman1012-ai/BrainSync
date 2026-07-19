import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Lightbulb, FileText, CheckSquare, Users, ArrowLeft, Settings, Home, LayoutDashboard } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Sidebar({ status = 'ideation', isMobileOpen = false, onCloseMobile = () => {} }) {
  const { orgId, ideaId } = useParams();

  const isIdeaActive = Boolean(ideaId);

  const navItems = isIdeaActive
    ? [
        {
          to: `/workspaces/${orgId}/ideas/${ideaId}`,
          label: 'Idea Overview',
          icon: Home,
        },
        {
          to: `/workspaces/${orgId}/ideas/${ideaId}/blueprint`,
          label: 'Blueprint',
          icon: FileText,
        },
        {
          to: `/workspaces/${orgId}/ideas/${ideaId}/tasks`,
          label: 'Tasks',
          icon: CheckSquare,
        },
        {
          to: `/workspaces/${orgId}/ideas/${ideaId}/dashboard`,
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
      ]
    : [
        {
          to: `/workspaces/${orgId}/ideas`,
          label: 'Idea Board',
          icon: Lightbulb,
        },
        {
          to: `/workspaces/${orgId}/members`,
          label: 'Members',
          icon: Users,
        },
        {
          to: `/workspaces/${orgId}/settings`,
          label: 'Settings',
          icon: Settings,
        },
      ];

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-300 p-4">
      <div className="space-y-6">
        {/* Back to parent */}
        <NavLink
          to={isIdeaActive ? `/workspaces/${orgId}/ideas` : '/dashboard'}
          onClick={onCloseMobile}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isIdeaActive ? 'Back to Idea Board' : 'Back to Dashboard'}</span>
        </NavLink>

        <div className="h-px bg-slate-800 my-2" />

        {/* Nav Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.isPlaceholder) {
              return (
                <div
                  key={item.to}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed group transition-colors hover:bg-slate-800/40"
                  title={`${item.label} (Coming Soon)`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0 text-slate-500" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[9px] font-extrabold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-widest">
                    Soon
                  </span>
                </div>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="text-xs text-slate-500 px-3 py-2">
        BrainSync v1.0 (MVP)
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:block w-64 shrink-0 border-r border-slate-800">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative z-10 w-64 max-w-xs flex-1 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
