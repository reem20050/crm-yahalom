// מסך המסמכים: GET /api/priority/documents (סינון), /documents/:id (מסמך + שורות), /revenue-monthly.
// אותו מבנה כמו priorityStatusRoute.test.js: SQLite בזיכרון, מראה מדומה (fetch), database/auth מוחלפים.
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

const month = (offset) => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + offset, 10)).toISOString().slice(0, 10);
};
const D = (id, doc_type, doc_no, issue_date, party_key, net, m = {}) => ({
  id, doc_type, doc_no, issue_date, doc_date: issue_date, party_key, party_name: `לקוח ${party_key}`,
  party_vat_id: null, total_after_discount_ex_vat: net, vat_amount: net == null ? null : net * 0.18,
  total_incl_vat: net == null ? 500 : net * 1.18, withholding_amount: null, cancelled: false, ...m,
});
const TABLES = {
  p_documents: [
    D(1, 305, 'IN1', month(0), '200100', 1000),
    D(2, 320, 'OV1', month(-1), '200100', 2000),
    D(3, 330, 'CR1', month(-1), '200100', 300),
    D(4, 300, 'PI1', month(0), '200200', 5000),
    D(5, 400, 'RC1', month(0), '200200', null),
    D(6, 305, 'IN2', month(0), '200200', 700, { cancelled: true }),
    D(7, 305, 'IN-OLD', '2020-01-15', '200100', 9999),
  ],
  p_doc_lines: [
    { document_id: 1, line_no: 2, description: 'שורה ב', quantity: 1, unit_price: 400, line_total: 400 },
    { document_id: 1, line_no: 1, description: 'שורה א', quantity: 2, unit_price: 300, line_total: 600 },
  ],
  p_customer_status: [
    { party_key: '200100', as_of: '2026-10-21T03:00:00Z', bank_through: '2026-09-24',
      items: [{ ref: 'IN1', open: 1180, status: 'to_chase', days: 12 }] },
  ],
};
let failStatus = false;

function postgrest(url) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  let rows = [...(TABLES[table] || [])];
  let limit = Infinity;
  let offset = 0;
  let order = null;
  for (const [k, v] of u.searchParams) {
    if (k === 'select') continue;
    if (k === 'order') { order = v; continue; }
    if (k === 'limit') { limit = Number(v); continue; }
    if (k === 'offset') { offset = Number(v); continue; }
    if (k === 'or') {
      const conds = v.replace(/^\(|\)$/g, '').split(',').map((c) => c.split('.'));
      rows = rows.filter((r) => conds.some(([col, , pat]) => {
        const needle = decodeURIComponent(pat).replace(/\*/g, '');
        return String(r[col] ?? '').includes(needle);
      }));
      continue;
    }
    const [op, ...rest] = v.split('.');
    const arg = rest.join('.');
    if (op === 'eq') rows = rows.filter((r) => String(r[k]) === arg);
    else if (op === 'in') {
      const set = new Set(arg.replace(/^\(|\)$/g, '').split(','));
      rows = rows.filter((r) => set.has(String(r[k])));
    } else if (op === 'is') rows = rows.filter((r) => String(r[k]) === arg);
    else if (op === 'gte') rows = rows.filter((r) => String(r[k]) >= arg);
    else if (op === 'lte') rows = rows.filter((r) => String(r[k]) <= arg);
    else throw new Error(`unsupported filter ${k}=${v}`);
  }
  if (order === 'line_no') rows.sort((a, b) => a.line_no - b.line_no);
  if (order?.startsWith('issue_date.desc')) rows.sort((a, b) => String(b.issue_date).localeCompare(String(a.issue_date)));
  return { page: rows.slice(offset, offset + limit), total: rows.length };
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (!String(url).startsWith(MIRROR)) return realFetch(url, opts);
  if (String(url).includes('/auth/v1/token')) {
    return { ok: true, status: 200, json: async () => ({ access_token: 'jwt', expires_in: 3600 }) };
  }
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
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/priority', router);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/priority`;
  const ins = sqlite.prepare('INSERT INTO customers (id, company_name, priority_customer_no, deleted_at) VALUES (?, ?, ?, ?)');
  ins.run('c1', 'אלפא', '200100', null);
  ins.run('c2', 'בטא ישן', '200200', '2026-01-01');   // מחוק — לא מקשרים אליו
});
test.after(() => { server?.close(); globalThis.fetch = realFetch; });

