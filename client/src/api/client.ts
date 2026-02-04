import axios from 'axios';

// ✅ Logic: Environment variable with local fallback [cite: 1142, 1143]
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL,
  withCredentials: true,
});

// Request Interceptor: Attach JWT [cite: 1143]
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); 
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; 
  }
  return config;
});

// Response Interceptor: Error Handling & Loop Prevention 
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const { config, response } = error;
    const status = response?.status;

    // 🛡️ SHIELD 1: Background Quest Silence
    // Prevents the Floating Witch from triggering redirects if her specific API fails.
    if (config?.url?.includes('/daily')) {
      console.warn("🛡️ Daily Quest API silent failure - preventing reload loop.");
      return Promise.resolve({ data: null }); 
    }

    // 🛡️ SHIELD 2: Auth Logic Guard 
    if (status === 401 || status === 403) {
      // 1. Clear credentials from local storage 
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // 2. Loop Prevention Check
      // Only redirect if:
      // a) We aren't already on the login page.
      // b) The request that failed wasn't the actual login attempt.
      const isAtLogin = window.location.pathname === '/login';
      const isLoginRequest = config?.url?.includes('/auth/login');

      if (!isAtLogin && !isLoginRequest) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default client;