import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../services/api';
import { Shield, Plus, Pencil, KeyRound, UserX, UserCheck, X } from 'lucide-react';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: string;
  is_active: number;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

interface UserForm {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
}

const emptyForm: UserForm = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  role: 'employee',
};

const roleLabels: Record<string, string> = {
  admin: 'מנהל',
  manager: 'מנהל משמרות',
  employee: 'עובד',
};

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  employee: 'bg-gray-100 text-gray-800',
};

export default function Users() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ userId: string; userName: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await usersApi.getAll();
      return res.data as User[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'שגיאה ביצירת משתמש');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'שגיאה בעדכון משתמש');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: number }) =>
      usersApi.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersApi.resetPassword(id, password),
    onSuccess: () => {
      setResetPasswordModal(null);
      setNewPassword('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'שגיאה באיפוס סיסמה');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setForm(emptyForm);
    setError('');
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditingUser(null);
    setError('');
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      role: user.role,
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (editingUser) {
      const data: Record<string, unknown> = {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        role: form.role,
        email: form.email,
      };
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      if (!form.password) {
        setError('נא להזין סיסמה');
        return;
      }
      createMutation.mutate({ ...form });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ניהול משתמשים</h1>
          <p className="text-gray-500 mt-1">ניהול חשבונות משתמשים והרשאות גישה למערכת</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-5 w-5" />
          הוסף משתמש
        </button>
      </div>

      {/* Info banner about Google login */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <strong>אבטחת Google:</strong> התחברות עם Google זמינה רק למשתמשים שכתובת ה-Gmail שלהם רשומה במערכת.
          כדי לאפשר למישהו להתחבר עם Google, הוסף אותו כמשתמש עם כתובת ה-Gmail שלו.
        </div>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">אימייל</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">טלפון</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תפקיד</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">התחברות אחרונה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={!user.is_active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <span className="font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 direction-ltr text-right">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeColors[user.role] || 'bg-gray-100 text-gray-800'}`}>
                      {roleLabels[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.is_active ? (
                      <span className="badge-success">פעיל</span>
                    ) : (
                      <span className="badge-danger">מושבת</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.last_login)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(user)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="ערוך"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setResetPasswordModal({ userId: user.id, userName: `${user.first_name} ${user.last_name}` });
                          setNewPassword('');
                          setError('');
                        }}
                        className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                        title="איפוס סיסמה"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      {user.is_active ? (
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: user.id, is_active: 0 })}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="השבת משתמש"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: user.id, is_active: 1 })}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                          title="הפעל משתמש"
                        >
                          <UserCheck className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    אין משתמשים במערכת
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">
                {editingUser ? 'עריכת משתמש' : 'הוספת משתמש חדש'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">שם פרטי *</label>
                  <input
                    type="text"
                    className="input"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">שם משפחה *</label>
                  <input
                    type="text"
                    className="input"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">אימייל *</label>
                <input
                  type="email"
                  className="input"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  אם הכתובת היא Gmail, המשתמש יוכל גם להתחבר עם Google
                </p>
              </div>

              {!editingUser && (
                <div>
                  <label className="label">סיסמה *</label>
                  <input
                    type="password"
                    className="input"
                    dir="ltr"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    minLength={6}
                    placeholder="לפחות 6 תווים"
                    required
                  />
                </div>
              )}

              <div>
                <label className="label">טלפון</label>
                <input
                  type="tel"
                  className="input"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="label">תפקיד *</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="employee">עובד</option>
                  <option value="manager">מנהל משמרות</option>
                  <option value="admin">מנהל</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'שומר...'
                    : editingUser
                      ? 'עדכן'
                      : 'צור משתמש'}
                </button>
                <button type="button" onClick={closeModal} className="btn-secondary">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">איפוס סיסמה</h2>
              <button
                onClick={() => { setResetPasswordModal(null); setError(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
              )}

              <p className="text-gray-600">
                איפוס סיסמה עבור <strong>{resetPasswordModal.userName}</strong>
              </p>

              <div>
                <label className="label">סיסמה חדשה</label>
                <input
                  type="password"
                  className="input"
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  placeholder="לפחות 6 תווים"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    if (newPassword.length < 6) {
                      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
                      return;
                    }
                    setError('');
                    resetPasswordMutation.mutate({
                      id: resetPasswordModal.userId,
                      password: newPassword,
                    });
                  }}
                  className="btn-primary flex-1"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? 'מאפס...' : 'אפס סיסמה'}
                </button>
                <button
                  onClick={() => { setResetPasswordModal(null); setError(''); }}
                  className="btn-secondary"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
