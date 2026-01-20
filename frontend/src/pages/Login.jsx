import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Google OAuth Client ID from environment or hardcoded for development
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    // Check if already authenticated
    api.get('/auth/me')
      .then(() => {
        // Already logged in, redirect to dashboard
        navigate('/');
      })
      .catch(() => {
        // Not authenticated, show login
      });

    // Initialize Google Identity Services
    if (window.google && GOOGLE_CLIENT_ID) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: 'outline',
          size: 'large',
          width: '100%',
        }
      );
    }
  }, [navigate]);

  const handleCredentialResponse = async (response) => {
    setLoading(true);
    setError('');

    try {
      // Send credential to backend
      const res = await api.post('/auth/google', {
        credential: response.credential,
      });

      // Cookie is set automatically by backend
      // Store CSRF token if provided (for additional security)
      if (res.data.csrf_token) {
        // CSRF token is also in cookie, but we might need it for headers
        // In this implementation, cookies handle it
      }

      // Redirect to dashboard
      navigate('/');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Authentication failed. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '400px',
          width: '100%',
          padding: '2rem',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            className="brand-icon"
            style={{ fontSize: '3rem', marginBottom: '1rem' }}
          >
            💎
          </div>
          <h1 className="page-title text-gradient">Diamond Team CRM</h1>
          <p className="page-subtitle">Sign in to continue</p>
        </div>

        {error && (
          <div
            style={{
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#ef4444',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        {!GOOGLE_CLIENT_ID && (
          <div
            style={{
              padding: '1rem',
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: '#fbbf24',
              marginBottom: '1rem',
            }}
          >
            Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID.
          </div>
        )}

        <div id="google-signin-button" style={{ marginBottom: '1rem' }}></div>

        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Authenticating...
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
