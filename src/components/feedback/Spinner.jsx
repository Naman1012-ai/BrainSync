import React from 'react';
import PropTypes from 'prop-types';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div role="status" aria-label="Loading" className="flex items-center justify-center">
      <Loader2 className={cn('animate-spin text-indigo-600', sizes[size], className)} />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

Spinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};
