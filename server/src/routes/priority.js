// נתוני Priority (ERP) — קריאה בלבד דרך המראה ב-Supabase.
//
// למה השרת מתווך ולא הדפדפן פונה ישירות ל-Supabase:
//   1. הקרדנציאלים של המראה נשארים בשרת. דפדפן שמחזיק אותם חושף גישה לכל
//      הנתונים הפיננסיים לכל מי שפותח DevTools.
//   2. ה-CRM כבר מדבר עם השרת שלו ב-JWT משלו. הוספת ספק-זהות שני לצד לקוח
//      הייתה יוצרת שתי מערכות הרשאה במקביל על אותו מסך.
//   3. RLS על priority_mirror מתיר קריאה ל-owner/agent בלבד — כלומר בכל מקרה
//      צריך התחברות, והמקום הנכון לה הוא השרת.
//
// למה fetch ולא @supabase/supabase-js: Node 20 (engines: >=18) כולל fetch
// גלובלי, ו-PostgREST הוא REST רגיל. אפס תלויות חדשות.
//
// ⚠️ ה-API של Priority עצמו חסום ברמת מודול (Basic auth אסור כשExternal ID
//    פעיל; PAT ו-OAuth2 דורשים מסכים שאינם מותקנים). לכן המראה מתעדכנת
//    ע"י ייצוא כרטסת ידני + `sync_kartesset.py`, ומכאן החשיבות של חיווי
//    העדכניות: המספרים כאן נכונים לתאריך הייצוא, לא לרגע זה.

const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const db = require('../config/database');
const {
  CUSTOMER_NO_RE, DOC_TYPES, proposeMatches, documentTotals, lastDocuments, runImport, buildImportQueue,
} = require('../services/priorityLink');
const {
  KINDS: REQUEST_KINDS, SKUS: REQUEST_SKUS, OPEN_STATUSES, STATUS_LABELS, validateRequest, netTotal, requestKey,
} = require('../services/priorityRequests');

const router = express.Router();
router.use(authenticateToken);
router.use(requireManager);   // נתונים פיננסיים — הנהלה בלבד

const SCHEMA = 'priority_mirror';
const PAGE_MAX = 500;
// סטטוס תשלום נגזר (p_customer_status, נכתב ב-VPS מ-paid-check). party_name — מהצילום, ללקוח בלי שורה ב-p_accounts
const STATUS_COLS = 'party_key,party_name,as_of,bank_through,computed_at,balance,paid_no_receipt,short,maybe,to_chase,deals_open';
const STATUS_MONEY = ['balance', 'paid_no_receipt', 'short', 'maybe', 'to_chase'];
// numeric עלול לחזור כמחרוזת — הלקוח מחבר סכומים, ו-"1"+"2" היה מציג 12
const statusRow = (r) => (r ? { ...r, ...Object.fromEntries(STATUS_MONEY.map((k) => [k, Number(r[k] || 0)])) } : null);
const DOC_COLS = 'id,doc_type,doc_no,issue_date,doc_date,party_key,party_name,party_vat_id,'
               + 'total_after_discount_ex_vat,vat_amount,total_incl_vat,withholding_amount,cancelled';
const DOC_TYPE_RE = /^\d{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** מספרי לקוח Priority → כרטיס CRM פעיל (id, company_name). מספרים לא תקינים מסוננים. */
async function crmCustomersByNo(keys) {
  const nos = [...new Set(keys.map((k) => String(k ?? '')).filter((k) => CUSTOMER_NO_RE.test(k)))];
  if (!nos.length) return new Map();
  const ph = nos.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await db.query(
    `SELECT id, company_name, priority_customer_no FROM customers
     WHERE deleted_at IS NULL AND priority_customer_no IN (${ph})`,
    nos,
  );
  return new Map(rows.map((c) => [String(c.priority_customer_no), c]));
}

// ── חיבור למראה ──────────────────────────────────────────────────────────────
let cached = { token: null, expiresAt: 0 };

function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || '';
  const email = process.env.PRIORITY_MIRROR_EMAIL || '';
  const password = process.env.PRIORITY_MIRROR_PASSWORD || '';
  return { url, anon, email, password, ok: !!(url && anon && email && password) };
}

async function token() {
  const c = config();
  if (!c.ok) {
    const err = new Error('mirror_not_configured');
    err.status = 503;
    throw err;
  }
  // מרווח של דקה לפני הפקיעה — כדי לא לשלוח בקשה עם טוקן שפג בדרך
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const res = await fetch(`${c.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: c.anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: c.email, password: c.password }),
  });
  if (!res.ok) {
    const err = new Error(`mirror_login_failed_${res.status}`);
    err.status = 502;
    throw err;
  }
  const body = await res.json();
  cached = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in || 3600) * 1000,
  };
  return cached.token;
}

/** שאילתת PostgREST. מחזיר { rows, total } — total מגיע מכותרת Content-Range. */
async function pm(path, { count = false } = {}) {
  const c = config();
  const jwt = await token();
  const headers = {
    apikey: c.anon,
    Authorization: `Bearer ${jwt}`,
    'Accept-Profile': SCHEMA,
  };
  if (count) headers.Prefer = 'count=exact';

  const res = await fetch(`${c.url}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    // RLS שדוחה מחזירה 200 עם מערך ריק, לא שגיאה — כלומר "אין הרשאה" ו"אין נתונים"
    // נראים זהים. לכן חשוב ששגיאה אמיתית **תיזרק** ולא תתחזה למראה ריקה.
    const err = new Error(`mirror_query_failed_${res.status}: ${detail}`);
    err.status = 502;   // כשל מול שירות במעלה הזרם — לא אשמת הקורא
    throw err;
  }
  const rows = await res.json();
  let total = rows.length;
  const range = res.headers.get('content-range');   // "0-24/3405"
  if (range && range.includes('/')) {
    const n = parseInt(range.split('/')[1], 10);
    if (!Number.isNaN(n)) total = n;
  }
  return { rows, total };
}

/** כתיבה ל-PostgREST (רק טבלת הבקשות p_requests). מחזיר את השורות שנכתבו (return=representation). */
async function pmWrite(method, path, body) {
  const c = config();
  const jwt = await token();
  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: c.anon,
      Authorization: `Bearer ${jwt}`,
      'Accept-Profile': SCHEMA,
      'Content-Profile': SCHEMA,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    const err = new Error(`mirror_write_failed_${res.status}: ${detail}`);
    err.status = 502;
    throw err;
  }
  return res.json();
}

