import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, MapPin, Phone, Mail, FileText, Calendar, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { customersApi } from '../services/api';

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: '', address: '', city: '', requirements: '', requires_weapon: false, notes: '' });
  const [contactForm, setContactForm] = useState({ name: '', role: '', phone: '', email: '', is_primary: false });
  const [contractForm, setContractForm] = useState({ start_date: '', end_date: '', monthly_value: '', terms: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  const customer = data?.customer;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה ללקוחות
      </button>

      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
          <Building2 className="w-8 h-8 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer?.company_name}</h1>
          {customer?.city && (
            <p className="text-gray-500 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {customer.city}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Contacts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">אנשי קשר</h2>
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
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-primary-600">
                          <Phone className="w-4 h-4" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary-600">
                          <Mail className="w-4 h-4" />
                          {contact.email}
                        </a>
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
              <h2 className="text-lg font-semibold">אתרים</h2>
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
              <h2 className="text-lg font-semibold">חוזים</h2>
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטים</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">ח.פ</dt>
                <dd className="font-medium">{customer?.business_id || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">סוג שירות</dt>
                <dd className="font-medium">{customer?.service_type || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">תנאי תשלום</dt>
                <dd className="font-medium">{customer?.payment_terms || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">סטטוס</dt>
                <dd>
                  <span className={`badge ${customer?.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                    {customer?.status === 'active' ? 'פעיל' : customer?.status}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Recent invoices */}
          {data?.invoices?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">חשבוניות אחרונות</h2>
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
    </div>
  );
}
