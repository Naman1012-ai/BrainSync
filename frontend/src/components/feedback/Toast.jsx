import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { NotificationService } from '../../services/notificationService';

/**
 * Legacy Toast compatibility component.
 * Delegates directly to the centralized NotificationService to prevent duplicate bottom-right toasts.
 */
export function Toast({
  type = 'info',
  message = '',
  isOpen = false,
  onClose,
  duration = 4000,
}) {
  useEffect(() => {
    if (isOpen && message) {
      NotificationService.show(message, type, duration);
      if (onClose) {
        onClose();
      }
    }
  }, [isOpen, message, type, duration, onClose]);

  return null;
}

Toast.propTypes = {
  type: PropTypes.oneOf(['success', 'warning', 'error', 'info']),
  message: PropTypes.string,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  duration: PropTypes.number,
};
