import axios from 'axios';

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for handling common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 422) {
      // Token expired, invalid, or missing
      console.log('Authentication error - clearing tokens');
      localStorage.removeItem('authToken');
      // Don't automatically redirect here - let components handle it
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Authentication endpoints
  async login(credentials) {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  async register(userData) {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async changePassword(passwordData) {
    const response = await api.post('/auth/change-password', passwordData);
    return response.data;
  },

  // Profile endpoints
  async getProfile() {
    const response = await api.get('/profile');
    return response.data;
  },

  async updateProfile(profileData) {
    const response = await api.put('/profile', profileData);
    return response.data;
  },

  async updateTheme(theme) {
    const response = await api.put('/profile/theme', { theme });
    return response.data;
  },

  async uploadAvatar(avatarFile) {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    
    const response = await api.post('/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async getSettings() {
    const response = await api.get('/profile/settings');
    return response.data;
  },

  async updateSettings(settings) {
    const response = await api.put('/profile/settings', settings);
    return response.data;
  }
};

// Search users for messaging / discovery
export async function searchUsers(query) {
  try {
    const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
    return response.data.users || response.data || [];
  } catch (error) {
    console.error('Search API Error:', error);
    throw error;
  }
}

export default api;