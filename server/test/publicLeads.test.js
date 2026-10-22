// טופס לידים ציבורי: POST /api/public/leads — קליטה, מלכודת בוטים, כפילות טלפון, בדיקות קלט, התראה למנהלים.
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
    assigned_to TEXT, lost_reason TEXT, expected_value REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT);
  CREATE TABLE notifications (
    id TEXT PRIMARY KEY, user_id TEXT, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT,
    related_entity_type TEXT, related_entity_id TEXT, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE activity_log (
    id TEXT PRIMARY KEY, user_id TEXT, entity_type TEXT NOT NULL, entity_id TEXT, action TEXT NOT NULL,
    changes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, description TEXT, user_name TEXT
  );
  INSERT INTO users VALUES ('m1', 'manager'), ('a1', 'admin'), ('e1', 'employee');
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
// RETURNING * לא נתמך בכל גרסאות SQLite דרך run — עוטפים: אחרי INSERT מחזירים את השורה
const origQuery = fakeDb.query;
fakeDb.query = async (sql, params = []) => {
  if (/INSERT INTO leads/.test(sql)) {
    await origQuery(sql.replace(/RETURNING \*/, ''), params);
    return { rows: sqlite.prepare('SELECT * FROM leads WHERE id = ?').all(params[0]) };
  }
  return origQuery(sql, params);
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
const sent = [];
stub('../src/utils/whatsappHelper', { notifyNewLead: async (lead) => { sent.push(lead.id); } });

process.env.PUBLIC_LEADS_PER_HOUR = '6';   // 6 הבקשות של הבדיקות עוברות, השביעית נחסמת
const router = require('../src/routes/publicLeads');

let base;
let server;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/public/leads', router);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/public/leads`;
});
test.after(() => server?.close());

const post = async (body) => {
  const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
const leads = () => sqlite.prepare('SELECT * FROM leads ORDER BY created_at').all();

test('normalizePhone: +972 / מקפים → 0XXXXXXXXX; זבל → null', () => {
  assert.equal(router.normalizePhone('+972-52-316-3859'), '0523163859');
  assert.equal(router.normalizePhone('09 888 8888'), '098888888');
  assert.equal(router.normalizePhone('12345'), null);
});

test('ליד תקין נשמר: סטטוס חדש, מקור מ-utm, התראה לכל מנהל, יומן', async () => {
  const r = await post({
    name: 'דני כהן', phone: '052-1234567', company_name: 'אולמי השרון', service_type: 'event',
    message: 'אירוע 300 איש', utm_source: 'facebook', utm_campaign: 'oct26', elapsed_ms: 9000,
  });
  assert.equal(r.status, 201);
  const [l] = leads();
  assert.equal(l.contact_name, 'דני כהן');
  assert.equal(l.phone, '0521234567');
  assert.equal(l.status, 'new');
  assert.equal(l.source, 'facebook');
  assert.equal(l.service_type, 'event');
  assert.match(l.description, /אירוע 300 איש/);
  assert.match(l.description, /קמפיין: oct26/);
  const notes = sqlite.prepare("SELECT user_id FROM notifications WHERE type = 'lead_new'").all().map((n) => n.user_id).sort();
  assert.deepEqual(notes, ['a1', 'm1'], 'מנהלים בלבד');
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM activity_log WHERE entity_id = ?").get(l.id).n, 1);
  assert.deepEqual(sent, [l.id]);
});

test('אותו טלפון שוב תוך 24 שעות — אין ליד כפול', async () => {
  const before = leads().length;
  const r = await post({ name: 'דני', phone: '0521234567', elapsed_ms: 9000 });
  assert.equal(r.status, 201);
  assert.equal(leads().length, before);
});

test('בוט: שדה מלכודת או שליחה מהירה — "הצלחה" בלי שמירה', async () => {
  const before = leads().length;
  assert.equal((await post({ name: 'בוט', phone: '0501111111', website: 'http://spam', elapsed_ms: 9000 })).status, 201);
  assert.equal((await post({ name: 'בוט', phone: '0502222222', elapsed_ms: 300 })).status, 201);
  assert.equal(leads().length, before);
});

test('קלט חסר / לא תקין → 400 עם הודעה לכל שדה; מקור לא מוכר → website', async () => {
  const r = await post({ name: 'א', phone: '123', email: 'not-mail', elapsed_ms: 9000 });
  assert.equal(r.status, 400);
  assert.ok(r.body.errors.name && r.body.errors.phone && r.body.errors.email);
  const ok = await post({ name: 'רותי לוי', phone: '0503333333', source: 'tiktok', service_type: 'xxx', elapsed_ms: 9000 });
  assert.equal(ok.status, 201);
  const l = leads().find((x) => x.phone === '0503333333');
  assert.equal(l.source, 'website');
  assert.equal(l.service_type, null);
});

test('מגבלת קצב: הבקשה השביעית מאותה כתובת בשעה → 429', async () => {
  const r = await post({ name: 'עוד אחד', phone: '0504444444', elapsed_ms: 9000 });
  assert.equal(r.status, 429);
  assert.match(r.body.error, /יותר מדי פניות/);
});
