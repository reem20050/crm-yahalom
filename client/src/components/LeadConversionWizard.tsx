import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X, ChevronLeft, ChevronRight, ArrowLeftRight, Loader2, Check } from 'lucide-react';
import { leadsApi } from '../services/api';

interface LeadData {
  id: string;
  company_name?: string;
  contact_name: string;
  phone: string;
  email?: string;
  service_type?: string;
  description?: string;
  location?: string;
  expected_value?: number;
}

interface LeadConversionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadData;
  onSuccess?: (customerId: string) => void;
}

interface CustomerForm {
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  service_type: string;
  notes: string;
}

interface ContractForm {
  monthly_value: number | '';
  start_date: string;
  end_date: string;
  terms: string;
  auto_renewal: boolean;
}

interface SiteForm {
  name: string;
  address: string;
  city: string;
  type: string;
  contact_name: string;
  contact_phone: string;
  requirements: string;
  notes: string;
}

const stepLabels = ['פרטי לקוח', 'פרטי חוזה', 'פרטי אתר'];

const siteTypeOptions = [
  { value: 'office', label: 'משרד' },
  { value: 'warehouse', label: 'מחסן' },
  { value: 'residential', label: 'מגורים' },
  { value: 'commercial', label: 'מסחרי' },
  { value: 'industrial', label: 'תעשייתי' },
  { value: 'other', label: 'אחר' },
];

const serviceTypeOptions = [
  { value: 'regular', label: 'אבטחה קבועה' },
  { value: 'event', label: 'אירוע חד-פעמי' },
  { value: 'both', label: 'שניהם' },
];

