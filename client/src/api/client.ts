import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); 
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; 
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // 🛡️ SHIELD: If the daily question fails, DO NOT redirect to login.
    // This stops the reload loop even if the server has a 502/500/404/401 error.
    if (error.config?.url?.includes('/daily')) {
      console.warn("Daily Question failed, but we are preventing a reload loop.");
      return Promise.resolve({ data: null }); 
    }

    // 🚪 Standard logout logic for other critical APIs
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if we aren't already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;