/** בונה ערך ilike בטוח. **חובה לקודד** — הערך נשתל לתוך מחרוזת ה-URL שנשלחת
 *  ל-PostgREST, ולכן `&` בתוכו היה הופך למפריד פרמטרים אמיתי במעלה הזרם
 *  (`q=x&limit=9999` היה עוקף את clampLimit). `*` שורד כ-%2A ומפוענח בחזרה. */
function likeParam(q) {
  return encodeURIComponent(`*${q}*`);
}

function clampLimit(v, dflt = 100) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n <= 0) return dflt;
  return Math.min(n, PAGE_MAX);
}

// מספר לקוח Priority (200xxx): CUSTOMER_NO_RE — ספרות בלבד. נבדק לפני שהוא נשתל ב-URL של PostgREST.
const MATCHED_BY = { vat: 'לפי ח.פ.', name: 'לפי שם', manual: 'ידני' };

function isUniqueViolation(e) {
  return e && (e.code === '23505' || e.code === 'SQLITE_CONSTRAINT_UNIQUE'
    || String(e.message || '').includes('UNIQUE constraint failed'));
}

function userName(user) {
  return `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'מערכת';
}

/** רישום ביומן פעולות. כשל ברישום לא מבטל את הקישור שכבר נשמר. */
async function logActivity(req, customerId, action, changes, description) {
  try {
    await db.query(
      'INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes, description, user_name)'
      + ' VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [db.generateUUID(), req.user?.id || null, 'customer', customerId, action,
        JSON.stringify(changes), description, userName(req.user)],
    );
  } catch (e) {
    console.error('priority activity_log error:', e.message);
  }
}

async function activeCustomer(id) {
  const r = await db.query(
    'SELECT id, company_name, priority_customer_no FROM customers WHERE id = $1 AND deleted_at IS NULL',
    [id],
  );
  return r.rows[0] || null;
}

async function conflictFor(no, customerId) {
  const r = await db.query(
    'SELECT id, company_name, deleted_at FROM customers WHERE priority_customer_no = $1 AND id <> $2',
    [no, customerId],
  );
  return r.rows[0] || null;
}

function conflictResponse(res, other, no) {
  const error = other?.deleted_at
    ? `מספר לקוח Priority ${no} מקושר ללקוח שנמחק (${other.company_name})`
    : `מספר לקוח Priority ${no} כבר מקושר ללקוח אחר${other ? ` (${other.company_name})` : ''}`;
  return res.status(409).json({
    error,
    conflict: other ? { customer_id: other.id, customer_name: other.company_name } : null,
  });
}

// ── GET /api/priority/summary ────────────────────────────────────────────────
// כרטיסי סיכום + **עדכניות הנתונים**. זה המסלול שהמסך תמיד קורא.
router.get('/summary', async (req, res, next) => {
  try {
    const [lastEntry, run, journalCount] = await Promise.all([
      // התנועה האחרונה = עד מתי הנתונים נכונים. זה **לא** מתי רצה הטעינה:
      // אפשר לטעון היום ייצוא שהתנועה האחרונה בו בת חודש.
      pm('p_journal?select=entry_date&order=entry_date.desc.nullslast&limit=1'),
      pm('p_sync_runs?select=source,started_at,period_start,period_end,records_loaded'
         + '&order=started_at.desc&limit=1'),
      pm('p_journal?select=id&limit=1', { count: true }),
    ]);

    const dataAsOf = lastEntry.rows[0]?.entry_date ?? run.rows[0]?.period_end ?? null;
    let staleDays = null;
    if (dataAsOf) {
      const d = new Date(`${dataAsOf}T00:00:00Z`);
      if (!Number.isNaN(d.getTime())) {
        staleDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
      }
    }

    // 🔴 סיכומי הכסף באים מ-v_summary — חישוב על **כל** הנתונים בשרת.
    // אסור לסכום את השורות שהמסך טען: חלון של 100 שורות מציג חוב נמוך מהאמת,
    // וזו טעות שנראית סבירה לגמרי על המסך.
    let summary = null;
    try {
      const v = await pm('v_summary?select=*&limit=1');
      summary = v.rows[0] || null;
    } catch (_e) {
      // ה-view אופציונלי — היעדרו לא אמור להפיל את המסך.
      summary = null;
    }

    res.json({
      dataAsOf,
      staleDays,
      journalRows: journalCount.total,
      lastRun: run.rows[0] || null,
      summary,
    });
  } catch (e) { next(e); }
});

// ── GET /api/priority/journal ────────────────────────────────────────────────
router.get('/journal', async (req, res, next) => {
  try {
    const limit = clampLimit(req.query.limit, 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const cols = 'id,entry_no,line_no,account_key,counter_account,entry_date,'
               + 'reference,details,debit_credit,amount';
    let path = `p_journal?select=${cols}`
             + '&order=entry_date.desc.nullslast,entry_no.desc'
             + `&limit=${limit}&offset=${offset}`;
    const q = (req.query.q || '').trim();
    if (q) {
      // or= דורש קידוד; PostgREST מצפה ל-`*` כתו-כללי ב-ilike.
      const like = likeParam(q);
      path += `&or=(details.ilike.${like},reference.ilike.${like},`
            + `account_key.ilike.${like},counter_account.ilike.${like})`;
    }
    const { rows, total } = await pm(path, { count: true });
    res.json({ rows, total, limit, offset });
  } catch (e) { next(e); }
});

// ── GET /api/priority/accounts ───────────────────────────────────────────────
router.get('/accounts', async (req, res, next) => {
  try {
    const limit = clampLimit(req.query.limit, 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    let path = 'p_accounts?select=account_key,account_name,kind,party_vat_id,city,balance'
             + '&order=balance.desc.nullslast'
             + `&limit=${limit}&offset=${offset}`;
    const kind = (req.query.kind || '').trim();
    if (kind && kind !== 'all') path += `&kind=eq.${encodeURIComponent(kind)}`;
    const q = (req.query.q || '').trim();
    if (q) {
      const like = likeParam(q);
      path += `&or=(account_name.ilike.${like},account_key.ilike.${like},`
            + `party_vat_id.ilike.${like})`;
    }
    const { rows, total } = await pm(path, { count: true });
    res.json({ rows, total, limit, offset });
  } catch (e) { next(e); }
});

// ── GET /api/priority/documents ──────────────────────────────────────────────
// חשבוניות/קבלות כפי שהן רשומות בהנהלת החשבונות. `cancelled` הוא שדה אמיתי —
// מסמך מבוטל נשאר בטבלה, ולכן סכימה בלי סינון מנפחת את ההכנסות.
router.get('/documents', async (req, res, next) => {
  try {
    const partyKey = String(req.query.party_key ?? '').trim();
    if (partyKey && !CUSTOMER_NO_RE.test(partyKey)) {
      return res.status(400).json({ error: 'party_key חייב להכיל ספרות בלבד' });
    }
    const types = String(req.query.doc_type ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    if (types.some((t) => !DOC_TYPE_RE.test(t))) {
      return res.status(400).json({ error: 'doc_type: קודי סוג מסמך (3 ספרות), מופרדים בפסיק' });
    }
    const from = String(req.query.from ?? '').trim();
    const to = String(req.query.to ?? '').trim();
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
      return res.status(400).json({ error: 'from / to בפורמט YYYY-MM-DD' });
    }
    const limit = clampLimit(req.query.limit, 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    let path = `p_documents?select=${DOC_COLS}`
             + '&order=issue_date.desc.nullslast,doc_no.desc'
             + `&limit=${limit}&offset=${offset}`;
    if (partyKey) path += `&party_key=eq.${partyKey}`;
    if (types.length) path += `&doc_type=in.(${types.join(',')})`;
    if (from) path += `&issue_date=gte.${from}`;
    if (to) path += `&issue_date=lte.${to}`;
    if (req.query.includeCancelled !== 'true') path += '&cancelled=is.false';
    const q = (req.query.q || '').trim();
    if (q) {
      const like = likeParam(q);
      path += `&or=(party_name.ilike.${like},doc_no.ilike.${like},`
            + `party_vat_id.ilike.${like})`;
    }
    const { rows, total } = await pm(path, { count: true });
    const byNo = await crmCustomersByNo(rows.map((r) => r.party_key));
    res.json({
      rows: rows.map((r) => ({ ...r, customer_id: byNo.get(String(r.party_key))?.id ?? null })),
      total, limit, offset,
    });
  } catch (e) { next(e); }
});

// ── GET /api/priority/documents/:id ──────────────────────────────────────────
// מסמך אחד: כותרת, שורות (p_doc_lines — לא לכל מסמך יש שורות במראה: קבלה אין לה, ולחלק לא נטענו),
// הלקוח המקושר ב-CRM, ומצב פתוח **משוער** מ-p_customer_status (FIFO — לא ההתאמה הרשמית של Priority).
router.get('/documents/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!/^\d{1,18}$/.test(id)) return res.status(400).json({ error: 'מזהה מסמך לא תקין' });
    const [d, lines] = await Promise.all([
      pm(`p_documents?select=${DOC_COLS},value_date,party_city,party_phone,total_before_discount,doc_discount`
         + `&id=eq.${id}&limit=1`),
      pm('p_doc_lines?select=line_no,internal_sku,description,unit,quantity,unit_price,line_discount,line_total,vat_rate'
         + `&document_id=eq.${id}&order=line_no`),
    ]);
    const doc = d.rows[0];
    if (!doc) return res.status(404).json({ error: 'המסמך לא נמצא במראה' });

    const key = String(doc.party_key ?? '');
    let customer = null;
    let payment = null;
    if (CUSTOMER_NO_RE.test(key)) {
      const c = (await crmCustomersByNo([key])).get(key);
      customer = c ? { id: c.id, name: c.company_name } : null;
      // סטטוס התשלום — תוספת; כשל בקריאה שלו לא מפיל את המסמך
      const st = await pm(`p_customer_status?select=as_of,bank_through,items&party_key=eq.${key}&limit=1`)
        .catch(() => null);
      const row = st?.rows?.[0];
      if (row) {
        const item = (row.items || []).find((i) => String(i.ref) === String(doc.doc_no));
        payment = {
          as_of: row.as_of,
          bank_through: row.bank_through,
          open: item ? Number(item.open || 0) : 0,
          status: item?.status ?? null,
          days: item?.days ?? null,
        };
      }
    }
    res.json({ document: doc, lines: lines.rows, customer, payment });
  } catch (e) { next(e); }
});

/** טלפון / עיר / ח.פ. מ-Priority: המסמך האחרון שיש בו ערך (השורות כבר ממוינות מהחדש), ואחר כך החשבון. */
function priorityContact(docs, account) {
  const first = (k) => docs.find((d) => d[k] && String(d[k]).trim())?.[k] ?? null;
  const out = {
    phone: first('party_phone'),
    city: first('party_city') ?? account?.city ?? null,
    vat_id: first('party_vat_id') ?? account?.party_vat_id ?? null,
  };
  return out.phone || out.city || out.vat_id ? out : null;
}

// ── GET /api/priority/finance-report ─────────────────────────────────────────
// דוח כספים שנתי מ-Priority (מסך הדוחות): לכל חודש — חשבוניות מס שהופקו ו"נגבה" (קבלות + חשבוניות מס קבלה —
// חשבונית מס קבלה היא מסמך ששולם בהפקתו); ולקוחות מובילים לפי הופק.
// השוואת הופק/נגבה רק על אותו בסיס — **כולל מע"מ** (invoiced_incl), כי קבלה כוללת מע"מ. invoiced (לפני מע"מ) = ההכנסה.
// "נגבה" כאן = מה שתועד ב-Priority, לא ספר הבנק (לזה — "מי חייב").
router.get('/finance-report', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
    if (year < 2020 || year > 2100) return res.status(400).json({ error: 'שנה לא תקינה' });
    const docs = await pmAll('p_documents?select=id,doc_type,issue_date,party_key,party_name,'
      + 'total_after_discount_ex_vat,total_incl_vat'
      + `&issue_date=gte.${year}-01-01&issue_date=lte.${year}-12-31&cancelled=is.false`
      + '&doc_type=in.(305,310,320,330,400)&order=id', 'finance');
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: `${year}-${String(i + 1).padStart(2, '0')}`, invoiced: 0, invoiced_incl: 0, collected: 0, count: 0,
    }));
    const byParty = new Map();
    let invoiced = 0;
    let invoicedIncl = 0;
    let collected = 0;
    for (const d of docs) {
      const m = months[Number(String(d.issue_date).slice(5, 7)) - 1];
      if (!m) continue;
      const t = Number(d.doc_type);
      if (t !== 400) {
        const net = Number(d.total_after_discount_ex_vat || 0);
        const v = t === 330 ? -Math.abs(net) : net;
        const gross = Number(d.total_incl_vat || 0);
        const vi = t === 330 ? -Math.abs(gross) : gross;
        m.invoiced += v;
        m.invoiced_incl += vi;
        m.count += 1;
        invoiced += v;
        invoicedIncl += vi;
        const key = String(d.party_key ?? '');
        const p = byParty.get(key) || { party_key: key, name: d.party_name, invoiced: 0, count: 0 };
        p.invoiced += v;
        p.count += 1;
        byParty.set(key, p);
      }
      if (t === 400 || t === 320) {
        const v = Number(d.total_incl_vat || 0);
        m.collected += v;
        collected += v;
      }
    }
    const top = [...byParty.values()].sort((a, b) => b.invoiced - a.invoiced).slice(0, 15);
    const links = await crmCustomersByNo(top.map((p) => p.party_key));
    const r2 = (n) => Math.round(n * 100) / 100;
    res.json({
      year,
      totals: { invoiced: r2(invoiced), invoiced_incl: r2(invoicedIncl), collected: r2(collected) },
      months: months.map((m) => ({
        ...m, invoiced: r2(m.invoiced), invoiced_incl: r2(m.invoiced_incl), collected: r2(m.collected),
      })),
      top_customers: top.map((p) => ({
        ...p,
        invoiced: r2(p.invoiced),
        customer_id: links.get(p.party_key)?.id ?? null,
        name: links.get(p.party_key)?.company_name || p.name,
      })),
    });
  } catch (e) { next(e); }
});

// ── PDF של מסמך: POST/GET /api/priority/documents/:id/pdf ─────────────────────
// בקשה kind='pdf' ל-p_requests; העובד ב-VPS מפיק ב-Priority ("הצגה" + "קובץ PDF", לעולם לא שליחה) ומעלה ל-storage
// (bucket פרטי priority-pdf). בלי אישור בטלגרם — החלטת רעם 22/10: הצגה בלבד של מסמך שכבר הופק.
// הקובץ נשמר ומשמש שוב, כך שמסמך לא מודפס ב-Priority בכל לחיצה. הדפדפן מקבל קישור חתום ל-10 דקות בלבד.
const PDF_DOC_TYPES = new Set([300, 305, 310, 320]);   // אלה שיש להם הדפסה ממופה ב-prio pdf
const PDF_BUCKET = 'priority-pdf';
const PDF_OPEN = ['new', 'preparing'];

async function pdfDoc(id) {
  if (!/^\d{1,18}$/.test(String(id))) return { error: [400, 'מזהה מסמך לא תקין'] };
  const d = (await pm(`p_documents?select=id,doc_type,doc_no,party_key,cancelled&id=eq.${id}&limit=1`)).rows[0];
  if (!d) return { error: [404, 'המסמך לא נמצא במראה'] };
  if (!PDF_DOC_TYPES.has(Number(d.doc_type))) return { error: [422, 'אין PDF לסוג המסמך הזה (קבלה / זיכוי — ב-Priority)'] };
  if (!/^[A-Z]{2}\d{6,12}$/.test(String(d.doc_no || '')) || !CUSTOMER_NO_RE.test(String(d.party_key || ''))) {
    return { error: [422, 'פרטי המסמך לא תקינים לבקשת PDF'] };
  }
  return { doc: d };
}

async function latestPdfRequest(docNo) {
  const q = 'p_requests?select=id,status,file_path,error,created_at,updated_at'
    + `&kind=eq.pdf&payload->>doc_no=eq.${encodeURIComponent(docNo)}&order=id.desc&limit=1`;
  return (await pm(q)).rows[0] || null;
}

async function signedPdfUrl(path) {
  const c = config();
  const jwt = await token();
  const res = await fetch(`${c.url}/storage/v1/object/sign/${PDF_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { apikey: c.anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!res.ok) {
    const err = new Error(`storage_sign_failed_${res.status}`);
    err.status = 502;
    throw err;
  }
  const body = await res.json();
  return `${c.url}/storage/v1${body.signedURL || body.signedUrl}`;
}

function pdfView(r) {
  return r ? { request_id: r.id, status: r.status, error: r.status === 'failed' ? r.error : null } : { status: 'none' };
}

router.get('/documents/:id/pdf', async (req, res, next) => {
  try {
    const { doc, error } = await pdfDoc(req.params.id);
    if (error) return res.status(error[0]).json({ error: error[1] });
    const r = await latestPdfRequest(doc.doc_no);
    if (r?.status === 'done' && r.file_path) return res.json({ ...pdfView(r), url: await signedPdfUrl(r.file_path) });
    res.json(pdfView(r));
  } catch (e) { next(e); }
});

router.post('/documents/:id/pdf', async (req, res, next) => {
  try {
    const { doc, error } = await pdfDoc(req.params.id);
    if (error) return res.status(error[0]).json({ error: error[1] });
    const prev = await latestPdfRequest(doc.doc_no);
    // כבר מוכן או בדרך — לא יוצרים בקשה נוספת (ולא מדפיסים שוב ב-Priority)
    if (prev && (PDF_OPEN.includes(prev.status) || (prev.status === 'done' && prev.file_path))) {
      return res.json(pdfView(prev));
    }
    const crm = (await crmCustomersByNo([doc.party_key])).get(String(doc.party_key));
    const [created] = await pmWrite('POST', 'p_requests', {
      created_by: userName(req.user),
      crm_customer_id: crm?.id ?? null,
      priority_customer_no: String(doc.party_key),
      kind: 'pdf',
      payload: { doc_type: Number(doc.doc_type), doc_no: doc.doc_no, document_id: doc.id },
      status: 'new',
    });
    res.status(201).json(pdfView(created));
  } catch (e) { next(e); }
});

// ── GET /api/priority/revenue-monthly ────────────────────────────────────────
// חשבוניות מס שהופקו לפי חודש (305/310/320 פחות זיכויים 330, בלי מבוטלים), **לפני מע"מ**.
// זה "הופק", לא "נגבה". חשבון עסקה (300) לא נספר — הוא לא הכנסה עד שמופקת חשבונית.
router.get('/revenue-monthly', async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
    const now = new Date();
    const keys = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      keys.push(d.toISOString().slice(0, 7));
    }
    const rows = await pmAll('p_documents?select=id,doc_type,issue_date,total_after_discount_ex_vat'
      + `&issue_date=gte.${keys[0]}-01&cancelled=is.false&doc_type=in.(305,310,320,330)&order=id`, 'revenue');
    const by = new Map(keys.map((k) => [k, { month: k, net: 0, count: 0 }]));
    for (const r of rows) {
      const b = by.get(String(r.issue_date || '').slice(0, 7));
      if (!b) continue;
      const v = Number(r.total_after_discount_ex_vat || 0);
      b.net += r.doc_type === 330 ? -Math.abs(v) : v;
      b.count += 1;
    }
    res.json({ months: [...by.values()].map((b) => ({ ...b, net: Math.round(b.net * 100) / 100 })) });
  } catch (e) { next(e); }
});

