import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// Google Client ID
const GOOGLE_CLIENT_ID = '46942876627-akhltgi9p3objsd3maj79kftd1u7b7j9.apps.googleusercontent.com';

// Google types for GSI library (fallback)
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              width?: number;
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const loginSchema = z.object({
  email: z.string().email('אימייל לא תקין'),
  password: z.string().min(1, 'נדרשת סיסמה'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [gsiError, setGsiError] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const gsiCheckCount = useRef(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Handle Google login response (for GSI ID token)
  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setIsGoogleLoading(true);
    try {
      const result = await authApi.loginWithGoogle(response.credential);
      login(result.data.token, result.data.user);
      toast.success('התחברת בהצלחה עם Google!');
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'שגיאה בהתחברות עם Google';
      toast.error(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [login, navigate]);

  // Initialize Google Sign-In with GSI library
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
        });

        const googleButtonContainer = document.getElementById('google-signin-button');
        if (googleButtonContainer) {
          window.google.accounts.id.renderButton(googleButtonContainer, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'center',
          });
        }
      }
    };

    // Check if Google script is already loaded
    if (window.google?.accounts?.id) {
      initializeGoogleSignIn();
    } else {
      // Wait for script to load with timeout
      const checkGoogleLoaded = setInterval(() => {
        gsiCheckCount.current++;
        if (window.google?.accounts?.id) {
          clearInterval(checkGoogleLoaded);
          initializeGoogleSignIn();
        } else if (gsiCheckCount.current >= 50) {
          // After 5 seconds, show custom button
          clearInterval(checkGoogleLoaded);
          setGsiError(true);
        }
      }, 100);

      // Clear interval after 5 seconds
      setTimeout(() => {
        clearInterval(checkGoogleLoaded);
        if (!window.google?.accounts?.id) {
          setGsiError(true);
        }
      }, 5000);
    }
  }, [handleGoogleResponse]);

  // Custom Google OAuth using redirect (fallback when GSI fails)
  const handleCustomGoogleLogin = () => {
    setIsGoogleLoading(true);

    // Save state to localStorage to verify after redirect
    const state = Math.random().toString(36).substring(2);
    const nonce = Math.random().toString(36).substring(2);
    localStorage.setItem('google_oauth_state', state);
    localStorage.setItem('google_oauth_nonce', nonce);

    // Build OAuth URL - using redirect mode (not popup)
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'openid email profile';
    const responseType = 'id_token';

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', responseType);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('prompt', 'select_account');

    // Redirect to Google (not popup)
    window.location.href = authUrl.toString();
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data.email, data.password);
      login(response.data.token, response.data.user);
      toast.success('התחברת בהצלחה!');
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'שגיאה בהתחברות');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
            <Shield className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">צוות יהלום</h1>
          <p className="text-primary-200 mt-2">מערכת ניהול CRM</p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            התחברות למערכת
          </h2>

          {/* Google Sign-In Button */}
          <div className="mb-6">
            {/* GSI Button Container (hidden if GSI failed) */}
            {!gsiError && (
              <div
                id="google-signin-button"
                className="flex justify-center"
                style={{ minHeight: '44px' }}
              />
            )}

            {/* Custom Google Button (shown if GSI failed to load) */}
            {gsiError && (
              <button
                type="button"
                onClick={handleCustomGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-gray-700 font-medium">
                  {isGoogleLoading ? 'מתחבר...' : 'התחבר עם Google'}
                </span>
              </button>
            )}

            {isGoogleLoading && (
              <div className="flex justify-center mt-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">או התחבר עם סיסמה</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="label">
                אימייל
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className={`input ${errors.email ? 'input-error' : ''}`}
                placeholder="your@email.com"
                dir="ltr"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                סיסמה
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  className={`input pl-10 ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3 text-lg"
            >
              {isLoading ? 'מתחבר...' : 'התחבר'}
            </button>
          </form>

          {/* Info note */}
          <p className="mt-4 text-xs text-gray-500 text-center">
            התחברות עם Google זמינה רק למשתמשים מורשים במערכת
          </p>
        </div>

        <p className="text-center text-primary-200 mt-6 text-sm">
          © 2024 צוות יהלום - כל הזכויות שמורות
        </p>
      </div>
    </div>
  );
}
