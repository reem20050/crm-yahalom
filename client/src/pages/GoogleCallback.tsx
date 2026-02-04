import { useEffect, useState } from 'react';

export default function GoogleCallback() {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = () => {
      try {
        // Get the full URL to debug
        const fullUrl = window.location.href;
        console.log('Google callback URL:', fullUrl);

        // Get the ID token from URL hash
        const hash = window.location.hash;
        console.log('Hash:', hash);

        if (!hash || hash.length < 2) {
          setError('לא התקבל טוקן מ-Google (no hash)');
          setProcessing(false);
          return;
        }

        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');
        const errorParam = params.get('error');

        console.log('ID Token exists:', !!idToken);
        console.log('Access Token exists:', !!accessToken);
        console.log('Error param:', errorParam);

        if (errorParam) {
          setError(`שגיאה מ-Google: ${errorParam}`);
          setProcessing(false);
          return;
        }

        if (!idToken) {
          setError('לא התקבל טוקן מ-Google (no id_token)');
          setProcessing(false);
          return;
        }

        if (window.opener) {
          // Send the token back to the parent window
          console.log('Sending token to parent window...');
          window.opener.postMessage(
            { type: 'google-oauth-callback', credential: idToken },
            window.location.origin
          );
          // Close the popup after a short delay
          setTimeout(() => {
            window.close();
          }, 500);
        } else {
          // No opener - maybe opened in same window
          console.log('No opener window found');
          setError('חלון המקור לא נמצא. נסה להתחבר שוב.');
          setProcessing(false);
        }
      } catch (err) {
        console.error('Error processing callback:', err);
        setError('שגיאה בעיבוד התשובה מ-Google');
        setProcessing(false);
      }
    };

    // Small delay to ensure hash is available
    setTimeout(processCallback, 100);
  }, []);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">מעבד התחברות עם Google...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">שגיאה בהתחברות</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            סגור חלון
          </button>
        </div>
      </div>
    );
  }

  return null;
}