// ── GET /api/priority/link-proposals ─────────────────────────────────────────
// הצעות קישור לקוח CRM ↔ לקוח Priority. **הצעות בלבד** — מנהל מאשר כל אחת ב-POST /links.
// summary.accounts_read = 0 מראה ש-RLS החזירה מערך ריק, ולא ש"אין התאמות".
const ACCOUNTS_PAGE = 1000;
const ACCOUNTS_MAX_PAGES = 20;

/** כל השורות של שאילתה. הדפדוף לפי total (count) ולא לפי "דף קצר" — max-rows של PostgREST
 *  עלול להיות קטן מ-1000. path בלי limit/offset, וחייב order יציב. */
async function pmAll(path, label) {
  const out = [];
  let offset = 0;
  for (let page = 0; page < ACCOUNTS_MAX_PAGES; page += 1) {
    const { rows, total } = await pm(`${path}&limit=${ACCOUNTS_PAGE}&offset=${offset}`, { count: true });
    out.push(...rows);
    offset += rows.length;
    if (rows.length === 0 || out.length >= total) break;
    if (page === ACCOUNTS_MAX_PAGES - 1) {
      console.warn(`priority ${label}: stopped after ${out.length} of ${total} rows`);
    }
  }
  return out;
}

/** כל חשבונות הלקוח ב-Priority (kind=customer). */
function customerAccounts(select) {
  return pmAll(`p_accounts?select=${select}&kind=eq.customer&order=account_key`, 'accounts');
}

