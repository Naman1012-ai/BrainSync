import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Toast({
  type = 'info',
  message = '',
  isOpen = false,
  onClose,
  duration = 4000,
}) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-indigo-500 shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-200',
    warning: 'border-amber-200',
    error: 'border-rose-200',
    info: 'border-indigo-200',
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border bg-white p-4 shadow-lg animate-in slide-in-from-bottom-5 duration-200 max-w-md',
        borderColors[type]
      )}
    >
      {icons[type]}
      <p className="text-sm text-slate-800 font-medium">{message}</p>
      <button
        onClick={onClose}
        className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

Toast.propTypes = {
  type: PropTypes.oneOf(['success', 'warning', 'error', 'info']),
  message: PropTypes.string.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  duration: PropTypes.number,
};
