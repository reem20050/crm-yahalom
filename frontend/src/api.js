import axios from 'axios';

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

export default api;
