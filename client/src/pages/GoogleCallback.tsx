import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function GoogleCallback() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get the full URL to debug
        const fullUrl = window.location.href;
        console.log('Google callback URL:', fullUrl);

        // Get the ID token from URL hash
        const hash = window.location.hash;
        console.log('Hash:', hash);

        if (!hash || hash.length < 2) {
          setError('לא התקבל טוקן מ-Google');
          setProcessing(false);
          return;
        }

        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        const errorParam = params.get('error');
        const state = params.get('state');

        console.log('ID Token exists:', !!idToken);
        console.log('Error param:', errorParam);
        console.log('State:', state);

        // Verify state if we saved it
        const savedState = localStorage.getItem('google_oauth_state');
        if (savedState && state && savedState !== state) {
          console.warn('State mismatch - possible CSRF attack');
          setError('שגיאת אבטחה - נסה שוב');
          setProcessing(false);
          return;
        }

        // Clean up localStorage
        localStorage.removeItem('google_oauth_state');
        localStorage.removeItem('google_oauth_nonce');

        if (errorParam) {
          setError(`שגיאה מ-Google: ${errorParam}`);
          setProcessing(false);
          return;
        }

        if (!idToken) {
          setError('לא התקבל טוקן מ-Google');
          setProcessing(false);
          return;
        }

        // Send token to our backend for verification
        console.log('Sending token to backend...');
        const result = await authApi.loginWithGoogle(idToken);

        // Login successful - store token and user
        login(result.data.token, result.data.user);
        toast.success('התחברת בהצלחה עם Google!');

        // Redirect to home page
        navigate('/', { replace: true });

      } catch (err: unknown) {
        console.error('Error processing callback:', err);
        const error = err as { response?: { data?: { error?: string; message?: string } } };
        const errorMessage = error.response?.data?.message || error.response?.data?.error || 'שגיאה בהתחברות עם Google';
        setError(errorMessage);
        setProcessing(false);
      }
    };

    // Small delay to ensure hash is available
    setTimeout(processCallback, 100);
  }, [login, navigate]);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">מתחבר עם Google...</p>
          <p className="text-gray-500 text-sm mt-2">אנא המתן</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800" dir="rtl">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl max-w-md">
          <div className="text-red-500 text-6xl mb-4">!</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">שגיאה בהתחברות</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            חזור לדף ההתחברות
          </button>
        </div>
      </div>
    );
  }

  return null;
}