/**
 * כל לקוחות Priority לקישור: חשבונות p_accounts, ובנוסף לקוחות שמופיעים בסטטוס התשלום (p_customer_status —
 * שורה לכל לקוח במסך הלקוחות של Priority) ואין להם שורה ב-p_accounts. בלי זה תור הקישור עיוור אליהם, וגם
 * קישור ידני נדחה (למשל 200039 — חייב ₪86k). ח.פ. ועיר להשלמה — מהמסמך האחרון שיש בו.
 * כשל בקריאת הסטטוס לא מפיל את התור — חוזרים לחשבונות בלבד.
 */
async function customerParties(select) {
  const accounts = await customerAccounts(select);
  const have = new Set(accounts.map((a) => String(a.account_key)));
  let status = [];
  try {
    status = await pmAll('p_customer_status?select=party_key,party_name&order=party_key', 'status');
  } catch (e) {
    console.warn('priority parties: p_customer_status unreadable, accounts only', e.message);
    return accounts;
  }
  const missing = status.filter((r) => CUSTOMER_NO_RE.test(String(r.party_key)) && !have.has(String(r.party_key)));
  if (!missing.length) return accounts;
  const keys = missing.map((r) => String(r.party_key));
  const docs = [];
  for (let i = 0; i < keys.length; i += IN_CHUNK) {
    docs.push(...await pmAll(
      `p_documents?select=id,party_key,party_name,party_vat_id,party_city&party_key=in.(${keys.slice(i, i + IN_CHUNK).join(',')})&order=id`,
      'documents',
    ));
  }
  const latest = (key, field) => {
    let v = null;
    for (const d of docs) if (String(d.party_key) === key && d[field] && String(d[field]).trim()) v = d[field];
    return v;   // order=id → האחרון שנמצא הוא החדש
  };
  return [...accounts, ...missing.map((r) => {
    const key = String(r.party_key);
    return {
      account_key: key,
      account_name: r.party_name || latest(key, 'party_name'),
      party_vat_id: latest(key, 'party_vat_id'),
      city: latest(key, 'party_city'),
      source: 'status',   // לא מ-p_accounts
    };
  })];
}

