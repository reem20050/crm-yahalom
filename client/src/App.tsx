import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { usePermissions } from './hooks/usePermissions';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load all pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const GoogleCallback = lazy(() => import('./pages/GoogleCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetails = lazy(() => import('./pages/LeadDetails'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetails = lazy(() => import('./pages/CustomerDetails'));
const Employees = lazy(() => import('./pages/Employees'));
const EmployeeDetails = lazy(() => import('./pages/EmployeeDetails'));
const Shifts = lazy(() => import('./pages/Shifts'));
const Events = lazy(() => import('./pages/Events'));
const EventDetails = lazy(() => import('./pages/EventDetails'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Profile = lazy(() => import('./pages/Profile'));
const Users = lazy(() => import('./pages/Users'));
const Incidents = lazy(() => import('./pages/Incidents'));
const WeaponsEquipment = lazy(() => import('./pages/WeaponsEquipment'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function RoleRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = usePermissions();
  return can(permission) ? <>{children}</> : <Navigate to="/" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
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
            <Route path="dashboard" element={<Navigate to="/" replace />} />
            <Route path="leads" element={<RoleRoute permission="page:leads"><Leads /></RoleRoute>} />
            <Route path="leads/:id" element={<RoleRoute permission="page:leads"><LeadDetails /></RoleRoute>} />
            <Route path="customers" element={<RoleRoute permission="page:customers"><Customers /></RoleRoute>} />
            <Route path="customers/:id" element={<RoleRoute permission="page:customers"><CustomerDetails /></RoleRoute>} />
            <Route path="employees" element={<RoleRoute permission="page:employees"><Employees /></RoleRoute>} />
            <Route path="employees/:id" element={<RoleRoute permission="page:employees"><EmployeeDetails /></RoleRoute>} />
            <Route path="shifts" element={<Shifts />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetails />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="weapons" element={<RoleRoute permission="page:weapons"><WeaponsEquipment /></RoleRoute>} />
            <Route path="invoices" element={<RoleRoute permission="page:invoices"><Invoices /></RoleRoute>} />
            <Route path="reports" element={<RoleRoute permission="page:reports"><Reports /></RoleRoute>} />
            <Route path="users" element={<RoleRoute permission="page:users"><Users /></RoleRoute>} />
            <Route path="settings" element={<RoleRoute permission="page:settings"><Settings /></RoleRoute>} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
