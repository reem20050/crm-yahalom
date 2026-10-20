// בקשות הפקה ל-Priority — אימות טהור (בלי DB ובלי רשת), כדי שאפשר לבדוק אותו ב-node:test.
//
// הזרימה: ה-CRM רק **מבקש**. הבקשה נכתבת ל-priority_mirror.p_requests; העובד ב-VPS מכין אותה (ריצה יבשה) ושולח
// לרעם בטלגרם; ההפקה עצמה קורית רק אחרי "כן" של רעם ב-HERMES. אין כאן כפתור אישור בכוונה: המשתמש המשותף ב-Supabase
// (hermes) יכול לכתוב לטבלה, ולכן סטטוס "מאושר" בטבלה לא היה חתימה של אף אחד.
//
// אותם כללים נאכפים שוב בעובד (prio_agent/crm_queue.py) — שם הם הקובעים. כאן הם נותנים למשתמש שגיאה מיד.

const KINDS = {
  invoice: 'חשבונית מס',
  'consolidated-invoice': 'חשבונית מרכזת',
  rebill: 'חיוב חוזר (כמו החודש הקודם)',
};
// מק"טי שירות שבשימוש ב-2026 (נמדד 20/10 משורות החשבוניות ב-Priority)
const SKUS = ['3', '000', '1', '2', '6'];
const MAX_LINES = 20;
const MAX_QTY = 10000;
const MAX_PRICE = 10_000_000;
const OPEN_STATUSES = ['new', 'preparing', 'awaiting_approval'];
const STATUS_LABELS = {
  new: 'ממתין להכנה',
  preparing: 'בהכנה (ריצה יבשה)',
  awaiting_approval: 'ממתין לאישור רעם בטלגרם',
  done: 'הופק',
  failed: 'נכשל',
  rejected: 'נדחה',
  expired: 'פג — לא אושר בתוך שעתיים',
  check_manually: 'לבדיקה ידנית ב-Priority',
};

function bad(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function num(v, what, lo, hi) {
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(x)) throw bad(`${what}: ערך לא תקין`);
  if (x < lo || x > hi) throw bad(`${what}: מחוץ לטווח`);
  return Math.round(x * 100) / 100;
}

/** גוף הבקשה מהדפדפן → { kind, payload } אחרי אימות. הלקוח והחברה **לא** נלקחים מכאן — רק מהשרת. */
function validateRequest(body, today = new Date()) {
  const kind = String(body?.kind ?? '').trim();
  if (!KINDS[kind]) throw bad('סוג מסמך לא מותר');
  const payload = {};
  const date = String(body?.date ?? '').trim();
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw bad('תאריך לא תקין (YYYY-MM-DD)');
    }
    const days = Math.abs(Date.parse(`${date}T00:00:00Z`) - Date.parse(today.toISOString().slice(0, 10) + 'T00:00:00Z'))
      / 86_400_000;
    if (days > 60) throw bad('תאריך רחוק מדי מהיום (±60 יום)');
    payload.date = date;
  }
  if (kind === 'rebill') return { kind, payload };

  const details = String(body?.details ?? '').trim();
  if (details.length > 40) throw bad('"פרטים" עד 40 תווים (התיאור המלא — בשורה)');
  if (details) payload.details = details;
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  if (lines.length < 1 || lines.length > MAX_LINES) throw bad(`צריך 1–${MAX_LINES} שורות`);
  payload.lines = lines.map((ln, i) => {
    const part = String(ln?.part ?? '').trim();
    if (!SKUS.includes(part)) throw bad(`שורה ${i + 1}: מק"ט לא מותר`);
    const description = String(ln?.description ?? '').trim();
    if (description.length > 120) throw bad(`שורה ${i + 1}: תיאור עד 120 תווים`);
    return {
      part,
      qty: num(ln?.qty, `שורה ${i + 1}: כמות`, 0.01, MAX_QTY),
      price: num(ln?.price, `שורה ${i + 1}: מחיר`, 0, MAX_PRICE),
      description,
    };
  });
  return { kind, payload };
}

/** סכום לפני מע"מ — להצגה בטופס ולסינון כפילויות. Priority מחשבת את המע"מ בעצמה. */
function netTotal(payload) {
  return Math.round((payload.lines || []).reduce((s, l) => s + l.qty * l.price, 0) * 100) / 100;
}

/** מפתח להשוואת בקשות זהות (לחיצה כפולה). */
function requestKey(customerNo, kind, payload) {
  return JSON.stringify([String(customerNo), kind, payload.date || '', payload.details || '',
    (payload.lines || []).map((l) => [l.part, l.qty, l.price, l.description])]);
}

module.exports = {
  KINDS, SKUS, MAX_LINES, OPEN_STATUSES, STATUS_LABELS, validateRequest, netTotal, requestKey,
};
