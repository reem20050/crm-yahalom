import { useState, useEffect } from 'react';
import api from '../api';

function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contact_person: '',
        contact_phone: ''
    });
    const [showForm, setShowForm] = useState(false);

    const fetchClients = async () => {
        try {
            const response = await api.get('/clients/');
            setClients(response.data);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/clients/', formData);
            fetchClients();
            setFormData({ name: '', address: '', contact_person: '', contact_phone: '' });
            setShowForm(false);
        } catch (error) {
            console.error('Error creating client:', error);
            alert('שגיאה ביצירת לקוח');
        }
    };

    return (
        <div>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row-reverse' }}>
                <div>
                    <h1 className="page-title text-gradient">לקוחות</h1>
                    <p className="page-subtitle">ניהול אתרי הלקוחות והכתובות</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}>
                    {showForm ? '✕ ביטול' : '+ הוסף לקוח'}
                </button>
            </header>

            {showForm && (
                <div className="card mb-4 animate-fade-in">
                    <div className="card-header">
                        <h3 className="card-title">הוספת לקוח חדש</h3>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-row mb-2">
                            <div className="form-group">
                                <label>שם הלקוח</label>
                                <input
                                    name="name"
                                    placeholder="הכנס שם לקוח"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>כתובת</label>
                                <input
                                    name="address"
                                    placeholder="הכנס כתובת"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="form-row mb-2">
                            <div className="form-group">
                                <label>איש קשר</label>
                                <input
                                    name="contact_person"
                                    placeholder="הכנס איש קשר"
                                    value={formData.contact_person}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>טלפון איש קשר</label>
                                <input
                                    name="contact_phone"
                                    placeholder="הכנס טלפון איש קשר"
                                    value={formData.contact_phone}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <button type="submit">שמור לקוח</button>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <p className="text-center">טוען לקוחות...</p>
                ) : clients.length === 0 ? (
                    <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>
                        אין לקוחות עדיין. לחץ על &quot;הוסף לקוח&quot; כדי להתחיל.
                    </p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>מזהה</th>
                                <th>שם</th>
                                <th>כתובת</th>
                                <th>איש קשר</th>
                                <th>טלפון איש קשר</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map(client => (
                                <tr key={client.id}>
                                    <td>{client.id}</td>
                                    <td><strong>{client.name}</strong></td>
                                    <td>{client.address || '—'}</td>
                                    <td>{client.contact_person || '—'}</td>
                                    <td>{client.contact_phone || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default Clients;
