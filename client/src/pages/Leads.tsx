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
import { SkeletonPulse, SkeletonTableRows } from '../components/Skeleton';
import { usePermissions } from '../hooks/usePermissions';
import { useBulkSelection } from '../hooks/useBulkSelection';
import BulkActionBar from '../components/BulkActionBar';

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
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkNewStatus, setBulkNewStatus] = useState('contacted');
  const queryClient = useQueryClient();
  const { selectedIds, selectedCount, isSelected, toggleSelect, toggleAll, clearSelection } = useBulkSelection();

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

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) => leadsApi.bulkUpdateStatus(ids, status),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      clearSelection();
      setBulkStatusModal(false);
      toast.success(res.data.message || 'לידים עודכנו');
    },
    onError: () => toast.error('שגיאה בעדכון לידים'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => leadsApi.bulkDelete(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      clearSelection();
      toast.success(res.data.message || 'לידים נמחקו');
    },
    onError: () => toast.error('שגיאה במחיקת לידים'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
  });

  const { can } = usePermissions();

  const onSubmit = (data: LeadForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">לידים</h1>
          <p className="page-subtitle">ניהול לידים ומעקב מכירות</p>
        </div>
        {can('leads:create') && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            ליד חדש
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי שם, טלפון או חברה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pr-11"
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
          <SkeletonTableRows columns={7} rows={5} />
        ) : data?.leads?.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      checked={selectedCount > 0 && selectedCount === data.leads.length}
                      onChange={() => toggleAll(data.leads.map((l: { id: string }) => l.id))}
                    />
                  </th>
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
                  <tr key={lead.id} className={isSelected(lead.id) ? 'bg-primary-50' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                        checked={isSelected(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                      />
                    </td>
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
                        {can('leads:delete') && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              if (confirm('האם אתה בטוח שברצונך למחוק ליד זה?')) {
                                deleteMutation.mutate(lead.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-danger-500 hover:bg-danger-50 transition-colors"
                            title="מחק"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium mb-1">לא נמצאו לידים</p>
            <p className="text-sm text-gray-400 mb-6">התחל להוסיף לידים חדשים למעקב</p>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              הוסף ליד ראשון
            </button>
          </div>
        )}
      </div>

      {/* Create Lead Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-lg max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-2 sm:col-span-2">
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

      {/* Bulk Status Update Modal */}
      {bulkStatusModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">עדכון סטטוס ({selectedCount} לידים)</h3>
            <select
              value={bulkNewStatus}
              onChange={(e) => setBulkNewStatus(e.target.value)}
              className="input w-full mb-4"
            >
              <option value="new">חדש</option>
              <option value="contacted">נוצר קשר</option>
              <option value="meeting_scheduled">פגישה נקבעה</option>
              <option value="proposal_sent">הצעה נשלחה</option>
              <option value="negotiation">משא ומתן</option>
              <option value="won">נסגר</option>
              <option value="lost">אבד</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBulkStatusModal(false)} className="btn-secondary">ביטול</button>
              <button
                onClick={() => bulkStatusMutation.mutate({ ids: [...selectedIds], status: bulkNewStatus })}
                className="btn-primary"
                disabled={bulkStatusMutation.isPending}
              >
                {bulkStatusMutation.isPending ? 'מעדכן...' : 'עדכן'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClear={clearSelection}
        actions={[
          {
            label: 'עדכן סטטוס',
            onClick: () => setBulkStatusModal(true),
            icon: <Filter className="w-4 h-4" />,
            variant: 'primary',
          },
          {
            label: 'מחק נבחרים',
            onClick: () => {
              if (confirm('האם למחוק את הלידים הנבחרים?')) {
                bulkDeleteMutation.mutate([...selectedIds]);
              }
            },
            icon: <Trash2 className="w-4 h-4" />,
            variant: 'danger',
            loading: bulkDeleteMutation.isPending,
          },
        ]}
      />
    </div>
  );
}
