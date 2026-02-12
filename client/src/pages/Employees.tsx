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
import { WhatsAppIcon } from '../components/WhatsAppButton';

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">עובדים</h1>
          <p className="text-sm text-gray-500 mt-0.5">ניהול עובדים ומסמכים</p>
        </div>
        {can('employees:create') && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            עובד חדש
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="חיפוש עובדים..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pr-11"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      ) : data?.employees?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              className="card hover:shadow-elevated transition-all duration-200"
            >
              <div className="flex items-start gap-3.5">
                <Link to={`/employees/${employee.id}`} className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 font-semibold text-sm">
                      {employee.first_name?.[0]}{employee.last_name?.[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {employee.first_name} {employee.last_name}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span dir="ltr">{employee.phone}</span>
                      <WhatsAppIcon phone={employee.phone} message={`שלום ${employee.first_name}, \n\nצוות יהלום`} />
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
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
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
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
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm mb-4">לא נמצאו עובדים</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            הוסף עובד ראשון
          </button>
        </div>
      )}

      {/* Create Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">עובד חדש</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  reset();
                }}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">שם פרטי *</label>
                  <input {...register('first_name')} className="input" />
                  {errors.first_name && (
                    <p className="text-xs text-red-600 mt-1">{errors.first_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">שם משפחה *</label>
                  <input {...register('last_name')} className="input" />
                  {errors.last_name && (
                    <p className="text-xs text-red-600 mt-1">{errors.last_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">ת.ז *</label>
                  <input {...register('id_number')} className="input" dir="ltr" />
                  {errors.id_number && (
                    <p className="text-xs text-red-600 mt-1">{errors.id_number.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">טלפון *</label>
                  <input {...register('phone')} className="input" dir="ltr" />
                  {errors.phone && (
                    <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>
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
                    <p className="text-xs text-red-600 mt-1">{errors.hire_date.message}</p>
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

                <div className="col-span-1 sm:col-span-2 border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">רישיונות</h3>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        {...register('has_weapon_license')}
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">רישיון נשק</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        {...register('has_driving_license')}
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">רישיון נהיגה</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-1 sm:col-span-2 border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">איש קשר לחירום</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      שומר...
                    </span>
                  ) : 'שמור'}
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
