/**
 * מסמכי Priority בכרטיס לקוח — רק ללקוח שמקושר למספר לקוח ב-Priority (200xxx).
 *
 * Priority מנפיקה את המסמכים הרשמיים. החשבוניות של ה-CRM הן נתוני חשבונית ירוקה
 * ואינן המקור, ולכן ללקוח מקושר הכרטיס מציג את המסמכים מכאן במקום את הרשימה ההיא.
 *
 * הנתונים מגיעים מהמראה (`priority_mirror`) דרך השרת — נכונים לטעינה האחרונה,
 * לא לרגע זה. סטטוס התשלום והכרטסת — בלשונית "תשלום" (PriorityCustomerSummary.tsx).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { priorityApi } from '../services/api';
import type { PaymentStatus } from './PriorityPaymentStatus';
import PriorityDocumentDrawer from './PriorityDocumentDrawer';

export type MatchedBy = 'vat' | 'name' | 'manual';

export interface PriorityDocRow {
  id: number;
  doc_type: number;
  doc_no: string;
  issue_date: string | null;
  doc_date: string | null;
  party_key: string | null;
  party_name: string | null;
  party_vat_id: string | null;
  total_after_discount_ex_vat: number | null;
  vat_amount: number | null;
  total_incl_vat: number | null;
  withholding_amount: number | null;
  cancelled: boolean;
}

export interface PriorityLink {
  priority_customer_no: string;
  matched_by: MatchedBy | null;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
}

export interface PriorityAccount {
  account_key: string;
  account_name: string | null;
  party_vat_id: string | null;
  balance: number | null;
}

/** המסמך האחרון שלא בוטל — אותו כלל בשרת לכרטיס ולרשימת הלקוחות (lastDocuments). */
export interface LastDoc {
  id: number;
  doc_type: number;
  doc_no: string | null;
  date: string;
  total_incl_vat: number | null;
}

export type PriorityCustomerResponse =
  | { linked: false; customer_id: string }
  | {
      linked: true;
      link: PriorityLink;
      account: PriorityAccount | null;
      /** עד מתי הכרטסת נכונה (התנועה האחרונה במראה). */
      kartesset_as_of?: string | null;
      last_doc?: LastDoc | null;
      /** סטטוס תשלום נגזר (p_customer_status) — null כשעוד לא חושב. */
      status?: PaymentStatus | null;
      status_unavailable?: boolean;
      /** טלפון / עיר / ח.פ. כפי שמופיעים במסמכים ב-Priority — null כשאין. */
      contact?: { phone: string | null; city: string | null; vat_id: string | null } | null;
      rows: PriorityDocRow[];
      total: number;
      truncated: boolean;
      totals: {
        by_type: Record<string, { label: string; count: number; cancelled: number; total_incl_vat: number }>;
        tax_invoices_net: number;
        deal_invoices: number;
        receipts: number;
      };
    };

export const MIRROR_NOT_CONFIGURED = 'המראה של Priority לא מוגדרת בשרת';

export const MATCHED_BY_LABELS: Record<MatchedBy, string> = {
  vat: 'לפי ח.פ.',
  name: 'לפי שם',
  manual: 'ידני',
};

export const CREDIT_NOTE = 330;

export const DOC_TYPES: Record<number, string> = {
  300: 'חשבון עסקה',
  305: 'חשבונית מס',
  310: 'חשבונית מרכזת',
  320: 'חשבונית מס קבלה',
  330: 'חשבונית זיכוי',
  400: 'קבלה',
};

/** מפתח משותף לכרטיס המסמכים ולכרטיס הקישור — react-query מאחד אותם לבקשה אחת. */
export const priorityCustomerKey = (customerId: string) =>
  ['priority', 'customer-docs', customerId] as const;

export function usePriorityCustomer(customerId: string, enabled: boolean) {
  return useQuery<PriorityCustomerResponse>({
    queryKey: priorityCustomerKey(customerId),
    queryFn: () => priorityApi.getCustomerDocuments(customerId).then((r) => r.data),
    enabled,
    // בלי ניסיון חוזר: 503/502 לא ייפתרו בתוך שנייה, והמיירט הגלובלי מקפיץ toast על כל ניסיון.
    retry: false,
  });
}

