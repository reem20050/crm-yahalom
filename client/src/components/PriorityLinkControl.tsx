/**
 * קישור לקוח CRM ↔ מספר לקוח ב-Priority (200xxx). כרטיס צד בכרטיס הלקוח.
 *
 * קישור הוא **הצעה + אישור מנהל** בלבד: אין יצירה ואין מיזוג אוטומטיים. רק כמחצית
 * מהלקוחות מותאמים אוטומטית (ח.פ. או שם), ולכן יש גם חיפוש ידני.
 *
 * הצעות ההתאמה נטענות רק בלחיצה: המסלול קורא את כל החשבונות ואת כל הלקוחות,
 * ואין סיבה להריץ אותו בכל פתיחת כרטיס.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Link2, Search, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import { priorityApi } from '../services/api';
import {
  MATCHED_BY_LABELS,
  MIRROR_NOT_CONFIGURED,
  type MatchedBy,
  fmtDate,
  httpStatus,
  priorityCustomerKey,
  usePriorityCustomer,
} from './PriorityCustomerDocs';

interface CustomerLinkFields {
  priority_customer_no?: string | number | null;
  priority_matched_by?: string | null;
  priority_confirmed_at?: string | null;
}

interface Proposal {
  priority_customer_no: string;
  priority_name: string | null;
  priority_vat_id: string | null;
  customer_id: string;
  customer_name: string;
  business_id: string | null;
  matched_by: MatchedBy;
}

interface AmbiguousEntry {
  priority_customer_no: string;
  priority_name: string | null;
  priority_vat_id: string | null;
  matched_by: MatchedBy;
  reason: 'several_crm_customers' | 'priority_duplicate';
  customers: { customer_id: string; customer_name: string; business_id: string | null }[];
}

interface LinkProposalsResponse {
  proposals: Proposal[];
  ambiguous: AmbiguousEntry[];
}

interface AccountRow {
  account_key: string;
  account_name: string | null;
  kind: string | null;
  party_vat_id: string | null;
  city: string | null;
  balance: number | null;
}

const PROPOSALS_KEY = ['priority', 'link-proposals'] as const;

const AMBIGUOUS_REASON: Record<AmbiguousEntry['reason'], string> = {
  several_crm_customers: 'החשבון ב-Priority מתאים לכמה לקוחות ב-CRM',
  priority_duplicate: 'ללקוח זה יש כמה חשבונות תואמים ב-Priority',
};

const isMatchedBy = (v: unknown): v is MatchedBy => v === 'vat' || v === 'name' || v === 'manual';

/** confirmed_at היא חותמת זמן אמיתית (לא תאריך בלבד) — מציגים לפי שעון ישראל, לא לפי התאריך ב-UTC. */
function fmtTimestamp(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fmtDate(v) : d.toLocaleDateString('he-IL');
}

/** הודעה לשגיאת קישור. null = המיירט הגלובלי כבר הציג הודעה (403 / 5xx כללי). */
function linkErrorMessage(err: unknown, no: string): string | null {
  const status = httpStatus(err);
  switch (status) {
    case 400:
      return 'מספר לקוח Priority לא תקין';
    case 404:
      return 'הלקוח לא נמצא';
    case 409: {
      const name = (err as { response?: { data?: { conflict?: { customer_name?: string } } } })
        .response?.data?.conflict?.customer_name;
      return name
        ? `מספר ${no} כבר מקושר ללקוח "${name}"`
        : `מספר ${no} כבר מקושר ללקוח אחר`;
    }
    case 422:
      return `מספר ${no} לא נמצא במראה של Priority`;
    case 503:
      return MIRROR_NOT_CONFIGURED;
    case 502:
      return 'לא ניתן לאמת את המספר מול המראה של Priority';
    case 403:
      return null;
    default:
      return status && status >= 500 ? null : 'שגיאה בקישור ל-Priority';
  }
}

function unlinkErrorMessage(err: unknown): string | null {
  const status = httpStatus(err);
  if (status === 404) return 'הלקוח לא נמצא';
  if (status === 503) return MIRROR_NOT_CONFIGURED;
  if (status === 403 || (status && status >= 500)) return null;
  return 'שגיאה בניתוק הקישור ל-Priority';
}

