import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Access the global AuthContext state and authentication methods.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
