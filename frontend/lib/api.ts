import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration / 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config && error.config.url && error.config.url.includes('/auth/login');
      if (!isLoginRequest && typeof window !== 'undefined') {
        clearAuthToken();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper methods
export const setAuthToken = (token: string) => {
  localStorage.setItem('token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('selectedProjectId');
  localStorage.removeItem('selectedOrgId');
};

export const getSelectedProjectId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('selectedProjectId');
};

export const setSelectedProjectId = (id: string) => {
  localStorage.setItem('selectedProjectId', id);
};

export const getSelectedOrgId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('selectedOrgId');
};

export const setSelectedOrgId = (id: string) => {
  localStorage.setItem('selectedOrgId', id);
};
