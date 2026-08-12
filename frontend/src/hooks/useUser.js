import { useContext } from 'react';
import { UserContext } from '../contexts/UserContext';

/**
 * Access the real-time RTDB UserProfile state and update functions.
 */
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
