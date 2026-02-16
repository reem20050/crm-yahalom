import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowRight, Phone, Mail, Building2, MapPin, Edit, Save, X, Trash2, ArrowLeftRight, AlertTriangle, Send } from 'lucide-react';
import { leadsApi } from '../services/api';
import WhatsAppButton from '../components/WhatsAppButton';
import ActivityLog from '../components/ActivityLog';
import EmailComposeModal from '../components/EmailComposeModal';

const statusOptions = [
  { value: 'new', label: 'חדש' },
  { value: 'contacted', label: 'נוצר קשר' },
  { value: 'meeting_scheduled', label: 'פגישה נקבעה' },
  { value: 'proposal_sent', label: 'הצעה נשלחה' },
  { value: 'negotiation', label: 'משא ומתן' },
  { value: 'won', label: 'נסגר' },
  { value: 'lost', label: 'אבד' },
];

const sourceOptions = [
  { value: 'website', label: 'אתר אינטרנט' },
  { value: 'whatsapp', label: 'וואטסאפ' },
  { value: 'phone', label: 'טלפון' },
  { value: 'referral', label: 'הפניה' },
];

const serviceTypeOptions = [
  { value: 'regular', label: 'שמירה רגילה' },
  { value: 'event', label: 'אירועים' },
  { value: 'both', label: 'שניהם' },
];

