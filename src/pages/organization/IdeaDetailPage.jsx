import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ideaService } from '../../services/ideaService';
import { voteService } from '../../services/voteService';
import { rtdbService } from '../../services/rtdbService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/feedback/Spinner';
import { ErrorMessage } from '../../components/feedback/ErrorMessage';
import { Toast } from '../../components/feedback/Toast';
import { DiscussionPanel } from '../../features/discussions/DiscussionPanel';
import { PublicIdeaDetailModal } from '../../features/ideas/PublicIdeaDetailModal';
import { formatTimestamp } from '../../utils/formatting';
import {
  ArrowLeft,
  ThumbsUp,
  MessageCircle,
  Lightbulb,
  HelpCircle,
  Globe,
} from 'lucide-react';

import { orgService } from '../../services/orgService';

export default function IdeaDetailPage() {
  const { orgId, ideaId } = useParams();
  const { user } = useAuth();

  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!orgId || !user) return;
    orgService
      .getOrganizationMembers(orgId)
      .then((membersList) => {
        const me = (membersList || []).find((m) => m.uid === user.uid);
        if (me) setUserRole(me.role);
      })
      .catch(() => {});
  }, [orgId, user]);

  // Original Public Idea view state
  const [originalPublicIdea, setOriginalPublicIdea] = useState(null);
  const [isOriginalPublicIdeaModalOpen, setIsOriginalPublicIdeaModalOpen] = useState(false);

  // Voting State
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [isVoting, setIsVoting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (!orgId || !ideaId) return;

    setLoading(true);
    const unsubscribe = ideaService.subscribeToIdea(orgId, ideaId, (ideaData) => {
      setIdea(ideaData);
      if (ideaData) {
        setVoteCount(ideaData.voteCount || 0);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orgId, ideaId]);

  useEffect(() => {
    if (!user || !ideaId) return;
    const unsubscribe = voteService.subscribeToUserVote(ideaId, user.uid, (voted) => {
      setHasVoted(voted);
    });
    return () => unsubscribe();
  }, [user, ideaId]);

  const handleVoteToggle = async () => {
    if (!user || !ideaId || isVoting) return;

    setIsVoting(true);
    try {
      const result = await voteService.toggleVote(
        ideaId,
        user.uid,
        false,
        orgId
      );
      setHasVoted(result.voted);
      setVoteCount(result.voteCount);
      setToastMessage(
        result.voted ? '👍 Vote recorded!' : 'Vote removed.'
      );
    } catch (err) {
      setToastMessage(err.message || 'Failed to update vote.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleViewOriginalPublicIdea = async () => {
    const pubId = idea.importedFromPublicId || idea.origin?.publicIdeaId;
    if (!pubId) return;

    try {
      const pubData = await rtdbService.getData(`publicIdeas/${pubId}`);
      if (pubData) {
        setOriginalPublicIdea(pubData);
        setIsOriginalPublicIdeaModalOpen(true);
      } else {
        setToastMessage('Original public proposal is no longer available.');
      }
    } catch (err) {
      console.error('[IdeaDetailPage] Error loading original public idea:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <Link
          to={`/workspaces/${orgId}/ideas`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Idea Board</span>
        </Link>
        <ErrorMessage
          title="Idea Not Found"
          message="The requested proposal does not exist or has been removed from the Idea Board."
        />
      </div>
    );
  }

  const isAuthor = user && user.uid === idea.authorId;
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';
  const canManageStatus = isOwnerOrAdmin || isAuthor;

  const handleStatusChange = async (newStatus) => {
    if (!canManageStatus || updatingStatus) return;
    const currentStatus = idea.projectStatus || (idea.isSelected ? 'Selected MVP' : 'Ideation');
    if (newStatus === currentStatus) return;

    setUpdatingStatus(true);

    try {
      await ideaService.updateIdeaStatus(orgId, ideaId, newStatus);
      if (newStatus === 'Selected MVP') {
        setToastMessage('✓ Idea selected as the Workspace MVP.');
      } else {
        setToastMessage(`✓ Project status updated to "${newStatus}".`);
      }
    } catch (err) {
      console.warn('[IdeaDetailPage] Status update error:', err);
      setToastMessage(err.message || 'Unable to update project status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const difficultyVariants = {
    Easy: 'success',
    Medium: 'info',
    Hard: 'warning',
  };

  const statusOptions = ['Ideation', 'Voting', 'Selected MVP', 'Project', 'Completed', 'Archived'];

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Main Proposal Card */}
      <Card className="p-8">
        {/* Imported Attribution Section */}
        {(idea.importedFromPublicId || idea.origin?.publicIdeaId) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-indigo-50/80 border border-indigo-200/80 mb-6">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Badge variant="info" className="bg-indigo-600 text-white font-bold text-[10px] flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Imported from Public Ideas
                </Badge>
                <span className="text-xs text-indigo-900 font-semibold">
                  Originally created by <strong className="text-indigo-950">{idea.originalAuthorName || idea.authorName}</strong>
                </span>
              </div>
              <p className="text-[11px] text-indigo-700">
                Posted originally: {formatTimestamp(idea.originalCreatedAt || idea.createdAt)} · Imported: {formatTimestamp(idea.importedAt || idea.createdAt)}
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<Globe className="h-3.5 w-3.5 text-indigo-600" />}
              onClick={handleViewOriginalPublicIdea}
              className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100 shrink-0 font-bold"
            >
              View Original Public Idea
            </Button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={difficultyVariants[idea.difficultyLevel] || 'default'}>
                {idea.difficultyLevel || 'Medium'} Difficulty
              </Badge>
              
              {/* Editable Project Status Selector */}
              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Status:</span>
                {canManageStatus ? (
                  <select
                    value={idea.projectStatus || (idea.isSelected ? 'Selected MVP' : 'Ideation')}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updatingStatus}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-slate-800">
                    {idea.projectStatus || (idea.isSelected ? 'Selected MVP' : 'Ideation')}
                  </span>
                )}
              </div>

              {idea.isSelected && <Badge variant="success">Selected Project</Badge>}
            </div>

            <h1 className="text-2xl font-bold text-slate-900">{idea.title}</h1>

            <div className="flex items-center gap-2.5">
              <Avatar name={idea.authorName} size="sm" />
              <span className="text-sm font-medium text-slate-700">
                {isAuthor ? 'Created by You' : idea.authorName}
              </span>
              <span className="text-xs text-slate-400">· {formatTimestamp(idea.createdAt)}</span>
            </div>
          </div>

          {/* Interactive Vote Action */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={hasVoted ? 'primary' : 'secondary'}
              size="md"
              icon={<ThumbsUp className={`h-4 w-4 ${hasVoted ? 'fill-current' : ''}`} />}
              isLoading={isVoting}
              onClick={handleVoteToggle}
            >
              {hasVoted ? `👍 Voted (${voteCount})` : `Vote Proposal (${voteCount})`}
            </Button>
          </div>
        </div>

        {/* Idea Full Specs */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Problem Statement
            </h2>
            <p className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
              {idea.problemStatement}
            </p>
          </div>

          {idea.proposedSolution && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Proposed Technical Solution
              </h2>
              <p className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
                {idea.proposedSolution}
              </p>
            </div>
          )}

          {idea.techStack && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Tech Stack & Libraries
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {idea.techStack
                  .split(',')
                  .map((tech) => tech.trim())
                  .filter(Boolean)
                  .map((tech, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-mono font-medium text-slate-700"
                    >
                      {tech}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Discussion & Collaboration Panel */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-indigo-600" /> Discussion & Technical Refinement
        </h2>
        <DiscussionPanel idea={idea} onToast={(msg) => setToastMessage(msg)} />
      </div>

      {/* View Original Public Idea Modal */}
      <PublicIdeaDetailModal
        isOpen={isOriginalPublicIdeaModalOpen}
        idea={originalPublicIdea}
        onClose={() => setIsOriginalPublicIdeaModalOpen(false)}
        onToast={(msg) => setToastMessage(msg)}
      />

      {/* Toast Feedback */}
      <Toast
        type="info"
        message={toastMessage}
        isOpen={Boolean(toastMessage)}
        onClose={() => setToastMessage('')}
      />
    </div>
  );
}
