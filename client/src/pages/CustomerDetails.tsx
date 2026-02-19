import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
  Plus,
  X,
  Edit3,
  Save,
  Trash2,
  AlertTriangle,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { customersApi } from '../services/api';
import WhatsAppButton from '../components/WhatsAppButton';
import ActivityLog from '../components/ActivityLog';
import EmailComposeModal from '../components/EmailComposeModal';
import DocumentManager from '../components/DocumentManager';

const SERVICE_TYPE_OPTIONS = [
  { value: 'regular', label: 'שמירה רגילה' },
  { value: 'event', label: 'אירועים' },
  { value: 'both', label: 'שניהם' },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: 'net30', label: 'שוטף + 30' },
  { value: 'net60', label: 'שוטף + 60' },
  { value: 'net90', label: 'שוטף + 90' },
  { value: 'immediate', label: 'מיידי' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'פעיל' },
  { value: 'inactive', label: 'לא פעיל' },
  { value: 'suspended', label: 'מושהה' },
];

interface EditForm {
  company_name: string;
  business_id: string;
  address: string;
  city: string;
  service_type: string;
  payment_terms: string;
  status: string;
  notes: string;
}

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [showContractForm, setShowContractForm] = useState(false);

  const [editForm, setEditForm] = useState<EditForm>({
    company_name: '',
    business_id: '',
    address: '',
    city: '',
    service_type: '',
    payment_terms: '',
    status: 'active',
    notes: '',
  });

  const [siteForm, setSiteForm] = useState({ name: '', address: '', city: '', requirements: '', requires_weapon: false, notes: '' });
  const [contactForm, setContactForm] = useState({ name: '', role: '', phone: '', email: '', is_primary: false });
  const [contractForm, setContractForm] = useState({ start_date: '', end_date: '', monthly_value: '', terms: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  const customer = data?.customer;

  // Sync edit form when customer data loads or changes
  useEffect(() => {
    if (customer) {
      setEditForm({
        company_name: customer.company_name || '',
        business_id: customer.business_id || '',
        address: customer.address || '',
        city: customer.city || '',
        service_type: customer.service_type || '',
        payment_terms: customer.payment_terms || '',
        status: customer.status || 'active',
        notes: customer.notes || '',
      });
    }
  }, [customer]);

  // --- Mutations ---

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) => customersApi.update(id!, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('הלקוח עודכן בהצלחה');
      setIsEditing(false);
    },
    onError: () => toast.error('שגיאה בעדכון הלקוח'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => customersApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('הלקוח נמחק בהצלחה');
      navigate('/customers');
    },
    onError: () => toast.error('שגיאה במחיקת הלקוח'),
  });

  const addSiteMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => customersApi.addSite(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('אתר נוסף בהצלחה');
      setShowSiteForm(false);
      setSiteForm({ name: '', address: '', city: '', requirements: '', requires_weapon: false, notes: '' });
    },
    onError: () => toast.error('שגיאה בהוספת אתר'),
  });

  const addContactMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => customersApi.addContact(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('איש קשר נוסף בהצלחה');
      setShowContactForm(false);
      setContactForm({ name: '', role: '', phone: '', email: '', is_primary: false });
    },
    onError: () => toast.error('שגיאה בהוספת איש קשר'),
  });

  const addContractMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => customersApi.addContract(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('חוזה נוסף בהצלחה');
      setShowContractForm(false);
      setContractForm({ start_date: '', end_date: '', monthly_value: '', terms: '' });
    },
    onError: () => toast.error('שגיאה בהוספת חוזה'),
  });

  // --- Handlers ---

  const handleSave = () => {
    if (!editForm.company_name.trim()) {
      toast.error('שם חברה הוא שדה חובה');
      return;
    }
    updateMutation.mutate(editForm as unknown as Record<string, unknown>);
  };

  const handleCancelEdit = () => {
    if (customer) {
      setEditForm({
        company_name: customer.company_name || '',
        business_id: customer.business_id || '',
        address: customer.address || '',
        city: customer.city || '',
        service_type: customer.service_type || '',
        payment_terms: customer.payment_terms || '',
        status: customer.status || 'active',
        notes: customer.notes || '',
      });
    }
    setIsEditing(false);
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
        onClick={() => navigate('/customers')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה ללקוחות
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-50 rounded-xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="label">שם חברה *</label>
                  <input
                    value={editForm.company_name}
                    onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                    className="input text-2xl font-bold font-heading"
                    placeholder="שם חברה"
                  />
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 font-heading">{customer?.company_name}</h1>
                {customer?.city && (
                  <p className="text-gray-500 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {customer.city}
                  </p>
                )}
              </>
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
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary text-sm flex items-center gap-1 px-3 py-2"
              >
                <Edit3 className="w-4 h-4" />
                עריכה
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-danger text-sm flex items-center gap-1 px-3 py-2"
              >
                <Trash2 className="w-4 h-4" />
                מחק לקוח
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 font-heading">מחיקת לקוח</h3>
                <p className="text-sm text-gray-500">פעולה זו אינה ניתנת לביטול</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              האם אתה בטוח שברצונך למחוק את הלקוח{' '}
              <strong>{customer?.company_name}</strong>?
              כל הנתונים הקשורים ללקוח זה יימחקו לצמיתות.
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
                {deleteMutation.isPending ? 'מוחק...' : 'מחק לקוח'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Contacts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-heading">אנשי קשר</h2>
              <button onClick={() => setShowContactForm(!showContactForm)} className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5">
                {showContactForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showContactForm ? 'ביטול' : 'הוסף'}
              </button>
            </div>
            {showContactForm && (
              <form onSubmit={(e) => { e.preventDefault(); addContactMutation.mutate(contactForm); }} className="mb-4 p-4 bg-blue-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">שם *</label>
                    <input value={contactForm.name} onChange={(e) => setContactForm({...contactForm, name: e.target.value})} className="input" required />
                  </div>
                  <div>
                    <label className="label">תפקיד</label>
                    <input value={contactForm.role} onChange={(e) => setContactForm({...contactForm, role: e.target.value})} className="input" />
                  </div>
                  <div>
                    <label className="label">טלפון</label>
                    <input value={contactForm.phone} onChange={(e) => setContactForm({...contactForm, phone: e.target.value})} className="input" dir="ltr" />
                  </div>
                  <div>
                    <label className="label">אימייל</label>
                    <input value={contactForm.email} onChange={(e) => setContactForm({...contactForm, email: e.target.value})} className="input" dir="ltr" type="email" />
                  </div>
                </div>
                <button type="submit" disabled={addContactMutation.isPending || !contactForm.name} className="btn-primary text-sm">
                  {addContactMutation.isPending ? 'שומר...' : 'שמור איש קשר'}
                </button>
              </form>
            )}
            {data?.contacts?.length > 0 ? (
              <div className="space-y-3">
                {data.contacts.map((contact: {
                  id: string;
                  name: string;
                  role: string;
                  phone: string;
                  email: string;
                  is_primary: boolean;
                }) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-gray-500">{contact.role}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {contact.phone && (
                        <div className="flex items-center gap-1">
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-primary-600">
                            <Phone className="w-4 h-4" />
                            {contact.phone}
                          </a>
                          <WhatsAppButton phone={contact.phone} name={contact.name} size="sm" />
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1">
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary-600">
                            <Mail className="w-4 h-4" />
                            {contact.email}
                          </a>
                          <button
                            onClick={() => { setEmailTo(contact.email); setShowEmailModal(true); }}
                            className="text-blue-500 hover:text-blue-700 p-0.5 rounded hover:bg-blue-50 transition-colors"
                            title="שלח אימייל"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין אנשי קשר</p>
            )}
          </div>

          {/* Sites */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-heading">אתרים</h2>
              <button onClick={() => setShowSiteForm(!showSiteForm)} className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5">
                {showSiteForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showSiteForm ? 'ביטול' : 'הוסף אתר'}
              </button>
            </div>
            {showSiteForm && (
              <form onSubmit={(e) => { e.preventDefault(); addSiteMutation.mutate(siteForm); }} className="mb-4 p-4 bg-green-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">שם אתר *</label>
                    <input value={siteForm.name} onChange={(e) => setSiteForm({...siteForm, name: e.target.value})} className="input" required />
                  </div>
                  <div>
                    <label className="label">כתובת *</label>
                    <input value={siteForm.address} onChange={(e) => setSiteForm({...siteForm, address: e.target.value})} className="input" required />
                  </div>
                  <div>
                    <label className="label">עיר</label>
                    <input value={siteForm.city} onChange={(e) => setSiteForm({...siteForm, city: e.target.value})} className="input" />
                  </div>
                  <div>
                    <label className="label">דרישות מיוחדות</label>
                    <input value={siteForm.requirements} onChange={(e) => setSiteForm({...siteForm, requirements: e.target.value})} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">הערות</label>
                    <textarea value={siteForm.notes} onChange={(e) => setSiteForm({...siteForm, notes: e.target.value})} className="input" rows={2} />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={siteForm.requires_weapon} onChange={(e) => setSiteForm({...siteForm, requires_weapon: e.target.checked})} className="w-4 h-4 text-primary-600 rounded" />
                      <span>דורש נשק</span>
                    </label>
                  </div>
                </div>
                <button type="submit" disabled={addSiteMutation.isPending || !siteForm.name || !siteForm.address} className="btn-primary text-sm">
                  {addSiteMutation.isPending ? 'שומר...' : 'שמור אתר'}
                </button>
              </form>
            )}
            {data?.sites?.length > 0 ? (
              <div className="space-y-3">
                {data.sites.map((site: {
                  id: string;
                  name: string;
                  address: string;
                  requires_weapon: boolean;
                }) => (
                  <div key={site.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{site.name}</p>
                        <p className="text-sm text-gray-500">{site.address}</p>
                      </div>
                      {site.requires_weapon && (
                        <span className="badge badge-warning">דורש נשק</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין אתרים</p>
            )}
          </div>

          {/* Contracts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-heading">חוזים</h2>
              <button onClick={() => setShowContractForm(!showContractForm)} className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5">
                {showContractForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showContractForm ? 'ביטול' : 'הוסף חוזה'}
              </button>
            </div>
            {showContractForm && (
              <form onSubmit={(e) => { e.preventDefault(); addContractMutation.mutate({...contractForm, monthly_value: Number(contractForm.monthly_value)}); }} className="mb-4 p-4 bg-yellow-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">תאריך התחלה *</label>
                    <input type="date" value={contractForm.start_date} onChange={(e) => setContractForm({...contractForm, start_date: e.target.value})} className="input" required />
                  </div>
                  <div>
                    <label className="label">תאריך סיום</label>
                    <input type="date" value={contractForm.end_date} onChange={(e) => setContractForm({...contractForm, end_date: e.target.value})} className="input" />
                  </div>
                  <div>
                    <label className="label">ערך חודשי (₪)</label>
                    <input type="number" value={contractForm.monthly_value} onChange={(e) => setContractForm({...contractForm, monthly_value: e.target.value})} className="input" dir="ltr" />
                  </div>
                  <div>
                    <label className="label">תנאים</label>
                    <input value={contractForm.terms} onChange={(e) => setContractForm({...contractForm, terms: e.target.value})} className="input" />
                  </div>
                </div>
                <button type="submit" disabled={addContractMutation.isPending || !contractForm.start_date} className="btn-primary text-sm">
                  {addContractMutation.isPending ? 'שומר...' : 'שמור חוזה'}
                </button>
              </form>
            )}
            {data?.contracts?.length > 0 ? (
              <div className="space-y-3">
                {data.contracts.map((contract: {
                  id: string;
                  start_date: string;
                  end_date: string;
                  monthly_value: number;
                  status: string;
                }) => (
                  <div key={contract.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            {contract.start_date} - {contract.end_date || 'ללא הגבלה'}
                          </p>
                          <p className="text-sm text-gray-500">
                            ₪{contract.monthly_value?.toLocaleString()}/חודש
                          </p>
                        </div>
                      </div>
                      <span className={`badge ${contract.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                        {contract.status === 'active' ? 'פעיל' : contract.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין חוזים</p>
            )}
          </div>

          {/* Documents */}
          {id && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 font-heading">מסמכים</h2>
              <DocumentManager entityType="customer" entityId={id} />
            </div>
          )}

          {/* Activity Log */}
          {id && <ActivityLog entityType="customer" entityId={id} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 font-heading">פרטים</h2>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="label">ח.פ</label>
                  <input
                    value={editForm.business_id}
                    onChange={(e) => setEditForm({ ...editForm, business_id: e.target.value })}
                    className="input"
                    dir="ltr"
                    placeholder="מספר ח.פ"
                  />
                </div>
                <div>
                  <label className="label">כתובת</label>
                  <input
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="input"
                    placeholder="כתובת"
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
                <div>
                  <label className="label">סוג שירות</label>
                  <select
                    value={editForm.service_type}
                    onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })}
                    className="input"
                  >
                    <option value="">בחר סוג שירות</option>
                    {SERVICE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">תנאי תשלום</label>
                  <select
                    value={editForm.payment_terms}
                    onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
                    className="input"
                  >
                    <option value="">בחר תנאי תשלום</option>
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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
                <div>
                  <label className="label">הערות</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="input"
                    rows={3}
                    placeholder="הערות..."
                  />
                </div>
              </div>
            ) : (
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-500">ח.פ</dt>
                  <dd className="font-medium">{customer?.business_id || '-'}</dd>
                </div>
                {customer?.address && (
                  <div>
                    <dt className="text-sm text-gray-500">כתובת</dt>
                    <dd className="font-medium">{customer.address}{customer.city ? `, ${customer.city}` : ''}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-gray-500">סוג שירות</dt>
                  <dd className="font-medium">
                    {SERVICE_TYPE_OPTIONS.find((o) => o.value === customer?.service_type)?.label || customer?.service_type || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">תנאי תשלום</dt>
                  <dd className="font-medium">
                    {PAYMENT_TERMS_OPTIONS.find((o) => o.value === customer?.payment_terms)?.label || customer?.payment_terms || '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">סטטוס</dt>
                  <dd>
                    <span className={`badge ${customer?.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                      {STATUS_OPTIONS.find((o) => o.value === customer?.status)?.label || customer?.status}
                    </span>
                  </dd>
                </div>
                {customer?.notes && (
                  <div>
                    <dt className="text-sm text-gray-500">הערות</dt>
                    <dd className="font-medium text-sm whitespace-pre-wrap">{customer.notes}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Recent invoices */}
          {data?.invoices?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 font-heading">חשבוניות אחרונות</h2>
              <div className="space-y-2">
                {data.invoices.slice(0, 5).map((invoice: {
                  id: string;
                  invoice_number: string;
                  total_amount: number;
                  status: string;
                }) => (
                  <div key={invoice.id} className="flex items-center justify-between text-sm">
                    <span>#{invoice.invoice_number}</span>
                    <span className={invoice.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}>
                      ₪{invoice.total_amount?.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Compose Modal */}
      <EmailComposeModal
        isOpen={showEmailModal}
        onClose={() => { setShowEmailModal(false); setEmailTo(''); }}
        defaultTo={emailTo}
        defaultName={customer?.company_name || ''}
        entityType="customer"
        entityId={id}
      />
    </div>
  );
}
