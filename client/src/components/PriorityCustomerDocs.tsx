/**
 * מסמכי Priority בכרטיס לקוח — רק ללקוח שמקושר למספר לקוח ב-Priority (200xxx).
 *
 * Priority מנפיקה את המסמכים הרשמיים. החשבוניות של ה-CRM הן נתוני חשבונית ירוקה
 * ואינן המקור, ולכן ללקוח מקושר הכרטיס מציג את המסמכים מכאן במקום את הרשימה ההיא.
 *
 * הנתונים מגיעים מהמראה (`priority_mirror`) דרך השרת — נכונים לטעינה האחרונה,
 * לא לרגע זה.
 */
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import { priorityApi } from '../services/api';
import PriorityPaymentStatus, { type PaymentStatus } from './PriorityPaymentStatus';
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

export type PriorityCustomerResponse =
  | { linked: false; customer_id: string }
  | {
      linked: true;
      link: PriorityLink;
      account: PriorityAccount | null;
      /** סטטוס תשלום נגזר (p_customer_status) — null כשעוד לא חושב. */
      status?: PaymentStatus | null;
      status_unavailable?: boolean;
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

export default function PriorityCustomerDocs({ customerId }: { customerId: string }) {
  const q = usePriorityCustomer(customerId, true);
  const data = q.data;
  const [openId, setOpenId] = useState<number | null>(null);

  let body: ReactNode;
  if (q.isLoading) {
    body = (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
      </div>
    );
  } else if (q.isError) {
    const status = httpStatus(q.error);
    body = status === 503 ? (
      <div className="p-4 rounded-lg bg-warning-50 border-r-4 border-warning-500">
        <p className="font-semibold text-warning-700">{MIRROR_NOT_CONFIGURED}</p>
        <p className="text-sm text-gray-600 mt-1">לא ניתן להציג את מסמכי Priority עד שהחיבור למראה יוגדר.</p>
      </div>
    ) : status === 404 ? (
      <p className="text-gray-500 text-center py-4">הלקוח לא נמצא</p>
    ) : status === 422 ? (
      <div className="p-4 rounded-lg bg-warning-50 border-r-4 border-warning-500">
        <p className="font-semibold text-warning-700">מספר הלקוח השמור ב-Priority אינו תקין</p>
        <p className="text-sm text-gray-600 mt-1">יש לנתק את הקישור ולקשר מחדש.</p>
      </div>
    ) : (
      <div className="p-4 rounded-lg bg-danger-50 border-r-4 border-danger-500">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-danger-700">לא ניתן לקרוא את מסמכי Priority</p>
            <p className="text-sm text-gray-600 mt-1">
              זו תקלה בקריאה מהמראה — <b>לא</b> "אין מסמכים".
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
  } else if (!data || !data.linked) {
    body = <p className="text-gray-500 text-center py-4">הלקוח אינו מקושר ל-Priority</p>;
  } else {
    const { rows, totals, account } = data;
    body = (
      <>
        <PriorityPaymentStatus status={data.status} unavailable={data.status_unavailable} />
        <div className={`grid grid-cols-2 ${account ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 mb-4`}>
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
          {account && (
            <Tile
              label="יתרה בכרטסת"
              value={shekel(account.balance)}
              hint="נכון לטעינת הכרטסת האחרונה"
            />
          )}
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            אין מסמכים ב-Priority ללקוח זה
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>סוג</th>
                  <th>מספר</th>
                  <th>סה"כ כולל מע"מ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const amount = signedTotal(d);
                  const struck = d.cancelled ? 'line-through text-gray-400' : '';
                  const negative = !d.cancelled && amount != null && amount < 0 ? 'text-danger-700' : '';
                  return (
                    <tr key={d.id} onClick={() => setOpenId(d.id)} className="cursor-pointer hover:bg-gray-50" title="לחיצה פותחת את המסמך">
                      <td className={`tabular-nums ${struck}`}>{fmtDate(d.issue_date ?? d.doc_date)}</td>
                      <td className={struck}>{docTypeLabel(d.doc_type)}</td>
                      <td className={`tabular-nums ${struck}`}>{d.doc_no}</td>
                      <td className={`tabular-nums ${struck} ${negative}`}>{shekel(amount)}</td>
                      <td>{d.cancelled && <span className="badge badge-gray">מבוטל</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.truncated && (
          <p className="text-sm text-gray-500 text-center mt-3 flex items-center justify-center gap-1">
            <AlertTriangle className="w-4 h-4 text-warning-500" />
            מוצגים {rows.length.toLocaleString('he-IL')} מתוך {data.total.toLocaleString('he-IL')} מסמכים
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
