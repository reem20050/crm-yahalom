import { useState, useEffect } from 'react';
import api from '../api';

function Employees() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        id_number: '',
        phone: '',
        role: 'guard'
    });
    const [showForm, setShowForm] = useState(false);

    const fetchEmployees = async () => {
        try {
            const response = await api.get('/employees/');
            setEmployees(response.data);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/employees/', formData);
            fetchEmployees();
            setFormData({ first_name: '', last_name: '', id_number: '', phone: '', role: 'guard' });
            setShowForm(false);
        } catch (error) {
            console.error('Error creating employee:', error);
            alert('שגיאה ביצירת עובד');
        }
    };

    return (
        <div>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row-reverse' }}>
                <div>
                    <h1 className="page-title text-gradient">עובדים</h1>
                    <p className="page-subtitle">ניהול צוות האבטחה שלך</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}>
                    {showForm ? '✕ ביטול' : '+ הוסף עובד'}
                </button>
            </header>

            {showForm && (
                <div className="card mb-4 animate-fade-in">
                    <div className="card-header">
                        <h3 className="card-title">הוספת עובד חדש</h3>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-row mb-2">
                            <div className="form-group">
                                <label>שם פרטי</label>
                                <input
                                    name="first_name"
                                    placeholder="הכנס שם פרטי"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>שם משפחה</label>
                                <input
                                    name="last_name"
                                    placeholder="הכנס שם משפחה"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-row mb-2">
                            <div className="form-group">
                                <label>תעודת זהות</label>
                                <input
                                    name="id_number"
                                    placeholder="הכנס תעודת זהות"
                                    value={formData.id_number}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>טלפון</label>
                                <input
                                    name="phone"
                                    placeholder="הכנס מספר טלפון"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>תפקיד</label>
                                <select name="role" value={formData.role} onChange={handleChange}>
                                    <option value="guard">מאבטח</option>
                                    <option value="shift_manager">מנהל משמרת</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit">שמור עובד</button>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <p className="text-center">טוען עובדים...</p>
                ) : employees.length === 0 ? (
                    <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>
                        אין עובדים עדיין. לחץ על &quot;הוסף עובד&quot; כדי להתחיל.
                    </p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>מזהה</th>
                                <th>שם</th>
                                <th>תעודת זהות</th>
                                <th>טלפון</th>
                                <th>תפקיד</th>
                                <th>סטטוס</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => (
                                <tr key={emp.id}>
                                    <td>{emp.id}</td>
                                    <td><strong>{emp.first_name} {emp.last_name}</strong></td>
                                    <td>{emp.id_number}</td>
                                    <td>{emp.phone}</td>
                                    <td>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: emp.role === 'shift_manager' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 211, 238, 0.2)',
                                            color: emp.role === 'shift_manager' ? 'var(--color-accent-gold)' : 'var(--color-accent-cyan)',
                                            fontSize: 'var(--font-size-xs)',
                                            textTransform: 'none'
                                        }}>
                                            {emp.role === 'shift_manager' ? 'מנהל' : 'מאבטח'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            color: emp.is_active ? '#10b981' : '#ef4444'
                                        }}>
                                            {emp.is_active ? '● פעיל' : '○ לא פעיל'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default Employees;
