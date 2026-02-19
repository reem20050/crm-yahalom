import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  Phone,
  Mail,
  Star,
  Plus,
  X,
  Edit3,
  Save,
  Trash2,
  Users,
  Calendar,
  MapPin,
  DollarSign,
  Briefcase,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { contractorsApi } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

// --- Types ---

interface ContractorWorker {
  id: string;
  name: string;
  phone: string;
  id_number: string;
  has_weapon_license: boolean;
  status: string;
}

interface ContractorEvent {
  id: string;
  event_name: string;
  event_date: string;
  location: string;
  workers_count: number;
  cost: number;
  status: string;
}

interface ContractorData {
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
  address: string;
  city: string;
  business_id: string;
  created_at: string;
}

interface EditForm {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  specialization: string;
  hourly_rate: number | string;
  daily_rate: number | string;
  max_workers: number | string;
  status: string;
  notes: string;
  address: string;
  city: string;
  business_id: string;
}

interface WorkerForm {
  name: string;
  phone: string;
  id_number: string;
  has_weapon_license: boolean;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'פעיל' },
  { value: 'inactive', label: 'לא פעיל' },
  { value: 'blacklisted', label: 'חסום' },
];

const TABS = [
  { key: 'details', label: 'פרטים' },
  { key: 'workers', label: 'עובדים' },
  { key: 'events', label: 'אירועים' },
  { key: 'financials', label: 'כספים' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? 0 : star)}
          className="p-0.5"
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              star <= value
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 hover:text-yellow-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

