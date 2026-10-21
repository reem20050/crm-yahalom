// סטטוס תשלום נגזר (p_customer_status): כרטיס לקוח + GET /api/priority/collections ("מי חייב").
// אותו מבנה כמו priorityImportRoute.test.js: SQLite בזיכרון, מראה מדומה (fetch), database/auth מוחלפים.
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

const ST = (party_key, m = {}) => ({
  party_key, as_of: '2026-10-20T03:10:00+00:00', bank_through: '2026-09-24', computed_at: '2026-10-20T03:20:00+00:00',
  balance: '0.00', paid_no_receipt: '0.00', short: '0.00', maybe: '0.00', to_chase: '0.00',
  items: [], deals_open: [], ...m,
});
const TABLES = {
  p_accounts: [
    { account_key: '200100', account_name: 'אלפא בע"מ', balance: 3000 },
    { account_key: '200200', account_name: 'בטא (Priority)', balance: 500 },
    { account_key: '200300', account_name: 'גמא', balance: 0 },
  ],
  p_documents: [],
  // numeric חוזר כמחרוזת — השרת חייב להמיר למספר
  // party_name — השם מהצילום; ה-CRM נופל אליו רק כשאין שם מהכרטיס או מ-p_accounts
  p_customer_status: [
    ST('200100', { party_name: 'אלפא מהצילום', balance: '3000.00', to_chase: '2000.00', paid_no_receipt: '1000.00',
      items: [{ ref: 'IN1', open: 2000, status: 'to_chase' }] }),
    ST('200200', { party_name: 'בטא מהצילום', balance: '500.00', maybe: '300.50', short: '199.50' }),
    ST('200300'),
  ],
};
let failStatus = false;

function postgrest(url) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  let rows = [...(TABLES[table] || [])];
  let limit = Infinity;
  for (const [k, v] of u.searchParams) {
    if (k === 'select' || k === 'order') continue;
    if (k === 'limit') { limit = Number(v); continue; }
    if (k === 'or') {
      const conds = v.replace(/^\(|\)$/g, '').split(',').map((c) => c.split('.'));
      rows = rows.filter((r) => conds.some(([col, op, val]) => op === 'gt' && Number(r[col]) > Number(val)));
      continue;
    }
    const [op, ...rest] = v.split('.');
    const arg = rest.join('.');
    if (op === 'eq') rows = rows.filter((r) => String(r[k]) === arg);
    else if (op === 'in') {
      const set = new Set(arg.replace(/^\(|\)$/g, '').split(','));
      rows = rows.filter((r) => set.has(String(r[k])));
    } else throw new Error(`unsupported filter ${k}=${v}`);
  }
  if (table === 'p_customer_status') rows.sort((x, y) => Number(y.to_chase) - Number(x.to_chase));
  // רק העמודות שנבחרו — כמו PostgREST. עמודה שלא ב-select לא מגיעה לשרת
  const select = u.searchParams.get('select');
  const cols = select && select !== '*' ? select.split(',') : null;
  const page = rows.slice(0, limit)
    .map((r) => (cols ? Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]])) : r));
  return { page, total: rows.length };
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
  ins.run('c3', 'גמא', '200300', null);
});
test.after(() => { server?.close(); globalThis.fetch = realFetch; });

async function call(route, role = 'admin') {
  const headers = role ? { 'x-test-role': role } : {};
  const res = await realFetch(`${base}${route}`, { headers });
  return { status: res.status, body: await res.json() };
}

test('GET /collections: מנהל בלבד', async () => {
  assert.equal((await call('/collections', 'employee')).status, 403);
});

test('GET /collections: רק לקוחות עם משהו פתוח, ממוינים לפי לגבות, סכומים כמספרים', async () => {
  const { status, body } = await call('/collections');
  assert.equal(status, 200);
  assert.deepEqual(body.rows.map((r) => r.party_key), ['200100', '200200']);
  assert.equal(body.bank_through, '2026-09-24');
  assert.deepEqual(body.totals, { to_chase: 2000, paid_no_receipt: 1000, maybe: 300.5, short: 199.5 });
  const [alpha, beta] = body.rows;
  assert.equal(alpha.customer_id, 'c1');
  assert.equal(alpha.name, 'אלפא');
  assert.equal(typeof alpha.to_chase, 'number');
  // לקוח CRM מחוק — בלי קישור, השם מ-Priority
  assert.equal(beta.customer_id, null);
  assert.equal(beta.name, 'בטא (Priority)');
  assert.equal(beta.maybe + beta.short, 500);
});

test('GET /collections: לקוח בלי כרטיס ובלי שורה ב-p_accounts מקבל את השם מהצילום', async () => {
  // כמו 200039 (מועצה דתית עמק חפר): חוב במראה, אין p_accounts — עד 21/10 הוצג לפי מספר בלבד
  TABLES.p_customer_status.push(ST('200400', { party_name: 'דלתא מהצילום', balance: '50.00', to_chase: '50.00' }));
  try {
    const { status, body } = await call('/collections');
    assert.equal(status, 200);
    const byNo = new Map(body.rows.map((r) => [r.party_key, r]));
    const delta = byNo.get('200400');
    assert.equal(delta.customer_id, null);
    assert.equal(delta.name, 'דלתא מהצילום');
    // הסדר: כרטיס CRM → p_accounts → הצילום
    assert.equal(byNo.get('200100').name, 'אלפא');
    assert.equal(byNo.get('200200').name, 'בטא (Priority)');
  } finally { TABLES.p_customer_status.pop(); }
});

test('GET /customer/:id: מחזיר סטטוס עם פירוט המסמכים', async () => {
  const { status, body } = await call('/customer/c1');
  assert.equal(status, 200);
  assert.equal(body.status.to_chase, 2000);
  assert.equal(body.status.paid_no_receipt, 1000);
  assert.equal(body.status.items[0].ref, 'IN1');
  assert.equal(body.status_unavailable, false);
});

test('GET /customer/:id: תקלה בקריאת הסטטוס לא מפילה את הכרטיס ומסומנת כתקלה', async () => {
  failStatus = true;
  try {
    const { status, body } = await call('/customer/c3');
    assert.equal(status, 200);
    assert.equal(body.status, null);
    assert.equal(body.status_unavailable, true);
  } finally { failStatus = false; }
});
