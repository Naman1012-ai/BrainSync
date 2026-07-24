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
import { rtdbService } from './rtdbService';
import { orgService } from './orgService';

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

    const uid = user.uid;
    const isPasswordUser = user.providerData?.some((p) => p.providerId === 'password');

    // 1. Re-authenticate user if password user
    if (isPasswordUser) {
      if (!password || !password.trim()) {
        throw new Error('Current password is required to delete your account.');
      }
      await authService.reauthenticateUser(password.trim());
    }

    try {
      // 2. Cascade Cleanup: Workspaces & Memberships
      try {
        const allOrgs = (await rtdbService.getData('organizations')) || {};
        const ownedOrgIds = [];
        const memberOrgIds = [];

        for (const [orgId, org] of Object.entries(allOrgs)) {
          if (!org) continue;
          if (org.ownerId === uid) {
            ownedOrgIds.push(orgId);
          } else {
            memberOrgIds.push(orgId);
          }
        }

        // Delete all owned workspaces (and their associated tasks, blueprints, ideas, discussions, members)
        for (const orgId of ownedOrgIds) {
          await orgService.deleteWorkspace(orgId).catch((err) => {
            console.warn(`[authService] Error purging owned workspace ${orgId}:`, err);
          });
        }

        // Remove user from all joined workspace rosters and update memberCount
        for (const orgId of memberOrgIds) {
          await rtdbService.removeData(`organization_members/${orgId}/${uid}`).catch(() => {});
          const org = allOrgs[orgId];
          if (org && typeof org.memberCount === 'number') {
            const updatedCount = Math.max(1, org.memberCount - 1);
            await rtdbService.updateData(`organizations/${orgId}`, { memberCount: updatedCount }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[authService] Error cleaning up workspaces:', err);
      }

      // 3. Cascade Cleanup: Ideas (Public & Workspace)
      try {
        const publicIdeas = (await rtdbService.getData('publicIdeas')) || {};
        for (const [ideaId, idea] of Object.entries(publicIdeas)) {
          if (idea && (idea.authorId === uid || idea.createdBy === uid)) {
            await rtdbService.updateData(`publicIdeas/${ideaId}`, { isDeleted: true, updatedAt: Date.now() }).catch(() => {});
            await rtdbService.removeData(`votes/${ideaId}`).catch(() => {});
            await rtdbService.removeData(`discussions/${ideaId}`).catch(() => {});
          }
        }

        const workspaceIdeasMap = (await rtdbService.getData('ideas')) || {};
        for (const [orgId, orgIdeas] of Object.entries(workspaceIdeasMap)) {
          if (!orgIdeas || typeof orgIdeas !== 'object') continue;
          for (const [ideaId, idea] of Object.entries(orgIdeas)) {
            if (idea && (idea.authorId === uid || idea.createdBy === uid)) {
              await rtdbService.updateData(`ideas/${orgId}/${ideaId}`, { isDeleted: true, updatedAt: Date.now() }).catch(() => {});
              await rtdbService.removeData(`votes/${ideaId}`).catch(() => {});
              await rtdbService.removeData(`discussions/${ideaId}`).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('[authService] Error cleaning up authored ideas:', err);
      }

      // 4. Cascade Cleanup: Votes
      try {
        const votes = (await rtdbService.getData('votes')) || {};
        for (const [voteKey, vote] of Object.entries(votes)) {
          if (voteKey.endsWith(`_${uid}`) || (vote && (vote.uid === uid || vote.userId === uid))) {
            await rtdbService.removeData(`votes/${voteKey}`).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[authService] Error cleaning up votes:', err);
      }

      // 5. Cascade Cleanup: Discussions / Comments / Suggestions
      try {
        const discussions = (await rtdbService.getData('discussions')) || {};
        for (const [ideaId, discMap] of Object.entries(discussions)) {
          if (!discMap || typeof discMap !== 'object') continue;
          for (const [discId, disc] of Object.entries(discMap)) {
            if (disc && (disc.authorId === uid || disc.uid === uid)) {
              await rtdbService.removeData(`discussions/${ideaId}/${discId}`).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn('[authService] Error cleaning up discussions:', err);
      }

      // 6. Direct User Profile & Settings Cleanup across RTDB
      await Promise.all([
        rtdbService.removeData(`users/${uid}`).catch(() => {}),
        rtdbService.removeData(`notifications/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_activity/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_preferences/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_announcements/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_reports/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_admin_notes/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_admin_warnings/${uid}`).catch(() => {}),
        rtdbService.removeData(`user_settings/${uid}`).catch(() => {}),
      ]);

      // 7. Delete Firebase Auth User Account
      await user.delete();

      return true;
    } catch (error) {
      console.error('[authService] deleteUserAccount error:', error);
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('For security reasons, please log out and log back in before deleting your account.');
      }
      throw new Error(error.message || getErrorMessage(error.code || 'default'));
    }
  },

  /**
   * Get current authenticated user synchronous snapshot.
   */
  getCurrentUser: () => {
    return auth.currentUser;
  },
};
