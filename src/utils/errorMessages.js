/**
 * Maps Firebase Auth and Firestore error codes to user-friendly error strings.
 */
export function getErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing.';
    case 'permission-denied':
      return "You don't have permission to perform this action.";
    case 'not-found':
      return 'The requested resource was not found.';
    case 'already-exists':
      return 'This entry already exists.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
