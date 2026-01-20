<<<<<<< HEAD
import { Routes, Route, Navigate } from 'react-router-dom';
=======
import { Routes, Route } from 'react-router-dom';
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Clients from './pages/Clients';
<<<<<<< HEAD
import Shifts from './pages/Shifts';
import Tasks from './pages/Tasks';
import Calendar from './pages/Calendar';
import Reports from './pages/Reports';
import Login from './pages/Login';
import api from './api';
import './App.css';

// Protected Route Component
function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(() => {
        setIsAuthenticated(true);
        setLoading(false);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
=======
import Login from './pages/Login';
import Users from './pages/Users';
import api from './api';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const loadMe = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setAuthLoading(false);
      return;
    }
    loadMe();
  }, []);

  const handleLogin = () => {
    setAuthLoading(true);
    loadMe();
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  if (authLoading) {
    return (
      <div className="text-center" style={{ padding: '4rem' }}>
        <div className="stat-value">💎</div>
        <p className="mt-2">טוען...</p>
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
      </div>
    );
  }

<<<<<<< HEAD
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <>
                <Navbar />
                <main className="page-container animate-fade-in">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/shifts" element={<Shifts />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </>
            </ProtectedRoute>
          }
        />
      </Routes>
=======
  if (!user) {
    return (
      <div className="app">
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="page-container animate-fade-in">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </main>
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
    </div>
  );
}

export default App;
