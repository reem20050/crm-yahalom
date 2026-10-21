/**
 * מסמכים — כל המסמכים שהופקו ב-Priority (חשבוניות מס, חשבוניות מס קבלה, מרכזות, חשבונות עסקה, קבלות, זיכויים).
 *
 * Priority מנפיקה את המסמכים הרשמיים; כאן הם מוצגים מהמראה (מתעדכנת כל לילה), עם סינון ופתיחת מסמך.
 * "חשבוניות CRM" (הטבלה הישנה של ה-CRM / חשבונית ירוקה) נשארת בלשונית נפרדת — לא נמחק כלום.
 */
import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, Search } from 'lucide-react';
import { priorityApi } from '../services/api';
import {
  DOC_TYPES, docTypeLabel, fmtDate, httpStatus, MIRROR_NOT_CONFIGURED, shekel, signedTotal,
} from '../components/PriorityCustomerDocs';
import PriorityDocumentDrawer from '../components/PriorityDocumentDrawer';
import Invoices from './Invoices';

interface DocRow {
  id: number;
  doc_type: number;
  doc_no: string;
  issue_date: string | null;
  doc_date: string | null;
  party_key: string | null;
  party_name: string | null;
  total_after_discount_ex_vat: number | null;
  total_incl_vat: number | null;
  cancelled: boolean;
  customer_id: string | null;
}

const PAGE = 50;
const TYPE_ORDER = [305, 320, 310, 300, 400, 330];
const TYPE_TONE: Record<number, string> = {
  305: 'bg-primary-50 text-primary-700',
  320: 'bg-primary-50 text-primary-700',
  310: 'bg-primary-50 text-primary-700',
  300: 'bg-gray-100 text-gray-700',
  400: 'bg-success-50 text-success-700',
  330: 'bg-danger-50 text-danger-700',
};

