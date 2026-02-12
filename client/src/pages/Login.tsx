import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// Google Client ID loaded from backend

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
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const gsiCheckCount = useRef(0);

  // Fetch Google Client ID from backend
  useEffect(() => {
    authApi.getGoogleClientId()
      .then(res => setGoogleClientId(res.data.clientId))
      .catch(() => setGsiError(true)); // No Google login configured
  }, []);

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

  // Initialize Google Sign-In with GSI library (only when clientId is loaded)
  useEffect(() => {
    if (!googleClientId) return;

    const initializeGoogleSignIn = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
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
          clearInterval(checkGoogleLoaded);
          setGsiError(true);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkGoogleLoaded);
        if (!window.google?.accounts?.id) {
          setGsiError(true);
        }
      }, 5000);
    }
  }, [googleClientId, handleGoogleResponse]);

  // Custom Google OAuth using redirect (fallback when GSI fails)
  const handleCustomGoogleLogin = () => {
    if (!googleClientId) {
      toast.error('Google Login לא מוגדר במערכת');
      return;
    }
    setIsGoogleLoading(true);

    const state = Math.random().toString(36).substring(2);
    const nonce = Math.random().toString(36).substring(2);
    localStorage.setItem('google_oauth_state', state);
    localStorage.setItem('google_oauth_nonce', nonce);

    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'openid email profile';
    const responseType = 'id_token';

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', responseType);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('prompt', 'select_account');

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
    <div className="min-h-screen bg-white flex">
      {/* Left decorative panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] bg-primary-600 relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }} />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">צוות יהלום</h1>
          <p className="text-primary-200 text-lg">מערכת ניהול אבטחה וCRM</p>
          <div className="mt-12 space-y-4 text-right max-w-xs mx-auto">
            <div className="flex items-center gap-3 text-primary-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-sm">ניהול משמרות ושיבוצים</span>
            </div>
            <div className="flex items-center gap-3 text-primary-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-sm">מעקב עובדים וציוד</span>
            </div>
            <div className="flex items-center gap-3 text-primary-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-sm">דוחות וחשבוניות</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">צוות יהלום</h1>
            <p className="text-gray-400 text-sm mt-1">מערכת ניהול CRM</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">התחברות למערכת</h2>
            <p className="text-gray-500 text-sm mt-1">הזן את פרטי ההתחברות שלך</p>
          </div>

          {/* Google Sign-In Button */}
          <div className="mb-6">
            {!gsiError && (
              <div
                id="google-signin-button"
                className="flex justify-center"
                style={{ minHeight: '44px' }}
              />
            )}

            {gsiError && (
              <button
                type="button"
                onClick={handleCustomGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-gray-700 font-medium text-sm">
                  {isGoogleLoading ? 'מתחבר...' : 'התחבר עם Google'}
                </span>
              </button>
            )}

            {isGoogleLoading && (
              <div className="flex justify-center mt-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent"></div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-xs text-gray-400 uppercase tracking-wider">או התחבר עם סיסמה</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                <p className="mt-1.5 text-sm text-red-600">{errors.email.message}</p>
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4.5 h-4.5" />
                  ) : (
                    <Eye className="w-4.5 h-4.5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  מתחבר...
                </span>
              ) : 'התחבר'}
            </button>
          </form>

          <p className="mt-8 text-xs text-gray-400 text-center">
            © {new Date().getFullYear()} צוות יהלום — כל הזכויות שמורות
          </p>
        </div>
      </div>
    </div>
  );
}
