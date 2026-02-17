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
  getGoogleClientId: () => api.get('/auth/google/client-id'),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Dashboard
export const dashboardApi = {
  get: () => api.get('/dashboard'),
  getOperations: () => api.get('/dashboard/operations'),
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
  deleteDocument: (employeeId: string, docId: string) =>
    api.delete(`/employees/${employeeId}/documents/${docId}`),
  setAvailability: (employeeId: string, availability: unknown[]) =>
    api.post(`/employees/${employeeId}/availability`, { availability }),
  getAvailable: (date: string, params?: Record<string, unknown>) =>
    api.get(`/employees/available/${date}`, { params }),
  getHours: (id: string, year: number, month: number) =>
    api.get(`/employees/${id}/hours/${year}/${month}`),
};

// Sites (per customer)
export const sitesApi = {
  getByCustomer: (customerId: string) => api.get(`/customers/${customerId}/sites`),
  create: (customerId: string, data: Record<string, unknown>) =>
    api.post(`/customers/${customerId}/sites`, data),
  update: (customerId: string, siteId: string, data: Record<string, unknown>) =>
    api.put(`/customers/${customerId}/sites/${siteId}`, data),
  delete: (customerId: string, siteId: string) =>
    api.delete(`/customers/${customerId}/sites/${siteId}`),
  geocode: (customerId: string, siteId: string) =>
    api.post(`/customers/${customerId}/sites/${siteId}/geocode`),
  setCoordinates: (customerId: string, siteId: string, data: { latitude: number; longitude: number }) =>
    api.patch(`/customers/${customerId}/sites/${siteId}/coordinates`, data),
};

// Sites (global - for map)
export const sitesGlobalApi = {
  getAll: () => api.get('/sites'),
  getWithCoordinates: () => api.get('/sites/with-coordinates'),
  geocodeAll: () => api.post('/sites/geocode-all'),
};

// Maps
export const mapsApi = {
  getApiKey: () => api.get('/integrations/google-maps-key'),
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
  update: (id: string, data: Record<string, unknown>) => api.patch(`/shifts/${id}`, data),
  locationReport: (data: { shift_assignment_id: string; latitude: number; longitude: number; accuracy?: number }) =>
    api.post('/shifts/location-report', data),
  getActiveGuards: () => api.get('/shifts/active-guards'),
  getGuardLocationHistory: (assignmentId: string) => api.get(`/shifts/guard-location-history/${assignmentId}`),
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
  sendEmail: (id: string, email?: string) =>
    api.post(`/invoices/${id}/send-email`, { email }),
};

// Reports
export const reportsApi = {
  sales: (params?: Record<string, unknown>) => api.get('/reports/sales', { params }),
  customers: () => api.get('/reports/customers'),
  employees: (params?: Record<string, unknown>) => api.get('/reports/employees', { params }),
  events: (params?: Record<string, unknown>) => api.get('/reports/events', { params }),
  financial: (params?: Record<string, unknown>) => api.get('/reports/financial', { params }),
  profitLoss: (params?: Record<string, unknown>) => api.get('/reports/profit-loss', { params }),
};

// Search
export const searchApi = {
  search: (q: string) => api.get('/search', { params: { q } }),
};

// Integrations
export const integrationsApi = {
  getSettings: () => api.get('/integrations/settings'),
  sendWhatsApp: (to: string, message: string) =>
    api.post('/integrations/whatsapp/send', { to, message }),
  createGreenInvoice: (data: Record<string, unknown>) =>
    api.post('/integrations/green-invoice/create-invoice', data),
  syncGreenInvoices: (fromDate?: string) =>
    api.post('/integrations/green-invoice/sync', { fromDate }),
  getSchedulerStatus: () => api.get('/integrations/scheduler/status'),
  getGoogleCalendarEvents: (start_date: string, end_date: string) =>
    api.get('/integrations/google/calendar/events', { params: { start_date, end_date } }),
  getEmailTemplates: () => api.get('/integrations/email-templates'),
  createEmailTemplate: (data: Record<string, unknown>) =>
    api.post('/integrations/email-templates', data),
  deleteEmailTemplate: (id: string) => api.delete(`/integrations/email-templates/${id}`),
  sendEmail: (to: string, subject: string, body: string) =>
    api.post('/integrations/google/send-email', { to, subject, body }),
};

// Users (admin only)
export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  resetPassword: (id: string, new_password: string) =>
    api.post(`/users/${id}/reset-password`, { new_password }),
  getUnlinkedEmployees: () => api.get('/users/unlinked-employees'),
};

