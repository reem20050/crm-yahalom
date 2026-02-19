import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { User, Mail, Shield, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// Role labels in Hebrew
const roleLabels: Record<string, string> = {
  admin: 'מנהל',
  manager: 'מנהל משמרות',
  employee: 'עובד',
};

// Role badge color classes
const roleBadgeClasses: Record<string, string> = {
  admin: 'badge-danger',
  manager: 'badge-warning',
  employee: 'badge-info',
};

// Zod schema for password change form
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'נדרשת סיסמה נוכחית'),
    newPassword: z.string().min(6, 'סיסמה חדשה חייבת להכיל לפחות 6 תווים'),
    confirmPassword: z.string().min(1, 'נדרש אישור סיסמה'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'הסיסמאות אינן תואמות',
    path: ['confirmPassword'],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function Profile() {
  const user = useAuthStore((state) => state.user);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordForm) =>
      authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      toast.success('הסיסמה שונתה בהצלחה');
      reset();
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      const message =
        err.response?.data?.message || err.response?.data?.error || 'שגיאה בשינוי הסיסמה';
      toast.error(message);
    },
  });

  const onSubmit = (data: ChangePasswordForm) => {
    changePasswordMutation.mutate(data);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">לא נמצא משתמש מחובר</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">הפרופיל שלי</h1>
        <p className="page-subtitle">צפייה בפרטי המשתמש ושינוי סיסמה</p>
      </div>

      {/* User Info Card */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-50 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 font-heading">
                  {user.firstName} {user.lastName}
                </h2>
                <div className="flex items-center gap-2 mt-1 text-gray-500">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm" dir="ltr">
                    {user.email}
                  </span>
                </div>
              </div>
              <span className={`badge ${roleBadgeClasses[user.role] || 'badge-gray'}`}>
                <Shield className="w-3 h-3 ml-1 inline-block" />
                {roleLabels[user.role] || user.role}
              </span>
            </div>

            {/* Info Grid */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">שם פרטי</p>
                <p className="font-medium text-gray-900">{user.firstName}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">שם משפחה</p>
                <p className="font-medium text-gray-900">{user.lastName}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">תפקיד</p>
                <p className="font-medium text-gray-900">
                  {roleLabels[user.role] || user.role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 font-heading">שינוי סיסמה</h3>
            <p className="text-sm text-gray-500">עדכן את הסיסמה שלך לחשבון</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-md">
          {/* Current Password */}
          <div>
            <label htmlFor="currentPassword" className="label">
              סיסמה נוכחית
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                {...register('currentPassword')}
                className={`input pl-10 ${errors.currentPassword ? 'input-error' : ''}`}
                placeholder="הזן סיסמה נוכחית"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="newPassword" className="label">
              סיסמה חדשה
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                {...register('newPassword')}
                className={`input pl-10 ${errors.newPassword ? 'input-error' : ''}`}
                placeholder="לפחות 6 תווים"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="label">
              אישור סיסמה חדשה
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                {...register('confirmPassword')}
                className={`input pl-10 ${errors.confirmPassword ? 'input-error' : ''}`}
                placeholder="הזן שוב את הסיסמה החדשה"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {changePasswordMutation.isPending ? 'משנה סיסמה...' : 'שנה סיסמה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