/** מספר לקוח קיים ב-Priority: חשבון לקוח ב-p_accounts, או שורה בסטטוס התשלום. מחזיר את השם, או null. */
async function partyName(no) {
  const acc = await pm(`p_accounts?select=account_key,account_name&kind=eq.customer&account_key=eq.${no}&limit=1`);
  if (acc.rows.length) return { name: acc.rows[0].account_name };
  const st = await pm(`p_customer_status?select=party_key,party_name&party_key=eq.${no}&limit=1`).catch(() => ({ rows: [] }));
  return st.rows.length ? { name: st.rows[0].party_name } : null;
}

router.get('/link-proposals', async (req, res, next) => {
  try {
    const accounts = await customerParties('account_key,account_name,party_vat_id');
    const customers = await db.query(
      'SELECT id, company_name, business_id, priority_customer_no, priority_matched_by, deleted_at'
      + ' FROM customers WHERE deleted_at IS NULL',
    );
    res.json(proposeMatches(accounts, customers.rows));
  } catch (e) { next(e); }
});

// ── GET /api/priority/unmatched ──────────────────────────────────────────────
// חשבונות Priority בלי לקוח ב-CRM (unmatched) והדו-משמעיים, עם עיר וסטטיסטיקת מסמכים —
// כדי להחליט על מה לפתוח כרטיס. לכל unmatched: blocked = מה ש-POST /import-customers היה מחזיר.
const IN_CHUNK = 100;   // מספרים לבקשה אחת ב-party_key=in.(…) — שה-URL לא יתארך בלי גבול

router.get('/unmatched', async (req, res, next) => {
  try {
    const accounts = await customerParties('account_key,account_name,party_vat_id,city');
    // כולל מחוקים: מספר Priority שמקושר ללקוח מחוק עדיין תפוס (האינדקס הייחודי כולל אותו)
    const all = (await db.query(
      'SELECT id, company_name, business_id, priority_customer_no, priority_matched_by, deleted_at FROM customers',
    )).rows;
    const matches = proposeMatches(accounts, all.filter((c) => !c.deleted_at));

    const keys = [...new Set([...matches.unmatched, ...matches.ambiguous].map((x) => x.priority_customer_no))]
      .filter((k) => CUSTOMER_NO_RE.test(k));
    const docs = [];
    for (let i = 0; i < keys.length; i += IN_CHUNK) {
      docs.push(...await pmAll(
        'p_documents?select=id,party_key,doc_type,issue_date,total_incl_vat,cancelled'
        + `&party_key=in.(${keys.slice(i, i + IN_CHUNK).join(',')})&order=id`,
        'documents',
      ));
    }

    res.json(buildImportQueue(matches, accounts, all, docs));
  } catch (e) { next(e); }
});

