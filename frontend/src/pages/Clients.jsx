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
            alert('Error creating client');
        }
    };

    const handleDelete = async (clientId) => {
        if (!window.confirm('Are you sure you want to delete this client?')) {
            return;
        }
        try {
            await api.delete(`/clients/${clientId}`);
            fetchClients();
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

            <div className="card">
                {loading ? (
                    <p className="text-center">Loading clients...</p>
                ) : clients.length === 0 ? (
                    <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>
                        No clients yet. Click "Add Client" to get started.
                    </p>
                ) : (
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
                )}
            </div>
        </div>
    );
}

export default Clients;
