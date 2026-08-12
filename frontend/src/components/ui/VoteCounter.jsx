import React from 'react';
import PropTypes from 'prop-types';
import { ThumbsUp } from 'lucide-react';

export function VoteCounter({ count = 0, hasVoted = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold text-xs ${
        hasVoted ? 'text-indigo-600 font-extrabold' : 'text-slate-600'
      }`}
    >
      <ThumbsUp className={`h-3.5 w-3.5 ${hasVoted ? 'text-indigo-600 fill-current' : 'text-slate-400'}`} />
      <span>{count}</span>
    </span>
  );
}

VoteCounter.propTypes = {
  count: PropTypes.number,
  hasVoted: PropTypes.bool,
};