export default function PriorityLinkControl({
  customerId,
  customer,
}: {
  customerId: string;
  customer: CustomerLinkFields;
}) {
  const queryClient = useQueryClient();
  const linkedNo = customer.priority_customer_no ? String(customer.priority_customer_no) : '';

  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [proposalsRequested, setProposalsRequested] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<AccountRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // אחרי קישור/ניתוק מצב הקומפוננטה מתאפס — כדי שלא תישאר בחירה ישנה במסך.
  useEffect(() => {
    setConfirmUnlink(false);
    setPicked(null);
    setSearch('');
  }, [linkedNo]);

  // --- Queries ---

  // אותו מפתח כמו כרטיס המסמכים — בקשה אחת לשניהם. ממנו מגיע confirmed_by_name.
  const docsQ = usePriorityCustomer(customerId, !!linkedNo);

  const proposalsQ = useQuery<LinkProposalsResponse>({
    queryKey: PROPOSALS_KEY,
    queryFn: () => priorityApi.getLinkProposals().then((r) => r.data),
    enabled: !linkedNo && proposalsRequested,
    retry: false,
  });

  const accountsQ = useQuery<{ rows: AccountRow[]; total: number }>({
    queryKey: ['priority', 'link-search', debounced],
    queryFn: () =>
      priorityApi.getAccounts({ kind: 'customer', q: debounced, limit: 20 }).then((r) => r.data),
    enabled: !linkedNo && debounced.length >= 2,
    retry: false,
  });

  // --- Mutations ---

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
    queryClient.invalidateQueries({ queryKey: priorityCustomerKey(customerId) });
    queryClient.invalidateQueries({ queryKey: PROPOSALS_KEY });
  };

  const linkMutation = useMutation({
    mutationFn: (v: { priority_customer_no: string; matched_by: MatchedBy }) =>
      priorityApi.setLink({ customer_id: customerId, ...v }),
    onSuccess: (_res, v) => {
      invalidate();
      toast.success(`הלקוח קושר ללקוח ${v.priority_customer_no} ב-Priority`);
    },
    onError: (err, v) => {
      const msg = linkErrorMessage(err, v.priority_customer_no);
      if (msg) toast.error(msg);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => priorityApi.removeLink(customerId),
    onSuccess: () => {
      invalidate();
      toast.success('הקישור ל-Priority נותק');
    },
    onError: (err) => {
      const msg = unlinkErrorMessage(err);
      if (msg) toast.error(msg);
    },
  });

  const busy = linkMutation.isPending || unlinkMutation.isPending;

  // --- Linked ---

  if (linkedNo) {
    // כשהמראה לא זמינה (503/502) נופלים לשדות של הלקוח עצמו — כדי שעדיין יהיה
    // אפשר לראות את הקישור ולנתק אותו.
    const res = docsQ.data?.linked ? docsQ.data : null;
    const matchedBy = res?.link.matched_by ?? customer.priority_matched_by;
    const confirmedAt = res?.link.confirmed_at ?? customer.priority_confirmed_at;
    const confirmedBy = res?.link.confirmed_by_name;

    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 font-heading flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary-600" />
          קישור ל-Priority
        </h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-gray-500">מספר לקוח ב-Priority</dt>
            <dd className="font-medium tabular-nums">{linkedNo}</dd>
          </div>
          {res?.account?.account_name && (
            <div>
              <dt className="text-sm text-gray-500">שם ב-Priority</dt>
              <dd className="font-medium">{res.account.account_name}</dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">אופן ההתאמה</dt>
            <dd>
              <span className="badge badge-info">
                {isMatchedBy(matchedBy) ? MATCHED_BY_LABELS[matchedBy] : matchedBy || '-'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">אושר</dt>
            <dd className="font-medium">
              {confirmedAt ? fmtTimestamp(confirmedAt) : '-'}
              {confirmedBy ? ` · ${confirmedBy}` : ''}
            </dd>
          </div>
        </dl>

        <div className="mt-4 pt-4 border-t border-gray-100">
          {confirmUnlink ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                לנתק את הלקוח ממספר <strong className="tabular-nums">{linkedNo}</strong> ב-Priority?
                מסמכי Priority לא יוצגו עוד בכרטיס.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => unlinkMutation.mutate()}
                  disabled={busy}
                  className="btn-danger text-sm px-3 py-1.5"
                >
                  {unlinkMutation.isPending ? 'מנתק...' : 'כן, נתק'}
                </button>
                <button
                  onClick={() => setConfirmUnlink(false)}
                  disabled={busy}
                  className="btn-secondary text-sm px-3 py-1.5"
                >
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmUnlink(true)}
              className="btn-secondary text-sm flex items-center gap-1 px-3 py-1.5"
            >
              <Unlink className="w-4 h-4" />
              נתק
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- Not linked ---

  const mine = (proposalsQ.data?.proposals ?? []).filter(
    (p) => String(p.customer_id) === customerId,
  );
  const myAmbiguous = (proposalsQ.data?.ambiguous ?? []).filter((a) =>
    (a.customers ?? []).some((c) => String(c.customer_id) === customerId),
  );
  const accounts = accountsQ.data?.rows ?? [];
  const accountsTotal = accountsQ.data?.total ?? 0;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-1 font-heading flex items-center gap-2">
        <Link2 className="w-5 h-5 text-primary-600" />
        קישור ל-Priority
      </h2>
      <p className="text-sm text-gray-500 mb-4">הלקוח אינו מקושר למספר לקוח ב-Priority.</p>

      {/* (א) הצעות התאמה */}
      {!proposalsRequested ? (
        <button
          onClick={() => setProposalsRequested(true)}
          className="btn-primary text-sm flex items-center gap-1 px-3 py-1.5"
        >
          <Search className="w-4 h-4" />
          חפש התאמה
        </button>
      ) : proposalsQ.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
        </div>
      ) : proposalsQ.isError ? (
        <div className="p-3 rounded-lg bg-danger-50 text-sm">
          <p className="text-danger-700 font-medium">
            {httpStatus(proposalsQ.error) === 503 ? MIRROR_NOT_CONFIGURED : 'לא ניתן לטעון הצעות התאמה'}
          </p>
          {httpStatus(proposalsQ.error) !== 503 && (
            <button
              onClick={() => proposalsQ.refetch()}
              disabled={proposalsQ.isFetching}
              className="btn-secondary text-sm px-3 py-1 mt-2"
            >
              נסה שוב
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {mine.map((p) => (
            <div key={p.priority_customer_no} className="p-3 bg-success-50 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.priority_name || '—'}</p>
                  <p className="text-sm text-gray-500 tabular-nums">
                    {p.priority_customer_no}
                    {p.priority_vat_id ? ` · ח.פ. ${p.priority_vat_id}` : ''}
                  </p>
                  <span className="badge badge-info mt-1">{MATCHED_BY_LABELS[p.matched_by] ?? p.matched_by}</span>
                </div>
                <button
                  onClick={() =>
                    linkMutation.mutate({ priority_customer_no: p.priority_customer_no, matched_by: p.matched_by })
                  }
                  disabled={busy}
                  className="btn-primary text-sm px-3 py-1.5 shrink-0"
                >
                  {linkMutation.isPending ? 'מקשר...' : 'אשר'}
                </button>
              </div>
            </div>
          ))}

          {myAmbiguous.map((a) => (
            <div key={`${a.priority_customer_no}-${a.reason}`} className="p-3 bg-warning-50 rounded-lg text-sm">
              <p className="font-medium text-warning-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                התאמה דו-משמעית — נדרשת בחירה ידנית
              </p>
              <p className="mt-1">
                {a.priority_name || '—'}{' '}
                <span className="text-gray-500 tabular-nums">({a.priority_customer_no})</span>
              </p>
              <p className="text-gray-600 mt-0.5">{AMBIGUOUS_REASON[a.reason] ?? a.reason}</p>
              {a.reason === 'several_crm_customers' && a.customers.length > 0 && (
                <ul className="text-gray-600 mt-1 list-disc pr-5">
                  {a.customers.map((c) => (
                    <li key={c.customer_id}>
                      {c.customer_name}
                      {String(c.customer_id) === customerId ? ' (לקוח זה)' : ''}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => { setSearch(a.priority_customer_no); setPicked(null); }}
                className="text-primary-600 hover:text-primary-700 text-sm mt-1"
              >
                חפש ידנית לפי המספר
              </button>
            </div>
          ))}

          {mine.length === 0 && myAmbiguous.length === 0 && (
            <p className="text-sm text-gray-500">לא נמצאה הצעת התאמה ללקוח זה. אפשר לחפש ידנית.</p>
          )}
        </div>
      )}

      {/* (ב) חיפוש ידני */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <label className="label">חיפוש ידני ב-Priority</label>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPicked(null); }}
            className="input input-with-icon"
            placeholder="שם, מספר לקוח או ח.פ."
          />
        </div>

        {picked ? (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg space-y-2">
            <p className="text-sm text-gray-700">
              לקשר את הלקוח ל-<strong>{picked.account_name || picked.account_key}</strong>{' '}
              <span className="tabular-nums">({picked.account_key})</span>?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  linkMutation.mutate({ priority_customer_no: String(picked.account_key), matched_by: 'manual' })
                }
                disabled={busy}
                className="btn-primary text-sm px-3 py-1.5"
              >
                {linkMutation.isPending ? 'מקשר...' : 'אשר קישור'}
              </button>
              <button
                onClick={() => setPicked(null)}
                disabled={busy}
                className="btn-secondary text-sm px-3 py-1.5"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : debounced.length >= 2 && (
          <div className="mt-2">
            {accountsQ.isLoading ? (
              <p className="text-sm text-gray-500 py-2">מחפש...</p>
            ) : accountsQ.isError ? (
              <p className="text-sm text-danger-700 py-2">
                {httpStatus(accountsQ.error) === 503 ? MIRROR_NOT_CONFIGURED : 'שגיאה בחיפוש ב-Priority'}
              </p>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">לא נמצאו לקוחות ב-Priority עבור "{debounced}"</p>
            ) : (
              <>
                <ul className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {accounts.map((a) => (
                    <li key={a.account_key}>
                      <button
                        onClick={() => setPicked(a)}
                        className="w-full text-right p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium">{a.account_name || '—'}</p>
                        <p className="text-xs text-gray-500 tabular-nums">
                          {a.account_key}
                          {a.party_vat_id ? ` · ח.פ. ${a.party_vat_id}` : ''}
                          {a.city ? ` · ${a.city}` : ''}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
                {accountsTotal > accounts.length && (
                  <p className="text-xs text-gray-400 mt-1">
                    מוצגים {accounts.length} מתוך {accountsTotal.toLocaleString('he-IL')} — יש לצמצם את החיפוש
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
