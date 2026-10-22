// רשימת הלידים: GET /api/leads עם חיפוש / סטטוס / מקור.
// הבאג (22/10): העמודות בסינון לא היו מוסמכות, והשאילתה מצרפת את users — שגם לו יש phone / status /
// deleted_at — ולכן חיפוש החזיר 500 ("ambiguous column"). נחשף עם הליד הראשון מהטופס הציבורי.
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
  CREATE TABLE leads (
    id TEXT PRIMARY KEY, company_name TEXT, contact_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
    source TEXT, service_type TEXT, location TEXT, description TEXT, status TEXT DEFAULT 'new',
    assigned_to TEXT, lost_reason TEXT, expected_value REAL, deleted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE users (id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, phone TEXT, status TEXT, deleted_at TEXT);
  INSERT INTO users VALUES ('u1', 'רעם', 'יהלום', '0520000000', 'active', NULL);
  INSERT INTO leads (id, company_name, contact_name, phone, source, status, assigned_to)
    VALUES ('l1', 'אולמי השרון', 'דני כהן', '0521234567', 'facebook', 'new', 'u1'),
           ('l2', NULL, 'רותי לוי', '0503333333', 'website', 'lost', NULL);
  INSERT INTO leads (id, contact_name, phone, deleted_at) VALUES ('l3', 'נמחק', '0509999999', '2026-10-01');
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
  authenticateToken: (req, _res, next) => { req.user = { id: 'u1', role: 'admin' }; next(); },
  requireManager: (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
});
stub('../src/utils/whatsappHelper', { notifyNewLead: async () => {} });

const router = require('../src/routes/leads');

let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/leads', router);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/leads`;
});
test.after(() => server?.close());

const get = async (qs = '') => {
  const res = await fetch(`${base}${qs}`);
  return { status: res.status, body: await res.json() };
};

test('GET /leads: בלי סינון — בלי מחוקים, עם שם המטפל', async () => {
  const r = await get();
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.leads.map((l) => l.id).sort(), ['l1', 'l2']);
  assert.equal(r.body.leads.find((l) => l.id === 'l1').assigned_to_name, 'רעם יהלום');
  assert.equal(r.body.pagination.total, 2);
});

test('GET /leads?search=… — חיפוש לפי שם / טלפון עובד (היה 500)', async () => {
  let r = await get(`?search=${encodeURIComponent('דני')}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.leads.map((l) => l.id), ['l1']);
  r = await get('?search=0503333333');
  assert.deepEqual(r.body.leads.map((l) => l.id), ['l2']);
});

test('GET /leads?status=…&source=… — סינון לפי סטטוס ומקור', async () => {
  let r = await get('?status=lost');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.leads.map((l) => l.id), ['l2']);
  r = await get('?source=facebook');
  assert.deepEqual(r.body.leads.map((l) => l.id), ['l1']);
});
