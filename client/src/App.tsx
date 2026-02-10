import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import GoogleCallback from './pages/GoogleCallback';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetails from './pages/LeadDetails';
import Customers from './pages/Customers';
import CustomerDetails from './pages/CustomerDetails';
import Employees from './pages/Employees';
import EmployeeDetails from './pages/EmployeeDetails';
import Shifts from './pages/Shifts';
import Events from './pages/Events';
import EventDetails from './pages/EventDetails';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';
import Profile from './pages/Profile';
import Users from './pages/Users';
import NotFound from './pages/NotFound';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetails />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetails />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/:id" element={<EmployeeDetails />} />
          <Route path="shifts" element={<Shifts />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetails />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
