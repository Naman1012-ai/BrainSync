import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { voteService } from '../../services/voteService';
import { ThumbsUp } from 'lucide-react';

export function VoteButton({ ideaId, isPublic = false, orgId = null, initialCount = 0, size = 'md' }) {
  const { user } = useAuth();
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(initialCount);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    setVoteCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!user || !ideaId) return;
    const unsubscribe = voteService.subscribeToUserVote(ideaId, user.uid, (voted) => {
      setHasVoted(voted);
    });
    return () => unsubscribe();
  }, [user, ideaId]);

  const handleVoteToggle = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!user || isVoting) return;

    setIsVoting(true);
    try {
      const result = await voteService.toggleVote(ideaId, user.uid, isPublic, orgId);
      setHasVoted(result.voted);
      setVoteCount(result.voteCount);
    } catch (err) {
      console.error('[VoteButton] Vote toggle error:', err);
    } finally {
      setIsVoting(false);
    }
  };

  const isSmall = size === 'sm';

  return (
    <button
      onClick={handleVoteToggle}
      disabled={isVoting || !user}
      className={`flex items-center gap-1.5 rounded-full font-bold transition-all ${
        isSmall ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
      } ${
        hasVoted
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105'
          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
      }`}
    >
      <ThumbsUp className={`${isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${hasVoted ? 'fill-current' : ''}`} />
      <span>{hasVoted ? `Voted (${voteCount})` : `${voteCount} Votes`}</span>
    </button>
  );
}

VoteButton.propTypes = {
  ideaId: PropTypes.string.isRequired,
  isPublic: PropTypes.bool,
  orgId: PropTypes.string,
  initialCount: PropTypes.number,
  size: PropTypes.oneOf(['sm', 'md']),
};
