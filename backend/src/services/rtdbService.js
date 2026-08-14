import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'brainsync-07';
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const databaseURL = process.env.VITE_FIREBASE_DATABASE_URL || 'https://brainsync-07-default-rtdb.asia-southeast1.firebasedatabase.app';

let db = null;

try {
  const existingApps = getApps();
  if (!existingApps.length) {
    if (firebaseClientEmail && rawPrivateKey) {
      const privateKey = String(rawPrivateKey).trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      const app = initializeApp({
        credential: cert({
          projectId: firebaseProjectId,
          clientEmail: firebaseClientEmail,
          privateKey,
        }),
        databaseURL,
      });
      db = getDatabase(app);
      console.log('✅ [rtdbService] Initialized Firebase Admin SDK with Service Account credentials');
    } else {
      const app = initializeApp({
        projectId: firebaseProjectId,
        databaseURL,
      });
      db = getDatabase(app);
      console.log('⚠️ [rtdbService] Initialized Firebase Admin SDK default app');
    }
  } else {
    db = getDatabase(existingApps[0]);
  }
} catch (err) {
  console.warn('⚠️ [rtdbService] Firebase Admin SDK initialization fallback warning:', err.message);
}

/**
 * Server-side Firebase Realtime Database Service.
 * Uses Firebase Admin SDK for authenticated, rule-bypassing database access.
 */
export const rtdbService = {
  getData: async (path) => {
    try {
      const cleanPath = path.replace(/^\/|\/$/g, '');
      if (db) {
        const snapshot = await db.ref(cleanPath).once('value');
        return snapshot.val();
      }
      // Fallback REST request
      const url = `${databaseURL}/${cleanPath}.json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error(`🚨 [Backend RTDB getData Error] Path: ${path}:`, err.message);
      return null;
    }
  },

  setData: async (path, data) => {
    try {
      const cleanPath = path.replace(/^\/|\/$/g, '');
      if (db) {
        await db.ref(cleanPath).set(data);
        return true;
      }
      const url = `${databaseURL}/${cleanPath}.json`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch (err) {
      console.error(`🚨 [Backend RTDB setData Error] Path: ${path}:`, err.message);
      throw err;
    }
  },

  updateData: async (path, updates) => {
    try {
      const cleanPath = path.replace(/^\/|\/$/g, '');
      if (db) {
        await db.ref(cleanPath).update(updates);
        return true;
      }
      const url = `${databaseURL}/${cleanPath}.json`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return res.ok;
    } catch (err) {
      console.error(`🚨 [Backend RTDB updateData Error] Path: ${path}:`, err.message);
      throw err;
    }
  },

  removeData: async (path) => {
    try {
      const cleanPath = path.replace(/^\/|\/$/g, '');
      if (db) {
        await db.ref(cleanPath).remove();
        return true;
      }
      const url = `${databaseURL}/${cleanPath}.json`;
      const res = await fetch(url, { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      console.error(`🚨 [Backend RTDB removeData Error] Path: ${path}:`, err.message);
      throw err;
    }
  },
};
