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

const router = express.Router();
router.use(authenticateToken);
router.use(requireManager);   // נתונים פיננסיים — הנהלה בלבד

const SCHEMA = 'priority_mirror';
const PAGE_MAX = 500;

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
    const limit = clampLimit(req.query.limit, 100);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    let path = 'p_documents?select=id,doc_type,doc_no,issue_date,party_name,'
             + 'party_vat_id,total_incl_vat,vat_amount,cancelled'
             + '&order=issue_date.desc.nullslast'
             + `&limit=${limit}&offset=${offset}`;
    if (req.query.includeCancelled !== 'true') path += '&cancelled=is.false';
    const q = (req.query.q || '').trim();
    if (q) {
      const like = likeParam(q);
      path += `&or=(party_name.ilike.${like},doc_no.ilike.${like},`
            + `party_vat_id.ilike.${like})`;
    }
    const { rows, total } = await pm(path, { count: true });
    res.json({ rows, total, limit, offset });
  } catch (e) { next(e); }
});

module.exports = router;
