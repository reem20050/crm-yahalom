import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const buttonRef = useRef(null);

  // Google OAuth Client ID from environment or config
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

    // Load Google Identity Services script
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID.');
      return;
    }

    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      initializeGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = initializeGoogle;
    script.onerror = () => setError('Failed to load Google Identity Services.');
    document.body.appendChild(script);

    function initializeGoogle() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
      });
    }
  }, [navigate, GOOGLE_CLIENT_ID]);

  const handleCredentialResponse = async (response) => {
    setLoading(true);
    setError('');

    try {
      // Send credential to backend
      const res = await api.post('/auth/google', {
        credential: response.credential,
      });

      // Cookie is set automatically by backend (HTTPOnly, Secure)
      // No need to store token in localStorage

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

        <div ref={buttonRef} style={{ marginBottom: '1rem' }}></div>

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
