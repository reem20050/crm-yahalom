import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Search, UserCircle, Phone, Shield, Plus, X, Trash2 } from 'lucide-react';
import { employeesApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

const employeeSchema = z.object({
  first_name: z.string().min(1, 'נדרש שם פרטי'),
  last_name: z.string().min(1, 'נדרש שם משפחה'),
  id_number: z.string().min(1, 'נדרש מספר ת.ז'),
  phone: z.string().min(1, 'נדרש מספר טלפון'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  hire_date: z.string().min(1, 'נדרש תאריך תחילת עבודה'),
  employment_type: z.string().optional(),
  hourly_rate: z.number().optional(),
  has_weapon_license: z.boolean().optional(),
  has_driving_license: z.boolean().optional(),
  driving_license_type: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

export default function Employees() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['employees', { search: searchTerm }],
    queryFn: () => employeesApi.getAll({ search: searchTerm, limit: 50 }).then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: EmployeeForm) => employeesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('עובד נוצר בהצלחה');
      setIsModalOpen(false);
      reset();
    },
    onError: () => {
      toast.error('שגיאה ביצירת עובד');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('נמחק בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה במחיקה');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      hire_date: new Date().toISOString().split('T')[0],
      employment_type: 'hourly',
      has_weapon_license: false,
      has_driving_license: false,
    },
  });

  const { can } = usePermissions();

  const onSubmit = (data: EmployeeForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">עובדים</h1>
          <p className="text-gray-500">ניהול עובדים ומסמכים</p>
        </div>
        {can('employees:create') && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            עובד חדש
          </button>
        )}
      </div>

      <div className="card">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש עובדים..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pr-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      ) : data?.employees?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.employees.map((employee: {
            id: string;
            first_name: string;
            last_name: string;
            phone: string;
            status: string;
            has_weapon_license: boolean;
            employment_type: string;
          }) => (
            <div
              key={employee.id}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <Link to={`/employees/${employee.id}`} className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {employee.first_name} {employee.last_name}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {employee.phone}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`badge ${employee.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                        {employee.status === 'active' ? 'פעיל' : 'לא פעיל'}
                      </span>
                      {employee.has_weapon_license && (
                        <span className="badge badge-info flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          נשק
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                {can('employees:delete') && (
                  <button
                    onClick={() => {
                      if (confirm('האם אתה בטוח שברצונך למחוק עובד זה?')) {
                        deleteMutation.mutate(employee.id);
                      }
                    }}
                    className="text-red-400 hover:text-red-600 p-1"
                    title="מחק"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">לא נמצאו עובדים</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            הוסף עובד ראשון
          </button>
        </div>
      )}

      {/* Create Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">עובד חדש</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  reset();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">שם פרטי *</label>
                  <input {...register('first_name')} className="input" />
                  {errors.first_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.first_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">שם משפחה *</label>
                  <input {...register('last_name')} className="input" />
                  {errors.last_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.last_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">ת.ז *</label>
                  <input {...register('id_number')} className="input" dir="ltr" />
                  {errors.id_number && (
                    <p className="text-sm text-red-600 mt-1">{errors.id_number.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">טלפון *</label>
                  <input {...register('phone')} className="input" dir="ltr" />
                  {errors.phone && (
                    <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">אימייל</label>
                  <input {...register('email')} type="email" className="input" dir="ltr" />
                </div>

                <div>
                  <label className="label">תאריך תחילת עבודה *</label>
                  <input {...register('hire_date')} type="date" className="input" />
                  {errors.hire_date && (
                    <p className="text-sm text-red-600 mt-1">{errors.hire_date.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">כתובת</label>
                  <input {...register('address')} className="input" />
                </div>

                <div>
                  <label className="label">עיר</label>
                  <input {...register('city')} className="input" />
                </div>

                <div>
                  <label className="label">סוג העסקה</label>
                  <select {...register('employment_type')} className="input">
                    <option value="hourly">שעתי</option>
                    <option value="monthly">חודשי</option>
                    <option value="contractor">קבלן</option>
                  </select>
                </div>

                <div>
                  <label className="label">שכר שעתי</label>
                  <input
                    {...register('hourly_rate', { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="input"
                    dir="ltr"
                  />
                </div>

                <div className="col-span-2 border-t pt-4">
                  <h3 className="font-medium mb-3">רישיונות</h3>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        {...register('has_weapon_license')}
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span>רישיון נשק</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        {...register('has_driving_license')}
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                      <span>רישיון נהיגה</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-2 border-t pt-4">
                  <h3 className="font-medium mb-3">איש קשר לחירום</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">שם</label>
                      <input {...register('emergency_contact_name')} className="input" />
                    </div>
                    <div>
                      <label className="label">טלפון</label>
                      <input {...register('emergency_contact_phone')} className="input" dir="ltr" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'שומר...' : 'שמור'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    reset();
                  }}
                  className="btn-secondary"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
