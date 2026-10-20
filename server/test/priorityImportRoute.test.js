// בדיקת מסלולים: GET /api/priority/unmatched ו-POST /api/priority/import-customers מול
// SQLite בזיכרון ומראה מדומה (fetch). database.js ו-auth.js מוחלפים ב-require.cache: database.js
// מאתחל DB אמיתי בטעינה ומשאיר את התהליך חי, ו-auth דורש JWT ומשתמש ב-DB.
// הרצה (מתוך server/): node --test "test/**/*.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const express = require('express');
const Database = require('better-sqlite3');

// ── DB בזיכרון, עם אותה המרת $N → ? כמו querySqlite ────────────────────────────
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

// ── מראה מדומה (PostgREST מינימלי) ───────────────────────────────────────────
const MIRROR = 'https://mirror.test';
process.env.SUPABASE_URL = MIRROR;
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.PRIORITY_MIRROR_EMAIL = 'bot@test';
process.env.PRIORITY_MIRROR_PASSWORD = 'pw';

const a = (account_key, account_name, party_vat_id = null, city = null, kind = 'customer') => ({
  account_key, account_name, party_vat_id, city, kind, balance: 0,
});
const TABLES = {
  p_accounts: [
    a('200145', 'פארק המים בע"מ', '512345678'),
    a('200029', 'פארק המים', '512345678', 'אשדוד'),
    a('200300', 'בטא אבטחה', '513333333', 'חיפה'),
    a('200301', 'בטא אבטחה סניף', '51-333333-3'),
    a('200400', 'גמא', null, ' תל אביב '),
    a('200500', 'חב"ד מרכז בע"מ'),
    a('200600', 'אלפא שמירה', '511111111'),
    a('200700', 'יוטא'),
    a('200900', 'דלתא'),
    a('300001', 'ספק כלשהו', '514444444', null, 'supplier'),
  ],
  p_documents: [
    { id: 1, party_key: '200300', doc_type: 305, total_incl_vat: 1170, issue_date: '2026-07-10', cancelled: false },
    { id: 2, party_key: '200300', doc_type: 400, total_incl_vat: 1170, issue_date: '2026-07-20', cancelled: false },
    { id: 3, party_key: '200300', doc_type: 305, total_incl_vat: 500, issue_date: '2026-08-01', cancelled: true },
    { id: 4, party_key: '200029', doc_type: 305, total_incl_vat: 100, issue_date: '2026-05-01', cancelled: false },
    { id: 5, party_key: '200700', doc_type: 320, total_incl_vat: 585, issue_date: '2026-06-01', cancelled: false },
    { id: 6, party_key: '200600', doc_type: 305, total_incl_vat: 9, issue_date: '2026-06-02', cancelled: false },
  ],
};
const mirrorCalls = [];

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
  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  return { page, total };
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (!String(url).startsWith(MIRROR)) return realFetch(url, opts);
  mirrorCalls.push(String(url));
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

// ── האפליקציה ────────────────────────────────────────────────────────────────
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

  const ins = sqlite.prepare('INSERT INTO customers (id, company_name, business_id, priority_customer_no, priority_matched_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?)');
  ins.run('c1', 'פארק המים', '512345678', '200145', 'vat', null);
  ins.run('c2', 'חב"ד מרכז', null, null, null, null);
  ins.run('c3', 'דלתא ישן', null, '200900', 'manual', '2026-01-01');
  ins.run('c4', 'אלפא שמירה בע"מ', '511111111', null, null, null);
  ins.run('c5', 'יוטא', null, null, null, null);
  ins.run('c6', 'יוטא בע"מ', null, null, null, null);
});
test.after(() => { server?.close(); globalThis.fetch = realFetch; });

