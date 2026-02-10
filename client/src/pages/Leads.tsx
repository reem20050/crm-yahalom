import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  X,
  Filter,
  Trash2,
} from 'lucide-react';
import { leadsApi } from '../services/api';

const leadSchema = z.object({
  company_name: z.string().optional(),
  contact_name: z.string().min(1, 'נדרש שם איש קשר'),
  phone: z.string().min(1, 'נדרש מספר טלפון'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  source: z.string().optional(),
  service_type: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  expected_value: z.number().optional(),
});

type LeadForm = z.infer<typeof leadSchema>;

const statusLabels: Record<string, { label: string; class: string }> = {
  new: { label: 'חדש', class: 'badge-info' },
  contacted: { label: 'נוצר קשר', class: 'badge-gray' },
  meeting_scheduled: { label: 'פגישה נקבעה', class: 'badge-warning' },
  proposal_sent: { label: 'הצעה נשלחה', class: 'badge-warning' },
  negotiation: { label: 'משא ומתן', class: 'badge-warning' },
  won: { label: 'נסגר', class: 'badge-success' },
  lost: { label: 'אבד', class: 'badge-danger' },
};

const sourceLabels: Record<string, string> = {
  website: 'אתר אינטרנט',
  whatsapp: 'וואטסאפ',
  phone: 'טלפון',
  referral: 'המלצה',
};

export default function Leads() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', { search: searchTerm, status: statusFilter }],
    queryFn: () =>
      leadsApi
        .getAll({ search: searchTerm, status: statusFilter, limit: 50 })
        .then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: LeadForm) => leadsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('ליד נוצר בהצלחה');
      setIsModalOpen(false);
      reset();
    },
    onError: () => {
      toast.error('שגיאה ביצירת ליד');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
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
  } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
  });

  const onSubmit = (data: LeadForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לידים</h1>
          <p className="text-gray-500">ניהול לידים ומעקב מכירות</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          ליד חדש
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי שם, טלפון או חברה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pr-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-auto"
            >
              <option value="">כל הסטטוסים</option>
              {Object.entries(statusLabels).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leads table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
          </div>
        ) : data?.leads?.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>איש קשר</th>
                  <th>חברה</th>
                  <th>מקור</th>
                  <th>סטטוס</th>
                  <th>תאריך יצירה</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.leads.map((lead: {
                  id: string;
                  contact_name: string;
                  company_name: string;
                  phone: string;
                  email: string;
                  source: string;
                  status: string;
                  created_at: string;
                }) => (
                  <tr key={lead.id}>
                    <td>
                      <div>
                        <p className="font-medium">{lead.contact_name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                          </span>
                          {lead.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{lead.company_name || '-'}</td>
                    <td>{sourceLabels[lead.source] || lead.source || '-'}</td>
                    <td>
                      <span className={statusLabels[lead.status]?.class || 'badge-gray'}>
                        {statusLabels[lead.status]?.label || lead.status}
                      </span>
                    </td>
                    <td>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {new Date(lead.created_at).toLocaleDateString('he-IL')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/leads/${lead.id}`}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                          צפייה
                        </Link>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            if (confirm('האם אתה בטוח שברצונך למחוק ליד זה?')) {
                              deleteMutation.mutate(lead.id);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="מחק"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">לא נמצאו לידים</p>
          </div>
        )}
      </div>

      {/* Create Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">ליד חדש</h2>
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
                <div className="col-span-2">
                  <label className="label">שם איש קשר *</label>
                  <input {...register('contact_name')} className="input" />
                  {errors.contact_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.contact_name.message}</p>
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

                <div className="col-span-2">
                  <label className="label">שם חברה</label>
                  <input {...register('company_name')} className="input" />
                </div>

                <div>
                  <label className="label">מקור</label>
                  <select {...register('source')} className="input">
                    <option value="">בחר מקור</option>
                    <option value="website">אתר אינטרנט</option>
                    <option value="whatsapp">וואטסאפ</option>
                    <option value="phone">טלפון</option>
                    <option value="referral">המלצה</option>
                  </select>
                </div>

                <div>
                  <label className="label">סוג שירות</label>
                  <select {...register('service_type')} className="input">
                    <option value="">בחר סוג</option>
                    <option value="regular">אבטחה קבועה</option>
                    <option value="event">אירוע חד-פעמי</option>
                    <option value="both">שניהם</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="label">מיקום / אזור</label>
                  <input {...register('location')} className="input" />
                </div>

                <div className="col-span-2">
                  <label className="label">תיאור</label>
                  <textarea {...register('description')} className="input" rows={3} />
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
