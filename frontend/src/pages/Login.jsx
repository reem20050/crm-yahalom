<<<<<<< HEAD
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
=======
import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { GOOGLE_CLIENT_ID } from '../config';

function Login({ onLogin }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef(null);
  const clientId = GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      setError('חסר מזהה Google Client ID. יש להגדיר VITE_GOOGLE_CLIENT_ID.');
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
    script.onerror = () => setError('נכשל בטעינת Google Identity.');
    document.body.appendChild(script);

    function initializeGoogle() {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
      });
    }
  }, [clientId]);

  const handleCredentialResponse = async (response) => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/81502f92-da58-4ce7-99e9-6c7666b1e601',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Login.jsx:46',message:'handleCredentialResponse called',data:{hasCredential:!!response?.credential,credentialLength:response?.credential?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    setError('');
    setLoading(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/81502f92-da58-4ce7-99e9-6c7666b1e601',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Login.jsx:50',message:'Before api.post call',data:{tokenLength:response?.credential?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const res = await api.post('/auth/google', { token: response.credential });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/81502f92-da58-4ce7-99e9-6c7666b1e601',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Login.jsx:51',message:'api.post succeeded',data:{hasAccessToken:!!res?.data?.access_token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      localStorage.setItem('auth_token', res.data.access_token);
      onLogin();
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/81502f92-da58-4ce7-99e9-6c7666b1e601',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Login.jsx:53',message:'api.post failed',data:{hasResponse:!!err.response,status:err.response?.status,statusText:err.response?.statusText,detail:err.response?.data?.detail,message:err.message,code:err.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
      // #endregion
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'ההתחברות נכשלה. בדוק שהוגדר GOOGLE_CLIENT_ID בשרת.';
      setError(errorMessage);
    } finally {
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
      setLoading(false);
    }
  };

  return (
<<<<<<< HEAD
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
=======
    <div className="card" style={{ maxWidth: 520, margin: '4rem auto' }}>
      <div className="card-header">
        <h3 className="card-title">התחברות למערכת</h3>
      </div>
      <p className="mb-2">התחבר באמצעות חשבון Google כדי להמשיך.</p>
      <div ref={buttonRef} />
      {loading && <p className="mt-2">מתחבר...</p>}
      {error && <p className="mt-2" style={{ color: '#ef4444' }}>{error}</p>}
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
    </div>
  );
}

export default Login;
