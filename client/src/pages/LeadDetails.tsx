import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRight, Phone, Mail, Building2, MapPin, UserCheck } from 'lucide-react';
import { leadsApi } from '../services/api';

const statusOptions = [
  { value: 'new', label: 'חדש' },
  { value: 'contacted', label: 'נוצר קשר' },
  { value: 'meeting_scheduled', label: 'פגישה נקבעה' },
  { value: 'proposal_sent', label: 'הצעה נשלחה' },
  { value: 'negotiation', label: 'משא ומתן' },
  { value: 'won', label: 'נסגר' },
  { value: 'lost', label: 'אבד' },
];

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (status: string) => leadsApi.update(id!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      toast.success('סטטוס עודכן');
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => leadsApi.convert(id!),
    onSuccess: (res) => {
      toast.success('ליד הומר ללקוח בהצלחה');
      navigate(`/customers/${res.data.customer.id}`);
    },
    onError: () => {
      toast.error('שגיאה בהמרת ליד');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  const lead = data?.lead;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/leads')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה ללידים
      </button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead?.contact_name}</h1>
          {lead?.company_name && (
            <p className="text-gray-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {lead.company_name}
            </p>
          )}
        </div>
        {lead?.status !== 'won' && lead?.status !== 'lost' && (
          <button
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
            className="btn-success flex items-center gap-2"
          >
            <UserCheck className="w-5 h-5" />
            המר ללקוח
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Contact info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטי קשר</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">טלפון</p>
                  <a href={`tel:${lead?.phone}`} className="text-primary-600 font-medium">
                    {lead?.phone}
                  </a>
                </div>
              </div>
              {lead?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">אימייל</p>
                    <a href={`mailto:${lead.email}`} className="text-primary-600 font-medium">
                      {lead.email}
                    </a>
                  </div>
                </div>
              )}
              {lead?.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">מיקום</p>
                    <p className="font-medium">{lead.location}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {lead?.description && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">תיאור</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{lead.description}</p>
            </div>
          )}

          {/* Activity */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">היסטוריה</h2>
            {data?.activity?.length > 0 ? (
              <div className="space-y-3">
                {data.activity.map((item: { id: string; action: string; user_name: string; created_at: string }) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-gray-500">
                        {item.user_name} | {new Date(item.created_at).toLocaleString('he-IL')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין היסטוריה</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">סטטוס</h2>
            <select
              value={lead?.status}
              onChange={(e) => updateMutation.mutate(e.target.value)}
              className="input"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטים</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">מקור</dt>
                <dd className="font-medium">{lead?.source || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">סוג שירות</dt>
                <dd className="font-medium">{lead?.service_type || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">תאריך יצירה</dt>
                <dd className="font-medium">
                  {lead?.created_at && new Date(lead.created_at).toLocaleDateString('he-IL')}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