// Incidents (security incidents)
export const incidentsApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/incidents', { params }),
  getOne: (id: string) => api.get(`/incidents/${id}`),
  create: (data: Record<string, unknown>) => api.post('/incidents', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/incidents/${id}`, data),
  getStats: () => api.get('/incidents/stats'),
  addUpdate: (id: string, update_text: string) =>
    api.post(`/incidents/${id}/updates`, { update_text }),
  resolve: (id: string, resolution: string) =>
    api.patch(`/incidents/${id}/resolve`, { resolution }),
};

// Certifications
export const certificationsApi = {
  getExpiring: () => api.get('/certifications/expiring'),
  getByEmployee: (employeeId: string) => api.get(`/certifications/employee/${employeeId}`),
  create: (data: Record<string, unknown>) => api.post('/certifications', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/certifications/${id}`, data),
  delete: (id: string) => api.delete(`/certifications/${id}`),
};

// Weapons
export const weaponsApi = {
  getAll: () => api.get('/weapons'),
  getAvailable: () => api.get('/weapons/available'),
  getByEmployee: (employeeId: string) => api.get(`/weapons/employee/${employeeId}`),
  create: (data: Record<string, unknown>) => api.post('/weapons', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/weapons/${id}`, data),
  transfer: (id: string, new_employee_id: string | null) =>
    api.post(`/weapons/${id}/transfer`, { new_employee_id }),
  delete: (id: string) => api.delete(`/weapons/${id}`),
};

// Shift Templates
export const shiftTemplatesApi = {
  getAll: () => api.get('/shift-templates'),
  getOne: (id: string) => api.get(`/shift-templates/${id}`),
  create: (data: Record<string, unknown>) => api.post('/shift-templates', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/shift-templates/${id}`, data),
  delete: (id: string) => api.delete(`/shift-templates/${id}`),
  generate: (id: string, start_date: string, end_date: string) =>
    api.post(`/shift-templates/${id}/generate`, { start_date, end_date }),
};

// Patrols
export const patrolsApi = {
  getCheckpoints: (siteId: string) => api.get(`/patrols/sites/${siteId}/checkpoints`),
  createCheckpoint: (siteId: string, data: Record<string, unknown>) =>
    api.post(`/patrols/sites/${siteId}/checkpoints`, data),
  updateCheckpoint: (id: string, data: Record<string, unknown>) =>
    api.put(`/patrols/checkpoints/${id}`, data),
  deleteCheckpoint: (id: string) => api.delete(`/patrols/checkpoints/${id}`),
  log: (data: Record<string, unknown>) => api.post('/patrols/log', data),
  getShiftLogs: (assignmentId: string) => api.get(`/patrols/shift/${assignmentId}`),
  getSiteToday: (siteId: string) => api.get(`/patrols/site/${siteId}/today`),
  getStats: (params?: Record<string, unknown>) => api.get('/patrols/stats', { params }),
};

// Performance
export const performanceApi = {
  getEmployee: (employeeId: string) => api.get(`/performance/employee/${employeeId}`),
  rate: (data: Record<string, unknown>) => api.post('/performance/rate', data),
  getRankings: () => api.get('/performance/rankings'),
};

// Equipment
export const equipmentApi = {
  getAll: (params?: Record<string, unknown>) => api.get('/equipment', { params }),
  getByEmployee: (employeeId: string) => api.get(`/equipment/employee/${employeeId}`),
  create: (data: Record<string, unknown>) => api.post('/equipment', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/equipment/${id}`, data),
  returnItem: (id: string, condition?: string) => api.post(`/equipment/${id}/return`, { condition }),
  delete: (id: string) => api.delete(`/equipment/${id}`),
};

// Activities
export const activitiesApi = {
  getForLead: (leadId: string) => api.get(`/leads/${leadId}/activities`),
  addToLead: (leadId: string, data: Record<string, unknown>) =>
    api.post(`/leads/${leadId}/activities`, data),
  getForCustomer: (customerId: string) => api.get(`/customers/${customerId}/activities`),
  addToCustomer: (customerId: string, data: Record<string, unknown>) =>
    api.post(`/customers/${customerId}/activities`, data),
};

// Documents (Google Drive)
export const documentsApi = {
  getByEntity: (entity_type: string, entity_id: string) =>
    api.get('/documents', { params: { entity_type, entity_id } }),
  upload: (formData: FormData) =>
    api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export default api;
