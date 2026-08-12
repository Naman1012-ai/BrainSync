import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../utils/cn';

export function ProgressBar({ percentage, label = '', size = 'md', className = '' }) {
  const isNull = percentage === null || percentage === undefined;
  const clamped = isNull ? 0 : Math.min(100, Math.max(0, percentage));

  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between text-xs font-medium mb-1.5">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-900 font-semibold">
          {isNull ? 'No tasks yet' : `${clamped}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={isNull ? 0 : clamped}
        aria-valuemin="0"
        aria-valuemax="100"
        className={cn(
          'w-full overflow-hidden rounded-full bg-slate-200',
          heights[size]
        )}
      >
        {!isNull && (
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>
    </div>
  );
}

ProgressBar.propTypes = {
  percentage: PropTypes.number,
  label: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md']),
  className: PropTypes.string,
};