// ── POST /api/priority/import-customers ──────────────────────────────────────
// יוצר לקוח CRM לכל מספר שמנהל **סימן** ומקשר אותו מיד (matched_by=manual). body: { priority_customer_nos: [] }
// שם, ח.פ. ועיר נלקחים מהמראה — לא מהבקשה. מדלג על מספר שכבר מקושר; ח.פ. (או שם, כשאין ח.פ.)
// שכבר קיים ב-CRM חוזר כ-conflict ולא נוצר. 200 גם בהצלחה חלקית — התוצאה לכל מספר בגוף התשובה.
const IMPORT_MAX = 200;

router.post('/import-customers', async (req, res, next) => {
  try {
    const raw = req.body?.priority_customer_nos;
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ error: 'נדרשת רשימת מספרי לקוח Priority (priority_customer_nos)' });
    }
    if (raw.length > IMPORT_MAX) {
      return res.status(400).json({ error: `עד ${IMPORT_MAX} מספרים בבקשה אחת` });
    }
    const nos = [...new Set(raw.map((v) => String(v ?? '').trim()))];
    const valid = nos.filter((n) => CUSTOMER_NO_RE.test(n));   // לא תקינים → skipped invalid_no

    // כל החשבונות ולא רק המבוקשים: כפיל ב-Priority של חשבון שכבר מקושר מזוהה לפי ח.פ. של החשבון האחר
    const accounts = valid.length === 0 ? [] : await customerParties('account_key,account_name,party_vat_id,city');
    const customers = (await db.query(
      'SELECT id, company_name, business_id, priority_customer_no, deleted_at FROM customers',
    )).rows;

    const now = new Date();
    const confirmedAt = now.toISOString();
    // אותו נוסח כמו בייבוא הראשון (20/10/2026), כדי שכל הכרטיסים שנוצרו מ-Priority ייראו אותו דבר
    const createdOn = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem' });
    const result = await runImport(nos, accounts, customers, async (row) => {
      const id = db.generateUUID();
      let created;
      try {
        // יצירה וקישור בפקודה אחת: ל-db אין טרנזקציות, ושתי פקודות היו משאירות לקוח בלי קישור אם השנייה נכשלת
        created = await db.query(
          'INSERT INTO customers (id, company_name, business_id, city, notes, priority_customer_no, priority_matched_by,'
          + ' priority_confirmed_by, priority_confirmed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
          [id, row.company_name, row.business_id, row.city,
            `נוצר מ-Priority (לקוח ${row.priority_customer_no}) ${createdOn}`,
            row.priority_customer_no, 'manual', req.user.id, confirmedAt],
        );
      } catch (e) {
        if (isUniqueViolation(e)) return null;   // המספר נקשר בינתיים ללקוח אחר
        throw e;
      }
      await logActivity(req, id, 'priority_import',
        { source: 'priority', priority_customer_no: row.priority_customer_no, matched_by: 'manual',
          company_name: row.company_name, business_id: row.business_id, city: row.city },
        `נוצר מחשבון Priority ${row.priority_customer_no} וקושר אליו (ידני)`);
      return created.rows[0] || { id, company_name: row.company_name };
    });

    result.failed.forEach((f) => console.error('priority import-customers failed:', f.priority_customer_no, f.error));
    res.json(result);
  } catch (e) { next(e); }
});

// ── POST /api/priority/links ─────────────────────────────────────────────────
// אישור מנהל לקישור. body: { customer_id, priority_customer_no, matched_by: vat|name|manual }
router.post('/links', async (req, res, next) => {
  try {
    const customerId = String(req.body?.customer_id ?? '').trim();
    const no = String(req.body?.priority_customer_no ?? '').trim();
    const matchedBy = String(req.body?.matched_by ?? '').trim();
    if (!customerId) return res.status(400).json({ error: 'חסר customer_id' });
    if (!CUSTOMER_NO_RE.test(no)) {
      return res.status(400).json({ error: 'מספר לקוח Priority חייב להכיל ספרות בלבד' });
    }
    if (!Object.prototype.hasOwnProperty.call(MATCHED_BY, matchedBy)) {
      return res.status(400).json({ error: 'matched_by חייב להיות vat, name או manual' });
    }

    const customer = await activeCustomer(customerId);
    if (!customer) return res.status(404).json({ error: 'לקוח לא נמצא' });

    // גם לקוח שאין לו שורה ב-p_accounts אבל מופיע בסטטוס התשלום (מסך הלקוחות של Priority)
    if (!(await partyName(no))) {
      return res.status(422).json({ error: 'מספר לקוח לא נמצא במראה של Priority' });
    }

    const other = await conflictFor(no, customerId);
    if (other) return conflictResponse(res, other, no);

    let updated;
    try {
      updated = await db.query(
        'UPDATE customers SET priority_customer_no = $1, priority_matched_by = $2,'
        + ' priority_confirmed_by = $3, priority_confirmed_at = $4, updated_at = CURRENT_TIMESTAMP'
        + ' WHERE id = $5 RETURNING *',
        [no, matchedBy, req.user.id, new Date().toISOString(), customerId],
      );
    } catch (e) {
      if (isUniqueViolation(e)) return conflictResponse(res, await conflictFor(no, customerId), no);
      throw e;
    }

    await logActivity(req, customerId, 'priority_link',
      { priority_customer_no: no, matched_by: matchedBy },
      `קושר ללקוח Priority ${no} (${MATCHED_BY[matchedBy]})`);

    res.json({ customer: updated.rows[0] });
  } catch (e) { next(e); }
});

// ── DELETE /api/priority/links/:customerId ───────────────────────────────────
// גם לקוח שנמחק (soft-delete): האינדקס הייחודי כולל אותו, ובלי זה המספר שלו נעול לתמיד
// (POST /links ללקוח אחר מחזיר 409 על הלקוח המחוק).
router.delete('/links/:customerId', async (req, res, next) => {
  try {
    const customerId = req.params.customerId;
    const prev = await db.query(
      'SELECT id, priority_customer_no, priority_matched_by FROM customers WHERE id = $1',
      [customerId],
    );
    if (prev.rows.length === 0) return res.status(404).json({ error: 'לקוח לא נמצא' });

    const updated = await db.query(
      'UPDATE customers SET priority_customer_no = NULL, priority_matched_by = NULL,'
      + ' priority_confirmed_by = NULL, priority_confirmed_at = NULL, updated_at = CURRENT_TIMESTAMP'
      + ' WHERE id = $1 RETURNING *',
      [customerId],
    );

    const was = prev.rows[0] || {};
    if (was.priority_customer_no) {   // ביטול קישור שלא היה קיים — אין מה לרשום
      await logActivity(req, customerId, 'priority_unlink',
        { priority_customer_no: was.priority_customer_no, matched_by: was.priority_matched_by ?? null },
        `בוטל הקישור ללקוח Priority ${was.priority_customer_no}`);
    }

    res.json({ customer: updated.rows[0] });
  } catch (e) { next(e); }
});

