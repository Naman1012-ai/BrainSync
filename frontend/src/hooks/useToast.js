import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';
import { NotificationService } from '../services/notificationService';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // If used outside of provider, fallback to NotificationService directly
    return {
      toast: NotificationService,
      showToast: (msg, type, duration) => NotificationService.show(msg, type, duration),
    };
  }
  return context;
}

export default useToast;
