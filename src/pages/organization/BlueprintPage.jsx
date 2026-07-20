import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { orgService } from '../../services/orgService';
import { ideaService } from '../../services/ideaService';
import { blueprintService } from '../../services/blueprintService';
import { rtdbService } from '../../services/rtdbService';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { formatTimestamp } from '../../utils/formatting';
import {
  FileText,
  CheckCircle2,
  ThumbsUp,
  Sparkles,
  MessageCircle,
  Code,
  ArrowRight,
  Shield,
  Trophy,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

export default function BlueprintPage() {
  const { orgId } = useParams();
  const { canUseBlueprint } = usePlatformSettings();
  const blueprintCheck = canUseBlueprint();

  const [org, setOrg] = useState(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState(null);
  const [mvpIdea, setMvpIdea] = useState(null);
  const [blueprint, setBlueprint] = useState(null);

  const [loadingOrg, setLoadingOrg] = useState(true);
  const [loadingIdea, setLoadingIdea] = useState(true);
  const [loadingBlueprint, setLoadingBlueprint] = useState(true);

  if (!blueprintCheck.allowed) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <Card className="p-8 border border-amber-200 bg-amber-50 rounded-2xl text-amber-900 space-y-3 shadow-md">
          <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
          <h3 className="text-lg font-extrabold">Feature Disabled</h3>
          <p className="text-sm font-medium">{blueprintCheck.reason}</p>
        </Card>
      </div>
    );
  }

  // 1. Subscribe to Organization & Metadata
  useEffect(() => {
    if (!orgId) return;
    setLoadingOrg(true);

    const unsubOrg = orgService.subscribeToOrganization(orgId, (orgData) => {
      setOrg(orgData);
      setLoadingOrg(false);
    });

    const unsubMeta = rtdbService.subscribe(`workspaces/${orgId}/metadata`, (meta) => {
      if (meta?.selectedIdeaId) {
        setSelectedIdeaId(meta.selectedIdeaId);
      } else if (org?.activeProjectId) {
        setSelectedIdeaId(org.activeProjectId);
      } else {
        setSelectedIdeaId(null);
      }
    });

    return () => {
      unsubOrg();
      unsubMeta();
    };
  }, [orgId, org?.activeProjectId]);

  // 2. Real-time Subscription to Active MVP Idea Node
  useEffect(() => {
    const targetId = selectedIdeaId || org?.activeProjectId;
    if (!orgId || !targetId) {
      setMvpIdea(null);
      setLoadingIdea(false);
      return;
    }

    setLoadingIdea(true);
    const unsubIdea = ideaService.subscribeToIdea(orgId, targetId, (ideaData) => {
      setMvpIdea(ideaData);
      setLoadingIdea(false);
    });

    return () => unsubIdea();
  }, [orgId, selectedIdeaId, org?.activeProjectId]);

  // 3. Real-time Subscription to Blueprint Specs
  useEffect(() => {
    if (!orgId) return;
    setLoadingBlueprint(true);

    const unsubBp = blueprintService.subscribeToBlueprint(orgId, (bpData) => {
      setBlueprint(bpData);
      setLoadingBlueprint(false);
    });

    return () => unsubBp();
  }, [orgId]);

  const isLoading = loadingOrg || (Boolean(selectedIdeaId || org?.activeProjectId) && loadingIdea);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <LoadingSkeleton variant="card" count={2} />
      </div>
    );
  }

  const activeMvpId = selectedIdeaId || org?.activeProjectId;

  // Case 1: No MVP Selected for Workspace
  if (!activeMvpId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link to="/workspaces" className="hover:text-indigo-600 transition-colors">Workspaces</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <Link to={`/workspaces/${orgId}/ideas`} className="hover:text-indigo-600 transition-colors">Idea Board</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-900 font-bold">Blueprint</span>
        </nav>

        <PageHeader
          title="Project Blueprint"
          subtitle="Auto-generated build plan promoted from the selected Workspace MVP"
        />

        <EmptyState
          icon={<Trophy className="h-8 w-8 text-amber-500" />}
          title="No MVP Selected for this Workspace"
          description="No proposal has been selected as the Workspace MVP yet. Head to the Idea Board to vote or select a winning proposal."
          action={
            <Link to={`/workspaces/${orgId}/ideas`}>
              <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                Go to Idea Board & Vote
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Case 2: Referenced MVP was deleted or no longer exists
  if (!mvpIdea || mvpIdea.isDeleted) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link to="/workspaces" className="hover:text-indigo-600 transition-colors">Workspaces</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <Link to={`/workspaces/${orgId}/ideas`} className="hover:text-indigo-600 transition-colors">Idea Board</Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-900 font-bold">Blueprint</span>
        </nav>

        <EmptyState
          icon={<AlertTriangle className="h-8 w-8 text-rose-500" />}
          title="Referenced MVP Idea No Longer Exists"
          description="This Blueprint references a workspace proposal that has been removed or deleted."
          action={
            <Link to={`/workspaces/${orgId}/ideas`}>
              <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                Go to Idea Board
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Case 3: Live Selected MVP & Blueprint Display
  const title = mvpIdea.title || blueprint?.ideaTitle || 'Selected Project';
  const problemStatement = mvpIdea.problemStatement || blueprint?.problemStatement || '';
  const proposedSolution = mvpIdea.proposedSolution || blueprint?.proposedSolution || '';
  const techStack = mvpIdea.techStack || blueprint?.techStack || '';
  const difficultyLevel = mvpIdea.difficultyLevel || blueprint?.difficultyLevel || 'Medium';
  const authorName = mvpIdea.authorName || blueprint?.authorName || 'Team Member';
  const projectStatus = mvpIdea.projectStatus || (mvpIdea.isSelected ? 'Selected MVP' : 'Ideation');
  const voteCount = mvpIdea.voteCount || blueprint?.voteSummary?.totalVotes || 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Hero MVP Summary Card */}
      <Card className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-8 shadow-2xl border border-indigo-800/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-48 w-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="bg-amber-500 text-white font-bold flex items-center gap-1 shadow-md">
                <Trophy className="h-3.5 w-3.5" /> Current Workspace MVP
              </Badge>
              <Badge variant="info" className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                {difficultyLevel} Build
              </Badge>
              <Badge variant="default" className="bg-slate-800 text-slate-200">
                Status: {projectStatus}
              </Badge>
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight">{title}</h1>

            <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
              <Avatar name={authorName} size="sm" />
              <span>Original Proposal by <strong className="text-white">{authorName}</strong></span>
              <span>·</span>
              <span>Workspace: <strong className="text-white">{org?.name}</strong></span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <Link to={`/workspaces/${orgId}/ideas/${mvpIdea.ideaId}`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink className="h-4 w-4 text-white" />}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold"
              >
                View Original MVP Idea
              </Button>
            </Link>
            <div className="bg-indigo-950/80 p-3 rounded-xl border border-indigo-700/50 text-right space-y-1 w-full">
              <div className="text-xl font-black text-emerald-400 flex items-center justify-end gap-1.5">
                <ThumbsUp className="h-4 w-4" /> {voteCount} Votes
              </div>
              <p className="text-[11px] text-indigo-200">Selected MVP Project</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Executive Summary & Scope */}
      <Card className="p-6 space-y-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <FileText className="h-5 w-5 text-indigo-600" /> Executive Summary & Scope
        </h2>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            📌 Core Problem Statement
          </h3>
          <p className="text-base text-slate-800 leading-relaxed font-medium bg-slate-50 p-4 rounded-xl border border-slate-200">
            {problemStatement}
          </p>
        </div>

        {proposedSolution && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              💡 Proposed Technical Solution
            </h3>
            <p className="text-base text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              {proposedSolution}
            </p>
          </div>
        )}

        {techStack && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Code className="h-4 w-4 text-indigo-500" /> Technical Stack & Frameworks
            </h3>
            <div className="flex flex-wrap gap-2">
              {techStack
                .split(',')
                .map((tech) => tech.trim())
                .filter(Boolean)
                .map((tech, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-mono font-bold text-indigo-800 shadow-sm"
                  >
                    {tech}
                  </span>
                ))}
            </div>
          </div>
        )}
      </Card>

      {/* Technical Suggestions & Discussion Summary */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="h-5 w-5 text-amber-500" /> Technical Discussion & Suggestions Summary
        </h2>

        {blueprint?.discussionSummary?.acceptedSuggestionsList?.length > 0 ? (
          <div className="space-y-3">
            {blueprint.discussionSummary.acceptedSuggestionsList.map((suggestion, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" /> Accepted Suggestion #{index + 1}
                  </span>
                  <span className="text-[11px] text-amber-700">by {suggestion.authorName}</span>
                </div>
                <p className="text-sm text-amber-950 font-medium">{suggestion.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">
            No technical suggestions were explicitly recorded prior to project selection.
          </p>
        )}

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5 text-indigo-500" /> {blueprint?.discussionSummary?.commentCount || mvpIdea.commentCount || 0} Total Comments
          </span>
          <span className="flex items-center gap-1 font-semibold text-indigo-700">
            <Shield className="h-3.5 w-3.5" /> Project Specs Synchronized with Selected MVP
          </span>
        </div>
      </Card>
    </div>
  );
}
