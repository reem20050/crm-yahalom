import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  UserCircle,
  Phone,
  Mail,
  MapPin,
  Shield,
  Car,
  Edit3,
  Save,
  X,
  Trash2,
  FileText as FileTextIcon,
  Plus,
  ToggleLeft,
  ToggleRight,
  FileText,
  AlertTriangle,
  Award,
  Star,
  Crosshair,
  BarChart3,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { employeesApi, certificationsApi, weaponsApi, performanceApi, equipmentApi } from '../services/api';
import WhatsAppButton from '../components/WhatsAppButton';
import GuardRatingModal from '../components/GuardRatingModal';
import DocumentManager from '../components/DocumentManager';

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'id_card', label: 'תעודת זהות' },
  { value: 'weapon_license', label: 'רישיון נשק' },
  { value: 'driving_license', label: 'רישיון נהיגה' },
  { value: 'certificate', label: 'תעודה' },
  { value: 'other', label: 'אחר' },
];

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  id_card: 'תעודת זהות',
  weapon_license: 'רישיון נשק',
  driving_license: 'רישיון נהיגה',
  certificate: 'תעודה',
  other: 'אחר',
};

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'hourly', label: 'שעתי' },
  { value: 'monthly', label: 'חודשי' },
  { value: 'contractor', label: 'קבלן' },
];

const DRIVING_LICENSE_OPTIONS = [
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'C1', label: 'C1' },
  { value: 'D', label: 'D' },
  { value: 'D1', label: 'D1' },
];

interface EditForm {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  hourly_rate: string;
  employment_type: string;
  has_weapon_license: boolean;
  has_driving_license: boolean;
  driving_license_type: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

interface DocumentForm {
  document_type: string;
  expiry_date: string;
}

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'certifications' | 'weapons' | 'equipment' | 'performance'>('info');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState({ cert_type: 'firearm_license', cert_name: '', cert_number: '', issuing_authority: '', issue_date: '', expiry_date: '', notes: '' });

  const [editForm, setEditForm] = useState<EditForm>({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    hourly_rate: '',
    employment_type: '',
    has_weapon_license: false,
    has_driving_license: false,
    driving_license_type: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const [documentForm, setDocumentForm] = useState<DocumentForm>({
    document_type: 'id_card',
    expiry_date: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  const employee = data?.employee;

  // Additional queries for security-specific tabs
  const { data: certsData } = useQuery({
    queryKey: ['certifications', id],
    queryFn: () => certificationsApi.getByEmployee(id!).then((r) => r.data),
    enabled: !!id && activeTab === 'certifications',
  });

  const { data: weaponsData } = useQuery({
    queryKey: ['weapons', id],
    queryFn: () => weaponsApi.getByEmployee(id!).then((r) => r.data),
    enabled: !!id && activeTab === 'weapons',
  });

  const { data: equipData } = useQuery({
    queryKey: ['equipment', id],
    queryFn: () => equipmentApi.getByEmployee(id!).then((r) => r.data),
    enabled: !!id && activeTab === 'equipment',
  });

  const { data: perfData } = useQuery({
    queryKey: ['performance', id],
    queryFn: () => performanceApi.getEmployee(id!).then((r) => r.data),
    enabled: !!id && activeTab === 'performance',
  });

  const createCertMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) => certificationsApi.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', id] });
      toast.success('הסמכה נוספה בהצלחה');
      setShowCertForm(false);
      setCertForm({ cert_type: 'firearm_license', cert_name: '', cert_number: '', issuing_authority: '', issue_date: '', expiry_date: '', notes: '' });
    },
    onError: () => toast.error('שגיאה בהוספת הסמכה'),
  });

  const deleteCertMutation = useMutation({
    mutationFn: (certId: string) => certificationsApi.delete(certId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certifications', id] });
      toast.success('הסמכה נמחקה');
    },
    onError: () => toast.error('שגיאה במחיקה'),
  });