export default function LeadConversionWizard({ isOpen, onClose, lead, onSuccess }: LeadConversionWizardProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [includeContract, setIncludeContract] = useState(false);
  const [includeSite, setIncludeSite] = useState(false);

  const [customerForm, setCustomerForm] = useState<CustomerForm>({
    company_name: lead.company_name || '',
    contact_name: lead.contact_name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    address: '',
    city: '',
    service_type: lead.service_type || '',
    notes: lead.description || '',
  });

  const [contractForm, setContractForm] = useState<ContractForm>({
    monthly_value: lead.expected_value || '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    terms: 'שוטף + 30',
    auto_renewal: true,
  });

  const [siteForm, setSiteForm] = useState<SiteForm>({
    name: (lead.company_name || lead.contact_name) + ' - ראשי',
    address: lead.location || '',
    city: '',
    type: 'office',
    contact_name: lead.contact_name || '',
    contact_phone: lead.phone || '',
    requirements: '',
    notes: '',
  });

  const convertMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        customer: customerForm,
      };
      if (includeContract && contractForm.monthly_value) {
        payload.contract = contractForm;
      }
      if (includeSite && siteForm.name) {
        payload.site = siteForm;
      }
      return leadsApi.convert(lead.id, payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('ליד הומר ללקוח בהצלחה!');
      onClose();
      if (onSuccess && res.data?.customer?.id) {
        onSuccess(res.data.customer.id);
      }
    },
    onError: () => {
      toast.error('שגיאה בהמרת הליד');
    },
  });

  const handleNext = () => {
    if (step === 1) {
      if (!customerForm.contact_name.trim()) {
        toast.error('שם איש קשר הוא שדה חובה');
        return;
      }
      if (!customerForm.phone.trim()) {
        toast.error('מספר טלפון הוא שדה חובה');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = () => {
    convertMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold font-heading text-gray-900">המרת ליד ללקוח</h2>
          <button
            onClick={onClose}
            className="btn-icon"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-4 p-4 border-b border-gray-100 bg-gray-50/50">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center gap-2 cursor-pointer ${
                step >= s ? 'text-primary-600' : 'text-gray-400'
              }`}
              onClick={() => {
                if (s < step) setStep(s);
              }}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold font-heading transition-all duration-200 ${
                  step === s
                    ? 'bg-gradient-to-br from-primary-500 to-primary-700 text-white ring-4 ring-primary-100 shadow-md'
                    : step > s
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-sm'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className="text-sm font-medium hidden sm:block">
                {stepLabels[s - 1]}
              </span>
              {s < 3 && (
                <div className={`w-8 h-0.5 hidden sm:block transition-colors ${step > s ? 'bg-gradient-to-l from-green-500 to-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-6">
          {/* Step 1: Customer Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold font-heading text-gray-800 mb-4">פרטי לקוח</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">שם חברה</label>
                  <input
                    value={customerForm.company_name}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, company_name: e.target.value })
                    }
                    className="input"
                    placeholder="שם החברה"
                  />
                </div>

                <div>
                  <label className="label">שם איש קשר *</label>
                  <input
                    value={customerForm.contact_name}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, contact_name: e.target.value })
                    }
                    className="input"
                    placeholder="שם מלא"
                  />
                </div>

                <div>
                  <label className="label">טלפון *</label>
                  <input
                    value={customerForm.phone}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, phone: e.target.value })
                    }
                    className="input"
                    dir="ltr"
                    placeholder="050-0000000"
                  />
                </div>

                <div>
                  <label className="label">אימייל</label>
                  <input
                    value={customerForm.email}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, email: e.target.value })
                    }
                    className="input"
                    dir="ltr"
                    type="email"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="label">סוג שירות</label>
                  <select
                    value={customerForm.service_type}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, service_type: e.target.value })
                    }
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
                  <label className="label">כתובת</label>
                  <input
                    value={customerForm.address}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, address: e.target.value })
                    }
                    className="input"
                    placeholder="כתובת"
                  />
                </div>

                <div>
                  <label className="label">עיר</label>
                  <input
                    value={customerForm.city}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, city: e.target.value })
                    }
                    className="input"
                    placeholder="עיר"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">הערות</label>
                  <textarea
                    value={customerForm.notes}
                    onChange={(e) =>
                      setCustomerForm({ ...customerForm, notes: e.target.value })
                    }
                    className="input"
                    rows={3}
                    placeholder="הערות נוספות..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contract Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold font-heading text-gray-800">פרטי חוזה</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeContract}
                    onChange={(e) => setIncludeContract(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">הוסף חוזה</span>
                </label>
              </div>

              {includeContract ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">סכום חודשי (₪) *</label>
                    <input
                      type="number"
                      value={contractForm.monthly_value}
                      onChange={(e) =>
                        setContractForm({
                          ...contractForm,
                          monthly_value: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                      className="input"
                      dir="ltr"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="label">תנאי תשלום</label>
                    <select
                      value={contractForm.terms}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, terms: e.target.value })
                      }
                      className="input"
                    >
                      <option value="שוטף + 30">שוטף + 30</option>
                      <option value="שוטף + 45">שוטף + 45</option>
                      <option value="שוטף + 60">שוטף + 60</option>
                      <option value="שוטף + 90">שוטף + 90</option>
                      <option value="מזומן">מזומן</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">תאריך התחלה</label>
                    <input
                      type="date"
                      value={contractForm.start_date}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, start_date: e.target.value })
                      }
                      className="input"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="label">תאריך סיום</label>
                    <input
                      type="date"
                      value={contractForm.end_date}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, end_date: e.target.value })
                      }
                      className="input"
                      dir="ltr"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contractForm.auto_renewal}
                        onChange={(e) =>
                          setContractForm({ ...contractForm, auto_renewal: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">חידוש אוטומטי</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-lg font-heading">ניתן להוסיף חוזה מאוחר יותר</p>
                  <p className="text-sm mt-1">סמן את התיבה למעלה כדי להוסיף פרטי חוזה</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Site Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold font-heading text-gray-800">פרטי אתר</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSite}
                    onChange={(e) => setIncludeSite(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">הוסף אתר</span>
                </label>
              </div>

              {includeSite ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="label">שם האתר *</label>
                    <input
                      value={siteForm.name}
                      onChange={(e) =>
                        setSiteForm({ ...siteForm, name: e.target.value })
                      }
                      className="input"
                      placeholder="שם האתר"
                    />
                  </div>

                  <div>
                    <label className="label">כתובת</label>
                    <input
                      value={siteForm.address}
                      onChange={(e) =>
                        setSiteForm({ ...siteForm, address: e.target.value })
                      }
                      className="input"
                      placeholder="כתובת האתר"
                    />
                  </div>

                  <div>
                    <label className="label">עיר</label>
                    <input
                      value={siteForm.city}
                      onChange={(e) =>
                        setSiteForm({ ...siteForm, city: e.target.value })
                      }
                      className="input"
                      placeholder="עיר"
                    />
                  </div>

                  <div>
                    <label className="label">סוג אתר</label>
                    <select
                      value={siteForm.type}
                      onChange={(e) =>
                        setSiteForm({ ...siteForm, type: e.target.value })
                      }
                      className="input"
                    >
                      {siteTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">איש קשר באתר</label>
                    <input
                      value={siteForm.contact_name}
                      onChange={(e) =>
                        setSiteForm({ ...siteForm, contact_name: e.target.value })
                      }
                      className="input"
                      placeholder="שם איש קשר"
                    />
                  </div>

                  <div>
                    <label className="label">טלפון איש קשר</label>
                    <input
                      value={siteForm.contact_phone}
                      onChange={(e) =>
                        setSiteForm({ ...siteForm, contact_phone: e.target.value })
                      }
                      className="input"
                      dir="ltr"
                      placeholder="050-0000000"
                    />
                  </div>

                  <div>
                    <label className="label">דרישות</label>
                    <input
                      value={siteForm.requirements}
                      onChange={(e) =>
                        setSiteForm({ ...siteForm, requirements: e.target.value })
                      }
                      className="input"
                      placeholder="דרישות מיוחדות"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="label">הערות</label>
                    <textarea
                      value={siteForm.notes}
                      onChange={(e) =>
                        setSiteForm({ ...siteForm, notes: e.target.value })
                      }
                      className="input"
                      rows={2}
                      placeholder="הערות נוספות..."
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-lg font-heading">ניתן להוסיף אתר מאוחר יותר</p>
                  <p className="text-sm mt-1">סמן את התיבה למעלה כדי להוסיף פרטי אתר</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100 bg-gray-50/50">
          <div>
            {step > 1 && (
              <button
                onClick={handlePrev}
                className="btn-ghost flex items-center gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                הקודם
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn-ghost">
              ביטול
            </button>

            {step < 3 ? (
              <button
                onClick={handleNext}
                className="btn-primary flex items-center gap-2"
              >
                הבא
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={convertMutation.isPending}
                className="btn-success flex items-center gap-2"
              >
                {convertMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ממיר...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4" />
                    המר ליד
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
