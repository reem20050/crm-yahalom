/**
 * מסמך Priority אחד — חלונית צד: כותרת, סכומים, שורות, הלקוח ב-CRM ומצב פתוח **משוער**.
 *
 * - השורות מגיעות מהמראה (p_doc_lines). לקבלה אין שורות פריטים, ולחלק מהמסמכים השורות לא נטענו —
 *   שני המצבים מוצגים במפורש ולא כטבלה ריקה.
 * - "פתוח" הוא הערכה מהכרטסת וספר הבנק (אותו חישוב כמו "מי חייב"), לא ההתאמה הרשמית של Priority.
 * - PDF: בקשה לעובד ב-VPS, שמפיק אותו ב-Priority ("הצגה" + "קובץ PDF") ושומר. קובץ שמור משמש שוב — לא מדפיסים
 *   ב-Priority בכל לחיצה. קבלה / זיכוי — עדיין רק ב-Priority.
 */
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, ExternalLink, FileText, Loader2, X } from 'lucide-react';
import { priorityApi } from '../services/api';
import { CREDIT_NOTE, docTypeLabel, fmtDate, httpStatus, shekel } from './PriorityCustomerDocs';

interface DocLine {
  line_no: number;
  internal_sku: string | null;
  description: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_discount: number | null;
  line_total: number | null;
  vat_rate: number | null;
}

interface DocDetail {
  document: {
    id: number;
    doc_type: number;
    doc_no: string;
    issue_date: string | null;
    doc_date: string | null;
    value_date: string | null;
    party_key: string | null;
    party_name: string | null;
    party_vat_id: string | null;
    party_city: string | null;
    party_phone: string | null;
    total_before_discount: number | null;
    doc_discount: number | null;
    total_after_discount_ex_vat: number | null;
    vat_amount: number | null;
    total_incl_vat: number | null;
    withholding_amount: number | null;
    cancelled: boolean;
  };
  lines: DocLine[];
  customer: { id: string; name: string } | null;
  payment: { as_of: string | null; bank_through: string | null; open: number; status: string | null; days: number | null } | null;
}

const RECEIPT = 400;
const DEAL = 300;
const PDF_TYPES = new Set([300, 305, 310, 320]);

interface PdfState { status: 'none' | 'new' | 'preparing' | 'done' | 'failed' | string; url?: string; error?: string | null }

function PdfButton({ docId }: { docId: number }) {
  const qc = useQueryClient();
  const key = ['priority', 'document-pdf', docId];
  const q = useQuery<PdfState>({
    queryKey: key,
    queryFn: () => priorityApi.getDocumentPdf(docId).then((r) => r.data),
    retry: false,
    // בזמן ההכנה בודקים כל 8 שניות; אחרי שמוכן — לא
    refetchInterval: (query) => (['new', 'preparing'].includes(query.state.data?.status ?? '') ? 8000 : false),
  });
  const ask = useMutation({
    mutationFn: () => priorityApi.requestDocumentPdf(docId).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });
  const st = q.data?.status;
  if (q.isLoading) return null;
  if (q.isError) return <p className="text-xs text-danger-700">לא ניתן לבדוק את מצב ה-PDF.</p>;
  if (st === 'done' && q.data?.url) {
    return (
      <a href={q.data.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm inline-flex items-center gap-1.5 px-3 py-1.5">
        <Download className="w-4 h-4" /> פתיחת PDF
      </a>
    );
  }
  if (st === 'new' || st === 'preparing' || ask.isPending) {
    return (
      <p className="text-sm text-gray-600 flex items-center gap-1.5">
        <Loader2 className="w-4 h-4 animate-spin" /> מכין PDF מ-Priority — בדרך כלל דקה-שתיים…
      </p>
    );
  }
  return (
    <div className="space-y-1">
      {st === 'failed' && <p className="text-xs text-danger-700">ה-PDF נכשל: {q.data?.error || 'שגיאה'}</p>}
      <button onClick={() => ask.mutate()} className="btn-secondary text-sm inline-flex items-center gap-1.5 px-3 py-1.5">
        <FileText className="w-4 h-4" /> {st === 'failed' ? 'לנסות שוב' : 'הפקת PDF'}
      </button>
      {ask.isError && <p className="text-xs text-danger-700">הבקשה לא נשלחה.</p>}
    </div>
  );
}

const PAY_STATUS: Record<string, string> = {
  to_chase: 'לגבות — אין ראיה לתשלום',
  paid_no_receipt: 'שולם בבנק — חסרה קבלה',
  maybe: 'לבירור',
  short: 'שולם חלקית',
};

const num = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 });

function Amount({ label, value, strong }: { label: string; value: number | null | undefined; strong?: boolean }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold text-gray-900' : 'text-gray-800'}`}>{shekel(value)}</span>
    </div>
  );
}

function PaymentNote({ data }: { data: DocDetail }) {
  const { document: d, payment } = data;
  if (d.cancelled || d.doc_type === RECEIPT || d.doc_type === CREDIT_NOTE) return null;
  if (d.doc_type === DEAL) {
    return (
      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
        חשבון עסקה — לא חוב: או שלא שולם, או ששולם ולא הופקה חשבונית מס.
      </p>
    );
  }
  if (!payment) return null;
  if (payment.open > 0) {
    return (
      <div className="rounded-lg p-3 bg-danger-50">
        <p className="text-sm font-semibold text-danger-700">
          פתוח (הערכה): {shekel(payment.open)}
          {payment.status && PAY_STATUS[payment.status] ? ` · ${PAY_STATUS[payment.status]}` : ''}
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          {payment.days != null && `${payment.days} ימים · `}ספר הבנק עד {fmtDate(payment.bank_through)}
        </p>
      </div>
    );
  }
  return (
    <p className="text-xs text-success-700 bg-success-50 rounded-lg p-3">
      לא מופיע כפתוח לפי הכרטסת (נכון ל-{fmtDate(payment.as_of)}).
    </p>
  );
}

