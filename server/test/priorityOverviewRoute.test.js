// רשימת הלקוחות: GET /api/priority/customer-overview (לגבות + מסמך אחרון לכל לקוח מקושר),
// ו-last_doc / kartesset_as_of בכרטיס (GET /customer/:id).
// אותו מבנה כמו priorityDocumentsRoute.test.js: SQLite בזיכרון, מראה מדומה (fetch), database/auth מוחלפים.
// הרצה (מתוך server/): node --test "test/**/*.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const express = require('express');
const Database = require('better-sqlite3');

const sqlite = new Database(':memory:');
sqlite.exec(`
  CREATE TABLE customers (
    id TEXT PRIMARY KEY, company_name TEXT NOT NULL, deleted_at TEXT DEFAULT NULL,
    priority_customer_no TEXT, priority_matched_by TEXT, priority_confirmed_by TEXT, priority_confirmed_at TEXT
  );
  CREATE TABLE users (id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT);
`);

const fakeDb = {
  generateUUID: () => crypto.randomUUID(),
  async query(sql, params = []) {
    const ordered = [];
    const s = sql.replace(/\$(\d+)/g, (_m, n) => { ordered.push(params[Number(n) - 1]); return '?'; });
    const stmt = sqlite.prepare(s);
    if (stmt.reader) return { rows: stmt.all(...ordered) };
    const r = stmt.run(...ordered);
    return { rows: [], rowCount: r.changes };
  },
};

const fakeAuth = {
  authenticateToken: (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ error: 'no token' });
    req.user = { id: 'u1', role };
    return next();
  },
  requireManager: (req, res, next) => (
    ['admin', 'manager'].includes(req.user.role) ? next() : res.status(403).json({ error: 'forbidden' })),
};

function stub(relPath, exports) {
  const file = require.resolve(path.join(__dirname, relPath));
  const m = new Module(file);
  m.filename = file;
  m.loaded = true;
  m.exports = exports;
  require.cache[file] = m;
}
stub('../src/config/database', fakeDb);
stub('../src/middleware/auth', fakeAuth);

const MIRROR = 'https://mirror.test';
process.env.SUPABASE_URL = MIRROR;
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.PRIORITY_MIRROR_EMAIL = 'bot@test';
process.env.PRIORITY_MIRROR_PASSWORD = 'pw';

const D = (id, doc_type, doc_no, issue_date, party_key, m = {}) => ({
  id, doc_type, doc_no, issue_date, doc_date: issue_date, party_key, party_name: `לקוח ${party_key}`,
  party_vat_id: null, total_after_discount_ex_vat: 100, vat_amount: 18, total_incl_vat: 118,
  withholding_amount: null, cancelled: false, ...m,
});
const ST = (party_key, m = {}) => ({
  party_key, party_name: null, as_of: '2026-10-21T03:10:00+00:00', bank_through: '2026-09-24',
  computed_at: '2026-10-21T03:20:00+00:00', balance: '0.00', paid_no_receipt: '0.00', short: '0.00', maybe: '0.00',
  to_chase: '0.00', items: [], deals_open: [], ...m,
});
const TABLES = {
  p_documents: [
    D(1, 305, 'IN1', '2026-09-01', '200100'),
    D(2, 305, 'IN2', '2026-10-10', '200100', { cancelled: true }),   // מבוטל — לא "אחרון"
    D(3, 400, 'RC1', '2026-09-15', '200100', { total_incl_vat: 500 }),
    D(4, 700, 'SUP1', '2026-10-15', '200100'),                       // מסמך ספק — לא נספר
    D(5, 300, 'PI1', '2026-08-01', '200300'),
    D(6, 305, 'IN9', '2026-10-01', '200400'),                        // לקוח מחוק ב-CRM
  ],
  p_accounts: [{ account_key: '200100', account_name: 'אלפא', party_vat_id: null, balance: 9999 }],
  p_journal: [{ entry_date: '2026-09-30' }],
  // numeric חוזר כמחרוזת; שורות זבל מהצילום (Forecast) לא מגיעות לרשימה
  p_customer_status: [
    ST('200100', { to_chase: '2000.50', paid_no_receipt: '1000.00', maybe: '10.00', short: '5.00' }),
    ST('200300'),
    ST('Forecast', { to_chase: '7.00' }),
  ],
};
let failStatus = false;
const fetched = [];

