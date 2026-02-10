import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  loginWithGoogle: (credential: string) =>
    api.post('/auth/google', { credential }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Dashboard
export const dashboardApi = {
  get: () => api.get('/dashboard'),
  getNotifications: (unreadOnly = false) =>
    api.get('/dashboard/notifications', { params: { unread_only: unreadOnly } }),
  markNotificationRead: (id: string) =>
    api.patch(`/dashboard/notifications/${id}/read`),
  markAllNotificationsRead: () =>
    api.patch('/dashboard/notifications/read-all'),
};

// Leads
export const leadsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/leads', { params }),
  getOne: (id: string) => api.get(`/leads/${id}`),
  create: (data: Record<string, unknown>) => api.post('/leads', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
  convert: (id: string) => api.post(`/leads/${id}/convert`),
  getStats: () => api.get('/leads/stats/summary'),
};

// Customers
export const customersApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/customers', { params }),
  getOne: (id: string) => api.get(`/customers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/customers', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/customers/${id}`, data),
  delete: (id: string) => api.delete(`/customers/${id}`),
  addContact: (customerId: string, data: Record<string, unknown>) =>
    api.post(`/customers/${customerId}/contacts`, data),
  addSite: (customerId: string, data: Record<string, unknown>) =>
    api.post(`/customers/${customerId}/sites`, data),
  addContract: (customerId: string, data: Record<string, unknown>) =>
    api.post(`/customers/${customerId}/contracts`, data),
};

// Employees
export const employeesApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/employees', { params }),
  getOne: (id: string) => api.get(`/employees/${id}`),
  create: (data: Record<string, unknown>) => api.post('/employees', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
  addDocument: (employeeId: string, data: Record<string, unknown>) =>
    api.post(`/employees/${employeeId}/documents`, data),
  setAvailability: (employeeId: string, availability: unknown[]) =>
    api.post(`/employees/${employeeId}/availability`, { availability }),
  getAvailable: (date: string, params?: Record<string, unknown>) =>
    api.get(`/employees/available/${date}`, { params }),
  getHours: (id: string, year: number, month: number) =>
    api.get(`/employees/${id}/hours/${year}/${month}`),
};

// Sites
export const sitesApi = {
  getByCustomer: (customerId: string) => api.get(`/customers/${customerId}/sites`),
  create: (customerId: string, data: Record<string, unknown>) =>
    api.post(`/customers/${customerId}/sites`, data),
  update: (siteId: string, data: Record<string, unknown>) =>
    api.put(`/sites/${siteId}`, data),
  delete: (siteId: string) => api.delete(`/sites/${siteId}`),
};

// Shifts
export const shiftsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/shifts', { params }),
  getOne: (id: string) => api.get(`/shifts/${id}`),
  delete: (id: string) => api.delete(`/shifts/${id}`),
  create: (data: Record<string, unknown>) => api.post('/shifts', data),
  createRecurring: (data: Record<string, unknown>) => api.post('/shifts/recurring', data),
  assign: (shiftId: string, data: Record<string, unknown>) =>
    api.post(`/shifts/${shiftId}/assign`, data),
  unassign: (shiftId: string, assignmentId: string) =>
    api.delete(`/shifts/${shiftId}/assign/${assignmentId}`),
  checkIn: (assignmentId: string, data?: Record<string, unknown>) =>
    api.post(`/shifts/check-in/${assignmentId}`, data),
  checkOut: (assignmentId: string, data?: Record<string, unknown>) =>
    api.post(`/shifts/check-out/${assignmentId}`, data),
  getTodaySummary: () => api.get('/shifts/summary/today'),
};

// Events
export const eventsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/events', { params }),
  getOne: (id: string) => api.get(`/events/${id}`),
  create: (data: Record<string, unknown>) => api.post('/events', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
  assign: (eventId: string, data: Record<string, unknown>) =>
    api.post(`/events/${eventId}/assign`, data),
  unassign: (eventId: string, assignmentId: string) =>
    api.delete(`/events/${eventId}/assign/${assignmentId}`),
  complete: (id: string, data?: Record<string, unknown>) =>
    api.post(`/events/${id}/complete`, data),
  getUpcoming: () => api.get('/events/upcoming/week'),
};

// Invoices
export const invoicesApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/invoices', { params }),
  getOne: (id: string) => api.get(`/invoices/${id}`),
  delete: (id: string) => api.delete(`/invoices/${id}`),
  create: (data: Record<string, unknown>) => api.post('/invoices', data),
  updateStatus: (id: string, status: string, paymentDate?: string) =>
    api.patch(`/invoices/${id}/status`, { status, payment_date: paymentDate }),
  getOverdue: () => api.get('/invoices/status/overdue'),
  getMonthlySummary: (year?: number, month?: number) =>
    api.get('/invoices/summary/monthly', { params: { year, month } }),
};

// Reports
export const reportsApi = {
  sales: (params?: Record<string, unknown>) => api.get('/reports/sales', { params }),
  customers: () => api.get('/reports/customers'),
  employees: (params?: Record<string, unknown>) => api.get('/reports/employees', { params }),
  events: (params?: Record<string, unknown>) => api.get('/reports/events', { params }),
  financial: (params?: Record<string, unknown>) => api.get('/reports/financial', { params }),
};

export default api;