type Period = 'all' | 'this_month' | 'last_month' | '3m' | 'year' | 'custom';
const PERIODS: [Period, string][] = [
  ['all', 'כל התקופה'], ['this_month', 'החודש'], ['last_month', 'החודש הקודם'],
  ['3m', '3 חודשים אחרונים'], ['year', 'השנה'], ['custom', 'טווח תאריכים…'],
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function periodRange(p: Period, from: string, to: string): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case 'this_month': return { from: iso(new Date(y, m, 1)) };
    case 'last_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case '3m': return { from: iso(new Date(y, m - 2, 1)) };
    case 'year': return { from: iso(new Date(y, 0, 1)) };
    case 'custom': return { from: from || undefined, to: to || undefined };
    default: return {};
  }
}

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function PriorityDocumentsList() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [types, setTypes] = useState<number[]>([]);
  const [period, setPeriod] = useState<Period>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [withCancelled, setWithCancelled] = useState(false);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);

  const range = useMemo(() => periodRange(period, from, to), [period, from, to]);
  useEffect(() => { setPage(0); }, [q, types, range.from, range.to, withCancelled]);

  const docsQ = useQuery({
    queryKey: ['priority', 'documents-list', q, types, range.from, range.to, withCancelled, page],
    queryFn: () => priorityApi.getDocuments({
      limit: PAGE,
      offset: page * PAGE,
      q: q || undefined,
      doc_type: types.length ? types.join(',') : undefined,
      from: range.from,
      to: range.to,
      includeCancelled: withCancelled ? 'true' : undefined,
    }).then((r) => r.data as { rows: DocRow[]; total: number }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const summaryQ = useQuery({
    queryKey: ['priority', 'summary'],
    queryFn: () => priorityApi.getSummary().then((r) => r.data),
    retry: false,
  });
  const lastRun: string | null = summaryQ.data?.lastRun?.started_at ?? null;

  const rows = docsQ.data?.rows ?? [];
  const total = docsQ.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const toggleType = (t: number) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש לפי לקוח, מספר מסמך או ח.פ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input input-with-icon"
            />
          </div>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="input sm:w-48">
            {PERIODS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">מתאריך</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
            <span className="text-gray-600">עד</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {TYPE_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                types.includes(t)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
              }`}
            >
              {DOC_TYPES[t]}
            </button>
          ))}
          {types.length > 0 && (
            <button onClick={() => setTypes([])} className="text-sm text-primary-600 hover:underline">נקה סוגים</button>
          )}
          <label className="flex items-center gap-1.5 text-sm text-gray-600 mr-auto cursor-pointer">
            <input type="checkbox" checked={withCancelled} onChange={(e) => setWithCancelled(e.target.checked)} />
            כולל מבוטלים
          </label>
        </div>
      </div>

      {docsQ.isLoading ? (
        <div className="card flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : docsQ.isError ? (
        <div className="card border-r-4 border-danger-500">
          <p className="font-semibold text-danger-700">
            {httpStatus(docsQ.error) === 503 ? MIRROR_NOT_CONFIGURED : 'לא ניתן לקרוא את המסמכים'}
          </p>
          <p className="text-sm text-gray-600 mt-1">זו תקלת קריאה מהמראה — <b>לא</b> "אין מסמכים".</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-10 text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          לא נמצאו מסמכים לסינון הזה.
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>תאריך</th><th>סוג</th><th>מספר</th><th>לקוח</th>
                  <th>לפני מע"מ</th><th>סה"כ כולל מע"מ</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const amount = signedTotal(d);
                  const struck = d.cancelled ? 'line-through text-gray-400' : '';
                  const net = d.total_after_discount_ex_vat;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setOpenId(d.id)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className={`tabular-nums whitespace-nowrap ${struck}`}>{fmtDate(d.issue_date ?? d.doc_date)}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${TYPE_TONE[d.doc_type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {docTypeLabel(d.doc_type)}
                        </span>
                      </td>
                      <td className={`tabular-nums ${struck}`}>{d.doc_no}</td>
                      <td className="max-w-xs">
                        {d.customer_id ? (
                          <Link
                            to={`/customers/${d.customer_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary-600 hover:underline truncate block"
                          >
                            {d.party_name || d.party_key}
                          </Link>
                        ) : (
                          <span className="truncate block">{d.party_name || d.party_key || '—'}</span>
                        )}
                      </td>
                      <td className={`tabular-nums ${struck}`}>
                        {net == null ? '—' : shekel(d.doc_type === 330 ? -Math.abs(net) : net)}
                      </td>
                      <td className={`tabular-nums font-medium ${struck} ${!d.cancelled && amount != null && amount < 0 ? 'text-danger-700' : ''}`}>
                        {shekel(amount)}
                      </td>
                      <td>{d.cancelled && <span className="badge badge-gray">מבוטל</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-sm">
            <span className="text-gray-500">
              {(page * PAGE + 1).toLocaleString('he-IL')}–{Math.min(total, (page + 1) * PAGE).toLocaleString('he-IL')}
              {' '}מתוך {total.toLocaleString('he-IL')} מסמכים
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary px-2 py-1 disabled:opacity-40"
                aria-label="הקודם"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="tabular-nums text-gray-600 px-2">{page + 1} / {pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={page >= pages - 1}
                className="btn-secondary px-2 py-1 disabled:opacity-40"
                aria-label="הבא"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        המסמכים נטענים מ-Priority כל לילה
        {lastRun ? ` · טעינה אחרונה: ${new Date(lastRun).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}` : ''}.
        טיוטות שלא הופקו ב-Priority לא מוצגות.
      </p>

      <PriorityDocumentDrawer docId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

export default function Documents() {
  const [params, setParams] = useSearchParams();
  const legacy = params.get('tab') === 'crm';
  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary-600" />
            מסמכים
          </h1>
          <p className="page-subtitle">כל המסמכים שהופקו ב-Priority — לחיצה על שורה פותחת את המסמך</p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-gray-100">
        {([['priority', 'מסמכי Priority'], ['crm', 'חשבוניות CRM (ישן)']] as const).map(([key, label]) => {
          const active = (key === 'crm') === legacy;
          return (
            <button
              key={key}
              onClick={() => setParams(key === 'crm' ? { tab: 'crm' } : {})}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {legacy ? (
        <>
          <p className="text-sm text-warning-700 bg-warning-50 rounded-lg p-3">
            אלה חשבוניות שנוצרו בתוך ה-CRM (כולל ייבוא מחשבונית ירוקה) — <b>לא</b> מסמכים רשמיים של Priority.
          </p>
          <Invoices />
        </>
      ) : (
        <PriorityDocumentsList />
      )}
    </div>
  );
}
