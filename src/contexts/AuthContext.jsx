import React, { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { authService } from '../services/authService';

export const AuthContext = createContext({
  user: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    const newUser = await authService.signUp(email, password, displayName);
    setUser(newUser);
    return newUser;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const signedInUser = await authService.signIn(email, password);
    setUser(signedInUser);
    return signedInUser;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const googleUser = await authService.signInWithGoogle();
    if (googleUser) {
      setUser(googleUser);
    }
    return googleUser;
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
  }, []);

  const resetPassword = useCallback(async (email) => {
    await authService.resetPassword(email);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