export default function PriorityDocumentDrawer({ docId, onClose }: { docId: number | null; onClose: () => void }) {
  const q = useQuery<DocDetail>({
    queryKey: ['priority', 'document', docId],
    queryFn: () => priorityApi.getDocument(docId as number).then((r) => r.data),
    enabled: docId != null,
    retry: false,
  });

  useEffect(() => {
    if (docId == null) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [docId, onClose]);

  if (docId == null) return null;
  const data = q.data;
  const d = data?.document;
  const sign = d?.doc_type === CREDIT_NOTE ? -1 : 1;
  const signed = (v: number | null | undefined) => (v == null ? v : sign * Math.abs(v));

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="relative mr-auto h-full w-full max-w-xl bg-white shadow-xl overflow-y-auto animate-fade-in">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{d ? docTypeLabel(d.doc_type) : 'מסמך Priority'}</p>
            <h2 className="text-lg font-bold font-heading tabular-nums flex items-center gap-2">
              {d?.doc_no ?? '…'}
              {d?.cancelled && <span className="badge badge-gray text-xs">מבוטל</span>}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="סגירה">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {q.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
            </div>
          ) : q.isError || !data || !d ? (
            <p className="text-danger-700 text-sm">
              {httpStatus(q.error) === 404 ? 'המסמך לא נמצא במראה.' : 'לא ניתן לקרוא את המסמך (תקלת קריאה מהמראה).'}
            </p>
          ) : (
            <>
              <section className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{data.customer?.name || d.party_name || '—'}</p>
                    <p className="text-xs text-gray-500 tabular-nums">
                      {d.party_key ? `לקוח ${d.party_key}` : ''}
                      {d.party_vat_id ? ` · ח.פ ${d.party_vat_id}` : ''}
                      {d.party_city ? ` · ${d.party_city}` : ''}
                    </p>
                  </div>
                  {data.customer ? (
                    <Link
                      to={`/customers/${data.customer.id}`}
                      onClick={onClose}
                      className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" /> לכרטיס הלקוח
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400 shrink-0">לא מקושר לכרטיס ב-CRM</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  תאריך: <span className="tabular-nums">{fmtDate(d.issue_date ?? d.doc_date)}</span>
                  {d.value_date && d.value_date !== (d.issue_date ?? d.doc_date) && (
                    <> · תאריך ערך: <span className="tabular-nums">{fmtDate(d.value_date)}</span></>
                  )}
                </p>
              </section>

              <PaymentNote data={data} />

              <section className="rounded-xl border border-gray-100 px-4 py-2 divide-y divide-gray-50">
                <Amount label="לפני הנחה" value={d.doc_discount ? signed(d.total_before_discount) : null} />
                <Amount label="הנחה" value={d.doc_discount || null} />
                <Amount label='לפני מע"מ' value={signed(d.total_after_discount_ex_vat)} />
                <Amount label='מע"מ' value={signed(d.vat_amount)} />
                <Amount label='סה"כ כולל מע"מ' value={signed(d.total_incl_vat)} strong />
                <Amount label="ניכוי במקור" value={d.withholding_amount || null} />
              </section>

              <section>
                <h3 className="font-semibold text-gray-800 mb-2">שורות</h3>
                {data.lines.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                    {d.doc_type === RECEIPT
                      ? 'לקבלה אין שורות פריטים.'
                      : 'השורות של המסמך הזה לא נטענו למראה — הפירוט המלא נמצא ב-Priority.'}
                  </p>
                ) : (
                  <div className="table-container">
                    <table className="table text-sm">
                      <thead>
                        <tr><th>#</th><th>תיאור</th><th>כמות</th><th>מחיר</th><th>סה"כ</th></tr>
                      </thead>
                      <tbody>
                        {data.lines.map((l) => (
                          <tr key={l.line_no}>
                            <td className="tabular-nums text-gray-400">{l.line_no}</td>
                            <td>
                              <span className="block">{l.description || '—'}</span>
                              {(l.internal_sku || l.line_discount) && (
                                <span className="text-xs text-gray-400">
                                  {l.internal_sku ? `מק"ט ${l.internal_sku}` : ''}
                                  {l.line_discount ? ` · הנחה ${num(l.line_discount)}%` : ''}
                                </span>
                              )}
                            </td>
                            <td className="tabular-nums">{num(l.quantity)}{l.unit ? ` ${l.unit}` : ''}</td>
                            <td className="tabular-nums">{shekel(l.unit_price)}</td>
                            <td className="tabular-nums">{shekel(l.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="border-t border-gray-100 pt-4 space-y-2">
                {PDF_TYPES.has(d.doc_type) && !d.cancelled ? (
                  <>
                    <PdfButton docId={d.id} />
                    <p className="text-xs text-gray-400">ה-PDF מופק ב-Priority (הצגה בלבד — לא נשלח לאף אחד) ונשמר לפעם הבאה.</p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">PDF של מסמך מהסוג הזה — ב-Priority.</p>
                )}
                <p className="text-xs text-gray-400">הנתונים כאן מהטעינה הלילית.</p>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