  // Sync edit form when employee data loads or changes
  useEffect(() => {
    if (employee) {
      setEditForm({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        phone: employee.phone || '',
        email: employee.email || '',
        address: employee.address || '',
        city: employee.city || '',
        hourly_rate: employee.hourly_rate?.toString() || '',
        employment_type: employee.employment_type || 'hourly',
        has_weapon_license: !!employee.has_weapon_license,
        has_driving_license: !!employee.has_driving_license,
        driving_license_type: employee.driving_license_type || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
      });
    }
  }, [employee]);

  // --- Mutations ---

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) => employeesApi.update(id!, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('העובד עודכן בהצלחה');
      setIsEditing(false);
    },
    onError: () => toast.error('שגיאה בעדכון העובד'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: () => {
      const newStatus = employee?.status === 'active' ? 'inactive' : 'active';
      return employeesApi.update(id!, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      const newStatus = employee?.status === 'active' ? 'לא פעיל' : 'פעיל';
      toast.success(`סטטוס העובד שונה ל${newStatus}`);
    },
    onError: () => toast.error('שגיאה בשינוי סטטוס'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => employeesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('העובד נמחק בהצלחה');
      navigate('/employees');
    },
    onError: () => toast.error('שגיאה במחיקת העובד'),
  });

  const addDocumentMutation = useMutation({
    mutationFn: (docData: Record<string, unknown>) => employeesApi.addDocument(id!, docData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      toast.success('מסמך נוסף בהצלחה');
      setShowDocumentForm(false);
      setDocumentForm({ document_type: 'id_card', expiry_date: '' });
    },
    onError: () => toast.error('שגיאה בהוספת מסמך'),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (docId: string) => employeesApi.deleteDocument(id!, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      toast.success('מסמך נמחק בהצלחה');
    },
    onError: () => toast.error('שגיאה במחיקת מסמך'),
  });

  // --- Handlers ---

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      ...editForm,
      hourly_rate: editForm.hourly_rate ? Number(editForm.hourly_rate) : null,
    };
    updateMutation.mutate(payload);
  };

  const handleCancelEdit = () => {
    if (employee) {
      setEditForm({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        phone: employee.phone || '',
        email: employee.email || '',
        address: employee.address || '',
        city: employee.city || '',
        hourly_rate: employee.hourly_rate?.toString() || '',
        employment_type: employee.employment_type || 'hourly',
        has_weapon_license: !!employee.has_weapon_license,
        has_driving_license: !!employee.has_driving_license,
        driving_license_type: employee.driving_license_type || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
      });
    }
    setIsEditing(false);
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    addDocumentMutation.mutate({
      document_type: documentForm.document_type,
      expiry_date: documentForm.expiry_date || null,
    });
  };

  // --- Loading state ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/employees')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה לעובדים
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
            <UserCircle className="w-12 h-12 text-gray-400" />
          </div>
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="input text-xl font-bold w-40"
                  placeholder="שם פרטי"
                />
                <input
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="input text-xl font-bold w-40"
                  placeholder="שם משפחה"
                />
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">
                {employee?.first_name} {employee?.last_name}
              </h1>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className={`badge ${employee?.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                {employee?.status === 'active' ? 'פעיל' : 'לא פעיל'}
              </span>
              {employee?.has_weapon_license && (
                <span className="badge badge-info flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  רישיון נשק
                </span>
              )}
              {employee?.has_driving_license && (
                <span className="badge badge-gray flex items-center gap-1">
                  <Car className="w-3 h-3" />
                  רישיון {employee.driving_license_type}
                </span>
              )}
            </div>
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
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary text-sm flex items-center gap-1 px-3 py-2"
              >
                <Edit3 className="w-4 h-4" />
                עריכה
              </button>
              <button
                onClick={() => toggleStatusMutation.mutate()}
                disabled={toggleStatusMutation.isPending}
                className="btn-secondary text-sm flex items-center gap-1 px-3 py-2"
                title={employee?.status === 'active' ? 'העבר ללא פעיל' : 'הפעל עובד'}
              >
                {employee?.status === 'active' ? (
                  <ToggleRight className="w-4 h-4 text-green-600" />
                ) : (
                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                )}
                {toggleStatusMutation.isPending
                  ? 'מעדכן...'
                  : employee?.status === 'active'
                  ? 'השבת'
                  : 'הפעל'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-danger text-sm flex items-center gap-1 px-3 py-2"
              >
                <Trash2 className="w-4 h-4" />
                מחק עובד
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">מחיקת עובד</h3>
                <p className="text-sm text-gray-500">פעולה זו אינה ניתנת לביטול</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              האם אתה בטוח שברצונך למחוק את העובד{' '}
              <strong>{employee?.first_name} {employee?.last_name}</strong>?
              כל הנתונים הקשורים לעובד זה יימחקו לצמיתות.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary px-4 py-2"
              >
                ביטול
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="btn-danger px-4 py-2"
              >
                {deleteMutation.isPending ? 'מוחק...' : 'מחק עובד'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          {[
            { id: 'info' as const, label: 'מידע כללי', icon: UserCircle },
            { id: 'certifications' as const, label: 'הסמכות', icon: Award },
            { id: 'weapons' as const, label: 'נשק', icon: Crosshair },
            { id: 'equipment' as const, label: 'ציוד', icon: Package },
            { id: 'performance' as const, label: 'ביצועים', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Certifications Tab */}
      {activeTab === 'certifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">הסמכות ורישיונות</h2>
            <button onClick={() => setShowCertForm(!showCertForm)} className="btn-primary text-sm flex items-center gap-1">
              {showCertForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showCertForm ? 'ביטול' : 'הוסף הסמכה'}
            </button>
          </div>

          {showCertForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCertMutation.mutate({ ...certForm, employee_id: id });
              }}
              className="card space-y-3"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">סוג הסמכה *</label>
                  <select value={certForm.cert_type} onChange={(e) => setCertForm({ ...certForm, cert_type: e.target.value })} className="input">
                    <option value="firearm_license">רישיון נשק</option>
                    <option value="security_officer">קצין ביטחון</option>
                    <option value="first_aid">עזרה ראשונה</option>
                    <option value="fire_safety">בטיחות אש</option>
                    <option value="driving_license">רישיון נהיגה</option>
                    <option value="guard_license">רישיון שמירה</option>
                    <option value="other">אחר</option>
                  </select>
                </div>
                <div>
                  <label className="label">שם ההסמכה *</label>
                  <input value={certForm.cert_name} onChange={(e) => setCertForm({ ...certForm, cert_name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="label">מספר תעודה</label>
                  <input value={certForm.cert_number} onChange={(e) => setCertForm({ ...certForm, cert_number: e.target.value })} className="input" dir="ltr" />
                </div>
                <div>
                  <label className="label">גוף מנפיק</label>
                  <input value={certForm.issuing_authority} onChange={(e) => setCertForm({ ...certForm, issuing_authority: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">תאריך הנפקה</label>
                  <input type="date" value={certForm.issue_date} onChange={(e) => setCertForm({ ...certForm, issue_date: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">תאריך תפוגה</label>
                  <input type="date" value={certForm.expiry_date} onChange={(e) => setCertForm({ ...certForm, expiry_date: e.target.value })} className="input" />
                </div>
              </div>
              <button type="submit" disabled={createCertMutation.isPending} className="btn-primary text-sm">
                {createCertMutation.isPending ? 'שומר...' : 'שמור הסמכה'}
              </button>
            </form>
          )}

          {certsData?.certifications?.length > 0 ? (
            <div className="space-y-2">
              {certsData.certifications.map((cert: {
                id: string; cert_type: string; cert_name: string; cert_number?: string;
                issuing_authority?: string; expiry_date?: string; expiry_status?: string;
              }) => {
                const expiryColor = cert.expiry_status === 'expired' ? 'bg-red-100 border-red-300 text-red-800'
                  : cert.expiry_status === 'expiring_soon' ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                  : cert.expiry_status === 'expiring' ? 'bg-orange-50 border-orange-200 text-orange-700'
                  : 'bg-green-50 border-green-200 text-green-800';
                const expiryLabel: Record<string, string> = {
                  expired: 'פג תוקף',
                  expiring_soon: 'פג בקרוב (<30 יום)',
                  expiring: 'פג ב-60 יום',
                  valid: 'בתוקף',
                  no_expiry: 'ללא תפוגה',
                };

                return (
                  <div key={cert.id} className={`p-3 rounded-lg border ${expiryColor}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{cert.cert_name}</p>
                        <p className="text-sm opacity-80">
                          {cert.cert_number && `מס׳ ${cert.cert_number} | `}
                          {cert.issuing_authority || ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{expiryLabel[cert.expiry_status || 'valid']}</span>
                        {cert.expiry_date && <span className="text-xs opacity-70">{cert.expiry_date}</span>}
                        <button onClick={() => deleteCertMutation.mutate(cert.id)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">אין הסמכות רשומות</p>
          )}
        </div>
      )}

      {/* Weapons Tab */}
      {activeTab === 'weapons' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">נשק מוקצה</h2>
          {weaponsData?.weapons?.length > 0 ? (
            <div className="space-y-2">
              {weaponsData.weapons.map((w: {
                id: string; weapon_type: string; manufacturer?: string; model?: string;
                serial_number: string; license_number?: string; license_expiry?: string;
                status: string; assigned_date?: string;
              }) => (
                <div key={w.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Crosshair className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium">{w.weapon_type} {w.manufacturer && `- ${w.manufacturer}`} {w.model || ''}</p>
                        <p className="text-sm text-gray-500">מס״ס: {w.serial_number}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className={`badge ${w.status === 'assigned' ? 'badge-success' : w.status === 'maintenance' ? 'badge-warning' : 'badge-gray'}`}>
                        {w.status === 'assigned' ? 'מוקצה' : w.status === 'maintenance' ? 'בתחזוקה' : 'במחסן'}
                      </span>
                      {w.license_expiry && (
                        <p className="text-xs text-gray-500 mt-1">רישיון: {w.license_expiry}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">אין נשק מוקצה</p>
          )}
        </div>
      )}

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">ציוד מוקצה</h2>
          {equipData?.equipment?.length > 0 ? (
            <div className="space-y-2">
              {equipData.equipment.map((e: {
                id: string; item_type: string; item_name: string; serial_number?: string;
                condition: string; assigned_date?: string; notes?: string;
              }) => {
                const condLabel: Record<string, string> = { new: 'חדש', good: 'תקין', fair: 'סביר', needs_repair: 'דורש תיקון', damaged: 'פגום' };
                return (
                  <div key={e.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{e.item_name}</p>
                          <p className="text-sm text-gray-500">
                            {e.item_type}
                            {e.serial_number && ` | מס"ס: ${e.serial_number}`}
                          </p>
                          {e.assigned_date && (
                            <p className="text-xs text-gray-400">מאז: {e.assigned_date}</p>
                          )}
                        </div>
                      </div>
                      <span className={`badge ${
                        e.condition === 'good' || e.condition === 'new' ? 'badge-success' :
                        e.condition === 'fair' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {condLabel[e.condition] || e.condition}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">אין ציוד מוקצה</p>
          )}
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">ביצועים</h2>
            <button onClick={() => setShowRatingModal(true)} className="btn-primary text-sm flex items-center gap-1">
              <Star className="w-4 h-4" />
              דרג מאבטח
            </button>
          </div>

          {perfData && (() => {
            const avgRating = perfData.ratings?.avg_rating || 0;
            const totalRatings = perfData.ratings?.total_ratings || 0;
            const attendanceRate = perfData.attendance?.rate || 0;
            return (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <p className="text-2xl font-bold">{Number(avgRating).toFixed(1)}</p>
                  <p className="text-xs text-gray-500">דירוג ממוצע ({totalRatings} דירוגים)</p>
                </div>
                <div className="card text-center">
                  <p className="text-2xl font-bold text-green-600">{attendanceRate}%</p>
                  <p className="text-xs text-gray-500">נוכחות</p>
                </div>
                <div className="card text-center">
                  <p className="text-2xl font-bold text-blue-600">{perfData.total_hours || 0}</p>
                  <p className="text-xs text-gray-500">שעות (3 חודשים)</p>
                </div>
                <div className="card text-center">
                  <p className="text-2xl font-bold text-purple-600">{perfData.shifts_this_month || 0}</p>
                  <p className="text-xs text-gray-500">משמרות החודש</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card">
                  <h3 className="font-medium mb-2">סטטיסטיקות</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">אירועי אבטחה דווחו</dt>
                      <dd className="font-medium">{perfData.incidents_reported || 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">סיורים שהושלמו</dt>
                      <dd className="font-medium">{perfData.total_patrols || 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">משמרות הגיע</dt>
                      <dd className="font-medium">{perfData.attendance?.checked_in || 0}/{perfData.attendance?.total_assignments || 0}</dd>
                    </div>
                  </dl>
                </div>

                {perfData.recent_ratings?.length > 0 && (
                  <div className="card">
                    <h3 className="font-medium mb-2">דירוגים אחרונים</h3>
                    <div className="space-y-2">
                      {perfData.recent_ratings.slice(0, 5).map((r: { id: string; rating: number; rating_type: string; comments?: string; created_at: string }) => (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                            ))}
                            <span className="text-xs text-gray-500 mr-2">
                              {r.rating_type === 'manager_review' ? 'מנהל' : r.rating_type === 'customer_feedback' ? 'לקוח' : 'אירוע'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('he-IL')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
            );
          })()}
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && employee && (
        <GuardRatingModal
          employeeId={id!}
          employeeName={`${employee.first_name} ${employee.last_name}`}
          onClose={() => setShowRatingModal(false)}
        />
      )}

      {/* Main content - Info Tab */}
      {activeTab === 'info' && (
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
                    placeholder="050-0000000"
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
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="label">כתובת</label>
                  <input
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="input"
                    placeholder="רחוב ומספר"
                  />
                </div>
                <div>
                  <label className="label">עיר</label>
                  <input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="input"
                    placeholder="עיר"
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
                      <a href={`tel:${employee?.phone}`} className="text-primary-600 font-medium">
                        {employee?.phone}
                      </a>
                      {employee?.phone && (
                        <WhatsAppButton phone={employee.phone} name={`${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'עובד'} size="sm" />
                      )}
                    </div>
                  </div>
                </div>
                {employee?.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">אימייל</p>
                      <a href={`mailto:${employee.email}`} className="text-primary-600 font-medium">
                        {employee.email}
                      </a>
                    </div>
                  </div>
                )}
                {employee?.address && (
                  <div className="flex items-center gap-3 col-span-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">כתובת</p>
                      <p className="font-medium">{employee.address}, {employee.city}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Employment details (editable) */}
          {isEditing && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">פרטי העסקה - עריכה</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">סוג העסקה</label>
                  <select
                    value={editForm.employment_type}
                    onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value })}
                    className="input"
                  >
                    {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">שכר שעתי (₪)</label>
                  <input
                    type="number"
                    value={editForm.hourly_rate}
                    onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                    className="input"
                    dir="ltr"
                    placeholder="0"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.has_weapon_license}
                      onChange={(e) => setEditForm({ ...editForm, has_weapon_license: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span>רישיון נשק</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.has_driving_license}
                      onChange={(e) => setEditForm({ ...editForm, has_driving_license: e.target.checked })}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span>רישיון נהיגה</span>
                  </label>
                  {editForm.has_driving_license && (
                    <select
                      value={editForm.driving_license_type}
                      onChange={(e) => setEditForm({ ...editForm, driving_license_type: e.target.value })}
                      className="input w-auto"
                    >
                      <option value="">סוג רישיון</option>
                      {DRIVING_LICENSE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Emergency contact (editable) */}
          {isEditing && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">איש קשר לחירום - עריכה</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">שם איש קשר</label>
                  <input
                    value={editForm.emergency_contact_name}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
                    className="input"
                    placeholder="שם מלא"
                  />
                </div>
                <div>
                  <label className="label">טלפון חירום</label>
                  <input
                    value={editForm.emergency_contact_phone}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })}
                    className="input"
                    dir="ltr"
                    placeholder="050-0000000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Recent shifts */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">משמרות אחרונות</h2>
            {data?.recentShifts?.length > 0 ? (
              <div className="space-y-2">
                {data.recentShifts.slice(0, 10).map((shift: {
                  id: string;
                  date: string;
                  start_time: string;
                  end_time: string;
                  company_name: string;
                  site_name: string;
                  actual_hours: number;
                }) => (
                  <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{shift.company_name} - {shift.site_name}</p>
                      <p className="text-sm text-gray-500">{shift.date} | {shift.start_time} - {shift.end_time}</p>
                    </div>
                    {shift.actual_hours && (
                      <span className="text-sm text-gray-500">{shift.actual_hours} שעות</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין משמרות</p>
            )}
          </div>

          {/* Documents */}
          {id && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">מסמכים</h2>
              <DocumentManager entityType="employee" entityId={id} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Employment details (view mode) */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטי העסקה</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">ת.ז</dt>
                <dd className="font-medium">{employee?.id_number}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">תאריך התחלה</dt>
                <dd className="font-medium">{employee?.hire_date}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">סוג העסקה</dt>
                <dd className="font-medium">
                  {employee?.employment_type === 'hourly' ? 'שעתי' :
                   employee?.employment_type === 'monthly' ? 'חודשי' : 'קבלן'}
                </dd>
              </div>
              {employee?.hourly_rate && (
                <div>
                  <dt className="text-sm text-gray-500">שכר שעתי</dt>
                  <dd className="font-medium">₪{employee.hourly_rate}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Documents */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">מסמכים</h2>
              <button
                onClick={() => setShowDocumentForm(!showDocumentForm)}
                className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5"
              >
                {showDocumentForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showDocumentForm ? 'ביטול' : 'הוסף מסמך'}
              </button>
            </div>

            {showDocumentForm && (
              <form onSubmit={handleAddDocument} className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
                <div>
                  <label className="label">סוג מסמך *</label>
                  <select
                    value={documentForm.document_type}
                    onChange={(e) => setDocumentForm({ ...documentForm, document_type: e.target.value })}
                    className="input"
                    required
                  >
                    {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">תאריך תפוגה</label>
                  <input
                    type="date"
                    value={documentForm.expiry_date}
                    onChange={(e) => setDocumentForm({ ...documentForm, expiry_date: e.target.value })}
                    className="input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addDocumentMutation.isPending || !documentForm.document_type}
                  className="btn-primary text-sm"
                >
                  {addDocumentMutation.isPending ? 'שומר...' : 'שמור מסמך'}
                </button>
              </form>
            )}

            {data?.documents?.length > 0 ? (
              <div className="space-y-2">
                {data.documents.map((doc: {
                  id: string;
                  document_type: string;
                  expiry_date: string;
                }) => (
                  <div key={doc.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span>{DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.expiry_date && (
                        <span className="text-gray-500">{doc.expiry_date}</span>
                      )}
                      <button
                        onClick={() => { if (confirm('למחוק מסמך זה?')) deleteDocumentMutation.mutate(doc.id); }}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="מחק מסמך"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center">אין מסמכים</p>
            )}
          </div>

          {/* Emergency contact (view mode) */}
          {!isEditing && employee?.emergency_contact_name && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">איש קשר לחירום</h2>
              <p className="font-medium">{employee.emergency_contact_name}</p>
              <a href={`tel:${employee.emergency_contact_phone}`} className="text-primary-600 text-sm">
                {employee.emergency_contact_phone}
              </a>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
