import axios from 'axios';

const baseURL = import.meta.env.PROD 
  ? '/api' 
  : 'http://localhost:5000/api';

const client = axios.create({
  baseURL,
});

// ✅ THIS IS THE CRITICAL PART FOR FIXING 401 ERRORS
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Grab token from storage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; // Attach to header
  }
  return config;
});

// Handle Logout on Error
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