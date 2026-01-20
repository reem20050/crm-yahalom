import { useEffect, useState } from 'react';
import api from '../api';

const roleLabels = {
  admin: 'מנהל',
  user: 'משתמש',
};

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setError('');
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      setError('אין הרשאות לצפייה ברשימת משתמשים.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateRole = async (id, role) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } catch (err) {
      alert('שגיאה בעדכון הרשאה');
    }
  };

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title text-gradient">משתמשים</h1>
        <p className="page-subtitle">ניהול הרשאות משתמשים</p>
      </header>

      <div className="card">
        {loading ? (
          <p className="text-center">טוען משתמשים...</p>
        ) : error ? (
          <p className="text-center" style={{ color: '#ef4444' }}>{error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>מזהה</th>
                <th>אימייל</th>
                <th>תפקיד</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>
                    <select value={user.role} onChange={(e) => updateRole(user.id, e.target.value)}>
                      <option value="user">{roleLabels.user}</option>
                      <option value="admin">{roleLabels.admin}</option>
                    </select>
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

export default Users;
