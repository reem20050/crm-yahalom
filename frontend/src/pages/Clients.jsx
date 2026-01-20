import { useState, useEffect } from 'react';
import api from '../api';

function Clients() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        has_next: false,
        has_prev: false
    });
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contact_person: '',
        contact_phone: ''
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
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients(pagination.page, pagination.limit);
    }, [pagination.page, search]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/clients/', formData);
            fetchClients(pagination.page, pagination.limit);
            setFormData({ name: '', address: '', contact_person: '', contact_phone: '' });
            setShowForm(false);
        } catch (error) {
            console.error('Error creating client:', error);
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
        }
    };

    return (
        <div>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title text-gradient">Clients</h1>
                    <p className="page-subtitle">Manage your client sites and locations</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}>
                    {showForm ? '✕ Cancel' : '+ Add Client'}
                </button>
            </header>

            {showForm && (
                <div className="card mb-4 animate-fade-in">
                    <div className="card-header">
                        <h3 className="card-title">Add New Client</h3>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="form-row mb-2">
                            <div className="form-group">
                                <label>Client Name</label>
                                <input
                                    name="name"
                                    placeholder="Enter client name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Address</label>
                                <input
                                    name="address"
                                    placeholder="Enter address"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="form-row mb-2">
                            <div className="form-group">
                                <label>Contact Person</label>
                                <input
                                    name="contact_person"
                                    placeholder="Enter contact person"
                                    value={formData.contact_person}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Contact Phone</label>
                                <input
                                    name="contact_phone"
                                    placeholder="Enter contact phone"
                                    value={formData.contact_phone}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <button type="submit">Save Client</button>
                    </form>
                </div>
            )}

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
                                        <td>{client.id}</td>
                                        <td><strong>{client.name}</strong></td>
                                        <td>{client.address || '—'}</td>
                                        <td>{client.contact_person || '—'}</td>
                                        <td>{client.contact_phone || '—'}</td>
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
                )}
            </div>
        </div>
    );
}

export default Clients;
