import { useState, useEffect } from 'react';
import api from '../api';

function Dashboard() {
    const [stats, setStats] = useState({
        employees: 0,
        clients: 0,
        activeEmployees: 0,
        shifts: 0,
        tasks: 0,
        openTasks: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [employeesRes, clientsRes, shiftsRes, tasksRes] = await Promise.all([
                    api.get('/employees/'),
                    api.get('/clients/'),
                    api.get('/shifts/'),
                    api.get('/tasks/')
                ]);

                const employees = employeesRes.data;
                const tasks = tasksRes.data;
                setStats({
                    employees: employees.length,
                    clients: clientsRes.data.length,
                    activeEmployees: employees.filter(e => e.is_active).length,
                    shifts: shiftsRes.data.length,
                    tasks: tasks.length,
                    openTasks: tasks.filter(t => t.status !== 'done').length
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
                    <div className="stat-label">סה״כ עובדים</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.activeEmployees}</div>
                    <div className="stat-label">עובדים פעילים</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.clients}</div>
                    <div className="stat-label">סה״כ לקוחות</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.shifts}</div>
                    <div className="stat-label">סה״כ משמרות</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.openTasks}</div>
                    <div className="stat-label">משימות פתוחות</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">פעולות מהירות</h3>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flexDirection: 'row-reverse' }}>
                    <a href="/shifts" className="btn">+ הוסף משמרת</a>
                    <a href="/tasks" className="btn btn-secondary">+ הוסף משימה</a>
                    <a href="/employees" className="btn">+ הוסף עובד</a>
                    <a href="/clients" className="btn btn-secondary">+ הוסף לקוח</a>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
