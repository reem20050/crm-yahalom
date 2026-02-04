import { useEffect } from 'react';

export default function GoogleCallback() {
  useEffect(() => {
    // Get the ID token from URL hash
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');

    if (idToken && window.opener) {
      // Send the token back to the parent window
      window.opener.postMessage(
        { type: 'google-oauth-callback', credential: idToken },
        window.location.origin
      );
      // Close the popup
      window.close();
    } else {
      // If no token or no opener, show error
      document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; direction: rtl;">
          <h2>שגיאה בהתחברות</h2>
          <p>לא ניתן היה להשלים את ההתחברות עם Google</p>
          <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
            סגור חלון
          </button>
        </div>
      `;
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">מעבד התחברות עם Google...</p>
      </div>
    </div>
  );
}
