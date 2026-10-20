/**
 * בקשות הפקה ל-Priority מכרטיס לקוח מקושר.
 *
 * ה-CRM רק **מבקש**: הבקשה נשלחת לתור, העובד ב-VPS מכין אותה (ריצה יבשה) ושולח לרעם בטלגרם, וההפקה עצמה קורית
 * רק אחרי "כן" של רעם ב-HERMES. אין כאן כפתור "אשר" בכוונה — מסמך מס אי אפשר למחוק, רק לבטל.
 * מספר הלקוח ב-Priority נלקח בשרת מהקישור של הלקוח; החברה היא תמיד החברה הראשית.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Plus, Send, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { priorityApi } from '../services/api';
import { fmtDate, httpStatus, shekel } from './PriorityCustomerDocs';

type Kind = 'invoice' | 'consolidated-invoice' | 'rebill';

const KIND_LABELS: Record<Kind, string> = {
  invoice: 'חשבונית מס',
  'consolidated-invoice': 'חשבונית מרכזת',
  rebill: 'חיוב חוזר (כמו החודש הקודם)',
};
const SKUS = ['3', '000', '1', '2', '6'];
const OPEN = ['new', 'preparing', 'awaiting_approval'];

interface Line { part: string; description: string; qty: string; price: string }

interface RequestRow {
  id: number;
  created_at: string;
  created_by: string | null;
  kind: Kind;
  kind_label: string;
  status: string;
  status_label: string;
  summary: string | null;
  warnings: string[] | null;
  final_number: string | null;
  error: string | null;
  net_total: number | null;
  payload: { date?: string; details?: string; lines?: unknown[] };
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  preparing: 'bg-blue-50 text-blue-700',
  awaiting_approval: 'bg-warning-50 text-warning-700',
  done: 'bg-success-50 text-success-700',
  failed: 'bg-danger-50 text-danger-700',
  rejected: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
  check_manually: 'bg-danger-50 text-danger-700',
};

const emptyLine = (): Line => ({ part: '3', description: '', qty: '1', price: '' });

function errorMessage(e: unknown): string {
  const data = (e as { response?: { data?: { error?: string } } })?.response?.data;
  return data?.error || 'שליחת הבקשה נכשלה';
}

export default function PriorityIssueRequests({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const key = ['priority-requests', customerId];
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('invoice');
  const [date, setDate] = useState('');
  const [details, setDetails] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const q = useQuery({
    queryKey: key,
    queryFn: () => priorityApi.getRequests({ customer_id: customerId }).then((r) => r.data.rows as RequestRow[]),
    // רענון אוטומטי רק כשיש בקשה בטיפול — העובד מתקדם כל 2 דקות
    refetchInterval: (query) => ((query.state.data as RequestRow[] | undefined)?.some((r) => OPEN.includes(r.status))
      ? 20_000 : false),
  });

  const net = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0), [lines]);

  const create = useMutation({
    mutationFn: () => priorityApi.createRequest({
      customer_id: customerId,
      kind,
      ...(date ? { date } : {}),
      ...(kind === 'rebill' ? {} : { details, lines }),
    }),
    onSuccess: () => {
      toast.success('הבקשה נשלחה. רעם יקבל אותה לאישור בטלגרם');
      setOpen(false);
      setLines([emptyLine()]);
      setDetails('');
      setDate('');
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => {
      toast.error(httpStatus(e) === 409 ? 'בקשה זהה כבר בטיפול' : errorMessage(e));
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const cancel = useMutation({
    mutationFn: (id: number) => priorityApi.cancelRequest(id),
    onSuccess: () => { toast.success('הבקשה בוטלה'); qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const rows = q.data || [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FilePlus2 className="w-5 h-5 text-primary-600" />
          הפקת מסמך ב-Priority
        </h2>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5">
            <Plus className="w-4 h-4" /> בקשה חדשה
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        המסמך יופק רק אחרי אישור של רעם בטלגרם (HERMES). אחרי ההפקה מספר המסמך יופיע כאן, והמסמך ייכנס לכרטיס בריצה הלילית.
      </p>

      {open && (
        <div className="border rounded-lg p-3 mb-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">סוג מסמך</span>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {(Object.keys(KIND_LABELS) as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">תאריך (ריק = היום)</span>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {kind !== 'rebill' && (
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">פרטים (עד 40 תווים)</span>
                <input className="input" maxLength={40} value={details} onChange={(e) => setDetails(e.target.value)} />
              </label>
            )}
          </div>

          {kind === 'rebill' ? (
            <p className="text-sm text-gray-600">
              אותו מסמך כמו החיוב האחרון של הלקוח, לחודש הבא (השורות מועתקות, החודש בטקסט מתעדכן).
              הסיכום המדויק יגיע לרעם לאישור.
            </p>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <label className="col-span-2 text-xs">
                    {i === 0 && <span className="block text-gray-600 mb-1">מק"ט</span>}
                    <select className="input" value={l.part} onChange={(e) => setLine(i, { part: e.target.value })}>
                      {SKUS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="col-span-5 text-xs">
                    {i === 0 && <span className="block text-gray-600 mb-1">תיאור</span>}
                    <input className="input" maxLength={120} value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })} />
                  </label>
                  <label className="col-span-2 text-xs">
                    {i === 0 && <span className="block text-gray-600 mb-1">כמות</span>}
                    <input className="input" inputMode="decimal" value={l.qty}
                      onChange={(e) => setLine(i, { qty: e.target.value })} />
                  </label>
                  <label className="col-span-2 text-xs">
                    {i === 0 && <span className="block text-gray-600 mb-1">מחיר ליחידה (לפני מע"מ)</span>}
                    <input className="input" inputMode="decimal" value={l.price}
                      onChange={(e) => setLine(i, { price: e.target.value })} />
                  </label>
                  <button type="button" disabled={lines.length === 1} title="הסר שורה"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="col-span-1 p-2 text-gray-400 hover:text-danger-600 disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button type="button" disabled={lines.length >= 20} onClick={() => setLines((ls) => [...ls, emptyLine()])}
                  className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                  <Plus className="w-4 h-4" /> שורה
                </button>
                <span className="text-sm text-gray-700">
                  סה"כ לפני מע"מ: <b className="tabular-nums">{shekel(net)}</b>
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1">
              <X className="w-4 h-4" /> ביטול
            </button>
            <button type="button" disabled={create.isPending || (kind !== 'rebill' && net <= 0)}
              onClick={() => create.mutate()}
              className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1">
              <Send className="w-4 h-4" /> {create.isPending ? 'שולח…' : 'שלח לאישור'}
            </button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <p className="text-gray-500 text-center py-3">טוען…</p>
      ) : q.isError ? (
        <p className="text-danger-600 text-sm py-3">
          {httpStatus(q.error) === 503 ? 'החיבור ל-Priority לא מוגדר בשרת' : 'לא ניתן לקרוא את בקשות ההפקה'}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-center py-3">אין בקשות הפקה ללקוח הזה</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-gray-400 tabular-nums">#{r.id}</span>
                  <span className="font-medium">{r.kind_label}</span>
                  {r.net_total != null && <span className="text-gray-600 tabular-nums">{shekel(r.net_total)}</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[r.status] || 'bg-gray-100'}`}>
                    {r.status === 'done' && r.final_number ? `הופק: ${r.final_number}` : r.status_label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                  <span>{r.created_by || ''} · {fmtDate(r.created_at)}</span>
                  {r.status === 'new' && (
                    <button onClick={() => cancel.mutate(r.id)} disabled={cancel.isPending}
                      className="text-danger-600 hover:underline">בטל</button>
                  )}
                </div>
              </div>
              {r.summary && r.status === 'awaiting_approval' && (
                <p className="text-xs text-gray-600 mt-1">{r.summary}</p>
              )}
              {r.error && ['failed', 'expired', 'check_manually', 'rejected'].includes(r.status) && (
                <p className="text-xs text-danger-600 mt-1">{r.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
