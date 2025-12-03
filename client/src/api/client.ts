import axios from 'axios';

// 1. FIX: Dynamic Base URL
// If PROD (Server), use '/api' so Nginx handles it.
// If DEV (Laptop), use 'http://localhost:5000/api'
const baseURL = import.meta.env.PROD 
  ? '/api' 
  : 'http://localhost:5000/api';

const client = axios.create({
  baseURL,
});

// 2. Request Interceptor: Attach Token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 3. Response Interceptor: Handle Session Expiry (Optional but recommended)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server says "401 Unauthorized" (Token expired/invalid)
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Force redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;