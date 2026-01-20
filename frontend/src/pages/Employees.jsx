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
            alert('Error creating employee');
        }
    };

    const handleDelete = async (employeeId) => {
        if (!window.confirm('Are you sure you want to delete this employee?')) {
            return;
        }
        try {
            await api.delete(`/employees/${employeeId}`);
            fetchEmployees();
        } catch (error) {
            console.error('Error deleting employee:', error);
            alert('Error deleting employee. Make sure there are no shifts assigned to this employee.');
        }
    };

    return (
        <div>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title text-gradient">Employees</h1>
                    <p className="page-subtitle">Manage your security team members</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}>
                    {showForm ? '✕ Cancel' : '+ Add Employee'}
                </button>
            </header>

            {showForm && (
                <div className="card mb-4 animate-fade-in">
                    <div className="card-header">
                        <h3 className="card-title">Add New Employee</h3>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-row mb-2">
                            <div className="form-group">
                                <label>First Name</label>
                                <input
                                    name="first_name"
                                    placeholder="Enter first name"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                <input
                                    name="last_name"
                                    placeholder="Enter last name"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-row mb-2">
                            <div className="form-group">
                                <label>ID Number</label>
                                <input
                                    name="id_number"
                                    placeholder="Enter ID number"
                                    value={formData.id_number}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    name="phone"
                                    placeholder="Enter phone number"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <select name="role" value={formData.role} onChange={handleChange}>
                                    <option value="guard">Guard</option>
                                    <option value="shift_manager">Shift Manager</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit">Save Employee</button>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <p className="text-center">Loading employees...</p>
                ) : employees.length === 0 ? (
                    <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>
                        No employees yet. Click "Add Employee" to get started.
                    </p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>ID Number</th>
                                <th>Phone</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
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
                                            textTransform: 'uppercase'
                                        }}>
                                            {emp.role === 'shift_manager' ? 'Manager' : 'Guard'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{
                                            color: emp.is_active ? '#10b981' : '#ef4444'
                                        }}>
                                            {emp.is_active ? '● Active' : '○ Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleDelete(emp.id)}
                                            style={{
                                                padding: '0.25rem 0.75rem',
                                                fontSize: 'var(--font-size-sm)',
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)',
                                                cursor: 'pointer'
                                            }}
                                            onMouseOver={(e) => e.target.style.background = '#dc2626'}
                                            onMouseOut={(e) => e.target.style.background = '#ef4444'}
                                        >
                                            Delete
                                        </button>
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
