import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Interceptor: Automatically add the Token to every request if we have it
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;