async function call(route, role = 'admin') {
  const headers = role ? { 'x-test-role': role } : {};
  const res = await realFetch(`${base}${route}`, { headers });
  return { status: res.status, body: await res.json() };
}

test('GET /documents: מנהל בלבד; קלט לא תקין → 400', async () => {
  assert.equal((await call('/documents', 'employee')).status, 403);
  assert.equal((await call('/documents?doc_type=305;drop')).status, 400);
  assert.equal((await call('/documents?from=1/10/2026')).status, 400);
  assert.equal((await call('/documents?party_key=abc')).status, 400);
});

test('GET /documents: בלי מבוטלים כברירת מחדל, ממוין מהחדש, עם customer_id רק ללקוח מקושר פעיל', async () => {
  const { status, body } = await call('/documents');
  assert.equal(status, 200);
  assert.equal(body.total, 6);
  assert.ok(!body.rows.some((r) => r.doc_no === 'IN2'));
  assert.equal(body.rows.at(-1).doc_no, 'IN-OLD');
  const by = Object.fromEntries(body.rows.map((r) => [r.doc_no, r]));
  assert.equal(by.IN1.customer_id, 'c1');
  assert.equal(by.PI1.customer_id, null, 'כרטיס מחוק לא מקושר');
});

test('GET /documents: סינון לפי סוג, טווח תאריכים, לקוח ומבוטלים', async () => {
  let r = await call('/documents?doc_type=305,320');
  assert.deepEqual(r.body.rows.map((d) => d.doc_no).sort(), ['IN-OLD', 'IN1', 'OV1']);
  r = await call(`/documents?from=${month(0).slice(0, 8)}01`);
  assert.deepEqual(r.body.rows.map((d) => d.doc_no).sort(), ['IN1', 'PI1', 'RC1']);
  r = await call('/documents?to=2021-01-01');
  assert.deepEqual(r.body.rows.map((d) => d.doc_no), ['IN-OLD']);
  r = await call('/documents?party_key=200200&includeCancelled=true');
  assert.deepEqual(r.body.rows.map((d) => d.doc_no).sort(), ['IN2', 'PI1', 'RC1']);
});

test('GET /documents/:id: כותרת, שורות לפי סדר, לקוח מקושר ומצב פתוח משוער', async () => {
  const { status, body } = await call('/documents/1');
  assert.equal(status, 200);
  assert.equal(body.document.doc_no, 'IN1');
  assert.deepEqual(body.lines.map((l) => l.line_no), [1, 2]);
  assert.deepEqual(body.customer, { id: 'c1', name: 'אלפא' });
  assert.equal(body.payment.open, 1180);
  assert.equal(body.payment.status, 'to_chase');
  assert.equal(body.payment.bank_through, '2026-09-24');
});

test('GET /documents/:id: קבלה בלי שורות; לקוח בלי כרטיס; כשל בסטטוס לא מפיל', async () => {
  failStatus = true;
  try {
    const { status, body } = await call('/documents/5');
    assert.equal(status, 200);
    assert.deepEqual(body.lines, []);
    assert.equal(body.customer, null);
    assert.equal(body.payment, null);
  } finally { failStatus = false; }
});

test('GET /documents/:id: לא קיים → 404, מזהה לא תקין → 400', async () => {
  assert.equal((await call('/documents/999')).status, 404);
  assert.equal((await call('/documents/1;drop')).status, 400);
});

test('GET /revenue-monthly: חשבוניות מס לפני מע"מ, זיכוי בניכוי, בלי עסקה/קבלה/מבוטל, כל החודשים', async () => {
  const { status, body } = await call('/revenue-monthly?months=3');
  assert.equal(status, 200);
  assert.equal(body.months.length, 3);
  const [m2, m1, m0] = body.months;
  assert.equal(m0.month, month(0).slice(0, 7));
  assert.equal(m0.net, 1000, 'רק IN1 — לא PI1, RC1, IN2 המבוטל');
  assert.equal(m1.net, 1700, 'OV1 פחות CR1');
  assert.equal(m2.net, 0);
});
