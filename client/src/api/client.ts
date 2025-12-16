import axios from 'axios';

// ✅ CORRECT LOGIC:
// Use the environment variable if it exists.
// Fallback to localhost only if the variable is missing (dev mode).
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL,
  withCredentials: true, // Important for CORS cookies if you use them
});

// ... keep the rest of your interceptors below ...
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
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
