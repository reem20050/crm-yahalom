import { NavLink } from 'react-router-dom';
import './Navbar.css';

function Navbar({ user, onLogout }) {
    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div className="navbar-brand">
                    <span className="brand-icon">💎</span>
                    <span className="brand-text">צוות יהלום</span>
                </div>

                <div className="navbar-links">
                    <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} end>
                        <span className="nav-icon">📊</span>
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
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
