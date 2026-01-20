import { useEffect, useState } from 'react';
import api from '../api';

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    status: 'open',
    priority: 'normal',
  });

  const fetchTasks = async () => {
    try {
      const response = await api.get('/tasks/');
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
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
        assigned_to: formData.assigned_to ? Number(formData.assigned_to) : null,
        due_date: formData.due_date || null,
      };
      await api.post('/tasks/', payload);
      setFormData({
        title: '',
        description: '',
        assigned_to: '',
        due_date: '',
        status: 'open',
        priority: 'normal',
      });
      setShowForm(false);
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('שגיאה ביצירת משימה');
    }
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
          <h1 className="page-title text-gradient">משימות</h1>
          <p className="page-subtitle">מעקב משימות והתקדמות</p>
        </div>
        <button className="btn" type="button" onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? 'סגור' : '+ הוסף משימה'}
        </button>
      </header>

      {showForm && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">יצירת משימה חדשה</h3>
          </div>
          <form className="form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>כותרת</label>
                <input name="title" value={formData.title} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>משויך למשתמש (ID)</label>
                <input name="assigned_to" value={formData.assigned_to} onChange={handleChange} placeholder="לדוגמה: 1" />
              </div>
              <div className="form-group">
                <label>תאריך יעד</label>
                <input type="datetime-local" name="due_date" value={formData.due_date} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>סטטוס</label>
                <select name="status" value={formData.status} onChange={handleChange}>
                  <option value="open">פתוחה</option>
                  <option value="in_progress">בתהליך</option>
                  <option value="done">הושלמה</option>
                </select>
              </div>
              <div className="form-group">
                <label>עדיפות</label>
                <select name="priority" value={formData.priority} onChange={handleChange}>
                  <option value="low">נמוכה</option>
                  <option value="normal">רגילה</option>
                  <option value="high">גבוהה</option>
                </select>
              </div>
              <div className="form-group">
                <label>תיאור</label>
                <input name="description" value={formData.description} onChange={handleChange} placeholder="פרטי משימה" />
              </div>
            </div>
            <button className="btn" type="submit">שמור משימה</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">רשימת משימות</h3>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>כותרת</th>
                <th>משויך</th>
                <th>סטטוס</th>
                <th>עדיפות</th>
                <th>תאריך יעד</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.assigned_to ?? '-'}</td>
                  <td>{task.status}</td>
                  <td>{task.priority}</td>
                  <td>{task.due_date ? new Date(task.due_date).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Tasks;
