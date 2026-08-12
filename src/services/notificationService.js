import { getErrorMessage } from '../utils/errorMessages';

/**
 * Centralized Notification Service for BrainSync
 * Single source of truth for triggering, updating, and deduplicating toast notifications.
 */

class NotificationServiceManager {
  constructor() {
    this.listeners = new Set();
    this.recentToasts = new Map(); // Key: message+type -> timestamp
    this.dedupeWindowMs = 2500;
  }

  /**
   * Subscribe to notification events
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Internal notify helper
   */
  _emit(action, payload) {
    this.listeners.forEach((listener) => {
      try {
        listener(action, payload);
      } catch (err) {
        console.error('[NotificationService] listener error:', err);
      }
    });
  }

  /**
   * Sanitize error message to prevent raw JS stacktraces/TypeError exposing to users
   */
  _formatErrorMessage(rawError) {
    if (!rawError) return 'Something went wrong. Please try again.';

    if (typeof rawError === 'string') {
      if (rawError.includes('auth/') || rawError.includes('permission-denied')) {
        return getErrorMessage(rawError);
      }
      // If it looks like a JS syntax or runtime error string, fallback
      if (rawError.includes('TypeError') || rawError.includes('ReferenceError') || rawError.includes('Undefined')) {
        return 'Something went wrong. Please try again.';
      }
      return rawError;
    }

    if (typeof rawError === 'object') {
      if (rawError.code) {
        return getErrorMessage(rawError.code);
      }
      if (rawError.message) {
        if (
          rawError.message.includes('TypeError') ||
          rawError.message.includes('ReferenceError') ||
          rawError.message.includes('Cannot read properties')
        ) {
          return 'Something went wrong. Please try again.';
        }
        return rawError.message;
      }
    }

    return 'Something went wrong. Please try again.';
  }

  /**
   * Check deduplication
   */
  _isDuplicate(message, type) {
    const key = `${type}:${message}`;
    const now = Date.now();
    const lastTime = this.recentToasts.get(key);

    if (lastTime && now - lastTime < this.dedupeWindowMs) {
      return true;
    }

    this.recentToasts.set(key, now);
    // Cleanup old keys periodically
    if (this.recentToasts.size > 50) {
      for (const [k, time] of this.recentToasts.entries()) {
        if (now - time > this.dedupeWindowMs * 2) {
          this.recentToasts.delete(k);
        }
      }
    }
    return false;
  }

  /**
   * Show a toast
   */
  show(rawMessage, type = 'info', duration = 4000) {
    let message = rawMessage;
    if (type === 'error') {
      message = this._formatErrorMessage(rawMessage);
    }

    if (!message) return null;

    if (this._isDuplicate(message, type)) {
      return null;
    }

    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const toastItem = { id, message, type, duration };

    this._emit('ADD_TOAST', toastItem);
    return id;
  }

  success(message, duration = 4000) {
    return this.show(message, 'success', duration);
  }

  error(rawError, duration = 4500) {
    return this.show(rawError, 'error', duration);
  }

  warning(message, duration = 4000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 4000) {
    return this.show(message, 'info', duration);
  }

  loading(message = 'Loading...') {
    const id = `toast_loading_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const toastItem = { id, message, type: 'loading', duration: 0 }; // 0 means persistent until updated/dismissed
    this._emit('ADD_TOAST', toastItem);
    return id;
  }

  update(id, { type = 'success', message, duration = 4000 }) {
    if (!id) return;
    let formattedMsg = message;
    if (type === 'error') {
      formattedMsg = this._formatErrorMessage(message);
    }
    this._emit('UPDATE_TOAST', { id, type, message: formattedMsg, duration });
  }

  dismiss(id) {
    if (!id) return;
    this._emit('REMOVE_TOAST', { id });
  }
}

export const NotificationService = new NotificationServiceManager();
export default NotificationService;
