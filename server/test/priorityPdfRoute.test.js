// PDF של מסמך: POST/GET /api/priority/documents/:id/pdf — בקשה ל-p_requests, בלי כפילויות, קישור חתום כשמוכן.
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
  INSERT INTO customers (id, company_name, priority_customer_no) VALUES ('c1', 'עיריית נתניה', '200122');
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

function stub(relPath, exports) {
  const file = require.resolve(path.join(__dirname, relPath));
  const m = new Module(file);
  m.filename = file;
  m.loaded = true;
  m.exports = exports;
  require.cache[file] = m;
}
stub('../src/config/database', fakeDb);
stub('../src/middleware/auth', {
  authenticateToken: (req, res, next) => {
    const role = req.headers['x-test-role'];
    if (!role) return res.status(401).json({ error: 'no token' });
    req.user = { id: 'u1', role, first_name: 'רעם', last_name: 'יהלום' };
    return next();
  },
  requireManager: (req, res, next) => (
    ['admin', 'manager'].includes(req.user.role) ? next() : res.status(403).json({ error: 'forbidden' })),
});

const MIRROR = 'https://mirror.test';
process.env.SUPABASE_URL = MIRROR;
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.PRIORITY_MIRROR_EMAIL = 'bot@test';
process.env.PRIORITY_MIRROR_PASSWORD = 'pw';

const TABLES = {
  p_documents: [
    { id: 1, doc_type: 305, doc_no: 'IN264000070', party_key: '200122', cancelled: false },
    { id: 2, doc_type: 400, doc_no: 'RC269000052', party_key: '200122', cancelled: false },
  ],
  p_requests: [],
};
const signed = [];

function postgrest(url) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  let rows = [...(TABLES[table] || [])];
  let limit = Infinity;
  let order = null;
  for (const [k, v] of u.searchParams) {
    if (k === 'select') continue;
    if (k === 'order') { order = v; continue; }
    if (k === 'limit') { limit = Number(v); continue; }
    const [op, ...rest] = v.split('.');
    const arg = rest.join('.');
    const get = (r) => (k.includes('->>') ? (r[k.split('->>')[0]] || {})[k.split('->>')[1]] : r[k]);
    if (op === 'eq') rows = rows.filter((r) => String(get(r)) === arg);
    else if (op === 'in') {
      const set = new Set(arg.replace(/^\(|\)$/g, '').split(','));
      rows = rows.filter((r) => set.has(String(get(r))));
    } else throw new Error(`unsupported filter ${k}=${v}`);
  }
  if (order === 'id.desc') rows.sort((a, b) => b.id - a.id);
  return rows.slice(0, limit);
}

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  if (!String(url).startsWith(MIRROR)) return realFetch(url, opts);
  const json = (body, status = 200) => ({
    ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body),
    headers: { get: () => null },
  });
  if (String(url).includes('/auth/v1/token')) return json({ access_token: 'jwt', expires_in: 3600 });
  if (String(url).includes('/storage/v1/object/sign/')) {
    const p = String(url).split('/storage/v1/object/sign/')[1];
    signed.push(p);
    return json({ signedURL: `/object/sign/${p}?token=t` });
  }
  if ((opts.method || 'GET') === 'POST' && String(url).includes('/rest/v1/p_requests')) {
    const row = { id: TABLES.p_requests.length + 1, file_path: null, error: null, ...JSON.parse(opts.body) };
    TABLES.p_requests.push(row);
    return json([row], 201);
  }
  const rows = postgrest(url);
  return {
    ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows),
    headers: { get: (h) => (h.toLowerCase() === 'content-range' ? `0-${Math.max(rows.length - 1, 0)}/${rows.length}` : null) },
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
});
test.after(() => { server?.close(); globalThis.fetch = realFetch; });

async function call(method, route, role = 'admin') {
  const res = await realFetch(`${base}${route}`, { method, headers: role ? { 'x-test-role': role } : {} });
  return { status: res.status, body: await res.json() };
}

test('PDF: מנהל בלבד; קבלה → 422; מסמך לא קיים → 404', async () => {
  assert.equal((await call('POST', '/documents/1/pdf', 'employee')).status, 403);
  assert.equal((await call('POST', '/documents/2/pdf')).status, 422);
  assert.equal((await call('GET', '/documents/99/pdf')).status, 404);
});

test('PDF: לפני בקשה — none; בקשה יוצרת שורת pdf עם הלקוח המקושר; בקשה שנייה לא מכפילה', async () => {
  assert.equal((await call('GET', '/documents/1/pdf')).body.status, 'none');
  const r = await call('POST', '/documents/1/pdf');
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'new');
  const [row] = TABLES.p_requests;
  assert.equal(row.kind, 'pdf');
  assert.deepEqual(row.payload, { doc_type: 305, doc_no: 'IN264000070', document_id: 1 });
  assert.equal(row.priority_customer_no, '200122');
  assert.equal(row.crm_customer_id, 'c1');
  assert.equal(row.created_by, 'רעם יהלום');
  const again = await call('POST', '/documents/1/pdf');
  assert.equal(again.status, 200);
  assert.equal(TABLES.p_requests.length, 1, 'בקשה פתוחה — לא יוצרים עוד אחת');
});

test('PDF: כשמוכן — קישור חתום מה-storage; POST לא יוצר בקשה חדשה (לא מדפיסים שוב)', async () => {
  Object.assign(TABLES.p_requests[0], { status: 'done', file_path: '305/IN264000070.pdf' });
  const g = await call('GET', '/documents/1/pdf');
  assert.equal(g.body.status, 'done');
  assert.equal(g.body.url, `${MIRROR}/storage/v1/object/sign/priority-pdf/305/IN264000070.pdf?token=t`);
  assert.deepEqual(signed, ['priority-pdf/305/IN264000070.pdf']);
  await call('POST', '/documents/1/pdf');
  assert.equal(TABLES.p_requests.length, 1);
});

test('PDF: אחרי כישלון — מוצגת השגיאה, ובקשה חדשה אפשרית', async () => {
  Object.assign(TABLES.p_requests[0], { status: 'failed', file_path: null, error: 'PDF רק למסמך סופי' });
  const g = await call('GET', '/documents/1/pdf');
  assert.equal(g.body.status, 'failed');
  assert.equal(g.body.error, 'PDF רק למסמך סופי');
  const r = await call('POST', '/documents/1/pdf');
  assert.equal(r.status, 201);
  assert.equal(TABLES.p_requests.length, 2);
});
