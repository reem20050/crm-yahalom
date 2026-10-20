/**
 * "מי חייב" — לשונית במסך Priority. סטטוס תשלום נגזר לכל לקוח (אותו חישוב כמו paid-check וסיכום הבוקר בטלגרם).
 * תצוגה בלבד: אין כאן שליחת הודעות, תזכורות או משימות.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { priorityApi } from '../services/api';
import { fmtDate, shekel } from './PriorityCustomerDocs';

interface Row {
  party_key: string;
  name: string | null;
  customer_id: string | null;
  balance: number;
  to_chase: number;
  paid_no_receipt: number;
  maybe: number;
  short: number;
  deals_open: unknown[] | null;
}

interface Resp {
  as_of: string | null;
  bank_through: string | null;
  totals: { to_chase: number; paid_no_receipt: number; maybe: number; short: number };
  rows: Row[];
}

export default function PriorityCollections() {
  const q = useQuery({
    queryKey: ['priority-collections'],
    retry: false,
    queryFn: () => priorityApi.getCollections().then((r) => r.data as Resp),
  });
  if (q.isLoading) return <p className="text-gray-500 text-center py-6">טוען…</p>;
  if (q.isError || !q.data) {
    return <p className="text-danger-600 py-4">לא ניתן לקרוא את סטטוס התשלום (תקלת חיבור — לא "אין חובות").</p>;
  }
  const { rows, totals, as_of, bank_through } = q.data;
  return (
    <div className="space-y-3">
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-danger-50">
            <p className="text-xs text-gray-600">לגבות</p>
            <p className="text-xl font-bold tabular-nums">{shekel(totals.to_chase)}</p>
            <p className="text-xs text-gray-500">אין ראיה לתשלום עד {fmtDate(bank_through)}</p>
          </div>
          <div className="p-3 rounded-lg bg-success-50">
            <p className="text-xs text-gray-600">שולם בבנק — חסרה קבלה</p>
            <p className="text-xl font-bold tabular-nums">{shekel(totals.paid_no_receipt)}</p>
            <p className="text-xs text-gray-500">להפיק קבלות, לא לגבות</p>
          </div>
          <div className="p-3 rounded-lg bg-warning-50">
            <p className="text-xs text-gray-600">לבירור</p>
            <p className="text-xl font-bold tabular-nums">{shekel(totals.maybe + totals.short)}</p>
            <p className="text-xs text-gray-500">התאמה לא חד-משמעית / תשלום חלקי</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          נכון לצילום מ-{fmtDate(as_of)}, ספר הבנק עד {fmtDate(bank_through)}. תשלום שנכנס אחרי התאריך הזה עוד לא נראה —
          טענו תדפיס חדש ל-HERMES לפני שגובים. המסמכים לכל לקוח הם הערכה לפי הכרטסת.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-right">
              <th className="py-2">לקוח</th>
              <th className="py-2">לגבות</th>
              <th className="py-2">שולם בבנק — חסרה קבלה</th>
              <th className="py-2">לבירור</th>
              <th className="py-2">יתרה</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.party_key}>
                <td className="py-2">
                  {r.customer_id
                    ? <Link to={`/customers/${r.customer_id}`} className="text-primary-600 hover:underline">{r.name || r.party_key}</Link>
                    : <span>{r.name || r.party_key} <span className="text-xs text-gray-400">(בלי כרטיס)</span></span>}
                  <span className="text-xs text-gray-400 mr-1">{r.party_key}</span>
                </td>
                <td className="py-2 tabular-nums font-medium">{r.to_chase ? shekel(r.to_chase) : '—'}</td>
                <td className="py-2 tabular-nums">{r.paid_no_receipt ? shekel(r.paid_no_receipt) : '—'}</td>
                <td className="py-2 tabular-nums">{r.maybe + r.short ? shekel(r.maybe + r.short) : '—'}</td>
                <td className="py-2 tabular-nums text-gray-600">{shekel(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
