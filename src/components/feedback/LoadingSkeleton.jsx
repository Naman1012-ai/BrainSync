import React from 'react';
import PropTypes from 'prop-types';

export function LoadingSkeleton({ variant = 'card', count = 3 }) {
  const items = Array.from({ length: count });

  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="h-6 w-3/4 rounded bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-slate-200" />
              <div className="h-4 w-5/6 rounded bg-slate-200" />
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-4">
              <div className="h-4 w-1/3 rounded bg-slate-200" />
              <div className="h-4 w-1/4 rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {items.map((_, i) => (
          <div
            key={i}
            className="animate-pulse flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-200" />
              <div className="space-y-1">
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-200" />
              </div>
            </div>
            <div className="h-6 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 w-full rounded bg-slate-200" />
      <div className="h-4 w-4/5 rounded bg-slate-200" />
    </div>
  );
}

LoadingSkeleton.propTypes = {
  variant: PropTypes.oneOf(['card', 'list', 'text']),
  count: PropTypes.number,
};
