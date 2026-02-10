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
  Plus,
  ToggleLeft,
  ToggleRight,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { employeesApi } from '../services/api';

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
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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

      {/* Main content */}
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
                    <a href={`tel:${employee?.phone}`} className="text-primary-600 font-medium">
                      {employee?.phone}
                    </a>
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
                    {doc.expiry_date && (
                      <span className="text-gray-500">{doc.expiry_date}</span>
                    )}
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
    </div>
  );
}
