import { auth } from '../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Unified Frontend API Client for BrainSync Express Backend.
 * Handles base URL configuration, Bearer token injection, and standardized error parsing.
 */
async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach Firebase ID Token if user is authenticated
  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${idToken}`;
    } catch (err) {
      console.warn('⚠️ [apiClient] Failed to retrieve Firebase ID token:', err.message);
    }
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const result = await response.json();

    if (!response.ok || result.success === false) {
      const errorObj = result.error || {};
      const error = new Error(errorObj.message || `Request failed with status ${response.status}`);
      error.code = errorObj.code || 'API_ERROR';
      error.status = response.status;
      throw error;
    }

    return result.data !== undefined ? result.data : result;
  } catch (err) {
    console.error(`🚨 [apiClient Error] Endpoint: ${endpoint} | Error:`, err.message);
    throw err;
  }
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body = {}, options = {}) => request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body = {}, options = {}) => request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
  baseUrl: API_BASE_URL,
};
