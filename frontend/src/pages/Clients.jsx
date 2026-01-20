import { useState, useEffect } from 'react';
import api from '../api';

function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
<<<<<<< HEAD
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        has_next: false,
        has_prev: false
    });
    const [search, setSearch] = useState('');
=======
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contact_person: '',
<<<<<<< HEAD
        contact_phone: '',
        email: '',
        notes: ''
    });
    const [showForm, setShowForm] = useState(false);

    const fetchClients = async (page = 1, limit = 20) => {
        try {
            setLoading(true);
            const skip = (page - 1) * limit;
            const params = new URLSearchParams({
                skip: skip.toString(),
                limit: limit.toString()
            });
            
            if (search) params.append('search', search);
            
            const response = await api.get(`/clients/?${params}`);
            setClients(response.data.data || response.data);
            
            // Handle paginated response
            if (response.data.total !== undefined) {
                setPagination({
                    page: response.data.page || page,
                    limit: response.data.limit || limit,
                    total: response.data.total || 0,
                    has_next: response.data.has_next || false,
                    has_prev: response.data.has_prev || false
                });
            }
=======
        contact_phone: ''
    });
    const [showForm, setShowForm] = useState(false);

    const fetchClients = async () => {
        try {
            const response = await api.get('/clients/');
            setClients(response.data);
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
<<<<<<< HEAD
        fetchClients(pagination.page, pagination.limit);
    }, [pagination.page, search]);
=======
        fetchClients();
    }, []);
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/clients/', formData);
<<<<<<< HEAD
            fetchClients(pagination.page, pagination.limit);
=======
            fetchClients();
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
            setFormData({ name: '', address: '', contact_person: '', contact_phone: '' });
            setShowForm(false);
        } catch (error) {
            console.error('Error creating client:', error);
<<<<<<< HEAD
            alert('Error creating client');
        }
    };

    const handleDelete = async (clientId) => {
        if (!window.confirm('Are you sure you want to delete this client?')) {
            return;
        }
        try {
            await api.delete(`/clients/${clientId}`);
            fetchClients(pagination.page, pagination.limit);
        } catch (error) {
            console.error('Error deleting client:', error);
            alert('Error deleting client. Make sure there are no shifts assigned to this client.');
=======
            alert('שגיאה ביצירת לקוח');
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
        }
    };

    return (
        <div>
<<<<<<< HEAD
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title text-gradient">Clients</h1>
                    <p className="page-subtitle">Manage your client sites and locations</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}>
                    {showForm ? '✕ Cancel' : '+ Add Client'}
=======
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row-reverse' }}>
                <div>
                    <h1 className="page-title text-gradient">לקוחות</h1>
                    <p className="page-subtitle">ניהול אתרי הלקוחות והכתובות</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}>
                    {showForm ? '✕ ביטול' : '+ הוסף לקוח'}
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                </button>
            </header>

            {showForm && (
                <div className="card mb-4 animate-fade-in">
                    <div className="card-header">
<<<<<<< HEAD
                        <h3 className="card-title">Add New Client</h3>
=======
                        <h3 className="card-title">הוספת לקוח חדש</h3>
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-row mb-2">
                            <div className="form-group">
<<<<<<< HEAD
                                <label>Client Name</label>
                                <input
                                    name="name"
                                    placeholder="Enter client name"
=======
                                <label>שם הלקוח</label>
                                <input
                                    name="name"
                                    placeholder="הכנס שם לקוח"
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
<<<<<<< HEAD
                                <label>Address</label>
                                <input
                                    name="address"
                                    placeholder="Enter address"
=======
                                <label>כתובת</label>
                                <input
                                    name="address"
                                    placeholder="הכנס כתובת"
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="form-row mb-2">
                            <div className="form-group">
<<<<<<< HEAD
                                <label>Contact Person</label>
                                <input
                                    name="contact_person"
                                    placeholder="Enter contact person"
=======
                                <label>איש קשר</label>
                                <input
                                    name="contact_person"
                                    placeholder="הכנס איש קשר"
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                                    value={formData.contact_person}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
<<<<<<< HEAD
                                <label>Contact Phone</label>
                                <input
                                    name="contact_phone"
                                    placeholder="Enter contact phone"
=======
                                <label>טלפון איש קשר</label>
                                <input
                                    name="contact_phone"
                                    placeholder="הכנס טלפון איש קשר"
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                                    value={formData.contact_phone}
                                    onChange={handleChange}
                                />
                            </div>
<<<<<<< HEAD
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter email address"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="form-row mb-2">
                            <div className="form-group" style={{ width: '100%' }}>
                                <label>Notes</label>
                                <textarea
                                    name="notes"
                                    placeholder="Enter notes about this client"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-card)',
                                        color: 'var(--color-text-primary)',
                                        fontFamily: 'inherit',
                                        fontSize: 'inherit'
                                    }}
                                />
                            </div>
                        </div>
                        <button type="submit">Save Client</button>
=======
                        </div>
                        <button type="submit">שמור לקוח</button>
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                    </form>
                </div>
            )}

<<<<<<< HEAD
            {/* Search Control */}
            <div className="card mb-4">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
                            Search
                        </label>
                        <input
                            type="text"
                            placeholder="Search by name, contact person, or address..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-bg-card)',
                                color: 'var(--color-text-primary)'
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <p className="text-center">Loading clients...</p>
                ) : (clients.length === 0 && !search) ? (
                    <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>
                        No clients yet. Click "Add Client" to get started.
                    </p>
                ) : clients.length === 0 ? (
                    <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>
                        No clients found matching your search.
                    </p>
                ) : (
                    <>
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Address</th>
                                    <th>Contact Person</th>
                                    <th>Contact Phone</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map(client => (
                                    <tr key={client.id}>
=======
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
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                                    <td>{client.id}</td>
                                    <td><strong>{client.name}</strong></td>
                                    <td>{client.address || '—'}</td>
                                    <td>{client.contact_person || '—'}</td>
                                    <td>{client.contact_phone || '—'}</td>
<<<<<<< HEAD
                                    <td>{client.email || '—'}</td>
                                        <td>
                                            <button
                                                onClick={() => handleDelete(client.id)}
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

                        {/* Pagination Controls */}
                        {pagination.total > pagination.limit && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '1.5rem',
                                paddingTop: '1rem',
                                borderTop: '1px solid var(--color-border)'
                            }}>
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} clients
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                        disabled={!pagination.has_prev}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: pagination.has_prev ? 'var(--color-accent-blue)' : 'rgba(59, 130, 246, 0.3)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: pagination.has_prev ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                        disabled={!pagination.has_next}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            background: pagination.has_next ? 'var(--color-accent-blue)' : 'rgba(59, 130, 246, 0.3)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: pagination.has_next ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
=======
                                </tr>
                            ))}
                        </tbody>
                    </table>
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
                )}
            </div>
        </div>
    );
}

export default Clients;
