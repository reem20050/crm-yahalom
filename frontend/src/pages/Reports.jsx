import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';

function Reports() {
  const [shiftReport, setShiftReport] = useState(null);
  const [employeeReport, setEmployeeReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const [shiftRes, employeeRes] = await Promise.all([
        api.get('/reports/shifts'),
        api.get('/reports/employees'),
      ]);
      setShiftReport(shiftRes.data);
      setEmployeeReport(employeeRes.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '4rem' }}>
        <div className="stat-value">💎</div>
        <p className="mt-2">טוען...</p>
      </div>
    );
  }

  const shiftData = shiftReport
    ? [
        { name: 'מתוכננות', value: shiftReport.scheduled_shifts },
        { name: 'הושלמו', value: shiftReport.completed_shifts },
        { name: 'בוטלו', value: shiftReport.canceled_shifts },
      ]
    : [];

  const employeeData = employeeReport?.items?.map((item) => ({
    name: item.employee_name,
    total: item.total_shifts,
    active: item.active_shifts,
  })) || [];

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title text-gradient">דוחות וסטטיסטיקות</h1>
        <p className="page-subtitle">סקירה מהירה על פעילות המערכת</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{shiftReport?.total_shifts ?? 0}</div>
          <div className="stat-label">סה״כ משמרות</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{employeeReport?.total_employees ?? 0}</div>
          <div className="stat-label">סה״כ עובדים</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">סטטוס משמרות</h3>
        </div>
        {shiftData.length === 0 ? (
          <p>אין נתונים להצגה</p>
        ) : (
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shiftData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#22d3ee" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">משמרות לפי עובד</h3>
        </div>
        {employeeData.length === 0 ? (
          <p>אין נתונים להצגה</p>
        ) : (
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#3b82f6" name="סה״כ" />
                <Bar dataKey="active" fill="#fbbf24" name="פעיל" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;
