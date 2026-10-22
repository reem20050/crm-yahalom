import { useMemo, useState, type ReactNode } from 'react';
import { confirmDialog } from '../components/confirmDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Building2, Plus, Search, Trash2, X,
} from 'lucide-react';
import { customersApi, priorityApi } from '../services/api';
import { SkeletonPulse } from '../components/Skeleton';
import { docTypeLabel, fmtDate, shekel, type LastDoc } from '../components/PriorityCustomerDocs';
import { usePermissions } from '../hooks/usePermissions';
import { PAYMENT_TERMS } from '../utils/display';

const customerSchema = z.object({
  company_name: z.string().min(1, 'נדרש שם חברה'),
  business_id: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  service_type: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
  // Primary contact
  contact_name: z.string().min(1, 'נדרש שם איש קשר'),
  contact_phone: z.string().min(1, 'נדרש טלפון איש קשר'),
  contact_email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  contact_role: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;

// עמודות Priority (מספר, לגבות, מסמך אחרון) — הנהלה בלבד, מ-GET /priority/customer-overview (מאחורי requireManager).
// לגבות = אין ראיה לתשלום עד התדפיס האחרון (bank_through), לא "לא שילם".
interface CustomerRow {
  id: string;
  company_name: string;
  business_id: string | null;
  city: string | null;
  status: string;
  priority_customer_no: string | number | null;
}

interface OverviewRow {
  customer_id: string;
  priority_customer_no: string;
  status: { to_chase: number; paid_no_receipt: number; maybe: number; short: number } | null;
  last_doc: LastDoc | null;
}

interface Overview {
  as_of: string | null;
  bank_through: string | null;
  rows: OverviewRow[];
}

type SortKey = 'name' | 'no' | 'to_chase' | 'last_doc' | 'city' | 'status';
type LinkFilter = '' | 'linked' | 'unlinked';

const STATUS_LABELS: Record<string, string> = { active: 'פעיל', inactive: 'לא פעיל', suspended: 'מושהה' };
// כל הלקוחות בבקשה אחת: המיון והסינון בדפדפן (כ-150 לקוחות). אם יש יותר — מוצגת אזהרה.
const FETCH_LIMIT = 1000;
// בטלפון הטבלה נגללת הצידה — השם נשאר במקום (RTL: הטור הימני)
const STICKY = 'sticky right-0 z-10 shadow-[-1px_0_0_rgb(243_244_246)]';

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [debtOnly, setDebtOnly] = useState(false);
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canPriority = can('page:priority');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { all: true }],
    queryFn: () => customersApi.getAll({ limit: FETCH_LIMIT }).then((res) => res.data),
  });

  const overviewQ = useQuery({
    queryKey: ['priority', 'customer-overview'],
    queryFn: () => priorityApi.getCustomerOverview().then((r) => r.data as Overview),
    enabled: canPriority,
    retry: false,
  });
  const overviewOk = canPriority && overviewQ.isSuccess;

  const createMutation = useMutation({
    mutationFn: (data: CustomerForm) => customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('לקוח נוצר בהצלחה');
      setIsModalOpen(false);
      reset();
    },
    onError: () => {
      toast.error('שגיאה ביצירת לקוח');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
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
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      payment_terms: 'net30',
      service_type: 'regular',
    },
  });

  const customers: CustomerRow[] = useMemo(() => data?.customers || [], [data]);
  const total: number = data?.pagination?.total ?? customers.length;
  const byCustomer = useMemo(
    () => new Map((overviewQ.data?.rows || []).map((r) => [r.customer_id, r])),
    [overviewQ.data],
  );

  const rows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = customers.filter((c) => {
      const linked = !!c.priority_customer_no;
      if (statusFilter && c.status !== statusFilter) return false;
      if (canPriority && linkFilter === 'linked' && !linked) return false;
      if (canPriority && linkFilter === 'unlinked' && linked) return false;
      if (overviewOk && debtOnly && !((byCustomer.get(c.id)?.status?.to_chase ?? 0) > 0)) return false;
      if (!term) return true;
      return [c.company_name, c.business_id, c.city, canPriority ? c.priority_customer_no : null]
        .some((v) => v != null && String(v).toLowerCase().includes(term));
    });
    const value = (c: CustomerRow): string | number | null => {
      const o = byCustomer.get(c.id);
      switch (sort.key) {
        case 'no': return c.priority_customer_no ? Number(c.priority_customer_no) : null;
        case 'to_chase': return o?.status ? o.status.to_chase : null;
        case 'last_doc': return o?.last_doc?.date ?? null;
        case 'city': return c.city || null;
        case 'status': return STATUS_LABELS[c.status] || c.status || null;
        default: return c.company_name || null;
      }
    };
    // ריקים תמיד בסוף, בשני הכיוונים
    return list.sort((x, y) => {
      const a = value(x);
      const b = value(y);
      if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
      const cmp = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'he');
      return cmp * sort.dir;
    });
  }, [customers, searchTerm, statusFilter, linkFilter, debtOnly, sort, byCustomer, canPriority, overviewOk]);

  const filtered = !!(searchTerm.trim() || statusFilter || linkFilter || debtOnly);
  const clearFilters = () => { setSearchTerm(''); setStatusFilter(''); setLinkFilter(''); setDebtOnly(false); };
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key
    ? { key, dir: s.dir === 1 ? -1 : 1 }
    // סכום ותאריך — מהגדול/החדש; טקסט — א-ב
    : { key, dir: key === 'to_chase' || key === 'last_doc' ? -1 : 1 }));

  const th = (k: SortKey, children: ReactNode, className = '') => (
    <th
      className={`sortable ${className}`}
      onClick={() => sortBy(k)}
      aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sort.key === k
          ? (sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
          : <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );

  const onSubmit = (data: CustomerForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">לקוחות</h1>
          <p className="page-subtitle">ניהול לקוחות וחוזים</p>
        </div>
        {can('customers:create') && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            לקוח חדש
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={canPriority ? 'חיפוש לפי שם, ח.פ., עיר או מספר Priority...' : 'חיפוש לקוחות...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pr-11"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {canPriority && (
            <button
              onClick={() => setDebtOnly((v) => !v)}
              disabled={!overviewOk}
              title={overviewOk ? 'לגבות גדול מאפס' : 'נתוני Priority לא נטענו'}
              className={`px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                debtOnly ? 'bg-danger-50 border-danger-500 text-danger-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              יש חוב
            </button>
          )}
          {canPriority && (
            <select className="input py-1.5 w-auto" value={linkFilter} onChange={(e) => setLinkFilter(e.target.value as LinkFilter)}>
              <option value="">Priority: הכל</option>
              <option value="linked">מקושר</option>
              <option value="unlinked">לא מקושר</option>
            </select>
          )}
          <select className="input py-1.5 w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">סטטוס: הכל</option>
            <option value="active">פעיל</option>
            <option value="inactive">לא פעיל</option>
            <option value="suspended">מושהה</option>
          </select>
          {filtered && (
            <button onClick={clearFilters} className="text-primary-600 hover:underline px-1">נקה סינון</button>
          )}
          {!isLoading && (
            <span className="text-gray-500 mr-auto tabular-nums">
              {rows.length.toLocaleString('he-IL')} מתוך {total.toLocaleString('he-IL')} לקוחות
            </span>
          )}
        </div>
        {total > customers.length && (
          <p className="text-sm text-warning-700 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            נטענו {customers.length.toLocaleString('he-IL')} לקוחות מתוך {total.toLocaleString('he-IL')} — המיון והסינון רק עליהם.
          </p>
        )}
        {canPriority && overviewQ.isError && (
          <div className="p-3 rounded-lg bg-warning-50 border-r-4 border-warning-500 text-sm">
            <p className="font-semibold text-warning-700">לא ניתן לקרוא את נתוני Priority</p>
            <p className="text-gray-600">העמודות "לגבות" ו"מסמך אחרון" ריקות בגלל תקלה בקריאה — <b>לא</b> כי אין חוב.</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonPulse key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium mb-1">לא נמצאו לקוחות</p>
          <p className="text-sm text-gray-400 mb-6">הוסף לקוח חדש כדי להתחיל לנהל את העסק</p>
          {can('customers:create') && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              הוסף לקוח ראשון
            </button>
          )}
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-500 font-medium mb-3">אין לקוחות שמתאימים לחיפוש ולסינון</p>
          <button onClick={clearFilters} className="btn-secondary">נקה סינון</button>
        </div>
      ) : (
        <>
        {/* מובייל: שורה לכל לקוח עם השם, Priority והחוב — בלי גלילה הצידה */}
        <div className="md:hidden space-y-2">
          {rows.map((c) => {
            const o = byCustomer.get(c.id);
            const linked = !!c.priority_customer_no;
            const chase = canPriority && linked && overviewOk && o?.status && o.status.to_chase > 0 ? o.status.to_chase : 0;
            return (
              <Link key={c.id} to={`/customers/${c.id}`} className="card block p-3 active:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{c.company_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[c.city, canPriority ? (linked ? `Priority ${c.priority_customer_no}` : 'לא מקושר') : '']
                        .filter(Boolean).join(' · ')}
                    </p>
                    {canPriority && o?.last_doc && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {docTypeLabel(o.last_doc.doc_type)} · {fmtDate(o.last_doc.date)}
                      </p>
                    )}
                  </div>
                  {chase > 0 && (
                    <div className="text-left shrink-0">
                      <p className="text-[11px] text-gray-500">לגבות</p>
                      <p className="font-semibold text-danger-700 tabular-nums">{shekel(chase)}</p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
        <div className="table-container bg-white hidden md:block">
          <table className="table">
            <thead>
              <tr>
                {th('name', 'שם', `${STICKY} bg-gray-50`)}
                {canPriority && th('no', 'מספר Priority')}
                {canPriority && th('to_chase', (
                  <span className="flex flex-col leading-tight">
                    לגבות
                    {overviewQ.data?.bank_through && (
                      <span className="font-normal normal-case tracking-normal text-gray-400 whitespace-nowrap">
                        עד {fmtDate(overviewQ.data.bank_through)}
                      </span>
                    )}
                  </span>
                ))}
                {canPriority && th('last_doc', 'מסמך אחרון')}
                {th('city', 'עיר')}
                {th('status', 'סטטוס')}
                {can('customers:delete') && <th><span className="sr-only">פעולות</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const o = byCustomer.get(c.id);
                const linked = !!c.priority_customer_no;
                return (
                  <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="cursor-pointer">
                    <td className={`whitespace-normal min-w-[9rem] bg-white ${STICKY}`}>
                      <Link
                        to={`/customers/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-gray-900 hover:text-primary-700"
                      >
                        {c.company_name}
                      </Link>
                    </td>
                    {canPriority && (
                      <td className="tabular-nums">
                        {linked ? c.priority_customer_no : <span className="text-xs text-gray-400">לא מקושר</span>}
                      </td>
                    )}
                    {canPriority && (
                      <td className="tabular-nums">
                        {!linked || !overviewOk ? ''
                          : !o?.status ? <span className="text-xs text-gray-400" title="מתעדכן בכל לילה">לא חושב</span>
                          : o.status.to_chase > 0 ? <span className="font-semibold text-danger-700">{shekel(o.status.to_chase)}</span>
                          : '—'}
                      </td>
                    )}
                    {canPriority && (
                      <td className="text-xs">
                        {o?.last_doc ? (
                          <>
                            <span className="text-gray-700">{docTypeLabel(o.last_doc.doc_type)}</span>
                            <span className="text-gray-400 tabular-nums"> · {fmtDate(o.last_doc.date)}</span>
                          </>
                        ) : linked && overviewOk ? <span className="text-gray-400">אין</span> : ''}
                      </td>
                    )}
                    <td>{c.city || ''}</td>
                    <td>
                      <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    {can('customers:delete') && (
                      <td>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (await confirmDialog('האם אתה בטוח שברצונך למחוק לקוח זה?')) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-danger-500 hover:bg-danger-50 transition-colors"
                          title="מחק" aria-label="מחק"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Create Customer Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">לקוח חדש</h2>
              <button aria-label="סגירה"
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
                {/* Company Details */}
                <div className="col-span-2">
                  <h3 className="font-medium mb-3 text-gray-700">פרטי החברה</h3>
                </div>

                <div className="col-span-2">
                  <label className="label">שם החברה *</label>
                  <input {...register('company_name')} className="input" />
                  {errors.company_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.company_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">ח.פ / ע.מ</label>
                  <input {...register('business_id')} className="input" dir="ltr" />
                </div>

                <div>
                  <label className="label">סוג שירות</label>
                  <select {...register('service_type')} className="input">
                    <option value="regular">שמירה קבועה</option>
                    <option value="events">אירועים</option>
                    <option value="consulting">ייעוץ</option>
                    <option value="mixed">משולב</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="label">כתובת</label>
                  <input {...register('address')} className="input" />
                </div>

                <div>
                  <label className="label">עיר</label>
                  <input {...register('city')} className="input" />
                </div>

                <div>
                  <label className="label">תנאי תשלום</label>
                  <select {...register('payment_terms')} className="input">
                    {PAYMENT_TERMS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Primary Contact */}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <h3 className="font-medium mb-3 text-gray-700">איש קשר ראשי</h3>
                </div>

                <div>
                  <label className="label">שם איש קשר *</label>
                  <input {...register('contact_name')} className="input" />
                  {errors.contact_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.contact_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">תפקיד</label>
                  <input {...register('contact_role')} className="input" placeholder="מנכ״ל, מנהל תפעול..." />
                </div>

                <div>
                  <label className="label">טלפון *</label>
                  <input {...register('contact_phone')} className="input" dir="ltr" />
                  {errors.contact_phone && (
                    <p className="text-sm text-red-600 mt-1">{errors.contact_phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">אימייל</label>
                  <input {...register('contact_email')} type="email" className="input" dir="ltr" />
                  {errors.contact_email && (
                    <p className="text-sm text-red-600 mt-1">{errors.contact_email.message}</p>
                  )}
                </div>

                {/* Notes */}
                <div className="col-span-2 border-t pt-4 mt-2">
                  <label className="label">הערות</label>
                  <textarea {...register('notes')} className="input min-h-[80px]" />
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
