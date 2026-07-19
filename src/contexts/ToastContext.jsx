import React, { createContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { getErrorMessage } from '../utils/errorMessages';
import { cn } from '../utils/cn';

export const ToastContext = createContext({
  showToast: () => {},
  toast: {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  },
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((rawMessage, type = 'info', duration = 4000) => {
    let message = rawMessage;

    // Handle Error object or Firebase error codes
    if (rawMessage && typeof rawMessage === 'object' && rawMessage.message) {
      message = getErrorMessage(rawMessage.code || rawMessage.message);
    } else if (typeof rawMessage === 'string' && rawMessage.includes('auth/')) {
      message = getErrorMessage(rawMessage);
    }

    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Prevent identical notification spam in short window
    setToasts((prev) => {
      const isDuplicate = prev.some(
        (t) => t.message === message && t.type === type
      );
      if (isDuplicate) return prev;
      return [...prev, { id, message, type }];
    });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toastHelpers = {
    success: (msg, duration) => showToast(msg, 'success', duration),
    error: (msg, duration) => showToast(msg, 'error', duration),
    warning: (msg, duration) => showToast(msg, 'warning', duration),
    info: (msg, duration) => showToast(msg, 'info', duration),
  };

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-rose-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-indigo-500 shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
    warning: 'border-amber-200 bg-amber-50/90 text-amber-950',
    error: 'border-rose-200 bg-rose-50/90 text-rose-950',
    info: 'border-indigo-200 bg-indigo-50/90 text-indigo-950',
  };

  return (
    <ToastContext.Provider value={{ showToast, toast: toastHelpers }}>
      {children}

      {/* Global Toast Stack Container */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-top-5 duration-200',
              borderColors[t.type] || borderColors.info
            )}
          >
            {icons[t.type] || icons.info}
            <p className="text-xs sm:text-sm font-semibold flex-1 leading-snug break-words">
              {t.message}
            </p>
            <button
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
              className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
