import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useParams } from 'react-router-dom';
import { Lightbulb, FileText, CheckSquare, Users, ArrowLeft, Settings, Home, LayoutDashboard, MessageSquare } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Sidebar({ status = 'ideation', isMobileOpen = false, onCloseMobile = () => {} }) {
  const { orgId, ideaId } = useParams();

  const isIdeaActive = Boolean(ideaId);

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

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
          label: 'Progress',
          icon: LayoutDashboard,
        },
        {
          to: `/workspaces/${orgId}/chat`,
          label: 'Team Chat',
          icon: MessageSquare,
        },
      ]
    : [
        {
          to: `/workspaces/${orgId}/ideas`,
          label: 'Idea Board',
          icon: Lightbulb,
        },
        {
          to: `/workspaces/${orgId}/chat`,
          label: 'Team Chat',
          icon: MessageSquare,
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

      <div className="text-[10px] text-slate-500 text-center font-mono">
        Convia &copy; {new Date().getFullYear()}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 sm:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar - Portaled to document.body */}
      {isMobileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex sm:hidden">
            <div
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
              onClick={onCloseMobile}
            />
            <div className="relative flex w-64 max-w-xs flex-1 flex-col bg-slate-900 border-r border-slate-800 pt-5 pb-4 shadow-2xl z-[99999]">
              {sidebarContent}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