/** גוף השגיאה מהשרת גנרי ({error:'שגיאת שרת'}), לכן מפרידים לפי קוד HTTP בלבד. */
export const httpStatus = (err: unknown) =>
  (err as { response?: { status?: number } } | null)?.response?.status;

// שתי ספרות אחרי הנקודה, כמו במסך Priority — אחרת השורות לא מסתכמות לסך המוצג.
export const shekel = (n: number | null | undefined) =>
  n == null ? '—'
    : n.toLocaleString('he-IL', {
      style: 'currency', currency: 'ILS',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });

/** YYYY-MM-DD (או חותמת זמן שמתחילה כך) → DD/MM/YYYY, בלי המרת אזור זמן. */
export function fmtDate(v: string | null | undefined) {
  if (!v) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export const docTypeLabel = (code: number) => DOC_TYPES[code] ?? String(code);

/** זיכוי מוצג תמיד שלילי. Math.abs — כי לא ידוע אם המראה כבר שומרת אותו בסימן מינוס. */
export const signedTotal = (d: Pick<PriorityDocRow, 'doc_type' | 'total_incl_vat'>) =>
  d.total_incl_vat == null ? null
    : d.doc_type === CREDIT_NOTE ? -Math.abs(d.total_incl_vat) : d.total_incl_vat;

/**
 * טעינה / תקלה / לא מקושר — משותף ללשוניות Priority בכרטיס. null = יש נתונים של לקוח מקושר.
 * תקלה בקריאה מוצגת כתקלה, לא כ"אין מסמכים".
 */
export function priorityLoadState(q: UseQueryResult<PriorityCustomerResponse>, what: string): ReactNode | null {
  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }
  if (q.isError) {
    const status = httpStatus(q.error);
    if (status === 503) {
      return (
        <div className="p-4 rounded-lg bg-warning-50 border-r-4 border-warning-500">
          <p className="font-semibold text-warning-700">{MIRROR_NOT_CONFIGURED}</p>
          <p className="text-sm text-gray-600 mt-1">לא ניתן להציג את {what} עד שהחיבור למראה יוגדר.</p>
        </div>
      );
    }
    if (status === 404) return <p className="text-gray-500 text-center py-4">הלקוח לא נמצא</p>;
    if (status === 422) {
      return (
        <div className="p-4 rounded-lg bg-warning-50 border-r-4 border-warning-500">
          <p className="font-semibold text-warning-700">מספר הלקוח השמור ב-Priority אינו תקין</p>
          <p className="text-sm text-gray-600 mt-1">יש לנתק את הקישור ולקשר מחדש.</p>
        </div>
      );
    }
    return (
      <div className="p-4 rounded-lg bg-danger-50 border-r-4 border-danger-500">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-danger-700">לא ניתן לקרוא את {what}</p>
            <p className="text-sm text-gray-600 mt-1">
              זו תקלה בקריאה מהמראה — <b>לא</b> "אין נתונים".
            </p>
          </div>
          <button
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="btn-secondary text-sm flex items-center gap-1 px-3 py-1.5 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${q.isFetching ? 'animate-spin' : ''}`} />
            נסה שוב
          </button>
        </div>
      </div>
    );
  }
  if (!q.data || !q.data.linked) {
    return <p className="text-gray-500 text-center py-4">הלקוח אינו מקושר ל-Priority</p>;
  }
  return null;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function countHint(
  byType: Record<string, { count: number }> | undefined,
  code: number,
  extra?: string,
) {
  const count = byType?.[String(code)]?.count;
  const parts = [count != null ? `${count.toLocaleString('he-IL')} מסמכים` : null, extra ?? null];
  return parts.filter(Boolean).join(' · ') || undefined;
}

const PAGE_SIZE = 20;

export default function PriorityCustomerDocs({ customerId }: { customerId: string }) {
  const q = usePriorityCustomer(customerId, true);
  const data = q.data;
  const [openId, setOpenId] = useState<number | null>(null);
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);

  const allRows = useMemo(() => (data?.linked ? data.rows : []), [data]);
  const rows = useMemo(
    () => (type ? allRows.filter((d) => String(d.doc_type) === type) : allRows),
    [allRows, type],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // סינון חדש (או פחות שורות אחרי רענון) — חזרה לעמוד שקיים
  useEffect(() => { setPage(0); }, [type]);
  useEffect(() => { if (page >= pages) setPage(pages - 1); }, [page, pages]);

  let body = priorityLoadState(q, 'מסמכי Priority');
  if (!body && data?.linked) {
    const { totals } = data;
    // סוגים לפי מה שיש ללקוח בפועל, עם ספירה (כולל מבוטלים — הטבלה מציגה גם אותם)
    const typeOptions = Object.entries(totals.by_type)
      .map(([code, b]) => ({ code, label: b.label, n: b.count + b.cancelled }))
      .sort((a, b) => Number(a.code) - Number(b.code));
    const from = page * PAGE_SIZE;
    const shown = rows.slice(from, from + PAGE_SIZE);
    body = (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Tile
            label="חשבוניות מס נטו"
            value={shekel(totals.tax_invoices_net)}
            hint="בניכוי זיכויים, ללא מבוטלים"
          />
          <Tile
            label="חשבונות עסקה"
            value={shekel(totals.deal_invoices)}
            hint={countHint(totals.by_type, 300, 'לא חוב')}
          />
          <Tile
            label="קבלות"
            value={shekel(totals.receipts)}
            hint={countHint(totals.by_type, 400)}
          />
        </div>

        {allRows.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            אין מסמכים ב-Priority ללקוח זה
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <label className="text-sm flex items-center gap-2">
                <span className="text-gray-600">סוג מסמך</span>
                <select className="input py-1.5 w-auto" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">הכל ({allRows.length.toLocaleString('he-IL')})</option>
                  {typeOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.label} ({o.n.toLocaleString('he-IL')})</option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-gray-500">לחיצה על שורה פותחת את המסמך</span>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>סוג</th>
                    <th className="hidden sm:table-cell">מספר</th>
                    <th>סה"כ כולל מע"מ</th>
                    <th className="hidden sm:table-cell"></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((d) => {
                    const amount = signedTotal(d);
                    const struck = d.cancelled ? 'line-through text-gray-400' : '';
                    const negative = !d.cancelled && amount != null && amount < 0 ? 'text-danger-700' : '';
                    return (
                      <tr key={d.id} onClick={() => setOpenId(d.id)} className="cursor-pointer hover:bg-gray-50" title="לחיצה פותחת את המסמך">
                        <td className={`tabular-nums ${struck}`}>{fmtDate(d.issue_date ?? d.doc_date)}</td>
                        <td className={struck}>
                          {docTypeLabel(d.doc_type)}
                          {/* בטלפון המספר מתחת לסוג, כדי שהסכום ייכנס בלי גלילה הצידה */}
                          <span className="block sm:hidden text-xs text-gray-400 tabular-nums">
                            {d.doc_no}{d.cancelled && ' · מבוטל'}
                          </span>
                        </td>
                        <td className={`hidden sm:table-cell tabular-nums ${struck}`}>{d.doc_no}</td>
                        <td className={`tabular-nums ${struck} ${negative}`}>{shekel(amount)}</td>
                        <td className="hidden sm:table-cell">{d.cancelled && <span className="badge badge-gray">מבוטל</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 mt-3 text-sm">
                <span className="text-gray-500 tabular-nums">
                  {(from + 1).toLocaleString('he-IL')}–{Math.min(from + PAGE_SIZE, rows.length).toLocaleString('he-IL')}
                  {' '}מתוך {rows.length.toLocaleString('he-IL')}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="btn-secondary px-2 py-1 flex items-center gap-1 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" /> הקודם
                  </button>
                  <span className="px-2 tabular-nums text-gray-600">{page + 1}/{pages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                    disabled={page >= pages - 1}
                    className="btn-secondary px-2 py-1 flex items-center gap-1 disabled:opacity-40"
                  >
                    הבא <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {data.truncated && (
          <p className="text-sm text-gray-500 text-center mt-3 flex items-center justify-center gap-1">
            <AlertTriangle className="w-4 h-4 text-warning-500" />
            מוצגים {allRows.length.toLocaleString('he-IL')} מתוך {data.total.toLocaleString('he-IL')} מסמכים
            — הסיכומים מחושבים על המסמכים המוצגים בלבד
          </p>
        )}
      </>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold font-heading">מסמכי Priority</h2>
        {data?.linked && (
          <span className="text-sm text-gray-500 tabular-nums">לקוח {data.link.priority_customer_no}</span>
        )}
      </div>
      {body}
      <PriorityDocumentDrawer docId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
