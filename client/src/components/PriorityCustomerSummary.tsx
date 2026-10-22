/**
 * ראש כרטיס הלקוח (סיכום כספי קצר) ולשונית "תשלום" — ללקוח מקושר ל-Priority, הנהלה בלבד.
 *
 * שני מספרי "חוב" שונים, ולכן לא מציגים אותם זה לצד זה בלי הסבר:
 *  - "לגבות" — נגזר מהצילום + ספר הבנק (p_customer_status): אין ראיה לתשלום עד התדפיס האחרון. זה המספר לגבייה.
 *  - "יתרה בכרטסת" — הנהלת החשבונות (p_accounts), נכונה לטעינת הכרטסת. תשלום שנכנס לבנק בלי קבלה עדיין נספר בה.
 *    עד שיוחלט מה היא מייצגת בכרטיס — מוסתרת מאחורי "פרטים" בלשונית תשלום, עם התאריך שלה.
 *
 * הנתונים מאותה בקשה כמו לשונית המסמכים (usePriorityCustomer) — react-query מאחד.
 */
import { useState } from 'react';
import { FilePlus2, Info, Phone } from 'lucide-react';
import PriorityPaymentStatus from './PriorityPaymentStatus';
import PriorityDocumentDrawer from './PriorityDocumentDrawer';
import { docTypeLabel, fmtDate, priorityLoadState, shekel, signedTotal, usePriorityCustomer } from './PriorityCustomerDocs';

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className={`p-3 rounded-lg ${tone || 'bg-gray-50'}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5 text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function PriorityCustomerSummary({ customerId, onIssue, onShowPayment }: {
  customerId: string;
  /** "הפקת מסמך" — עובר ללשונית בקשות ההפקה ופותח טופס. */
  onIssue: () => void;
  onShowPayment: () => void;
}) {
  const q = usePriorityCustomer(customerId, true);
  const [openId, setOpenId] = useState<number | null>(null);

  const blocked = priorityLoadState(q, 'נתוני Priority');
  if (blocked) return <div className="card">{blocked}</div>;
  if (!q.data?.linked) return null;

  const { link, status, status_unavailable: unavailable, last_doc: last, contact } = q.data;
  const open = status ? status.maybe + status.short : 0;
  let toChase: { value: string; hint: string; tone?: string };
  let paidNoReceipt: { value: string; hint: string; tone?: string };
  if (unavailable) {
    toChase = { value: '?', hint: 'תקלת קריאה — לא "אין חוב"', tone: 'bg-danger-50' };
    paidNoReceipt = { value: '?', hint: 'תקלת קריאה' };
  } else if (!status) {
    toChase = { value: '—', hint: 'עוד לא חושב (מתעדכן בכל לילה)' };
    paidNoReceipt = { value: '—', hint: 'עוד לא חושב' };
  } else {
    toChase = {
      value: shekel(status.to_chase),
      hint: `אין ראיה לתשלום עד ${fmtDate(status.bank_through)}`,
      tone: status.to_chase ? 'bg-danger-50' : undefined,
    };
    paidNoReceipt = {
      value: shekel(status.paid_no_receipt),
      hint: 'להפיק קבלה, לא לגבות',
      tone: status.paid_no_receipt ? 'bg-success-50' : undefined,
    };
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
          <span>לקוח Priority <b className="tabular-nums text-gray-900">{link.priority_customer_no}</b></span>
          {contact?.phone && (
            <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1 text-primary-700 hover:underline tabular-nums">
              <Phone className="w-3.5 h-3.5" /> {contact.phone}
            </a>
          )}
          {contact?.vat_id && <span className="tabular-nums">ח.פ {contact.vat_id}</span>}
          {contact?.city && <span>{contact.city}</span>}
        </div>
        <button onClick={onIssue} className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5">
          <FilePlus2 className="w-4 h-4" /> הפקת מסמך
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="לגבות" {...toChase} />
        <Stat label="שולם בבנק — חסרה קבלה" {...paidNoReceipt} />
        {last ? (
          <button
            onClick={() => setOpenId(last.id)}
            className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-gray-50 text-right hover:bg-gray-100 transition-colors"
            title="לחיצה פותחת את המסמך"
          >
            <p className="text-xs text-gray-600">מסמך אחרון</p>
            <p className="text-sm font-bold mt-0.5 text-gray-900">
              {docTypeLabel(last.doc_type)} <span className="tabular-nums font-normal">{last.doc_no}</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
              {fmtDate(last.date)} · {shekel(signedTotal({ doc_type: last.doc_type, total_incl_vat: last.total_incl_vat }))}
            </p>
          </button>
        ) : (
          <div className="col-span-2 sm:col-span-1">
            <Stat label="מסמך אחרון" value="—" hint="אין מסמכים ב-Priority" />
          </div>
        )}
      </div>
      {open > 0 && (
        <button onClick={onShowPayment} className="mt-2 text-sm text-warning-700 hover:underline flex items-center gap-1">
          <Info className="w-4 h-4" /> עוד {shekel(open)} לבירור — פירוט בלשונית תשלום
        </button>
      )}
      <PriorityDocumentDrawer docId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

/** לשונית "תשלום": מצב התשלום המלא, והכרטסת מאחורי "פרטים" עם תווית ותאריך משלה. */
export function PriorityCustomerPayment({ customerId }: { customerId: string }) {
  const q = usePriorityCustomer(customerId, true);
  const blocked = priorityLoadState(q, 'סטטוס התשלום');
  if (blocked) return <div className="card">{blocked}</div>;
  if (!q.data?.linked) return null;
  const { status, status_unavailable: unavailable, account, kartesset_as_of: asOf } = q.data;
  return (
    <div className="card space-y-3">
      <PriorityPaymentStatus status={status} unavailable={unavailable} />
      {account && (
        <details className="border-t pt-3">
          <summary className="text-sm text-gray-600 cursor-pointer">פרטים: יתרה בכרטסת (הנהלת חשבונות)</summary>
          <div className="mt-2 p-3 rounded-lg bg-gray-50">
            <p className="text-lg font-bold tabular-nums text-gray-900">{shekel(account.balance)}</p>
            <p className="text-xs text-gray-600 mt-1">
              יתרת החשבון בכרטסת של Priority, נכונה ל-{fmtDate(asOf)}.
              {' '}<b>זה לא הסכום לגבייה:</b> תשלום שנכנס לבנק ועוד לא הופקה עליו קבלה נספר כאן כחוב,
              ותשלום שנכנס אחרי {fmtDate(asOf)} לא נראה כאן. לגבייה — "לגבות" למעלה.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
