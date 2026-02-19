import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Briefcase, Search, Plus, Phone, Star, Users, Trash2, Building2, X } from 'lucide-react';
import { contractorsApi } from '../services/api';
import { SkeletonPulse, SkeletonGrid } from '../components/Skeleton';
import { usePermissions } from '../hooks/usePermissions';

const contractorSchema = z.object({
  company_name: z.string().min(1, 'נדרש שם חברה'),
  contact_name: z.string().min(1, 'נדרש שם איש קשר'),
  phone: z.string().optional(),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  specialization: z.string().optional(),
  hourly_rate: z.number().optional(),
  daily_rate: z.number().optional(),
  max_workers: z.number().optional(),
  notes: z.string().optional(),
});

type ContractorForm = z.infer<typeof contractorSchema>;

interface Contractor {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  specialization: string;
  hourly_rate: number;
  daily_rate: number;
  max_workers: number;
  workers_count: number;
  rating: number;
  status: string;
  notes: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= rating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return { class: 'badge-success', label: 'פעיל' };
    case 'inactive':
      return { class: 'badge-gray', label: 'לא פעיל' };
    case 'blacklisted':
      return { class: 'badge-danger', label: 'חסום' };
    default:
      return { class: 'badge-gray', label: status || 'לא ידוע' };
  }
}

export default function Contractors() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contractors', { search: searchTerm }],
    queryFn: () => contractorsApi.getAll({ search: searchTerm, limit: 50 }).then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (formData: ContractorForm) => contractorsApi.create(formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      toast.success('קבלן נוצר בהצלחה');
      setIsModalOpen(false);
      reset();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || 'שגיאה ביצירת קבלן');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      toast.success('קבלן נמחק בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת קבלן');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContractorForm>({
    resolver: zodResolver(contractorSchema),
    defaultValues: {
      max_workers: 10,
    },
  });

  const { can } = usePermissions();

  const onSubmit = (formData: ContractorForm) => {
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">קבלנים</h1>
          <p className="page-subtitle">ניהול קבלנים וספקי כוח אדם</p>
        </div>
        {can('contractors:create') && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            קבלן חדש
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="חיפוש קבלנים..."
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
      ) : data?.contractors?.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.contractors.map((contractor: Contractor) => {
            const statusBadge = getStatusBadge(contractor.status);
            return (
              <div
                key={contractor.id}
                className="card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-start gap-3.5">
                  <Link to={`/contractors/${contractor.id}`} className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-11 h-11 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold text-gray-900 text-sm truncate">
                        {contractor.company_name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">{contractor.contact_name}</p>
                      {contractor.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span dir="ltr">{contractor.phone}</span>
                        </p>
                      )}
                      <div className="flex items-center flex-wrap gap-1.5 mt-2">
                        <span className={`badge ${statusBadge.class}`}>
                          {statusBadge.label}
                        </span>
                        {contractor.specialization && (
                          <span className="badge badge-info">{contractor.specialization}</span>
                        )}
                        <span className="badge badge-gray flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {contractor.workers_count || 0}
                        </span>
                      </div>
                      {contractor.rating > 0 && (
                        <div className="mt-2">
                          <StarRating rating={contractor.rating} />
                        </div>
                      )}
                    </div>
                  </Link>
                  {can('contractors:delete') && (
                    <button
                      onClick={() => {
                        if (confirm('האם אתה בטוח שברצונך למחוק קבלן זה?')) {
                          deleteMutation.mutate(contractor.id);
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
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-1">אין קבלנים</p>
          <p className="text-sm text-gray-400 mb-6">הוסף קבלן חדש כדי להתחיל לנהל את הספקים</p>
          {can('contractors:create') && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              הוסף קבלן ראשון
            </button>
          )}
        </div>
      )}

      {/* Create Contractor Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">קבלן חדש</h2>
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
                  <label className="label">שם חברה *</label>
                  <input {...register('company_name')} className="input" />
                  {errors.company_name && (
                    <p className="text-xs text-red-600 mt-1">{errors.company_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">איש קשר *</label>
                  <input {...register('contact_name')} className="input" />
                  {errors.contact_name && (
                    <p className="text-xs text-red-600 mt-1">{errors.contact_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">טלפון</label>
                  <input {...register('phone')} className="input" dir="ltr" />
                </div>

                <div>
                  <label className="label">אימייל</label>
                  <input {...register('email')} type="email" className="input" dir="ltr" />
                  {errors.email && (
                    <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">תחום התמחות</label>
                  <input {...register('specialization')} className="input" />
                </div>

                <div>
                  <label className="label">מקסימום עובדים</label>
                  <input
                    {...register('max_workers', { valueAsNumber: true })}
                    type="number"
                    className="input"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="label">תעריף שעתי (₪)</label>
                  <input
                    {...register('hourly_rate', { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="input"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="label">תעריף יומי (₪)</label>
                  <input
                    {...register('daily_rate', { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className="input"
                    dir="ltr"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="label">הערות</label>
                  <textarea {...register('notes')} className="input" rows={3} />
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
