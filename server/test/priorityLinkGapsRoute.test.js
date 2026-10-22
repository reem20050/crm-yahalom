// לקוחות Priority בלי שורה ב-p_accounts (מופיעים רק בסטטוס התשלום ובמסמכים): תור הקישור וקישור ידני.
// לפני התיקון: /unmatched ו-/link-proposals לא ראו אותם, ו-POST /links החזיר 422 — אי אפשר היה לקשר
// חייב של ₪86k (200039). אותו מבנה כמו priorityImportRoute.test.js.
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
    id TEXT PRIMARY KEY, company_name TEXT NOT NULL, business_id TEXT, address TEXT, city TEXT,
    service_type TEXT, status TEXT DEFAULT 'active', payment_terms TEXT DEFAULT 'net30', notes TEXT,
    lead_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT DEFAULT NULL, priority_customer_no TEXT, priority_matched_by TEXT,
    priority_confirmed_by TEXT, priority_confirmed_at TEXT
  );
  CREATE UNIQUE INDEX idx_customers_priority_no ON customers(priority_customer_no) WHERE priority_customer_no IS NOT NULL;
  CREATE TABLE activity_log (
    id TEXT PRIMARY KEY, user_id TEXT, entity_type TEXT NOT NULL, entity_id TEXT, action TEXT NOT NULL,
    changes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, description TEXT, user_name TEXT
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
    req.user = { id: 'u1', role, first_name: 'רעם', last_name: 'יהלום' };
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

const TABLES = {
  p_accounts: [
    { account_key: '200100', account_name: 'אלפא בע"מ', party_vat_id: '511111111', city: 'נתניה', kind: 'customer', balance: 0 },
  ],
  p_customer_status: [
    { party_key: '200100', party_name: 'אלפא בע"מ' },
    { party_key: '200039', party_name: 'מועצה דתית עמק חפר' },   // אין ב-p_accounts
    { party_key: '200041', party_name: 'רשת פנאי וקהילה דרום' },  // אין ב-p_accounts
  ],
  p_documents: [
    { id: 1, party_key: '200039', party_name: 'מועצה דתית עמק חפר', party_vat_id: '500301171', party_city: 'עמק חפר',
      doc_type: 305, total_incl_vat: 86340.6, issue_date: '2026-09-30', cancelled: false },
    { id: 2, party_key: '200041', party_name: 'רשת פנאי וקהילה דרום', party_vat_id: null, party_city: null,
      doc_type: 310, total_incl_vat: 5386.7, issue_date: '2026-09-30', cancelled: false },
  ],
};

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
  return { page: rows.slice(offset, offset + limit), total: rows.length };
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (!String(url).startsWith(MIRROR)) return realFetch(url, opts);
  if (String(url).includes('/auth/v1/token')) {
    return { ok: true, status: 200, json: async () => ({ access_token: 'jwt', expires_in: 3600 }) };
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
  const ins = sqlite.prepare('INSERT INTO customers (id, company_name, business_id, priority_customer_no) VALUES (?, ?, ?, ?)');
  ins.run('c1', 'אלפא', '511111111', '200100');
  ins.run('c2', 'מועמה דתית עמק חפר חפ 500301171', '500301171', null);   // כרטיס עם שגיאת כתיב, ח.פ. תואם
});
test.after(() => { server?.close(); globalThis.fetch = realFetch; });

async function call(method, route, body) {
  const res = await realFetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-test-role': 'admin' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('GET /link-proposals: מציע קישור ללקוח שאין לו שורה ב-p_accounts (לפי ח.פ. מהמסמך)', async () => {
  const { status, body } = await call('GET', '/link-proposals');
  assert.equal(status, 200);
  const all = JSON.stringify(body);
  assert.ok(all.includes('200039'), 'הלקוח מהסטטוס נכנס להצעות');
  const proposals = body.proposals || [];
  const p = proposals.find((x) => x.priority_customer_no === '200039');
  assert.ok(p, 'הצעה ל-200039');
  assert.equal(p.customer_id, 'c2');
});

test('GET /unmatched: לקוח מהסטטוס בלי כרטיס מופיע בתור הייבוא עם שם ומסמכים', async () => {
  const { status, body } = await call('GET', '/unmatched');
  assert.equal(status, 200);
  const u = (body.unmatched || []).find((x) => x.priority_customer_no === '200041');
  assert.ok(u, '200041 בתור');
  assert.equal(u.doc_count, 1);
});

test('POST /links: קישור ידני ללקוח שמופיע רק בסטטוס התשלום עובד; מספר שלא קיים → 422', async () => {
  let r = await call('POST', '/links', { customer_id: 'c2', priority_customer_no: '200039', matched_by: 'vat' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(sqlite.prepare('SELECT priority_customer_no FROM customers WHERE id = ?').get('c2').priority_customer_no, '200039');
  r = await call('POST', '/links', { customer_id: 'c1', priority_customer_no: '299999', matched_by: 'manual' });
  assert.equal(r.status, 422);
});