async function call(method, route, { body, role = 'admin' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (role) headers['x-test-role'] = role;
  const res = await realFetch(`${base}${route}`, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

const customersCount = () => sqlite.prepare('SELECT COUNT(*) AS n FROM customers').get().n;

// ── GET /unmatched ───────────────────────────────────────────────────────────
test('GET /unmatched: מנהל בלבד', async () => {
  assert.equal((await call('GET', '/unmatched', { role: 'employee' })).status, 403);
  assert.equal((await call('GET', '/unmatched', { role: null })).status, 401);
});

test('GET /unmatched: unmatched עם עיר, מסמכים, blocked; דו-משמעיים עם מסמכים', async () => {
  const before = customersCount();
  const { status, body } = await call('GET', '/unmatched');
  assert.equal(status, 200);
  assert.equal(customersCount(), before, 'GET לא יוצר כלום');

  const nos = body.unmatched.map((u) => u.priority_customer_no);
  // 200900 מקושר ללקוח מחוק — proposeMatches לא רואה אותו כמקושר, אבל הוא חסום ליצירה
  assert.deepEqual([...nos].sort(), ['200029', '200300', '200301', '200400', '200900']);
  assert.equal(nos[0], '200300', 'הפעיל לאחרונה ראשון');

  const by = Object.fromEntries(body.unmatched.map((u) => [u.priority_customer_no, u]));
  assert.equal(by['200300'].city, 'חיפה');
  assert.equal(by['200300'].doc_count, 2);
  assert.equal(by['200300'].cancelled_count, 1);
  assert.equal(by['200300'].tax_invoices_net, 1170);
  assert.equal(by['200300'].receipts, 1170);
  assert.equal(by['200300'].last_doc_date, '2026-07-20');
  assert.equal(by['200300'].blocked, null);
  assert.deepEqual(by['200300'].priority_duplicates, ['200301']);

  assert.equal(by['200029'].blocked.reason, 'vat_exists');
  assert.equal(by['200029'].blocked.customer_id, 'c1');
  assert.equal(by['200029'].blocked.customer_priority_no, '200145');
  assert.equal(by['200900'].blocked.reason, 'linked_to_deleted');
  assert.equal(by['200400'].doc_count, 0);
  assert.equal(by['200400'].blocked, null);

  assert.equal(body.summary.importable, 3);
  assert.equal(body.summary.accounts_read, 9, 'ספקים לא נכנסים');
  assert.equal(body.ambiguous.length, 1);
  assert.equal(body.ambiguous[0].priority_customer_no, '200700');
  assert.equal(body.ambiguous[0].doc_count, 1);

  const docsCall = mirrorCalls.find((u) => u.includes('/rest/v1/p_documents'));
  assert.ok(docsCall.includes('party_key=in.('), docsCall);
  assert.ok(!docsCall.includes('200600'), 'מסמכים רק לחשבונות בתור');
});

// ── POST /import-customers ───────────────────────────────────────────────────
test('POST /import-customers: קלט לא תקין → 400, בלי כתיבה', async () => {
  const before = customersCount();
  assert.equal((await call('POST', '/import-customers', { body: {} })).status, 400);
  assert.equal((await call('POST', '/import-customers', { body: { priority_customer_nos: [] } })).status, 400);
  assert.equal((await call('POST', '/import-customers', { body: { priority_customer_nos: '200300' } })).status, 400);
  const many = Array.from({ length: 201 }, (_v, i) => String(100000 + i));
  assert.equal((await call('POST', '/import-customers', { body: { priority_customer_nos: many } })).status, 400);
  assert.equal((await call('POST', '/import-customers', { role: 'employee', body: { priority_customer_nos: ['200300'] } })).status, 403);
  assert.equal(customersCount(), before);
});

test('POST /import-customers: יוצר ומקשר רק את המסומנים, conflict על ח.פ./שם, דילוג על מקושרים', async () => {
  const before = customersCount();
  mirrorCalls.length = 0;
  const { status, body } = await call('POST', '/import-customers', {
    body: { priority_customer_nos: ['200300', '200301', '200400', '200029', '200145', '200500', '200900', '999999', 'abc', '200300'] },
  });
  assert.equal(status, 200);
  assert.deepEqual(body.summary, { requested: 9, created: 2, conflicts: 3, skipped: 4, failed: 0 });

  const created = Object.fromEntries(body.created.map((c) => [c.priority_customer_no, c]));
  assert.deepEqual(Object.keys(created).sort(), ['200300', '200400']);

  const conflicts = Object.fromEntries(body.conflicts.map((c) => [c.priority_customer_no, c]));
  assert.equal(conflicts['200301'].reason, 'vat_exists');
  assert.equal(conflicts['200301'].customer_id, created['200300'].customer_id, 'אותו ח.פ. באותה בקשה');
  assert.equal(conflicts['200029'].reason, 'vat_exists');
  assert.equal(conflicts['200029'].customer_id, 'c1');
  assert.equal(conflicts['200500'].reason, 'name_exists');
  assert.equal(conflicts['200500'].customer_id, 'c2');

  const skipped = Object.fromEntries(body.skipped.map((s) => [s.priority_customer_no, s.reason]));
  assert.deepEqual(skipped, {
    200145: 'already_linked', 200900: 'linked_to_deleted', 999999: 'not_in_mirror', abc: 'invalid_no',
  });

  // ב-DB: שני לקוחות חדשים, מקושרים ידנית, עם הנתונים מהמראה
  assert.equal(customersCount(), before + 2);
  const beta = sqlite.prepare('SELECT * FROM customers WHERE priority_customer_no = ?').get('200300');
  assert.equal(beta.id, created['200300'].customer_id);
  assert.equal(beta.company_name, 'בטא אבטחה');
  assert.equal(beta.business_id, '513333333');
  assert.equal(beta.city, 'חיפה');
  assert.equal(beta.status, 'active');
  assert.equal(beta.priority_matched_by, 'manual');
  assert.equal(beta.priority_confirmed_by, 'u1');
  assert.ok(beta.priority_confirmed_at);
  const gamma = sqlite.prepare('SELECT * FROM customers WHERE priority_customer_no = ?').get('200400');
  assert.equal(gamma.business_id, null);
  assert.equal(gamma.city, 'תל אביב');

  // לא נוצרו: חשבון שלא סומן (200600, הצעה לפי ח.פ.), ולא חב"ד כפול
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM customers WHERE priority_customer_no = '200600'").get().n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM customers WHERE company_name LIKE '%חב%'").get().n, 1);

  // יומן פעולות: רשומה לכל לקוח שנוצר
  const logs = sqlite.prepare("SELECT * FROM activity_log WHERE action = 'priority_import' ORDER BY entity_id").all();
  assert.deepEqual(logs.map((l) => l.entity_id).sort(), [created['200300'].customer_id, created['200400'].customer_id].sort());
  for (const l of logs) {
    assert.equal(l.entity_type, 'customer');
    assert.equal(l.user_id, 'u1');
    assert.equal(l.user_name, 'רעם יהלום');
    assert.equal(JSON.parse(l.changes).matched_by, 'manual');
  }

  // הערה כמו בייבוא הראשון: "נוצר מ-Priority (לקוח 200xxx) DD/MM/YYYY"
  assert.match(beta.notes, /^נוצר מ-Priority \(לקוח 200300\) \d{2}\/\d{2}\/\d{4}$/);

  // כל חשבונות הלקוח נקראים (לזיהוי כפילים ב-Priority); ערך לא תקין לא נשתל ב-URL
  const accCall = mirrorCalls.find((u) => u.includes('/rest/v1/p_accounts'));
  assert.ok(accCall.includes('kind=eq.customer'), accCall);
  assert.ok(!accCall.includes('abc'), accCall);
});

test('POST /import-customers: הרצה חוזרת לא יוצרת כפילות', async () => {
  const before = customersCount();
  const { status, body } = await call('POST', '/import-customers', { body: { priority_customer_nos: ['200300', 200400] } });
  assert.equal(status, 200);
  assert.equal(body.summary.created, 0);
  assert.deepEqual(body.skipped.map((s) => s.reason), ['already_linked', 'already_linked']);
  assert.equal(customersCount(), before);
});

test('GET /unmatched אחרי ייבוא: הנוצרים יוצאים מהתור, והכפיל חסום', async () => {
  const { body } = await call('GET', '/unmatched');
  const by = Object.fromEntries(body.unmatched.map((u) => [u.priority_customer_no, u]));
  assert.equal(by['200300'], undefined);
  assert.equal(by['200400'], undefined);
  assert.equal(by['200301'].blocked.reason, 'vat_exists');
  assert.equal(by['200301'].blocked.customer_priority_no, '200300');
});
