import admin from 'firebase-admin';

/**
 * Singleton Firebase Admin SDK Module for Backend.
 * Uses server-side environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 */

let firebaseAdminApp = null;
let adminAuth = null;
let adminRtdb = null;

export function initializeFirebaseAdmin() {
  if (firebaseAdminApp) {
    return { adminApp: firebaseAdminApp, adminAuth, adminRtdb };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Unescape newlines in private key if passed as string
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const isPlaceholderKey = !privateKey || privateKey.includes('your_firebase_private_key_here') || privateKey.includes('your_private_key_here');

  if (projectId && clientEmail && privateKey && !isPlaceholderKey) {
    try {
      firebaseAdminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
      });

      adminAuth = admin.auth();
      adminRtdb = admin.database();

      console.log(`🔥 [Firebase Admin Initialized] Project: ${projectId}`);
    } catch (err) {
      console.error('❌ [Firebase Admin Initialization Error]:', err.message);
    }
  } else {
    console.warn(
      '⚠️ [Firebase Admin Warning] FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY is unconfigured/placeholder. Privileged server operations will run in mock mode.'
    );
  }

  return { adminApp: firebaseAdminApp, adminAuth, adminRtdb };
}

export { adminAuth, adminRtdb };
