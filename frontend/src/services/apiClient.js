import { auth } from '../config/firebase';

const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_BACKEND_URL || 
  'http://localhost:5000';

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
    const contentType = response.headers.get('content-type') || '';

    // Guard: Handle HTML responses (e.g. Vercel static route fallback or 404 HTML page)
    if (contentType.includes('text/html')) {
      console.error(`🚨 [apiClient Error] Endpoint: ${endpoint} returned HTML instead of JSON. Possible unmapped route or Vercel static fallback.`);
      const error = new Error(`API endpoint '${endpoint}' returned HTML (Status ${response.status}). Ensure backend server is running and VITE_API_URL / VITE_BACKEND_URL is configured correctly.`);
      error.status = response.status;
      error.code = 'HTML_RESPONSE_ERROR';
      throw error;
    }

    let result;
    try {
      result = await response.json();
    } catch (parseErr) {
      const error = new Error(`Failed to parse JSON response from endpoint '${endpoint}' (Status ${response.status}).`);
      error.status = response.status;
      error.code = 'JSON_PARSE_ERROR';
      throw error;
    }

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
