import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure dotenv environment variables are loaded prior to reading process.env at import time
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'brainsync-07';
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const databaseURL = process.env.VITE_FIREBASE_DATABASE_URL || 'https://brainsync-07-default-rtdb.asia-southeast1.firebasedatabase.app';

let db = null;

function getDbInstance() {
  if (db) return db;

  try {
    const existingApps = getApps();
    if (existingApps.length) {
      db = getDatabase(existingApps[0]);
      return db;
    }

    // 1. Check for JSON service account file (e.g. fFIREBASE_PRIVATE_KEY.json)
    const candidatePaths = [
      path.resolve(__dirname, '../../fFIREBASE_PRIVATE_KEY.json'),
      path.resolve(__dirname, '../../../fFIREBASE_PRIVATE_KEY.json'),
      path.resolve(__dirname, '../../serviceAccountKey.json'),
      path.resolve(__dirname, '../../../serviceAccountKey.json'),
    ];

    let fileCredential = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const jsonContent = JSON.parse(fs.readFileSync(p, 'utf8'));
          fileCredential = cert(jsonContent);
          console.log(`✅ [rtdbService] Loaded Service Account JSON credentials from: ${p}`);
          break;
        } catch (e) {
          console.warn(`⚠️ [rtdbService] Failed to parse key file at ${p}:`, e.message);
        }
      }
    }

    if (fileCredential) {
      const app = initializeApp({ credential: fileCredential, databaseURL });
      db = getDatabase(app);
      return db;
    }

    // 2. Check for environment variables
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
      console.log('✅ [rtdbService] Initialized Firebase Admin SDK with env credentials');
      return db;
    }

    // Fallback default app
    const app = initializeApp({ projectId: firebaseProjectId, databaseURL });
    db = getDatabase(app);
    console.log('⚠️ [rtdbService] Initialized Firebase Admin SDK default app');
    return db;
  } catch (err) {
    console.warn('⚠️ [rtdbService] Firebase Admin SDK initialization fallback warning:', err.message);
    return null;
  }
}

/**
 * Server-side Firebase Realtime Database Service.
 * Uses Firebase Admin SDK for authenticated, rule-bypassing database access.
 */
export const rtdbService = {
  getData: async (path) => {
    try {
      const cleanPath = path.replace(/^\/|\/$/g, '');
      const instance = getDbInstance();
      if (instance) {
        const snapshot = await instance.ref(cleanPath).once('value');
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
      const instance = getDbInstance();
      if (instance) {
        await instance.ref(cleanPath).set(data);
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
      const instance = getDbInstance();
      if (instance) {
        await instance.ref(cleanPath).update(updates);
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
      const instance = getDbInstance();
      if (instance) {
        await instance.ref(cleanPath).remove();
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
