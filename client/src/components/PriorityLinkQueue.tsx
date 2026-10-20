/**
 * תור הקישור ל-Priority במסך Priority: שתי לשוניות.
 *
 *   "לקוחות ללא כרטיס" — חשבונות לקוח ב-Priority שאין להם לקוח ב-CRM. מנהל מסמן, ורק מה שסומן
 *   נוצר ומקושר (POST /priority/import-customers). אין יצירה אוטומטית.
 *   "דו-משמעיים" — חשבון שמתאים לכמה לקוחות CRM, או כמה חשבונות Priority שמתאימים ללקוח אחד.
 *   הבחירה ידנית, דרך POST /priority/links הקיים.
 *
 * מה חסום ליצירה מחליט השרת (blocked): ח.פ. או שם שכבר קיימים ב-CRM, או מספר שכבר מקושר.
 * המסך רק מציג — אותה בדיקה רצה שוב ביצירה עצמה.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Link2, Search, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { priorityApi } from '../services/api';
import { MIRROR_NOT_CONFIGURED, fmtDate, httpStatus, priorityCustomerKey, shekel } from './PriorityCustomerDocs';
import { linkErrorMessage } from './PriorityLinkControl';
import { SkeletonGrid } from './Skeleton';

type BlockReason =
  | 'vat_exists' | 'name_exists' | 'priority_duplicate' | 'already_linked' | 'linked_to_deleted'
  | 'not_in_mirror' | 'missing_name' | 'invalid_no';

interface DocStats {
  city: string | null;
  doc_count: number;
  cancelled_count: number;
  tax_invoices_net: number;
  receipts: number;
  last_doc_date: string | null;
}

interface Blocked {
  reason: BlockReason;
  customer_id?: string | null;
  customer_name?: string;
  customer_priority_no?: string | null;
}

interface UnmatchedRow extends DocStats {
  priority_customer_no: string;
  priority_name: string | null;
  priority_vat_id: string | null;
  blocked: Blocked | null;
  priority_duplicates: string[];
}

interface Candidate { customer_id: string; customer_name: string; business_id: string | null }

interface AmbiguousRow extends DocStats {
  priority_customer_no: string;
  priority_name: string | null;
  priority_vat_id: string | null;
  matched_by: 'vat' | 'name';
  reason: 'several_crm_customers' | 'priority_duplicate';
  customers: Candidate[];
}

export interface LinkQueueResponse {
  summary: { accounts_read: number; unmatched: number; ambiguous: number; importable: number };
  unmatched: UnmatchedRow[];
  ambiguous: AmbiguousRow[];
}

interface ImportItem extends Partial<Blocked> { priority_customer_no: string; error?: string }
interface ImportResult {
  created: { priority_customer_no: string; customer_id: string; customer_name: string }[];
  conflicts: ImportItem[];
  skipped: ImportItem[];
  failed: ImportItem[];
  summary: { requested: number; created: number; conflicts: number; skipped: number; failed: number };
}

export const LINK_QUEUE_KEY = ['priority', 'unmatched'] as const;

export function useLinkQueue() {
  return useQuery<LinkQueueResponse>({
    queryKey: LINK_QUEUE_KEY,
    queryFn: () => priorityApi.getUnmatched().then((r) => r.data),
    retry: false,
  });
}

function reasonText(b: Partial<Blocked> & { error?: string }): string {
  const who = b.customer_name ? `"${b.customer_name}"` : 'לקוח אחר';
  switch (b.reason) {
    case 'vat_exists':
      return `ח.פ. כבר קיים ב-CRM אצל ${who}${b.customer_priority_no ? ` (מקושר ל-${b.customer_priority_no})` : ''}`;
    case 'name_exists':
      return `לקוח בשם זהה כבר קיים ב-CRM: ${who}`;
    case 'priority_duplicate':
      return `כפילות ב-Priority: לחשבון ${b.customer_priority_no ?? 'אחר'} עם אותו ח.פ. כבר יש כרטיס (${who})`;
    case 'already_linked':
      return b.customer_name ? `המספר כבר מקושר ל-${who}` : 'המספר כבר מקושר ללקוח ב-CRM';
    case 'linked_to_deleted':
      return `המספר מקושר ללקוח שנמחק (${who}). יש לנתק אותו קודם`;
    case 'not_in_mirror':
      return 'המספר לא נמצא בחשבונות הלקוח של Priority';
    case 'missing_name':
      return 'לחשבון אין שם ב-Priority';
    case 'invalid_no':
      return 'מספר לקוח לא תקין';
    default:
      return b.error ? `שגיאה: ${b.error}` : 'לא נוצר';
  }
}

function QueueError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notConfigured = httpStatus(error) === 503;
  return (
    <div className="card border-r-4 border-danger-500">
      <p className="font-semibold text-danger-700">
        {notConfigured ? MIRROR_NOT_CONFIGURED : 'לא ניתן לטעון את תור הקישור'}
      </p>
      {!notConfigured && (
        <>
          <p className="text-sm text-gray-600 mt-1">זו תקלת חיבור או הרשאה מול המראה — לא "אין חשבונות".</p>
          <button onClick={onRetry} className="btn-secondary text-sm px-3 py-1 mt-2">נסה שוב</button>
        </>
      )}
    </div>
  );
}

function matchesFilter(q: string, ...fields: (string | null | undefined)[]) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(needle));
}

function FilterBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        placeholder="סינון לפי שם, מספר, ח.פ. או עיר..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input input-with-icon"
      />
    </div>
  );
}

function useInvalidateQueue() {
  const queryClient = useQueryClient();
  return (customerIds: string[] = []) => {
    queryClient.invalidateQueries({ queryKey: LINK_QUEUE_KEY });
    queryClient.invalidateQueries({ queryKey: ['priority', 'link-proposals'] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    for (const id of customerIds) {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: priorityCustomerKey(id) });
    }
  };
}

// ── לקוחות ללא כרטיס ─────────────────────────────────────────────────────────

function ImportResultPanel({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const problems = [...result.conflicts, ...result.skipped, ...result.failed];
  return (
    <div className={`card border-r-4 ${problems.length ? 'border-warning-500' : 'border-success-500'}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-gray-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-success-600" />
          נוצרו וקושרו {result.summary.created} לקוחות
          {problems.length > 0 && ` · ${problems.length} לא נוצרו`}
        </p>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">סגירה</button>
      </div>
      {result.created.length > 0 && (
        <ul className="mt-2 text-sm space-y-0.5">
          {result.created.map((c) => (
            <li key={c.priority_customer_no}>
              <span className="tabular-nums text-gray-500">{c.priority_customer_no}</span>{' '}
              <Link to={`/customers/${c.customer_id}`} className="text-primary-600 hover:text-primary-700">
                {c.customer_name}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {problems.length > 0 && (
        <ul className="mt-3 text-sm space-y-0.5 text-warning-700">
          {problems.map((p) => (
            <li key={p.priority_customer_no}>
              <span className="tabular-nums">{p.priority_customer_no}</span> — {reasonText(p)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function UnmatchedTab() {
  const q = useLinkQueue();
  const invalidate = useInvalidateQueue();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const rows = useMemo(() => q.data?.unmatched ?? [], [q.data]);
  const visible = rows.filter((r) =>
    matchesFilter(filter.trim(), r.priority_name, r.priority_customer_no, r.priority_vat_id, r.city));
  const visibleOpen = visible.filter((r) => !r.blocked);

  // אחרי רענון: מה שכבר לא פתוח ליצירה יוצא מהבחירה
  useEffect(() => {
    const open = new Set(rows.filter((r) => !r.blocked).map((r) => r.priority_customer_no));
    setSelected((prev) => {
      const next = new Set([...prev].filter((no) => open.has(no)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const importMutation = useMutation({
    mutationFn: (nos: string[]) => priorityApi.importCustomers(nos).then((r) => r.data as ImportResult),
    onSuccess: (res) => {
      setResult(res);
      setSelected(new Set());
      setConfirming(false);
      invalidate(res.created.map((c) => c.customer_id));
      const notCreated = res.summary.requested - res.summary.created;
      if (res.summary.created > 0) {
        toast.success(`נוצרו וקושרו ${res.summary.created} לקוחות${notCreated ? ` · ${notCreated} לא נוצרו` : ''}`);
      } else {
        toast.error('לא נוצר אף לקוח — הפירוט מעל הטבלה');
      }
    },
    onError: (err) => {
      setConfirming(false);
      const status = httpStatus(err);
      if (status === 503) toast.error(MIRROR_NOT_CONFIGURED);
      else if (status === 400) {
        const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
        toast.error(msg || 'בקשה לא תקינה');
      } else if (status === 502) toast.error('לא ניתן לקרוא את המראה של Priority');
      // 403 ו-5xx אחרים: המיירט הגלובלי כבר הציג הודעה
    },
  });

  if (q.isLoading) return <SkeletonGrid />;
  if (q.isError) return <QueueError error={q.error} onRetry={() => q.refetch()} />;

  const s = q.data?.summary;
  const allVisibleSelected = visibleOpen.length > 0 && visibleOpen.every((r) => selected.has(r.priority_customer_no));
  const toggle = (no: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(no)) next.delete(no); else next.add(no);
    return next;
  });
  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    for (const r of visibleOpen) {
      if (allVisibleSelected) next.delete(r.priority_customer_no); else next.add(r.priority_customer_no);
    }
    return next;
  });
  const busy = importMutation.isPending || q.isFetching;

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="text-gray-800">
          <b className="tabular-nums">{rows.length}</b> חשבונות לקוח ב-Priority בלי כרטיס ב-CRM
          {s && <> · <b className="tabular-nums">{s.importable}</b> אפשר ליצור · <b className="tabular-nums">{rows.length - s.importable}</b> חסומים</>}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          נוצר רק מה שמסומן. כל לקוח חדש מקבל שם, ח.פ. ועיר מ-Priority ומקושר מיד למספר שלו (קישור ידני).
          חשבון שהח.פ. או השם שלו כבר קיימים ב-CRM חסום — כדי לא ליצור כפילות.
        </p>
      </div>

      {result && <ImportResultPanel result={result} onClose={() => setResult(null)} />}

      <FilterBox value={filter} onChange={setFilter} />

      <div className="card flex flex-wrap items-center justify-between gap-3 py-3">
        <span className="text-sm text-gray-700">
          נבחרו <b className="tabular-nums">{selected.size}</b>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-primary-600 hover:text-primary-700 mr-2">
              ניקוי
            </button>
          )}
        </span>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-700">
              ייווצרו <b className="tabular-nums">{selected.size}</b> לקוחות חדשים ב-CRM, כל אחד מקושר לחשבון שלו ב-Priority. להמשיך?
            </span>
            <button
              onClick={() => importMutation.mutate([...selected])}
              disabled={busy || selected.size === 0}
              className="btn-primary text-sm px-3 py-1.5"
            >
              {importMutation.isPending ? 'יוצר...' : 'כן, צור וקשר'}
            </button>
            <button onClick={() => setConfirming(false)} disabled={importMutation.isPending} className="btn-secondary text-sm px-3 py-1.5">
              ביטול
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={busy || selected.size === 0}
            className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5"
          >
            <UserPlus className="w-4 h-4" />
            צור וקשר{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          {rows.length === 0 ? 'לכל חשבונות הלקוח ב-Priority יש כרטיס או הצעת התאמה.' : `לא נמצאו חשבונות עבור "${filter}".`}
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  aria-label="בחירת כל החשבונות הפתוחים ליצירה"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  disabled={busy || visibleOpen.length === 0}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <th>מספר</th><th>שם ב-Priority</th><th>ח.פ / ע.מ</th><th>עיר</th>
              <th>מסמכים</th><th>חשבוניות מס נטו</th><th>מסמך אחרון</th>
            </tr></thead>
            <tbody>
              {visible.map((r) => {
                const no = r.priority_customer_no;
                return (
                  <tr key={no} className={r.blocked ? 'opacity-60' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`בחירת ${r.priority_name || no}`}
                        checked={selected.has(no)}
                        onChange={() => toggle(no)}
                        disabled={busy || !!r.blocked}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="tabular-nums">{no}</td>
                    {/* הסיבה לחסימה מתחת לשם ולא בעמודה אחרונה — בטבלה רחבה עמודה אחרונה נחתכת */}
                    <td className="min-w-[12rem]">
                      <p>{r.priority_name ?? '—'}</p>
                      {r.blocked && (
                        <p className="text-xs text-warning-700 mt-0.5 whitespace-normal">
                          {reasonText(r.blocked)}
                          {r.blocked.customer_id && r.blocked.reason !== 'linked_to_deleted' && (
                            <>{' '}<Link to={`/customers/${r.blocked.customer_id}`} className="text-primary-600 hover:text-primary-700">לכרטיס</Link></>
                          )}
                        </p>
                      )}
                      {r.priority_duplicates.length > 0 && (
                        <span className="badge-warning mt-1">כפילות ב-Priority: {r.priority_duplicates.join(', ')}</span>
                      )}
                    </td>
                    <td className="tabular-nums">{r.priority_vat_id ?? '—'}</td>
                    <td>{r.city ?? '—'}</td>
                    <td className="tabular-nums">
                      {r.doc_count}
                      {r.cancelled_count > 0 && <span className="text-xs text-gray-400"> (+{r.cancelled_count} מבוטלים)</span>}
                    </td>
                    <td className="tabular-nums">{r.doc_count ? shekel(r.tax_invoices_net) : '—'}</td>
                    <td className="tabular-nums">{fmtDate(r.last_doc_date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── דו-משמעיים ───────────────────────────────────────────────────────────────

function AccountLine({ a }: { a: AmbiguousRow }) {
  return (
    <span className="text-sm text-gray-600 tabular-nums">
      {a.priority_customer_no}
      {a.priority_vat_id ? ` · ח.פ. ${a.priority_vat_id}` : ''}
      {a.city ? ` · ${a.city}` : ''}
      {' · '}
      {a.doc_count
        ? `${a.doc_count === 1 ? 'מסמך אחד' : `${a.doc_count} מסמכים`} · נטו ${shekel(a.tax_invoices_net)} · אחרון ${fmtDate(a.last_doc_date)}`
        : 'אין מסמכים'}
    </span>
  );
}

interface Choice { no: string; customerId: string; customerName: string }

export function AmbiguousTab() {
  const q = useLinkQueue();
  const invalidate = useInvalidateQueue();
  const [filter, setFilter] = useState('');
  const [choice, setChoice] = useState<Choice | null>(null);

  const linkMutation = useMutation({
    mutationFn: (c: Choice) =>
      priorityApi.setLink({ customer_id: c.customerId, priority_customer_no: c.no, matched_by: 'manual' }),
    onSuccess: (_res, c) => {
      setChoice(null);
      invalidate([c.customerId]);
      toast.success(`"${c.customerName}" קושר ללקוח ${c.no} ב-Priority`);
    },
    onError: (err, c) => {
      const msg = linkErrorMessage(err, c.no);
      if (msg) toast.error(msg);
    },
  });

  const rows = useMemo(() => q.data?.ambiguous ?? [], [q.data]);

  if (q.isLoading) return <SkeletonGrid />;
  if (q.isError) return <QueueError error={q.error} onRetry={() => q.refetch()} />;

  const f = filter.trim();
  const hit = (a: AmbiguousRow) => matchesFilter(f, a.priority_name, a.priority_customer_no, a.priority_vat_id, a.city)
    || a.customers.some((c) => matchesFilter(f, c.customer_name, c.business_id));

  // כמה חשבונות Priority ← לקוח CRM אחד: כרטיס אחד ללקוח, לבחירת החשבון הנכון
  const dupGroups = new Map<string, { customer: Candidate; accounts: AmbiguousRow[] }>();
  for (const a of rows.filter((x) => x.reason === 'priority_duplicate' && hit(x))) {
    const c = a.customers[0];
    if (!c) continue;
    const g = dupGroups.get(c.customer_id) ?? { customer: c, accounts: [] };
    g.accounts.push(a);
    dupGroups.set(c.customer_id, g);
  }
  const several = rows.filter((x) => x.reason === 'several_crm_customers' && hit(x));

  // בזמן קישור ובזמן רענון התור — כל הכפתורים נעולים. POST /links מחליף קישור קיים של הלקוח,
  // כך שלחיצה על שני חשבונות של אותו לקוח לפני שהתור התעדכן הייתה דורסת את הבחירה הראשונה.
  const busy = linkMutation.isPending || q.isFetching;
  const isChosen = (no: string, customerId: string) => choice?.no === no && choice.customerId === customerId;

  const linkButton = (no: string, c: Candidate, label: string) => (
    isChosen(no, c.customer_id) ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-700">
          לקשר את "{c.customer_name}" ללקוח <b className="tabular-nums">{no}</b> ב-Priority?
        </span>
        <button onClick={() => linkMutation.mutate(choice!)} disabled={busy} className="btn-primary text-sm px-3 py-1.5">
          {linkMutation.isPending ? 'מקשר...' : 'אשר קישור'}
        </button>
        <button onClick={() => setChoice(null)} disabled={linkMutation.isPending} className="btn-secondary text-sm px-3 py-1.5">
          ביטול
        </button>
      </div>
    ) : (
      <button
        onClick={() => setChoice({ no, customerId: c.customer_id, customerName: c.customer_name })}
        disabled={busy}
        className="btn-secondary text-sm flex items-center gap-1 px-3 py-1.5 shrink-0"
      >
        <Link2 className="w-4 h-4" />
        {label}
      </button>
    )
  );

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="text-gray-800"><b className="tabular-nums">{rows.length}</b> התאמות דו-משמעיות — נדרשת בחירה ידנית</p>
        <p className="text-sm text-gray-500 mt-1">
          הקישור ידני ואפשר לבטל אותו בכרטיס הלקוח. אם אף מועמד אינו נכון, אפשר לחפש ידנית בכרטיס הלקוח
          (קישור ל-Priority ← חיפוש ידני).
        </p>
      </div>

      <FilterBox value={filter} onChange={setFilter} />

      {dupGroups.size === 0 && several.length === 0 && (
        <div className="card text-center py-10 text-gray-500">
          {rows.length === 0 ? 'אין התאמות דו-משמעיות.' : `לא נמצאו התאמות עבור "${filter}".`}
        </div>
      )}

      {[...dupGroups.values()].map(({ customer, accounts }) => (
        <div key={`dup-${customer.customer_id}`} className="card border-r-4 border-warning-500 space-y-3">
          <div>
            <p className="font-semibold text-warning-700 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              ללקוח אחד ב-CRM יש {accounts.length} חשבונות תואמים ב-Priority (כפילות ב-Priority)
            </p>
            <p className="text-sm mt-1">
              לקוח CRM:{' '}
              <Link to={`/customers/${customer.customer_id}`} className="text-primary-600 hover:text-primary-700 font-medium">
                {customer.customer_name}
              </Link>
              {customer.business_id && <span className="text-gray-500 tabular-nums"> · ח.פ. {customer.business_id}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              בוחרים חשבון אחד. החשבון השני יעבור ללשונית "לקוחות ללא כרטיס", חסום כי הח.פ. שלו כבר בשימוש.
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {accounts.map((a) => (
              <li key={a.priority_customer_no} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{a.priority_name || '—'}</p>
                  <AccountLine a={a} />
                </div>
                {linkButton(a.priority_customer_no, customer, `קשר את ${a.priority_customer_no}`)}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {several.map((a) => (
        <div key={`several-${a.priority_customer_no}`} className="card border-r-4 border-warning-500 space-y-3">
          <div>
            <p className="font-semibold text-warning-700 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              חשבון Priority אחד מתאים ל-{a.customers.length} לקוחות ב-CRM ({a.matched_by === 'vat' ? 'אותו ח.פ.' : 'אותו שם'})
            </p>
            <p className="font-medium mt-1">{a.priority_name || '—'}</p>
            <AccountLine a={a} />
          </div>
          <ul className="divide-y divide-gray-100">
            {a.customers.map((c) => (
              <li key={c.customer_id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0">
                  <Link to={`/customers/${c.customer_id}`} className="text-primary-600 hover:text-primary-700 font-medium">
                    {c.customer_name}
                  </Link>
                  {c.business_id && <span className="text-sm text-gray-500 tabular-nums"> · ח.פ. {c.business_id}</span>}
                </p>
                {linkButton(a.priority_customer_no, c, 'קשר ללקוח זה')}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
