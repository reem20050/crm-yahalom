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
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 520, margin: '4rem auto' }}>
      <div className="card-header">
        <h3 className="card-title">התחברות למערכת</h3>
      </div>
      <p className="mb-2">התחבר באמצעות חשבון Google כדי להמשיך.</p>
      <div ref={buttonRef} />
      {loading && <p className="mt-2">מתחבר...</p>}
      {error && <p className="mt-2" style={{ color: '#ef4444' }}>{error}</p>}
    </div>
  );
}

export default Login;
