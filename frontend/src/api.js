import axios from 'axios';

<<<<<<< HEAD
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true, // Important: Send cookies with requests
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      // Don't remove localStorage - we use cookies now
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
=======
// Support dynamic API URL for deployment (defaults to localhost for development)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95

export default api;
