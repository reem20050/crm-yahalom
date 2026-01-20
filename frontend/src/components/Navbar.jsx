<<<<<<< HEAD
import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api';
import './Navbar.css';

function Navbar() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    useEffect(() => {
        // Get current user info
        api.get('/auth/me')
            .then(res => setUser(res.data))
            .catch(() => setUser(null));
    }, []);

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            // Still redirect to login even if logout fails
            navigate('/login');
        }
    };

=======
import { NavLink } from 'react-router-dom';
import './Navbar.css';

function Navbar({ user, onLogout }) {
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-brand">
                    <span className="brand-icon">💎</span>
<<<<<<< HEAD
                    <span className="brand-text">Diamond Team CRM</span>
=======
                    <span className="brand-text">צוות יהלום</span>
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                </div>

                <div className="navbar-links">
                    <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} end>
                        <span className="nav-icon">📊</span>
<<<<<<< HEAD
                        Dashboard
                    </NavLink>
                    <NavLink to="/employees" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <span className="nav-icon">👥</span>
                        Employees
                    </NavLink>
                    <NavLink to="/clients" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <span className="nav-icon">🏢</span>
                        Clients
                    </NavLink>
                    {user && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem' }}>
                            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                {user.email}
                            </span>
                            <button
                                onClick={handleLogout}
                                style={{
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: 'var(--font-size-sm)',
                                }}
                            >
                                Logout
                            </button>
                        </div>
                    )}
=======
                        לוח בקרה
                    </NavLink>
                    <NavLink to="/employees" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <span className="nav-icon">👥</span>
                        עובדים
                    </NavLink>
                    <NavLink to="/clients" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <span className="nav-icon">🏢</span>
                        לקוחות
                    </NavLink>
                    {user?.role === 'admin' && (
                        <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                            <span className="nav-icon">🛡️</span>
                            משתמשים
                        </NavLink>
                    )}
                    <button className="nav-link" type="button" onClick={onLogout}>
                        <span className="nav-icon">⏻</span>
                        התנתקות
                    </button>
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
