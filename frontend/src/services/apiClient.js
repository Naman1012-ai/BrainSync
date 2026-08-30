import { auth } from '../config/firebase';

const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.DEV ? '' : '');

/**
 * Unified Frontend API Client for BrainSync Express Backend.
 * Handles base URL configuration, Bearer token injection, and standardized error parsing.
 */
async function request(endpoint, options = {}) {
  // Use relative URL if API_BASE_URL is empty, otherwise prepend base URL
  const url = endpoint.startsWith('http') 
    ? endpoint 
    : API_BASE_URL 
    ? `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`
    : endpoint;

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

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkErr) {
    console.error(`🚨 [apiClient Network Error] Failed to connect to '${url}':`, networkErr.message);
    const error = new Error(`Backend server is currently unavailable. Please ensure the backend server is running.`);
    error.code = 'BACKEND_UNAVAILABLE';
    error.status = 0;
    error.originalError = networkErr;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';

  // Guard: Handle HTML responses (e.g. Vercel static route fallback or Vite 404 HTML page)
  if (contentType.includes('text/html')) {
    console.error(`🚨 [apiClient Error] Endpoint: ${endpoint} returned HTML (Status ${response.status}). Unmapped route or SPA fallback.`);
    if (response.status === 404) {
      const error = new Error(`API endpoint '${endpoint}' was not found on the backend.`);
      error.status = 404;
      error.code = 'ENDPOINT_NOT_FOUND';
      throw error;
    }
    const error = new Error(`API endpoint '${endpoint}' returned unexpected HTML response (Status ${response.status}).`);
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
    const message = errorObj.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.code = errorObj.code || (response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : 'API_ERROR');
    error.status = response.status;
    throw error;
  }

  return result.data !== undefined ? result.data : result;
}

export const apiClient = {
  get: (endpoint, options = {}) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body = {}, options = {}) => request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  patch: (endpoint, body = {}, options = {}) => request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  put: (endpoint, body = {}, options = {}) => request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint, options = {}) => request(endpoint, { ...options, method: 'DELETE' }),
  baseUrl: API_BASE_URL,
};
