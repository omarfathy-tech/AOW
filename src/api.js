import { CONFIG } from './config';

export const API = CONFIG.API_BASE_URL;

// Helper to get auth headers
export const getAuthHeaders = (contentType = true) => {
  const token = localStorage.getItem('token');
  const headers = {};
  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Helper for authenticated fetch
export const authFetch = async (url, options = {}) => {
  const headers = getAuthHeaders(options.body !== undefined && !(options.body instanceof FormData));
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });
  
  if (response.status === 401) {
    // Token expired or invalid
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
    return null;
  }
  
  return response;
};