interface EditForm {
  contact_name: string;
  company_name: string;
  phone: string;
  email: string;
  location: string;
  description: string;
  source: string;
  service_type: string;
}

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    contact_name: '',
    company_name: '',
    phone: '',
    email: '',
    location: '',
    description: '',
    source: '',
    service_type: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  const lead = data?.lead;

  // Sync edit form when lead data loads or changes
  useEffect(() => {
    if (lead) {
      setEditForm({
        contact_name: lead.contact_name || '',
        company_name: lead.company_name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        location: lead.location || '',
        description: lead.description || '',
        source: lead.source || '',
        service_type: lead.service_type || '',
      });
    }
  }, [lead]);

  const statusMutation = useMutation({
    mutationFn: (status: string) => leadsApi.update(id!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      toast.success('סטטוס עודכן');
    },
    onError: () => toast.error('שגיאה בעדכון סטטוס'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => leadsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('הליד עודכן בהצלחה');
      setIsEditing(false);
    },
    onError: () => {
      toast.error('שגיאה בעדכון הליד');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => leadsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('הליד נמחק בהצלחה');
      navigate('/leads');
    },
    onError: () => {
      toast.error('שגיאה במחיקת הליד');
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => leadsApi.convert(id!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('הליד הומר ללקוח בהצלחה');
      navigate(`/customers/${res.data.customer.id}`);
    },
    onError: () => {
      toast.error('שגיאה בהמרת הליד');
    },
  });

  const handleSave = () => {
    if (!editForm.contact_name.trim()) {
      toast.error('שם איש קשר הוא שדה חובה');
      return;
    }
    updateMutation.mutate(editForm as unknown as Record<string, unknown>);
  };

  const handleCancel = () => {
    if (lead) {
      setEditForm({
        contact_name: lead.contact_name || '',
        company_name: lead.company_name || '',
        phone: lead.phone || '',
        email: lead.email || '',
        location: lead.location || '',
        description: lead.description || '',
        source: lead.source || '',
        service_type: lead.service_type || '',
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

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
          {isEditing ? (
            <div className="space-y-2">
              <div>
                <label className="label">שם איש קשר *</label>
                <input
                  value={editForm.contact_name}
                  onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                  className="input text-2xl font-bold"
                  placeholder="שם איש קשר"
                />
              </div>
              <div>
                <label className="label">שם חברה</label>
                <input
                  value={editForm.company_name}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  className="input"
                  placeholder="שם חברה"
                />
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">{lead?.contact_name}</h1>
              {lead?.company_name && (
                <p className="text-gray-500 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {lead.company_name}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                {updateMutation.isPending ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={handleCancel}
                className="btn-secondary flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                ביטול
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <Edit className="w-5 h-5" />
                עריכה
              </button>
              {lead?.status !== 'lost' && lead?.status !== 'converted' && (
                <button
                  onClick={() => setShowConvertConfirm(true)}
                  disabled={convertMutation.isPending}
                  className="btn-success flex items-center gap-2"
                >
                  <ArrowLeftRight className="w-5 h-5" />
                  המר ללקוח
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-danger flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                מחק ליד
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">מחיקת ליד</h3>
            <p className="text-gray-600">
              האם אתה בטוח שברצונך למחוק את הליד של <strong>{lead?.contact_name}</strong>?
              <br />
              פעולה זו אינה ניתנת לביטול.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate();
                  setShowDeleteConfirm(false);
                }}
                disabled={deleteMutation.isPending}
                className="btn-danger flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleteMutation.isPending ? 'מוחק...' : 'מחק'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to customer confirmation modal */}
      {showConvertConfirm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">המרת ליד ללקוח</h3>
            </div>
            <p className="text-gray-600">
              האם אתה בטוח שברצונך להמר ליד זה ללקוח?
            </p>
            <p className="text-sm text-gray-500">
              פעולה זו תיצור לקוח חדש מפרטי הליד
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowConvertConfirm(false)}
                className="btn-secondary"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  convertMutation.mutate();
                  setShowConvertConfirm(false);
                }}
                disabled={convertMutation.isPending}
                className="btn-success flex items-center gap-2"
              >
                <ArrowLeftRight className="w-4 h-4" />
                {convertMutation.isPending ? 'ממיר...' : 'כן, המר'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Contact info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטי קשר</h2>
            {isEditing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">טלפון</label>
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="input"
                    dir="ltr"
                    placeholder="טלפון"
                  />
                </div>
                <div>
                  <label className="label">אימייל</label>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="input"
                    dir="ltr"
                    type="email"
                    placeholder="אימייל"
                  />
                </div>
                <div>
                  <label className="label">מיקום</label>
                  <input
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="input"
                    placeholder="מיקום"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">טלפון</p>
                    <div className="flex items-center gap-2">
                      <a href={`tel:${lead?.phone}`} className="text-primary-600 font-medium">
                        {lead?.phone}
                      </a>
                      {lead?.phone && (
                        <WhatsAppButton phone={lead.phone} name={lead.contact_name} size="sm" />
                      )}
                    </div>
                  </div>
                </div>
                {lead?.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">אימייל</p>
                      <div className="flex items-center gap-2">
                        <a href={`mailto:${lead.email}`} className="text-primary-600 font-medium">
                          {lead.email}
                        </a>
                        <button
                          onClick={() => setShowEmailModal(true)}
                          className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="שלח אימייל"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
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
            )}
          </div>

          {/* Description */}
          {isEditing ? (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">תיאור</h2>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="input"
                rows={4}
                placeholder="תיאור הליד..."
              />
            </div>
          ) : (
            lead?.description && (
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">תיאור</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{lead.description}</p>
              </div>
            )
          )}

          {/* Activity Log */}
          {id && <ActivityLog entityType="lead" entityId={id} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">סטטוס</h2>
            <select
              value={lead?.status}
              onChange={(e) => statusMutation.mutate(e.target.value)}
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
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="label">מקור</label>
                  <select
                    value={editForm.source}
                    onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                    className="input"
                  >
                    <option value="">בחר מקור</option>
                    {sourceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">סוג שירות</label>
                  <select
                    value={editForm.service_type}
                    onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })}
                    className="input"
                  >
                    <option value="">בחר סוג שירות</option>
                    {serviceTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">תאריך יצירה</dt>
                  <dd className="font-medium">
                    {lead?.created_at && new Date(lead.created_at).toLocaleDateString('he-IL')}
                  </dd>
                </div>
              </div>
            ) : (
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">מקור</dt>
                  <dd className="font-medium">
                    {sourceOptions.find((o) => o.value === lead?.source)?.label || lead?.source || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">סוג שירות</dt>
                  <dd className="font-medium">
                    {serviceTypeOptions.find((o) => o.value === lead?.service_type)?.label || lead?.service_type || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">תאריך יצירה</dt>
                  <dd className="font-medium">
                    {lead?.created_at && new Date(lead.created_at).toLocaleDateString('he-IL')}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>

      {/* Email Compose Modal */}
      <EmailComposeModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        defaultTo={lead?.email || ''}
        defaultName={lead?.contact_name || ''}
        entityType="lead"
        entityId={id}
      />
    </div>
  );
}
