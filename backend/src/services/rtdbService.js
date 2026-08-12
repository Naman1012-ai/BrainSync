const RTDB_BASE_URL = process.env.VITE_FIREBASE_DATABASE_URL || 'https://brainsync-07-default-rtdb.asia-southeast1.firebasedatabase.app';

/**
 * Server-side Firebase Realtime Database REST API Service.
 * Direct HTTPS interaction with Firebase RTDB endpoints.
 */
export const rtdbService = {
  getData: async (path) => {
    try {
      const cleanPath = path.replace(/^\/|\/$/g, '');
      const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
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
      const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
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
      const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
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
      const url = `${RTDB_BASE_URL}/${cleanPath}.json`;
      const res = await fetch(url, { method: 'DELETE' });
      return res.ok;
    } catch (err) {
      console.error(`🚨 [Backend RTDB removeData Error] Path: ${path}:`, err.message);
      throw err;
    }
  },
};
