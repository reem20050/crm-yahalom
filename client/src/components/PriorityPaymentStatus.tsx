/**
 * סטטוס תשלום של לקוח — **נגזר**, לא עובדה של Priority.
 *
 * מחושב ב-VPS אחרי הצילום הלילי, באותו חישוב בדיוק כמו `prio paid-check` וסיכום הבוקר בטלגרם (צילום Priority + ספר הבנק),
 * כדי שה-CRM והטלגרם יראו אותם מספרים.
 *
 * איך לקרוא:
 *  - "לגבות" = אין ראיה לתשלום **עד התדפיס האחרון שנטען** — לא "לא שילם". תשלום שנכנס אחרי התאריך הזה עוד לא נראה.
 *  - "שולם בבנק — חסרה קבלה" = הכסף נכנס; צריך להפיק קבלה, **לא לגבות**.
 *  - המסמכים הפתוחים הם הערכה (FIFO מהכרטסת), לא ההתאמה הרשמית של Priority.
 *  - חשבון עסקה בלי חשבונית מס — לא חוב: או שלא שולם, או ששולם ולא הופקה חשבונית.
 */
import { AlertTriangle, Landmark } from 'lucide-react';
import { fmtDate, shekel } from './PriorityCustomerDocs';

export interface PaymentStatus {
  party_key: string;
  as_of: string | null;
  bank_through: string | null;
  balance: number;
  paid_no_receipt: number;
  short: number;
  maybe: number;
  to_chase: number;
  items?: { date: string | null; ref: string; days: number | null; original: number; open: number; status: string | null; note: string | null }[];
  deals_open?: { number: string; date: string | null; days: number | null; amount: number }[];
}

const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  to_chase: { label: 'לגבות', cls: 'bg-danger-50 text-danger-700' },
  paid_no_receipt: { label: 'שולם בבנק — חסרה קבלה', cls: 'bg-success-50 text-success-700' },
  maybe: { label: 'לבירור', cls: 'bg-warning-50 text-warning-700' },
  short: { label: 'שולם חלקית', cls: 'bg-warning-50 text-warning-700' },
};

function Tile({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: string }) {
  return (
    <div className={`p-3 rounded-lg ${value ? tone : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{shekel(value)}</p>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
    </div>
  );
}

export default function PriorityPaymentStatus({ status, unavailable }: {
  status: PaymentStatus | null | undefined;
  unavailable?: boolean;
}) {
  if (unavailable) {
    return (
      <p className="text-xs text-danger-700 mb-3">לא ניתן לקרוא את סטטוס התשלום כרגע (תקלת קריאה — לא "אין חוב").</p>
    );
  }
  if (!status) {
    return (
      <p className="text-xs text-gray-500 mb-3">סטטוס תשלום עוד לא חושב ללקוח הזה (מתעדכן בכל לילה).</p>
    );
  }
  const items = status.items || [];
  const deals = status.deals_open || [];
  const clear = !status.to_chase && !status.paid_no_receipt && !status.maybe && !status.short;
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-2">
        <h3 className="font-semibold text-gray-800 flex items-center gap-1.5 shrink-0">
          <Landmark className="w-4 h-4 text-primary-600" /> מצב תשלום
        </h3>
        <span className="text-xs text-gray-500">
          נכון ל-{fmtDate(status.as_of)} · תדפיס בנק עד {fmtDate(status.bank_through)}
        </span>
      </div>
      {clear ? (
        <p className="text-sm text-success-700 bg-success-50 rounded-lg p-3">
          אין מסמכים פתוחים לפי הכרטסת (עד {fmtDate(status.as_of)}).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Tile label="לגבות" value={status.to_chase} tone="bg-danger-50"
              hint={`אין ראיה לתשלום עד ${fmtDate(status.bank_through)}`} />
            <Tile label="שולם בבנק — חסרה קבלה" value={status.paid_no_receipt} tone="bg-success-50"
              hint="להפיק קבלה, לא לגבות" />
            <Tile label="לבירור" value={status.maybe + status.short} tone="bg-warning-50"
              hint="התאמה לא חד-משמעית / תשלום חלקי" />
          </div>
          {items.length > 0 && (
            <details className="mt-2">
              <summary className="text-sm text-primary-600 cursor-pointer">
                {items.length} מסמכים פתוחים (הערכה לפי הכרטסת)
              </summary>
              <ul className="mt-2 divide-y text-sm">
                {items.map((i) => (
                  <li key={i.ref} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs">{i.ref}</span>
                      <span className="text-gray-500 text-xs">{fmtDate(i.date)} · {i.days ?? '—'} ימים</span>
                      {i.status && (
                        // ערך שלא ממופה מוצג כמו שהוא — לא נעלם
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ITEM_STATUS[i.status]?.cls ?? 'bg-gray-100 text-gray-700'}`}>
                          {ITEM_STATUS[i.status]?.label ?? i.status}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums shrink-0">{shekel(i.open)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {deals.length > 0 && (
        <p className="text-xs text-gray-600 mt-2 flex items-start gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-warning-600 shrink-0 mt-0.5" />
          {deals.length} חשבונות עסקה בלי חשבונית מס ({shekel(deals.reduce((s, d) => s + (d.amount || 0), 0))}) — לא חוב:
          לא שולם, או ששולם ולא הופקה חשבונית. רק הבנק מכריע.
        </p>
      )}
    </div>
  );
}
