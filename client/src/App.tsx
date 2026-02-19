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
const SitesMap = lazy(() => import('./pages/SitesMap'));
const GuardTracking = lazy(() => import('./pages/GuardTracking'));
const GuardPanel = lazy(() => import('./pages/GuardPanel'));
const OpenShifts = lazy(() => import('./pages/OpenShifts'));
const AutomationSettings = lazy(() => import('./pages/AutomationSettings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="animate-fade-in p-4 lg:p-8 space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-32" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-card p-6">
            <div className="skeleton w-10 h-10 rounded-xl" />
            <div className="skeleton h-8 w-24 mt-3 rounded-xl" />
            <div className="skeleton h-4 w-16 mt-1.5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-card p-6 space-y-3">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-[85%]" />
            <div className="skeleton h-4 w-[60%]" />
          </div>
        ))}
      </div>
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
            <Route path="automation" element={<RoleRoute permission="page:settings"><AutomationSettings /></RoleRoute>} />
            <Route path="sites-map" element={<RoleRoute permission="page:sites-map"><SitesMap /></RoleRoute>} />
            <Route path="guard-tracking" element={<RoleRoute permission="page:guard-tracking"><GuardTracking /></RoleRoute>} />
            <Route path="guard-panel" element={<GuardPanel />} />
            <Route path="open-shifts" element={<OpenShifts />} />
            <Route path="profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