// ── GET /api/priority/customer/:customerId ───────────────────────────────────
// כרטיס לקוח: הקישור, חשבון Priority וכל המסמכים — **כולל מבוטלים** (מסומנים, ולא נסכמים).
router.get('/customer/:customerId', async (req, res, next) => {
  try {
    const r = await db.query(
      'SELECT c.id, c.company_name, c.priority_customer_no, c.priority_matched_by, c.priority_confirmed_at,'
      + ' u.first_name, u.last_name'
      + ' FROM customers c LEFT JOIN users u ON u.id = c.priority_confirmed_by'
      + ' WHERE c.id = $1 AND c.deleted_at IS NULL',
      [req.params.customerId],
    );
    const c = r.rows[0];
    if (!c) return res.status(404).json({ error: 'לקוח לא נמצא' });
    if (!c.priority_customer_no) return res.json({ linked: false, customer_id: c.id });

    const no = String(c.priority_customer_no);
    if (!CUSTOMER_NO_RE.test(no)) {
      return res.status(422).json({ error: 'מספר לקוח Priority השמור אינו תקין' });
    }

    const cols = 'id,doc_type,doc_no,issue_date,doc_date,party_key,party_name,party_vat_id,party_phone,party_city,'
               + 'total_after_discount_ex_vat,vat_amount,total_incl_vat,withholding_amount,cancelled';
    const [docs, acc, st, lastEntry] = await Promise.all([
      pm(`p_documents?select=${cols}&party_key=eq.${no}`
         + '&order=issue_date.desc.nullslast,doc_no.desc&limit=500', { count: true }),
      pm(`p_accounts?select=account_key,account_name,party_vat_id,city,balance&account_key=eq.${no}&limit=1`),
      // סטטוס תשלום — נגזר (אותו חישוב כמו paid-check ב-VPS). כשל כאן לא מפיל את הכרטיס
      pm(`p_customer_status?select=${STATUS_COLS},items&party_key=eq.${no}&limit=1`).catch(() => ({ rows: [], failed: true })),
      // עד מתי הכרטסת נכונה (התנועה האחרונה, כמו dataAsOf ב-/summary) — ליד "יתרה בכרטסת"
      pm('p_journal?select=entry_date&order=entry_date.desc.nullslast&limit=1').catch(() => ({ rows: [] })),
    ]);

    const confirmedBy = `${c.first_name || ''} ${c.last_name || ''}`.trim() || null;
    res.json({
      linked: true,
      link: {
        priority_customer_no: no,
        matched_by: c.priority_matched_by ?? null,
        confirmed_at: c.priority_confirmed_at ?? null,
        confirmed_by_name: confirmedBy,
      },
      account: acc.rows[0] || null,
      kartesset_as_of: lastEntry.rows[0]?.entry_date ?? null,
      // אותו כלל כמו ברשימת הלקוחות (GET /customer-overview)
      last_doc: lastDocuments(docs.rows).get(no) ?? null,
      // פרטי קשר כפי שמופיעים במסמכים ב-Priority (הטלפון/העיר מהמסמך האחרון שיש בו) — לכרטיס בלי אנשי קשר
      contact: priorityContact(docs.rows, acc.rows[0]),
      status: statusRow(st.rows[0]),
      status_unavailable: st.failed === true,   // תקלת קריאה ≠ "עוד לא חושב"
      rows: docs.rows,
      total: docs.total,
      truncated: docs.total > docs.rows.length,
      totals: documentTotals(docs.rows),
    });
  } catch (e) { next(e); }
});

// ── מי חייב (סטטוס תשלום נגזר) ────────────────────────────────────────────────
// p_customer_status נכתב ב-VPS אחרי הצילום הלילי מאותו חישוב כמו `prio paid-check`: יתרה, "שולם בבנק — חסרה קבלה",
// "לבירור", ו"לגבות" = אין ראיה לתשלום **עד התדפיס האחרון** (bank_through). המסמכים הפתוחים הם הערכת FIFO.

router.get('/collections', async (req, res, next) => {
  try {
    const { rows } = await pm(`p_customer_status?select=${STATUS_COLS}`
      + '&or=(to_chase.gt.0,paid_no_receipt.gt.0,maybe.gt.0,short.gt.0)&order=to_chase.desc&limit=500');
    const keys = rows.map((r) => r.party_key).filter((k) => CUSTOMER_NO_RE.test(String(k)));
    const linked = keys.length ? (await db.query(
      `SELECT id, company_name, priority_customer_no FROM customers
       WHERE deleted_at IS NULL AND priority_customer_no IS NOT NULL`,
    )).rows : [];
    const byNo = new Map(linked.map((c) => [String(c.priority_customer_no), c]));
    const names = keys.length ? (await pm(`p_accounts?select=account_key,account_name&account_key=in.(${keys.join(',')})`)).rows : [];
    const nameByNo = new Map(names.map((a) => [String(a.account_key), a.account_name]));
    const sum = (k) => Math.round(rows.reduce((s, r) => s + Number(r[k] || 0), 0) * 100) / 100;
    res.json({
      as_of: rows[0]?.as_of ?? null,
      bank_through: rows[0]?.bank_through ?? null,
      totals: { to_chase: sum('to_chase'), paid_no_receipt: sum('paid_no_receipt'), maybe: sum('maybe'), short: sum('short') },
      rows: rows.map((r) => {
        const c = byNo.get(String(r.party_key));
        return {
          ...statusRow(r),
          customer_id: c?.id ?? null,
          // כרטיס CRM → p_accounts → השם מהצילום (לקוח עם חוב בלי שורה ב-p_accounts, כמו 200039)
          name: c?.company_name || nameByNo.get(String(r.party_key)) || r.party_name || null,
        };
      }),
    });
  } catch (e) { next(e); }
});

