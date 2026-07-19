import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '../../utils/cn';

export function Badge({ variant = 'default', children, className = '' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

Badge.propTypes = {
  variant: PropTypes.oneOf(['default', 'info', 'success', 'warning', 'danger']),
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
