import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  updateEmail as firebaseUpdateEmail,
  verifyBeforeUpdateEmail as firebaseVerifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { getErrorMessage } from '../utils/errorMessages';

/**
 * Service Layer abstraction for Firebase Authentication.
 * No component should import from 'firebase/auth' directly.
 */
export const authService = {
  /**
   * Register a new user with email, password, and display name.
   */
  signUp: async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      // Send verification email on sign up
      await authService.sendVerificationEmail().catch(() => {});
      return userCredential.user;
    } catch (error) {
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Sign in an existing user with email and password.
   */
  signIn: async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Sign in or register with Google OAuth Popup.
   */
  signInWithGoogle: async () => {
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      return userCredential.user;
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        return null;
      }
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Send Firebase verification email to current user.
   */
  sendVerificationEmail: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user found.');
    try {
      await firebaseSendEmailVerification(user);
    } catch (error) {
      console.error('[authService] sendVerificationEmail error:', error);
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Reload current user status from Firebase Auth server.
   */
  reloadUser: async () => {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      await user.reload();
      return auth.currentUser;
    } catch (error) {
      console.error('[authService] reloadUser error:', error);
      return user;
    }
  },

  /**
   * Reauthenticate user using current password.
   */
  reauthenticateUser: async (password) => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user found.');
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (error) {
      console.error('[authService] reauthenticateUser error:', error);
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Update user email address safely.
   */
  updateUserEmail: async (newEmail) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user found.');
    try {
      if (typeof firebaseVerifyBeforeUpdateEmail === 'function') {
        await firebaseVerifyBeforeUpdateEmail(user, newEmail);
      } else {
        await firebaseUpdateEmail(user, newEmail);
      }
    } catch (error) {
      console.error('[authService] updateUserEmail error:', error);
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Send a password reset email.
   */
  sendPasswordResetEmail: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Sign out current user.
   */
  signOut: async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw new Error(getErrorMessage(error.code));
    }
  },

  /**
   * Subscribe to authentication state changes.
   */
  onAuthChange: (callback) => {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Delete current user's Firebase Auth account and all associated RTDB data.
   */
  deleteUserAccount: async (password = null) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user found.');

    try {
      const uid = user.uid;

      // 1. Re-authenticate if password provided
      if (password) {
        await authService.reauthenticateUser(password);
      }

      // 2. Cascade cleanup user data across Realtime Database
      await Promise.all([
        rtdbService.removeData(`users/${uid}`).catch(() => {}),
        rtdbService.removeData(`notifications/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_activity/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_preferences/${uid}`).catch(() => {}),
      ]);

      // 3. Remove user from all joined workspace member rosters
      try {
        const allOrgMembers = (await rtdbService.getData('organization_members')) || {};
        for (const [orgId, membersMap] of Object.entries(allOrgMembers)) {
          if (membersMap && membersMap[uid]) {
            await rtdbService.removeData(`organization_members/${orgId}/${uid}`).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[authService] Error cleaning up workspace memberships:', err);
      }

      // 4. Permanently delete Firebase Auth credential
      await user.delete();

      return true;
    } catch (error) {
      console.error('[authService] deleteUserAccount error:', error);
      throw new Error(getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Get current authenticated user synchronous snapshot.
   */
  getCurrentUser: () => {
    return auth.currentUser;
  },
};
