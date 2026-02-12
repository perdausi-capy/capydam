import axios from 'axios';

// ✅ Logic: Environment variable with local fallback
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 300000, // 👈 300,000ms = 5 Minutes
});

// --- REQUEST INTERCEPTOR: Attach JWT ---
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); 
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; 
  }
  return config;
});

// --- RESPONSE INTERCEPTOR: Error Handling & Loop Prevention ---
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const { config, response } = error;
    const status = response?.status;

    // 🛡️ SHIELD 1: Background Quest Silence
    // We ONLY silence GET requests (the Witch checking for questions).
    // We ALLOW POST/PATCH requests (voting/admin) to throw errors so we can see toasts.
    if (config?.url?.includes('/daily') && config.method === 'get') { 
      console.warn("🛡️ Daily Quest background fetch silenced to prevent reload loops.");
      return Promise.resolve({ data: null }); 
    }

    // 🛡️ SHIELD 2: Auth Logic Guard (401/403)
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