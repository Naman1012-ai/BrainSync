import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDashboard } from '../../hooks/useDashboard';
import { DashboardProvider } from '../../contexts/DashboardContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { formatTimestamp } from '../../utils/formatting';
import {
  TrendingUp,
  Clock,
  Briefcase,
  CheckCircle2,
  ListTodo,
  PlayCircle,
  AlertOctagon,
  Users,
  Calendar,
  ChevronRight,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';

function DashboardContent() {
  const { stats, recentActivity, loading } = useDashboard();
  const { orgId } = useParams();

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <EmptyState
          icon={<AlertOctagon className="h-8 w-8 text-indigo-500" />}
          title="Dashboard Unavailable"
          description="Workspace metrics could not be aggregated at this time."
        />
      </div>
    );
  }

  const { org, blueprint, taskSummary, teamSummary } = stats;

  // Calculate Days Remaining
  let daysRemainingText = 'No Deadline Set';
  if (org.hackathonDate) {
    const targetTime = new Date(org.hackathonDate).getTime();
    if (!isNaN(targetTime)) {
      const msDiff = targetTime - Date.now();
      const days = Math.max(0, Math.ceil(msDiff / (24 * 60 * 60 * 1000)));
      daysRemainingText = days === 1 ? '1 day remaining' : `${days} days remaining`;
    }
  }

  // Calculate progress percentage safely
  const progressPercentage =
    taskSummary.total > 0 ? Math.round((taskSummary.completed / taskSummary.total) * 100) : 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Project Overview Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-8 rounded-3xl border border-slate-700/60 shadow-2xl backdrop-blur-md">
        <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-0 left-0 h-40 w-40 bg-indigo-400/5 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Title & Phase */}
          <div className="space-y-2.5 md:col-span-2">
            <div className="flex items-center gap-2">
              <Badge variant="info" className="bg-indigo-500/20 text-indigo-200 uppercase tracking-widest font-black text-[9px] border border-indigo-500/30">
                Active Project
              </Badge>
              <span className="text-slate-400 font-bold text-xs flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {daysRemainingText}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
              {blueprint?.ideaTitle || 'Workspace Active Project'}
            </h2>
            <p className="text-xs text-slate-300 line-clamp-2 max-w-2xl font-medium leading-relaxed">
              {blueprint?.problemStatement || 'Executing sprint tasks compiled from the selected proposal.'}
            </p>
          </div>

          {/* Quick Progress Indicator */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3 w-full shadow-inner">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">Milestone Progress</span>
              <span className="text-indigo-400 text-sm font-black">{progressPercentage}%</span>
            </div>
            <ProgressBar percentage={progressPercentage} size="lg" className="bg-slate-700" />
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-1">
              <span>{taskSummary.completed} Completed Tasks</span>
              <span>{taskSummary.total} Total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1 & 2: Task Summary & Team Workload */}
        <div className="lg:col-span-2 space-y-6">
          {/* 2. Task Summary KPI Panel */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-6 rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-indigo-600" /> Task Status Matrix
              </h3>
              <Badge variant="default" className="font-extrabold uppercase text-[9px] tracking-widest bg-slate-100 text-slate-600">
                {taskSummary.total} Tasks Total
              </Badge>
            </div>

            {taskSummary.total === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                No active tasks found in the current sprint board.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* Completed */}
                <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <CheckCircle2 className="h-4 w-4" /> Completed
                  </div>
                  <h4 className="text-2xl font-black text-slate-900">{taskSummary.completed}</h4>
                </div>

                {/* In Progress */}
                <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-blue-700 font-bold">
                    <PlayCircle className="h-4 w-4" /> In Progress
                  </div>
                  <h4 className="text-2xl font-black text-slate-900">{taskSummary.inProgress}</h4>
                </div>

                {/* Todo */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
                    <ListTodo className="h-4 w-4" /> Todo
                  </div>
                  <h4 className="text-2xl font-black text-slate-900">{taskSummary.todo}</h4>
                </div>

                {/* Review */}
                <div className="p-4 bg-purple-50/40 border border-purple-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-purple-700 font-bold">
                    <TrendingUp className="h-4 w-4" /> In Review
                  </div>
                  <h4 className="text-2xl font-black text-slate-900">{taskSummary.review}</h4>
                </div>

                {/* Overdue */}
                <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-rose-700 font-bold">
                    <AlertTriangle className="h-4 w-4 text-rose-600" /> Overdue
                  </div>
                  <h4 className="text-2xl font-black text-slate-900">{taskSummary.overdue}</h4>
                </div>
              </div>
            )}
          </Card>

          {/* 3. Team Statistics Card */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4 rounded-2xl">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Users className="h-4 w-4 text-indigo-600" /> Team Workload Insights
            </h3>

            <div className="grid grid-cols-3 gap-4 text-center py-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Roster</span>
                <p className="text-xl font-black text-slate-900">{teamSummary.totalMembers}</p>
              </div>
              <div className="space-y-1 border-x border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Assignees</span>
                <p className="text-xl font-black text-indigo-600">{teamSummary.withTasks}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Tasks Assigned</span>
                <p className="text-xl font-black text-slate-500">{teamSummary.withoutTasks}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Column 3: Recent Activity Log */}
        <div className="space-y-6">
          {/* 4. Recent Activity Widget */}
          <Card className="p-6 bg-white border border-slate-200 shadow-sm space-y-4 rounded-2xl h-full flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                <Clock className="h-4 w-4 text-indigo-600 animate-spin" /> Activity Timeline
              </h3>

              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-6 text-center">
                  No task activities recorded in this sprint yet.
                </p>
              ) : (
                <div className="space-y-4 mt-4 overflow-y-auto max-h-[320px] pr-1">
                  {recentActivity.map((activity, index) => {
                    let typeBadgeColor = 'bg-slate-100 text-slate-700';
                    if (activity.type === 'complete') {
                      typeBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100 border';
                    } else if (activity.type === 'create') {
                      typeBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100 border';
                    }

                    return (
                      <div key={index} className="flex flex-col gap-1 text-xs border-b border-slate-50 pb-3 last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide shrink-0 ${typeBadgeColor}`}>
                            {activity.type}
                          </span>
                          <span className="text-slate-400 font-semibold">{formatTimestamp(activity.timestamp)}</span>
                        </div>
                        <p className="text-slate-700 font-bold leading-relaxed">{activity.title}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Link to={`/workspaces/${orgId}/ideas/${blueprint?.ideaId}/tasks`}>
              <Button variant="ghost" fullWidth size="sm" className="mt-4 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl">
                Go to Kanban Tasks Board <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ProgressDashboardPage() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}
