/**
 * מסך Priority — נתוני ההנהלת-חשבונות מתוך המראה (`priority_mirror` ב-Supabase).
 *
 * למה מהמראה ולא מ-Priority ישירות:
 *   קריאות ל-API של Priority נספרות במכסת הטרנזקציות של החברה. מסך שמושך חי
 *   בכל רענון הוא באג עלות, לא פיצ'ר. בנוסף — ה-API חסום כרגע ברמת מודול.
 *
 * למה דרך השרת: הקרדנציאלים של המראה יושבים ב-`src/routes/priority.js` ולא
 * מגיעים לדפדפן. המסך מדבר רק עם ה-API של ה-CRM, באותו JWT כמו כל שאר המסכים.
 *
 * 🔴 ההבחנה המרכזית של המסך: **מתי נטען ≠ עד מתי נכון.**
 *   `lastRun.started_at` אומר מתי רצה הטעינה. `dataAsOf` (תאריך התנועה
 *   האחרונה) אומר עד מתי הנתונים נכונים. אפשר לטעון היום ייצוא שהתנועה
 *   האחרונה בו בת חודש — ומסך שמציג רק את הראשון ישקר בביטחון מלא.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database, Search, RefreshCw, AlertTriangle, CheckCircle2, Clock, FileText,
} from 'lucide-react';
import { priorityApi } from '../services/api';
import { SkeletonGrid } from '../components/Skeleton';
import { AmbiguousTab, LINK_QUEUE_KEY, UnmatchedTab } from '../components/PriorityLinkQueue';
import PriorityCollections from '../components/PriorityCollections';
import PriorityDocumentDrawer from '../components/PriorityDocumentDrawer';

type DataTab = 'journal' | 'accounts' | 'documents';
// לשוניות תור הקישור: נטענות מ-/priority/unmatched, עם סינון מקומי משלהן
type QueueTab = 'unmatched' | 'ambiguous';
// "מי חייב": סטטוס תשלום נגזר (p_customer_status), נטען מ-/priority/collections
type Tab = DataTab | QueueTab | 'collections';
const TAB_KEYS = ['journal', 'accounts', 'documents', 'collections', 'unmatched', 'ambiguous'] as const;
const isQueueTab = (t: Tab): t is QueueTab => t === 'unmatched' || t === 'ambiguous';
const COLLECTIONS_KEY = ['priority-collections'];

interface Summary {
  dataAsOf: string | null;
  staleDays: number | null;
  journalRows: number;
  lastRun: {
    source: string | null; started_at: string | null;
    period_start: string | null; period_end: string | null;
    records_loaded: number | null;
  } | null;
  summary: {
    receivable: number | null; payable: number | null;
    customer_count: number | null;
    doc_count: number | null; doc_gross: number | null; doc_vat: number | null;
  } | null;
}

interface JournalRow {
  id: number; entry_no: string | null; line_no: number | null;
  account_key: string | null; counter_account: string | null;
  account_name?: string | null; counter_name?: string | null;
  entry_date: string | null; reference: string | null;
  details: string | null; debit_credit: string | null; amount: number | null;
}

// סוג החשבון במראה (customer / supplier / gl) — בתצוגה בעברית
const ACCOUNT_KINDS: Record<string, string> = { customer: 'לקוח', supplier: 'ספק', gl: 'חשבון הנהלת חשבונות' };

interface AccountRow {
  account_key: string; account_name: string | null; kind: string | null;
  party_vat_id: string | null; city: string | null; balance: number | null;
}

interface DocRow {
  id: number; doc_type: number; doc_no: string; issue_date: string | null;
  party_name: string | null; party_vat_id: string | null;
  total_incl_vat: number | null; vat_amount: number | null; cancelled: boolean;
}

const DOC_TYPES: Record<number, string> = {
  300: 'חשבון עסקה',
  305: 'חשבונית מס',
  320: 'חשבונית מס/קבלה',
  330: 'זיכוי',
  400: 'קבלה',
};

// שתי ספרות אחרי הנקודה — בעיגול לשקל שלם השורות לא מסתכמות לסך המוצג
// (1800.49 + 1800.49 הופיעו כ-1,800 + 1,800 מול סך 3,601).
const shekel = (n: number | null | undefined) =>
  n == null ? '—'
    : n.toLocaleString('he-IL', {
      style: 'currency', currency: 'ILS',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });

/** באנר עדכניות. הוא הדבר הראשון שנראה, כי בלעדיו כל מספר אחר במסך חסר-הקשר. */
function Freshness({ asOf, days }: { asOf: string | null; days: number | null }) {
  if (!asOf || days == null) {
    return (
      <div className="card flex items-start gap-3 border-r-4 border-gray-300">
        <Clock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-gray-700">אין נתוני עדכניות</p>
          <p className="text-sm text-gray-500">המראה ריקה, או שהטעינה מעולם לא רצה.</p>
        </div>
      </div>
    );
  }

  const tone = days <= 7
    ? { border: 'border-success-500', text: 'text-success-700', Icon: CheckCircle2 }
    : days <= 31
      ? { border: 'border-warning-500', text: 'text-warning-700', Icon: AlertTriangle }
      : { border: 'border-danger-500', text: 'text-danger-700', Icon: AlertTriangle };
  const { Icon } = tone;

  return (
    <div className={`card flex items-start gap-3 border-r-4 ${tone.border}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${tone.text}`} />
      <div className="min-w-0">
        <p className={`font-semibold ${tone.text}`}>
          תנועות היומן והיתרות (כרטסת) נכונות עד {asOf} — לפני {days} ימים
        </p>
        <p className="text-sm text-gray-600 mt-0.5 hidden sm:block">
          המסמכים ו"מי חייב" מתעדכנים כל לילה. הכרטסת מתעדכנת ידנית
          {days > 7 ? ' — לרענון לפנות לרעם.' : '.'}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function Priority() {
  // ברירת המחדל "מי חייב" — היומן הגולמי (קודי חשבון) הוא לרואה החשבון, לא לעבודה היומית.
  // ?tab=… מאפשר קישור ישיר (למשל מהדשבורד).
  const [params] = useSearchParams();
  const initialTab = (TAB_KEYS as readonly string[]).includes(params.get('tab') || '') ? params.get('tab') as Tab : 'collections';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [openDoc, setOpenDoc] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const queueTab = isQueueTab(tab);
  // לשונית עם טעינה משלה — בלי חיפוש ובלי rowsQ
  const ownTab = queueTab || tab === 'collections';

  const summaryQ = useQuery<Summary>({
    queryKey: ['priority', 'summary'],
    queryFn: () => priorityApi.getSummary().then((r) => r.data),
  });

  // החיפוש נשלח לשרת ולא מסנן מקומית: המראה מכילה אלפי תנועות, וסינון של
  // 100 השורות שנטענו היה נראה כאילו "אין תוצאות" בעוד שהן פשוט לא בדף.
  const rowsQ = useQuery({
    queryKey: ['priority', tab, search],
    queryFn: () => {
      const params = { limit: 100, q: search || undefined };
      if (tab === 'accounts') return priorityApi.getAccounts(params).then((r) => r.data);
      if (tab === 'documents') return priorityApi.getDocuments(params).then((r) => r.data);
      return priorityApi.getJournal(params).then((r) => r.data);
    },
    enabled: !ownTab,
  });

  const notConfigured =
    (summaryQ.error as { response?: { status?: number } } | null)?.response?.status === 503;

  if (notConfigured) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <h1 className="page-title">Priority</h1>
            <p className="page-subtitle">נתוני הנהלת חשבונות</p>
          </div>
        </div>
        <div className="card border-r-4 border-warning-500">
          <p className="font-semibold text-warning-700">החיבור למראה אינו מוגדר</p>
          <p className="text-sm text-gray-600 mt-1">
            חסרים משתני סביבה בשרת. נדרשים כל הארבעה יחד:{' '}
            <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>,{' '}
            <code>PRIORITY_MIRROR_EMAIL</code>, <code>PRIORITY_MIRROR_PASSWORD</code>.
          </p>
        </div>
      </div>
    );
  }

  const s = summaryQ.data;
  const rows = rowsQ.data?.rows ?? [];
  const total = rowsQ.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Database className="w-6 h-6 text-primary-600" />
            Priority
          </h1>
          <p className="page-subtitle">
            נתוני הנהלת חשבונות — קריאה בלבד מתוך המראה
          </p>
        </div>
        <button
          onClick={() => {
            summaryQ.refetch();
            if (queueTab) queryClient.invalidateQueries({ queryKey: LINK_QUEUE_KEY });
            else if (tab === 'collections') queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
            else rowsQ.refetch();
          }}
          className="btn-secondary flex items-center gap-2"
          disabled={summaryQ.isFetching || rowsQ.isFetching}
        >
          <RefreshCw className={`w-4 h-4 ${summaryQ.isFetching ? 'animate-spin' : ''}`} />
          רענון
        </button>
      </div>

      {summaryQ.isLoading ? <SkeletonGrid /> : summaryQ.isError ? (
        // כשל בקריאת הסיכום **חייב** להיראות ככשל. בלי הענף הזה המסך היה נופל
        // ל-Freshness עם ערכי null ומציג "אין נתוני עדכניות" — כלומר תקלת חיבור
        // הייתה מתחזה למראה ריקה. זה בדיוק הבלבול שהראוט מזהיר מפניו.
        <div className="card border-r-4 border-danger-500">
          <p className="font-semibold text-danger-700">לא ניתן לקרוא את מצב המראה</p>
          <p className="text-sm text-gray-600 mt-1">
            זו תקלת חיבור או הרשאה מול Supabase — <b>לא</b> "אין נתונים".
            המספרים למטה עלולים להיות חלקיים. הפירוט המלא ביומן השרת.
          </p>
        </div>
      ) : (
        <>
          <Freshness asOf={s?.dataAsOf ?? null} days={s?.staleDays ?? null} />

          {/* במובייל מוסתר: נתוני הכרטסת דוחקים את "מי חייב" אל מחוץ למסך */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ⚠️ המספר נכון לכרטסת, אך הכרטסת אינה כל החשיפה: חשבון עסקה אינו
                נכנס אליה, 2024 סגורה, והעוסק המורשה אינו כלול. בלי ההסתייגות
                המסך גורם להסיק שזו מלוא היתרה — טעות בטוחה-בעצמה. */}
            <Stat
              label="יתרת לקוחות"
              value={shekel(s?.summary?.receivable)}
              hint={`לפי הכרטסת${s?.dataAsOf ? ` עד ${s.dataAsOf}` : ''} — אינו כולל חשבון עסקה, 2024 והעוסק המורשה. לגבייה: "מי חייב"`}
            />
            <Stat label="יתרת ספקים" value={shekel(s?.summary?.payable)} />
            <Stat
              label="מסמכים פעילים"
              value={s?.summary?.doc_count != null
                ? s.summary.doc_count.toLocaleString('he-IL') : '—'}
              hint={s?.summary?.doc_gross != null
                ? `סה"כ כולל מע"מ: ${shekel(s.summary.doc_gross)}` : undefined}
            />
            <Stat
              label="תנועות יומן"
              value={(s?.journalRows ?? 0).toLocaleString('he-IL')}
              hint={s?.lastRun?.started_at
                ? `הטעינה האחרונה: ${new Date(s.lastRun.started_at).toLocaleDateString('he-IL')}`
                : undefined}
            />
          </div>
        </>
      )}

      {/* לשוניות */}
      <div className="flex gap-2 border-b border-gray-100 overflow-x-auto">
        {([
          ['collections', 'מי חייב'],
          ['documents', 'מסמכים'],
          ['accounts', 'חשבונות'],
          ['journal', 'תנועות יומן'],
          ['unmatched', 'לקוחות ללא כרטיס'],
          ['ambiguous', 'דו-משמעיים'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              tab === key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'unmatched' && <UnmatchedTab />}
      {tab === 'ambiguous' && <AmbiguousTab />}
      {tab === 'collections' && <PriorityCollections />}

      {!ownTab && (<>
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="חיפוש..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input input-with-icon"
        />
      </div>

      {rowsQ.isLoading ? <SkeletonGrid /> : rowsQ.isError ? (
        <div className="card border-r-4 border-danger-500">
          <p className="font-semibold text-danger-700">שגיאה בקריאת הנתונים</p>
          <p className="text-sm text-gray-600 mt-1">
            השרת לא הצליח לקרוא מהמראה. זו תקלת חיבור או הרשאה — לא "אין נתונים".
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          לא נמצאו רשומות{search ? ` עבור "${search}"` : ''}.
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            {tab === 'journal' && (
              <>
                <thead><tr>
                  <th>תאריך</th><th>תנועה</th><th>חשבון</th><th>חשבון נגדי</th>
                  <th>אסמכתא</th><th>פרטים</th><th>חובה</th><th>זכות</th>
                </tr></thead>
                <tbody>
                  {(rows as JournalRow[]).map((j) => (
                    <tr key={j.id}>
                      <td className="tabular-nums">{j.entry_date ?? '—'}</td>
                      <td className="tabular-nums">{j.entry_no ?? '—'}</td>
                      <td>
                        <span className="tabular-nums">{j.account_key ?? '—'}</span>
                        {j.account_name && <span className="block text-xs text-gray-500 max-w-[12rem] truncate">{j.account_name}</span>}
                      </td>
                      <td>
                        <span className="tabular-nums">{j.counter_account ?? '—'}</span>
                        {j.counter_name && <span className="block text-xs text-gray-500 max-w-[12rem] truncate">{j.counter_name}</span>}
                      </td>
                      <td>{j.reference ?? '—'}</td>
                      <td className="max-w-xs truncate">{j.details ?? '—'}</td>
                      <td className="tabular-nums">{j.debit_credit === '1' ? shekel(j.amount) : ''}</td>
                      <td className="tabular-nums">{j.debit_credit === '2' ? shekel(j.amount) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {tab === 'accounts' && (
              <>
                <thead><tr>
                  <th>מפתח</th><th>שם החשבון</th><th>סוג</th><th>ח.פ / ע.מ</th>
                  <th>עיר</th><th>יתרה</th>
                </tr></thead>
                <tbody>
                  {(rows as AccountRow[]).map((a) => (
                    <tr key={a.account_key}>
                      <td className="tabular-nums">{a.account_key}</td>
                      <td>{a.account_name ?? '—'}</td>
                      <td>{a.kind ? (ACCOUNT_KINDS[a.kind] ?? a.kind) : '—'}</td>
                      <td className="tabular-nums">{a.party_vat_id ?? '—'}</td>
                      <td>{a.city ?? '—'}</td>
                      <td className="tabular-nums">{shekel(a.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {tab === 'documents' && (
              <>
                <thead><tr>
                  <th>תאריך</th><th>סוג</th><th>מספר</th><th>לקוח / ספק</th>
                  <th>ח.פ / ע.מ</th><th>מע"מ</th><th>סה"כ כולל מע"מ</th>
                </tr></thead>
                <tbody>
                  {(rows as DocRow[]).map((d) => (
                    <tr key={d.id} onClick={() => setOpenDoc(d.id)} className="cursor-pointer hover:bg-gray-50">
                      <td className="tabular-nums">{d.issue_date ?? '—'}</td>
                      <td>{DOC_TYPES[d.doc_type] ?? d.doc_type}</td>
                      <td className="tabular-nums">{d.doc_no}</td>
                      <td>{d.party_name ?? '—'}</td>
                      <td className="tabular-nums">{d.party_vat_id ?? '—'}</td>
                      <td className="tabular-nums">{shekel(d.vat_amount)}</td>
                      <td className="tabular-nums">{shekel(d.total_incl_vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <p className="text-sm text-gray-500 text-center">
          מוצגות {rows.length.toLocaleString('he-IL')} מתוך {total.toLocaleString('he-IL')} רשומות
          {total > rows.length && ' — לצמצום התוצאות יש להשתמש בחיפוש'}
        </p>
      )}
      </>)}
      <PriorityDocumentDrawer docId={openDoc} onClose={() => setOpenDoc(null)} />
    </div>
  );
}