export default function ContractorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);

  const [editForm, setEditForm] = useState<EditForm>({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    specialization: '',
    hourly_rate: '',
    daily_rate: '',
    max_workers: '',
    status: 'active',
    notes: '',
    address: '',
    city: '',
    business_id: '',
  });

  const [workerForm, setWorkerForm] = useState<WorkerForm>({
    name: '',
    phone: '',
    id_number: '',
    has_weapon_license: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['contractor', id],
    queryFn: () => contractorsApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['contractor-events', id],
    queryFn: () => contractorsApi.getEvents(id!).then((res) => res.data),
    enabled: !!id && (activeTab === 'events' || activeTab === 'financials'),
  });

  const contractor: ContractorData | undefined = data?.contractor;
  const workers: ContractorWorker[] = data?.workers || [];
  const events: ContractorEvent[] = eventsData?.events || [];

  // Sync edit form when contractor data loads
  useEffect(() => {
    if (contractor) {
      setEditForm({
        company_name: contractor.company_name || '',
        contact_name: contractor.contact_name || '',
        phone: contractor.phone || '',
        email: contractor.email || '',
        specialization: contractor.specialization || '',
        hourly_rate: contractor.hourly_rate || '',
        daily_rate: contractor.daily_rate || '',
        max_workers: contractor.max_workers || '',
        status: contractor.status || 'active',
        notes: contractor.notes || '',
        address: contractor.address || '',
        city: contractor.city || '',
        business_id: contractor.business_id || '',
      });
      setRatingValue(contractor.rating || 0);
    }
  }, [contractor]);

  // --- Mutations ---

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) => contractorsApi.update(id!, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor', id] });
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
      toast.success('הקבלן עודכן בהצלחה');
      setIsEditing(false);
    },
    onError: () => toast.error('שגיאה בעדכון הקבלן'),
  });

  const addWorkerMutation = useMutation({
    mutationFn: (workerData: Record<string, unknown>) => contractorsApi.addWorker(id!, workerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor', id] });
      toast.success('עובד נוסף בהצלחה');
      setShowWorkerForm(false);
      setWorkerForm({ name: '', phone: '', id_number: '', has_weapon_license: false });
    },
    onError: () => toast.error('שגיאה בהוספת עובד'),
  });

  const updateWorkerMutation = useMutation({
    mutationFn: ({ workerId, workerData }: { workerId: string; workerData: Record<string, unknown> }) =>
      contractorsApi.updateWorker(id!, workerId, workerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor', id] });
      toast.success('עובד עודכן בהצלחה');
      setEditingWorkerId(null);
      setWorkerForm({ name: '', phone: '', id_number: '', has_weapon_license: false });
    },
    onError: () => toast.error('שגיאה בעדכון עובד'),
  });

  const deleteWorkerMutation = useMutation({
    mutationFn: (workerId: string) => contractorsApi.deleteWorker(id!, workerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractor', id] });
      toast.success('עובד נמחק בהצלחה');
    },
    onError: () => toast.error('שגיאה במחיקת עובד'),
  });

  // --- Handlers ---

  const handleSave = () => {
    if (!editForm.company_name.trim()) {
      toast.error('שם חברה הוא שדה חובה');
      return;
    }
    if (!editForm.contact_name.trim()) {
      toast.error('שם איש קשר הוא שדה חובה');
      return;
    }
    const payload: Record<string, unknown> = {
      ...editForm,
      hourly_rate: editForm.hourly_rate ? Number(editForm.hourly_rate) : null,
      daily_rate: editForm.daily_rate ? Number(editForm.daily_rate) : null,
      max_workers: editForm.max_workers ? Number(editForm.max_workers) : 10,
      rating: ratingValue,
    };
    updateMutation.mutate(payload);
  };

  const handleCancelEdit = () => {
    if (contractor) {
      setEditForm({
        company_name: contractor.company_name || '',
        contact_name: contractor.contact_name || '',
        phone: contractor.phone || '',
        email: contractor.email || '',
        specialization: contractor.specialization || '',
        hourly_rate: contractor.hourly_rate || '',
        daily_rate: contractor.daily_rate || '',
        max_workers: contractor.max_workers || '',
        status: contractor.status || 'active',
        notes: contractor.notes || '',
        address: contractor.address || '',
        city: contractor.city || '',
        business_id: contractor.business_id || '',
      });
      setRatingValue(contractor.rating || 0);
    }
    setIsEditing(false);
  };

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerForm.name.trim()) {
      toast.error('נדרש שם עובד');
      return;
    }
    addWorkerMutation.mutate(workerForm as unknown as Record<string, unknown>);
  };

  const handleUpdateWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkerId || !workerForm.name.trim()) return;
    updateWorkerMutation.mutate({
      workerId: editingWorkerId,
      workerData: workerForm as unknown as Record<string, unknown>,
    });
  };

  const startEditWorker = (worker: ContractorWorker) => {
    setEditingWorkerId(worker.id);
    setWorkerForm({
      name: worker.name || '',
      phone: worker.phone || '',
      id_number: worker.id_number || '',
      has_weapon_license: worker.has_weapon_license || false,
    });
    setShowWorkerForm(false);
  };

  // --- Financial calculations ---
  const financials = useMemo(() => {
    if (!events || events.length === 0) {
      return { totalRevenue: 0, averagePerEvent: 0, eventCount: 0 };
    }
    const totalRevenue = events.reduce((sum, ev) => sum + (ev.cost || 0), 0);
    return {
      totalRevenue,
      averagePerEvent: events.length > 0 ? totalRevenue / events.length : 0,
      eventCount: events.length,
    };
  }, [events]);

  // --- Loading state ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="card text-center py-16">
        <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">הקבלן לא נמצא</p>
        <button onClick={() => navigate('/contractors')} className="btn-primary mt-4">
          חזרה לקבלנים
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/contractors')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה לקבלנים
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">{contractor.company_name}</h1>
            <p className="text-gray-500">{contractor.contact_name}</p>
            {contractor.rating > 0 && (
              <div className="mt-1">
                <StarRatingDisplay rating={contractor.rating} />
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="btn-success text-sm flex items-center gap-1 px-3 py-2"
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="btn-secondary text-sm flex items-center gap-1 px-3 py-2"
              >
                <X className="w-4 h-4" />
                ביטול
              </button>
            </>
          ) : (
            can('contractors:edit') && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary text-sm flex items-center gap-1 px-3 py-2"
              >
                <Edit3 className="w-4 h-4" />
                עריכה
              </button>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 font-heading">פרטי חברה</h2>
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">שם חברה *</label>
                    <input
                      value={editForm.company_name}
                      onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">ח.פ / ע.מ</label>
                    <input
                      value={editForm.business_id}
                      onChange={(e) => setEditForm({ ...editForm, business_id: e.target.value })}
                      className="input"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="label">כתובת</label>
                    <input
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">עיר</label>
                    <input
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">תחום התמחות</label>
                    <input
                      value={editForm.specialization}
                      onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">סטטוס</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="input"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="label">דירוג</label>
                    <StarRatingInput value={ratingValue} onChange={setRatingValue} />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="label">הערות</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="input"
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">שם חברה</dt>
                    <dd className="font-medium">{contractor.company_name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">ח.פ / ע.מ</dt>
                    <dd className="font-medium">{contractor.business_id || '-'}</dd>
                  </div>
                  {contractor.address && (
                    <div>
                      <dt className="text-sm text-gray-500">כתובת</dt>
                      <dd className="font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {contractor.address}{contractor.city ? `, ${contractor.city}` : ''}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm text-gray-500">תחום התמחות</dt>
                    <dd className="font-medium">{contractor.specialization || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">סטטוס</dt>
                    <dd>
                      <span className={`badge ${
                        contractor.status === 'active' ? 'badge-success' :
                        contractor.status === 'blacklisted' ? 'badge-danger' : 'badge-gray'
                      }`}>
                        {STATUS_OPTIONS.find((o) => o.value === contractor.status)?.label || contractor.status}
                      </span>
                    </dd>
                  </div>
                  {contractor.notes && (
                    <div className="col-span-1 sm:col-span-2">
                      <dt className="text-sm text-gray-500">הערות</dt>
                      <dd className="font-medium text-sm whitespace-pre-wrap">{contractor.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            {/* Contact Details */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 font-heading">פרטי קשר</h2>
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">איש קשר *</label>
                    <input
                      value={editForm.contact_name}
                      onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">טלפון</label>
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="input"
                      dir="ltr"
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
                    />
                  </div>
                </div>
              ) : (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">איש קשר</dt>
                    <dd className="font-medium">{contractor.contact_name}</dd>
                  </div>
                  {contractor.phone && (
                    <div>
                      <dt className="text-sm text-gray-500">טלפון</dt>
                      <dd className="font-medium flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <a href={`tel:${contractor.phone}`} className="text-primary-600" dir="ltr">
                          {contractor.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {contractor.email && (
                    <div>
                      <dt className="text-sm text-gray-500">אימייל</dt>
                      <dd className="font-medium flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <a href={`mailto:${contractor.email}`} className="text-primary-600" dir="ltr">
                          {contractor.email}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          </div>

          {/* Sidebar - Financial Details */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 font-heading">פרטים כספיים</h2>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="label">תעריף שעתי (₪)</label>
                    <input
                      value={editForm.hourly_rate}
                      onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                      className="input"
                      type="number"
                      step="0.01"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="label">תעריף יומי (₪)</label>
                    <input
                      value={editForm.daily_rate}
                      onChange={(e) => setEditForm({ ...editForm, daily_rate: e.target.value })}
                      className="input"
                      type="number"
                      step="0.01"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="label">מקסימום עובדים</label>
                    <input
                      value={editForm.max_workers}
                      onChange={(e) => setEditForm({ ...editForm, max_workers: e.target.value })}
                      className="input"
                      type="number"
                      dir="ltr"
                    />
                  </div>
                </div>
              ) : (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm text-gray-500">תעריף שעתי</dt>
                    <dd className="font-medium">
                      {contractor.hourly_rate ? `₪${contractor.hourly_rate.toLocaleString()}` : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">תעריף יומי</dt>
                    <dd className="font-medium">
                      {contractor.daily_rate ? `₪${contractor.daily_rate.toLocaleString()}` : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">מקסימום עובדים</dt>
                    <dd className="font-medium">{contractor.max_workers || 10}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">עובדים רשומים</dt>
                    <dd className="font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {contractor.workers_count || workers.length || 0}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workers' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-heading">עובדי קבלן</h2>
              {can('contractors:edit') && (
                <button
                  onClick={() => {
                    setShowWorkerForm(!showWorkerForm);
                    setEditingWorkerId(null);
                    setWorkerForm({ name: '', phone: '', id_number: '', has_weapon_license: false });
                  }}
                  className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5"
                >
                  {showWorkerForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showWorkerForm ? 'ביטול' : 'הוסף עובד'}
                </button>
              )}
            </div>

            {/* Add Worker Form */}
            {showWorkerForm && (
              <form onSubmit={handleAddWorker} className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">שם *</label>
                    <input
                      value={workerForm.name}
                      onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">טלפון</label>
                    <input
                      value={workerForm.phone}
                      onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                      className="input"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="label">ת.ז</label>
                    <input
                      value={workerForm.id_number}
                      onChange={(e) => setWorkerForm({ ...workerForm, id_number: e.target.value })}
                      className="input"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                      <input
                        type="checkbox"
                        checked={workerForm.has_weapon_license}
                        onChange={(e) => setWorkerForm({ ...workerForm, has_weapon_license: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">רישיון נשק</span>
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={addWorkerMutation.isPending || !workerForm.name.trim()}
                  className="btn-primary text-sm"
                >
                  {addWorkerMutation.isPending ? 'שומר...' : 'שמור עובד'}
                </button>
              </form>
            )}

            {/* Edit Worker Form */}
            {editingWorkerId && (
              <form onSubmit={handleUpdateWorker} className="mb-4 p-4 bg-yellow-50 rounded-lg space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">עריכת עובד</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">שם *</label>
                    <input
                      value={workerForm.name}
                      onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">טלפון</label>
                    <input
                      value={workerForm.phone}
                      onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                      className="input"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="label">ת.ז</label>
                    <input
                      value={workerForm.id_number}
                      onChange={(e) => setWorkerForm({ ...workerForm, id_number: e.target.value })}
                      className="input"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                      <input
                        type="checkbox"
                        checked={workerForm.has_weapon_license}
                        onChange={(e) => setWorkerForm({ ...workerForm, has_weapon_license: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">רישיון נשק</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updateWorkerMutation.isPending || !workerForm.name.trim()}
                    className="btn-primary text-sm"
                  >
                    {updateWorkerMutation.isPending ? 'שומר...' : 'עדכן עובד'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWorkerId(null);
                      setWorkerForm({ name: '', phone: '', id_number: '', has_weapon_license: false });
                    }}
                    className="btn-secondary text-sm"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            )}

            {/* Workers List */}
            {workers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-right py-3 px-4 font-medium text-gray-500">שם</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">טלפון</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">ת.ז</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">רישיון נשק</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">סטטוס</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {workers.map((worker) => (
                      <tr key={worker.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-medium">{worker.name}</td>
                        <td className="py-3 px-4" dir="ltr">
                          {worker.phone ? (
                            <a href={`tel:${worker.phone}`} className="text-primary-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {worker.phone}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4" dir="ltr">{worker.id_number || '-'}</td>
                        <td className="py-3 px-4">
                          {worker.has_weapon_license ? (
                            <span className="badge badge-info flex items-center gap-1 w-fit">
                              <Shield className="w-3 h-3" />
                              יש
                            </span>
                          ) : (
                            <span className="text-gray-400">אין</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`badge ${worker.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                            {worker.status === 'active' ? 'פעיל' : 'לא פעיל'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {can('contractors:edit') && (
                              <button
                                onClick={() => startEditWorker(worker)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                title="ערוך"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {can('contractors:delete') && (
                              <button
                                onClick={() => {
                                  if (confirm('האם אתה בטוח שברצונך למחוק עובד זה?')) {
                                    deleteWorkerMutation.mutate(worker.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-danger-500 hover:bg-danger-50 transition-colors"
                                title="מחק"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">אין עובדים רשומים לקבלן זה</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 font-heading">אירועים</h2>
          {events.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-right py-3 px-4 font-medium text-gray-500">שם אירוע</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">תאריך</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">מיקום</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">עובדים</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">עלות</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4">
                        <a
                          href={`/events/${event.id}`}
                          className="font-medium text-primary-600 hover:text-primary-700"
                        >
                          {event.event_name}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {event.event_date}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {event.location ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {event.location}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          {event.workers_count || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {event.cost ? `₪${event.cost.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${
                          event.status === 'completed' ? 'badge-success' :
                          event.status === 'active' ? 'badge-info' :
                          event.status === 'cancelled' ? 'badge-danger' : 'badge-gray'
                        }`}>
                          {event.status === 'completed' ? 'הושלם' :
                           event.status === 'active' ? 'פעיל' :
                           event.status === 'cancelled' ? 'בוטל' :
                           event.status === 'scheduled' ? 'מתוכנן' : event.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">אין אירועים לקבלן זה</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'financials' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">סה"כ הכנסות מאירועים</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₪{financials.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">ממוצע לאירוע</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₪{financials.averagePerEvent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">מספר אירועים</p>
                  <p className="text-xl font-bold text-gray-900">
                    {financials.eventCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rates info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 font-heading">תעריפים</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">תעריף שעתי</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {contractor.hourly_rate ? `₪${contractor.hourly_rate.toLocaleString()}` : '-'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">תעריף יומי</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {contractor.daily_rate ? `₪${contractor.daily_rate.toLocaleString()}` : '-'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500">עובדים פעילים</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {contractor.workers_count || workers.length || 0} / {contractor.max_workers || 10}
                </p>
              </div>
            </div>
          </div>

          {/* Events breakdown */}
          {events.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 font-heading">פירוט אירועים</h2>
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{event.event_name}</p>
                      <p className="text-xs text-gray-500">{event.event_date}</p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">{event.cost ? `₪${event.cost.toLocaleString()}` : '-'}</p>
                      <p className="text-xs text-gray-500">{event.workers_count || 0} עובדים</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