function postgrest(url) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  let rows = [...(TABLES[table] || [])];
  let limit = Infinity;
  let offset = 0;
  for (const [k, v] of u.searchParams) {
    if (k === 'select' || k === 'order') continue;
    if (k === 'limit') { limit = Number(v); continue; }
    if (k === 'offset') { offset = Number(v); continue; }
    const [op, ...rest] = v.split('.');
    const arg = rest.join('.');
    if (op === 'eq') rows = rows.filter((r) => String(r[k]) === arg);
    else if (op === 'in') {
      const set = new Set(arg.replace(/^\(|\)$/g, '').split(','));
      rows = rows.filter((r) => set.has(String(r[k])));
    } else if (op === 'is') rows = rows.filter((r) => String(r[k]) === arg);
    else throw new Error(`unsupported filter ${k}=${v}`);
  }
  // רק העמודות שנבחרו — כמו PostgREST
  const select = u.searchParams.get('select');
  const cols = select && select !== '*' ? select.split(',') : null;
  const page = rows.slice(offset, offset + limit)
    .map((r) => (cols ? Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]])) : r));
  return { page, total: rows.length };
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (!String(url).startsWith(MIRROR)) return realFetch(url, opts);
  if (String(url).includes('/auth/v1/token')) {
    return { ok: true, status: 200, json: async () => ({ access_token: 'jwt', expires_in: 3600 }) };
  }
  fetched.push(new URL(url).pathname.replace('/rest/v1/', ''));
  if (failStatus && String(url).includes('p_customer_status')) {
    return { ok: false, status: 500, json: async () => ({}), text: async () => 'boom', headers: { get: () => null } };
  }
  const { page, total } = postgrest(url);
  return {
    ok: true,
    status: 200,
    json: async () => page,
    text: async () => JSON.stringify(page),
    headers: { get: (h) => (h.toLowerCase() === 'content-range' ? `0-${Math.max(page.length - 1, 0)}/${total}` : null) },
  };
};

const router = require('../src/routes/priority');

let base;
let server;
const ins = sqlite.prepare('INSERT INTO customers (id, company_name, priority_customer_no, deleted_at) VALUES (?, ?, ?, ?)');
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/priority', router);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/priority`;
  ins.run('c1', 'אלפא', '200100', null);
  ins.run('c2', 'בלי מסמכים ובלי סטטוס', '200200', null);
  ins.run('c3', 'גמא', '200300', null);
  ins.run('c4', 'מחוק', '200400', '2026-01-01');
  ins.run('c5', 'לא מקושר', null, null);
});
test.after(() => { server?.close(); globalThis.fetch = realFetch; });

async function call(route, role = 'admin') {
  const headers = role ? { 'x-test-role': role } : {};
  const res = await realFetch(`${base}${route}`, { headers });
  return { status: res.status, body: await res.json() };
}

test('GET /customer-overview: מנהל בלבד', async () => {
  assert.equal((await call('/customer-overview', 'employee')).status, 403);
  assert.equal((await call('/customer-overview', null)).status, 401);
});

test('GET /customer-overview: שורה לכל לקוח מקושר פעיל, סכומים כמספרים, מסמך אחרון בלי מבוטל/ספק', async () => {
  const { status, body } = await call('/customer-overview');
  assert.equal(status, 200);
  assert.equal(body.bank_through, '2026-09-24');
  const byId = new Map(body.rows.map((r) => [r.customer_id, r]));
  assert.deepEqual([...byId.keys()].sort(), ['c1', 'c2', 'c3']);   // לא מחוק, לא לא-מקושר
  const alpha = byId.get('c1');
  assert.equal(alpha.priority_customer_no, '200100');
  assert.deepEqual(alpha.status, { to_chase: 2000.5, paid_no_receipt: 1000, maybe: 10, short: 5 });
  assert.deepEqual(alpha.last_doc, { id: 3, doc_type: 400, doc_no: 'RC1', date: '2026-09-15', total_incl_vat: 500 });
  // בלי שורת סטטוס → null ("עוד לא חושב"), לא אפסים; שורה עם אפסים → 0
  assert.equal(byId.get('c2').status, null);
  assert.equal(byId.get('c2').last_doc, null);
  assert.equal(byId.get('c3').status.to_chase, 0);
  assert.equal(byId.get('c3').last_doc.doc_no, 'PI1');
});

test('GET /customer-overview: מספר הקריאות למראה לא גדל עם מספר הלקוחות (לא N+1)', async () => {
  fetched.length = 0;
  await call('/customer-overview');
  const before = fetched.length;
  for (let i = 0; i < 30; i += 1) ins.run(`x${i}`, `לקוח ${i}`, String(201000 + i), null);
  try {
    fetched.length = 0;
    const { body } = await call('/customer-overview');
    assert.equal(body.rows.length, 33);
    assert.equal(fetched.length, before);
    assert.deepEqual([...new Set(fetched)].sort(), ['p_customer_status', 'p_documents']);
  } finally { sqlite.exec("DELETE FROM customers WHERE id LIKE 'x%'"); }
});

test('GET /customer-overview: תקלה בקריאת הסטטוס היא תקלה (502), לא "אין חוב"', async () => {
  failStatus = true;
  try {
    assert.equal((await call('/customer-overview')).status, 502);
  } finally { failStatus = false; }
});

test('GET /customer/:id: last_doc זהה לרשימה, ותאריך הכרטסת', async () => {
  const { status, body } = await call('/customer/c1');
  assert.equal(status, 200);
  const overview = (await call('/customer-overview')).body.rows.find((r) => r.customer_id === 'c1');
  assert.deepEqual(body.last_doc, overview.last_doc);
  assert.equal(body.kartesset_as_of, '2026-09-30');
  assert.equal(body.account.balance, 9999);
});
