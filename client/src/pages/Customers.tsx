import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Search, Building2, MapPin, Plus, X, Trash2 } from 'lucide-react';
import { customersApi } from '../services/api';
import { SkeletonPulse, SkeletonGrid } from '../components/Skeleton';
import { usePermissions } from '../hooks/usePermissions';

const customerSchema = z.object({
  company_name: z.string().min(1, 'נדרש שם חברה'),
  business_id: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  service_type: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  // Primary contact
  contact_name: z.string().min(1, 'נדרש שם איש קשר'),
  contact_phone: z.string().min(1, 'נדרש טלפון איש קשר'),
  contact_email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  contact_role: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search: searchTerm }],
    queryFn: () => customersApi.getAll({ search: searchTerm, limit: 50 }).then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CustomerForm) => customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('לקוח נוצר בהצלחה');
      setIsModalOpen(false);
      reset();
    },
    onError: () => {
      toast.error('שגיאה ביצירת לקוח');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
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
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      payment_terms: 'net30',
      service_type: 'regular',
    },
  });

  const { can } = usePermissions();

  const onSubmit = (data: CustomerForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">לקוחות</h1>
          <p className="page-subtitle">ניהול לקוחות וחוזים</p>
        </div>
        {can('customers:create') && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            לקוח חדש
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="חיפוש לקוחות..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pr-11"
        />
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <SkeletonPulse className="h-10 w-full rounded-xl" />
          <SkeletonGrid count={6} />
        </div>
      ) : data?.customers?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.customers.map((customer: {
            id: string;
            company_name: string;
            city: string;
            status: string;
            sites_count: number;
            active_contracts: number;
          }) => (
            <div
              key={customer.id}
              className="card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-start gap-3.5">
                <Link to={`/customers/${customer.id}`} className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-11 h-11 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-sm text-gray-900 truncate">{customer.company_name}</h3>
                    {customer.city && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {customer.city}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`badge ${customer.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                        {customer.status === 'active' ? 'פעיל' : 'לא פעיל'}
                      </span>
                      <span className="text-xs text-gray-400">{customer.sites_count} אתרים</span>
                    </div>
                  </div>
                </Link>
                {can('customers:delete') && (
                  <button
                    onClick={() => {
                      if (confirm('האם אתה בטוח שברצונך למחוק לקוח זה?')) {
                        deleteMutation.mutate(customer.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-danger-500 hover:bg-danger-50 transition-colors"
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
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-1">לא נמצאו לקוחות</p>
          <p className="text-sm text-gray-400 mb-6">הוסף לקוח חדש כדי להתחיל לנהל את העסק</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            הוסף לקוח ראשון
          </button>
        </div>
      )}

      {/* Create Customer Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">לקוח חדש</h2>
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
                {/* Company Details */}
                <div className="col-span-2">
                  <h3 className="font-medium mb-3 text-gray-700">פרטי החברה</h3>
                </div>

                <div className="col-span-2">
                  <label className="label">שם החברה *</label>
                  <input {...register('company_name')} className="input" />
                  {errors.company_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.company_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">ח.פ / ע.מ</label>
                  <input {...register('business_id')} className="input" dir="ltr" />
                </div>

                <div>
                  <label className="label">סוג שירות</label>
                  <select {...register('service_type')} className="input">
                    <option value="regular">שמירה קבועה</option>
                    <option value="events">אירועים</option>
                    <option value="consulting">ייעוץ</option>
                    <option value="mixed">משולב</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="label">כתובת</label>
                  <input {...register('address')} className="input" />
                </div>

                <div>
                  <label className="label">עיר</label>
                  <input {...register('city')} className="input" />
                </div>

                <div>
                  <label className="label">תנאי תשלום</label>
                  <select {...register('payment_terms')} className="input">
                    <option value="immediate">מיידי</option>
                    <option value="net15">שוטף + 15</option>
                    <option value="net30">שוטף + 30</option>
                    <option value="net45">שוטף + 45</option>
                    <option value="net60">שוטף + 60</option>
                  </select>
                </div>

                {/* Primary Contact */}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-medium mb-3 text-gray-700">איש קשר ראשי</h3>
                </div>

                <div>
                  <label className="label">שם איש קשר *</label>
                  <input {...register('contact_name')} className="input" />
                  {errors.contact_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.contact_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">תפקיד</label>
                  <input {...register('contact_role')} className="input" placeholder="מנכ״ל, מנהל תפעול..." />
                </div>

                <div>
                  <label className="label">טלפון *</label>
                  <input {...register('contact_phone')} className="input" dir="ltr" />
                  {errors.contact_phone && (
                    <p className="text-sm text-red-600 mt-1">{errors.contact_phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">אימייל</label>
                  <input {...register('contact_email')} type="email" className="input" dir="ltr" />
                  {errors.contact_email && (
                    <p className="text-sm text-red-600 mt-1">{errors.contact_email.message}</p>
                  )}
                </div>

                {/* Notes */}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <label className="label">הערות</label>
                  <textarea {...register('notes')} className="input min-h-[80px]" />
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
