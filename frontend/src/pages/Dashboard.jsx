import { useState, useEffect } from 'react';
import api from '../api';

function Dashboard() {
    const [stats, setStats] = useState({
        employees: 0,
        clients: 0,
        activeEmployees: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [employeesRes, clientsRes] = await Promise.all([
                    api.get('/employees/'),
                    api.get('/clients/')
                ]);

                const employees = employeesRes.data;
                setStats({
                    employees: employees.length,
                    clients: clientsRes.data.length,
                    activeEmployees: employees.filter(e => e.is_active).length
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="text-center" style={{ padding: '4rem' }}>
                <div className="stat-value">💎</div>
                <p className="mt-2">טוען...</p>
            </div>
        );
    }

    return (
        <div>
            <header className="page-header">
                <h1 className="page-title text-gradient">לוח בקרה</h1>
                <p className="page-subtitle">ברוכים הבאים למערכת ה-CRM של צוות יהלום</p>
            </header>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.employees}</div>
                    <div className="stat-label">סה&quot;כ עובדים</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.activeEmployees}</div>
                    <div className="stat-label">עובדים פעילים</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.clients}</div>
                    <div className="stat-label">סה&quot;כ לקוחות</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">פעולות מהירות</h3>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flexDirection: 'row-reverse' }}>
                    <a href="/employees" className="btn">+ הוסף עובד</a>
                    <a href="/clients" className="btn btn-secondary">+ הוסף לקוח</a>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
