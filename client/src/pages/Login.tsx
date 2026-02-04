import { useState, useEffect, useCallback } from 'react';
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

// Google types
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
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // Handle Google login response
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

  // Initialize Google Sign-In
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
      // Wait for script to load
      const checkGoogleLoaded = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(checkGoogleLoaded);
          initializeGoogleSignIn();
        }
      }, 100);

      // Clear interval after 10 seconds
      setTimeout(() => clearInterval(checkGoogleLoaded), 10000);
    }
  }, [handleGoogleResponse]);

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
            <div
              id="google-signin-button"
              className="flex justify-center"
              style={{ minHeight: '44px' }}
            />
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