// ── GET /api/priority/customer-overview ──────────────────────────────────────
// עמודות Priority ברשימת הלקוחות: לכל לקוח CRM מקושר — הסטטוס הנגזר (לגבות / שולם בבנק) והמסמך האחרון.
// שתי שאילתות למראה (עם דפדוף) לכל הלקוחות יחד, לא שאילתה לכל לקוח. מסמכי לקוח בלבד (לא 700 של ספקים).
// לקוח מקושר בלי שורת סטטוס → status: null ("עוד לא חושב"), לא אפסים.
router.get('/customer-overview', async (req, res, next) => {
  try {
    const linked = (await db.query(
      `SELECT id, priority_customer_no FROM customers
       WHERE deleted_at IS NULL AND priority_customer_no IS NOT NULL`,
    )).rows.filter((c) => CUSTOMER_NO_RE.test(String(c.priority_customer_no)));
    if (!linked.length) return res.json({ as_of: null, bank_through: null, rows: [] });

    const [status, docs] = await Promise.all([
      pmAll(`p_customer_status?select=${STATUS_COLS}&order=party_key`, 'status'),
      pmAll('p_documents?select=id,party_key,doc_type,doc_no,issue_date,doc_date,total_incl_vat,cancelled'
        + `&cancelled=is.false&doc_type=in.(${Object.keys(DOC_TYPES).join(',')})&order=id`, 'documents'),
    ]);
    const statusByNo = new Map(status.map((r) => [String(r.party_key), r]));
    const lastByNo = lastDocuments(docs);
    res.json({
      as_of: status[0]?.as_of ?? null,
      bank_through: status[0]?.bank_through ?? null,
      rows: linked.map((c) => {
        const no = String(c.priority_customer_no);
        const st = statusRow(statusByNo.get(no));
        return {
          customer_id: c.id,
          priority_customer_no: no,
          status: st && {
            to_chase: st.to_chase, paid_no_receipt: st.paid_no_receipt, maybe: st.maybe, short: st.short,
          },
          last_doc: lastByNo.get(no) ?? null,
        };
      }),
    });
  } catch (e) { next(e); }
});

// ── בקשות הפקה ל-Priority ─────────────────────────────────────────────────────
// ה-CRM רק מבקש. ההכנה (ריצה יבשה) והשליחה לאישור — העובד ב-VPS; ההפקה — רק אחרי "כן" של רעם ב-HERMES.
// מספר הלקוח ב-Priority נלקח מהלקוח המקושר בשרת, לא מהדפדפן; החברה לא נשלחת כלל (= הראשית).

const REQUEST_COLS = 'id,created_at,updated_at,created_by,crm_customer_id,priority_customer_no,kind,payload,status,'
  + 'summary,warnings,final_number,error';

function decorate(r) {
  return {
    ...r,
    kind_label: REQUEST_KINDS[r.kind] || r.kind,
    status_label: STATUS_LABELS[r.status] || r.status,
    net_total: r.payload && r.payload.lines ? netTotal(r.payload) : null,
  };
}

router.get('/requests/meta', (req, res) => {
  res.json({ kinds: REQUEST_KINDS, skus: REQUEST_SKUS, statuses: STATUS_LABELS });
});

router.get('/requests', async (req, res, next) => {
  try {
    const customerId = String(req.query.customer_id ?? '').trim();
    let path = `p_requests?select=${REQUEST_COLS}&order=id.desc&limit=${clampLimit(req.query.limit, 20)}`;
    if (customerId) {
      if (!/^[0-9a-f-]{8,64}$/i.test(customerId)) return res.status(400).json({ error: 'customer_id לא תקין' });
      path += `&crm_customer_id=eq.${encodeURIComponent(customerId)}`;
    }
    const { rows } = await pm(path);
    res.json({ rows: rows.map(decorate) });
  } catch (e) { next(e); }
});

router.post('/requests', async (req, res, next) => {
  try {
    const customerId = String(req.body?.customer_id ?? '').trim();
    if (!customerId) return res.status(400).json({ error: 'חסר customer_id' });
    let parsed;
    try {
      parsed = validateRequest(req.body);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
    const r = await db.query(
      'SELECT id, company_name, priority_customer_no FROM customers WHERE id = $1 AND deleted_at IS NULL', [customerId],
    );
    const c = r.rows[0];
    if (!c) return res.status(404).json({ error: 'לקוח לא נמצא' });
    const no = String(c.priority_customer_no || '');
    if (!no) return res.status(422).json({ error: 'הלקוח לא מקושר ל-Priority — קשרו אותו קודם' });
    if (!CUSTOMER_NO_RE.test(no)) return res.status(422).json({ error: 'מספר לקוח Priority השמור אינו תקין' });

    // לחיצה כפולה: בקשה פתוחה זהה לאותו לקוח — מחזירים אותה במקום ליצור עוד אחת
    const open = await pm(`p_requests?select=${REQUEST_COLS}&crm_customer_id=eq.${encodeURIComponent(c.id)}`
      + `&status=in.(${OPEN_STATUSES.join(',')})&order=id.desc&limit=20`);
    const key = requestKey(no, parsed.kind, parsed.payload);
    const dup = open.rows.find((x) => requestKey(x.priority_customer_no, x.kind, x.payload || {}) === key);
    if (dup) return res.status(409).json({ error: 'בקשה זהה כבר בטיפול', request: decorate(dup) });

    const rows = await pmWrite('POST', 'p_requests', [{
      created_by: userName(req.user),
      crm_customer_id: c.id,
      priority_customer_no: no,
      kind: parsed.kind,
      payload: parsed.payload,
    }]);
    const created = rows[0];
    await logActivity(req, c.id, 'priority_request', { request_id: created.id, kind: parsed.kind },
      `בקשת הפקה ל-Priority #${created.id}: ${REQUEST_KINDS[parsed.kind]}`
      + (parsed.payload.lines ? ` (${netTotal(parsed.payload).toLocaleString('he-IL')} ₪ לפני מע"מ)` : ''));
    res.status(201).json({ request: decorate(created) });
  } catch (e) { next(e); }
});

// ביטול — רק לפני שהעובד לקח את הבקשה (status=new). אחרי זה: "לא <id>" לרעם בטלגרם.
router.post('/requests/:id/cancel', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'מזהה לא תקין' });
    const rows = await pmWrite('PATCH', `p_requests?id=eq.${id}&status=eq.new`,
      { status: 'rejected', error: `בוטל ב-CRM ע"י ${userName(req.user)}`, notified: true });
    if (!rows.length) return res.status(409).json({ error: 'אפשר לבטל רק בקשה שעוד לא נכנסה להכנה' });
    await logActivity(req, rows[0].crm_customer_id, 'priority_request_cancel', { request_id: id },
      `בקשת הפקה #${id} בוטלה`);
    res.json({ request: decorate(rows[0]) });
  } catch (e) { next(e); }
});

module.exports = router;
