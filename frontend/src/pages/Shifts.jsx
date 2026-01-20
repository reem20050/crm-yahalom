import { useEffect, useState } from 'react';
import api from '../api';

function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    client_id: '',
    start_time: '',
    end_time: '',
    status: 'scheduled',
    notes: '',
  });

  const fetchAll = async () => {
    try {
      const [shiftsRes, employeesRes, clientsRes] = await Promise.all([
        api.get('/shifts/'),
        api.get('/employees/'),
        api.get('/clients/'),
      ]);
      setShifts(shiftsRes.data);
      setEmployees(employeesRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      console.error('Error fetching shifts data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...formData,
        employee_id: Number(formData.employee_id),
        client_id: formData.client_id ? Number(formData.client_id) : null,
      };
      await api.post('/shifts/', payload);
      setFormData({
        employee_id: '',
        client_id: '',
        start_time: '',
        end_time: '',
        status: 'scheduled',
        notes: '',
      });
      setShowForm(false);
      fetchAll();
    } catch (error) {
      console.error('Error creating shift:', error);
      alert('שגיאה ביצירת משמרת');
    }
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find((item) => item.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : 'לא ידוע';
  };

  const getClientName = (clientId) => {
    const client = clients.find((item) => item.id === clientId);
    return client ? client.name : '-';
  };

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
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row-reverse' }}>
        <div>
          <h1 className="page-title text-gradient">משמרות</h1>
          <p className="page-subtitle">ניהול והקצאת משמרות</p>
        </div>
        <button className="btn" type="button" onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? 'סגור' : '+ הוסף משמרת'}
        </button>
      </header>

      {showForm && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">יצירת משמרת חדשה</h3>
          </div>
          <form className="form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>עובד</label>
                <select name="employee_id" value={formData.employee_id} onChange={handleChange} required>
                  <option value="">בחר עובד</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>לקוח</label>
                <select name="client_id" value={formData.client_id} onChange={handleChange}>
                  <option value="">ללא</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>תחילת משמרת</label>
                <input type="datetime-local" name="start_time" value={formData.start_time} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>סיום משמרת</label>
                <input type="datetime-local" name="end_time" value={formData.end_time} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>סטטוס</label>
                <select name="status" value={formData.status} onChange={handleChange}>
                  <option value="scheduled">מתוכננת</option>
                  <option value="completed">הושלמה</option>
                  <option value="canceled">בוטלה</option>
                </select>
              </div>
              <div className="form-group">
                <label>הערות</label>
                <input name="notes" value={formData.notes} onChange={handleChange} placeholder="הערה קצרה" />
              </div>
            </div>
            <button className="btn" type="submit">שמור משמרת</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">רשימת משמרות</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>עובד</th>
                <th>לקוח</th>
                <th>תחילה</th>
                <th>סיום</th>
                <th>סטטוס</th>
                <th>הערות</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  <td>{getEmployeeName(shift.employee_id)}</td>
                  <td>{getClientName(shift.client_id)}</td>
                  <td>{new Date(shift.start_time).toLocaleString()}</td>
                  <td>{new Date(shift.end_time).toLocaleString()}</td>
                  <td>{shift.status}</td>
                  <td>{shift.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Shifts;
