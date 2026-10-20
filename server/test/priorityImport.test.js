// בדיקות לייבוא המבוקר של חשבונות Priority בלי לקוח ב-CRM (services/priorityLink.js).
// הרצה (מתוך server/): node --test "test/**/*.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  documentStats, findExisting, importDecision, runImport, buildImportQueue, proposeMatches,
} = require('../src/services/priorityLink');

const acc = (account_key, account_name, party_vat_id = null, city = null) => ({ account_key, account_name, party_vat_id, city });
const cust = (id, company_name, business_id = null, extra = {}) => ({
  id, company_name, business_id, priority_customer_no: null, priority_matched_by: null, deleted_at: null, ...extra,
});
const doc = (party_key, doc_type, total_incl_vat, issue_date, cancelled = false) => ({
  party_key, doc_type, total_incl_vat, issue_date, cancelled,
});
const byNo = (accounts) => new Map(accounts.map((a) => [String(a.account_key), a]));

// ── documentStats ────────────────────────────────────────────────────────────
test('documentStats: ספירה, נטו חשבוניות מס, קבלות בנפרד, תאריך אחרון בלי מבוטלים', () => {
  const s = documentStats([
    doc('200300', 305, 1170, '2026-07-10'),
    doc('200300', 400, 1170, '2026-07-20'),
    doc('200300', 330, 117, '2026-07-15'),
    doc('200300', 305, 500, '2026-08-01', true),   // מבוטל — לא נספר ולא קובע תאריך
    doc(200301, 320, 585, '2026-06-01'),           // party_key מספרי
  ]);
  assert.deepEqual(s.get('200300'), {
    doc_count: 3, cancelled_count: 1, tax_invoices_net: 1053, receipts: 1170, last_doc_date: '2026-07-20',
  });
  assert.equal(s.get('200301').doc_count, 1);
  assert.equal(s.get('200301').tax_invoices_net, 585);
  assert.equal(s.has('999'), false);
});

test('documentStats: כל המסמכים מבוטלים → 0 מסמכים, בלי תאריך', () => {
  const s = documentStats([doc('1', 305, 10, '2026-01-01', true)]);
  assert.deepEqual(s.get('1'), { doc_count: 0, cancelled_count: 1, tax_invoices_net: 0, receipts: 0, last_doc_date: null });
});

// ── findExisting ─────────────────────────────────────────────────────────────
test('findExisting: ח.פ. זהה (אחרי נרמול) — גם מול לקוח שכבר מקושר', () => {
  const r = findExisting(acc('200029', 'שם אחר', '051-234567-8'),
    [cust('c1', 'פארק המים', '512345678', { priority_customer_no: 200145 })]);
  assert.deepEqual(r, { reason: 'vat_exists', customer_id: 'c1', customer_name: 'פארק המים', customer_priority_no: '200145' });
});

test('findExisting: שם זהה כשלאחד הצדדים אין ח.פ.; שני ח.פ. שונים — לא', () => {
  assert.equal(findExisting(acc('1', 'גמא בע"מ'), [cust('c2', 'גמא', '511111111')]).reason, 'name_exists');
  assert.equal(findExisting(acc('1', 'גמא בע"מ', '599999999'), [cust('c2', 'גמא')]).reason, 'name_exists');
  assert.equal(findExisting(acc('1', 'גמא בע"מ', '599999999'), [cust('c2', 'גמא', '511111111')]), null);
  assert.equal(findExisting(acc('1', 'דלתא'), [cust('c2', 'גמא')]), null);
});

// ── importDecision ───────────────────────────────────────────────────────────
test('importDecision: יוצר עם שם, ח.פ. ועיר מהמראה (מנוקים)', () => {
  const d = importDecision('200300', byNo([acc('200300', '  בטא אבטחה ', ' 51-333333-3 ', ' חיפה ')]), []);
  assert.deepEqual(d, {
    action: 'create',
    row: { priority_customer_no: '200300', company_name: 'בטא אבטחה', business_id: '51-333333-3', city: 'חיפה' },
  });
});

test('importDecision: ח.פ. זבל לא נשמר ולא חוסם; עיר ריקה → null', () => {
  const d = importDecision('200400', byNo([acc('200400', 'גמא', '000', '')]), [cust('c9', 'אחר', '000')]);
  assert.equal(d.action, 'create');
  assert.equal(d.row.business_id, null);
  assert.equal(d.row.city, null);
});

test('importDecision: מספר מקושר (גם ללקוח מחוק), לא במראה, בלי שם, לא תקין', () => {
  const accounts = byNo([acc('200145', 'פארק'), acc('200900', 'דלתא'), acc('200800', '  ')]);
  const customers = [
    cust('c1', 'פארק המים', null, { priority_customer_no: '200145' }),
    cust('c3', 'דלתא ישן', null, { priority_customer_no: 200900, deleted_at: '2026-01-01' }),
  ];
  assert.deepEqual(importDecision('200145', accounts, customers),
    { action: 'skip', reason: 'already_linked', customer_id: 'c1', customer_name: 'פארק המים' });
  assert.equal(importDecision('200900', accounts, customers).reason, 'linked_to_deleted');
  assert.deepEqual(importDecision('999999', accounts, customers), { action: 'skip', reason: 'not_in_mirror' });
  assert.deepEqual(importDecision('200800', accounts, customers), { action: 'skip', reason: 'missing_name' });
  assert.deepEqual(importDecision('20x', accounts, customers), { action: 'skip', reason: 'invalid_no' });
  assert.deepEqual(importDecision('', accounts, customers), { action: 'skip', reason: 'invalid_no' });
});

test('importDecision: לקוח מחוק עם אותו ח.פ. לא חוסם; לקוח פעיל — conflict', () => {
  const accounts = byNo([acc('200300', 'בטא', '513333333')]);
  assert.equal(importDecision('200300', accounts, [cust('c8', 'בטא', '513333333', { deleted_at: '2026-01-01' })]).action, 'create');
  const d = importDecision('200300', accounts, [cust('c8', 'בטא בע"מ', '513333333')]);
  assert.equal(d.action, 'conflict');
  assert.equal(d.reason, 'vat_exists');
  assert.equal(d.customer_id, 'c8');
});

// ── runImport ────────────────────────────────────────────────────────────────
test('runImport: יוצר רק את מה שנבחר; שני חשבונות עם אותו ח.פ. → לקוח אחד ו-conflict', async () => {
  const accounts = [
    acc('200300', 'בטא אבטחה', '513333333', 'חיפה'),
    acc('200301', 'בטא אבטחה סניף', '51-333333-3'),
    acc('200400', 'גמא'),
    acc('200600', 'לא נבחר'),
  ];
  const calls = [];
  const r = await runImport(['200300', '200301', '200400'], accounts, [], async (row) => {
    calls.push(row);
    return { id: `new-${row.priority_customer_no}`, company_name: row.company_name, business_id: row.business_id };
  });
  assert.deepEqual(calls.map((c) => c.priority_customer_no), ['200300', '200400']);
  assert.deepEqual(r.created, [
    { priority_customer_no: '200300', customer_id: 'new-200300', customer_name: 'בטא אבטחה' },
    { priority_customer_no: '200400', customer_id: 'new-200400', customer_name: 'גמא' },
  ]);
  assert.deepEqual(r.conflicts, [{
    priority_customer_no: '200301', reason: 'vat_exists',
    customer_id: 'new-200300', customer_name: 'בטא אבטחה', customer_priority_no: '200300',
  }]);
  assert.deepEqual(r.summary, { requested: 3, created: 2, conflicts: 1, skipped: 0, failed: 0 });
});

test('runImport: create שמחזיר null (נתפס בינתיים) → skipped; זריקה → failed, והשאר ממשיכים', async () => {
  const accounts = [acc('1', 'א'), acc('2', 'ב'), acc('3', 'ג')];
  const r = await runImport(['1', '2', '3'], accounts, [], async (row) => {
    if (row.priority_customer_no === '1') return null;
    if (row.priority_customer_no === '2') throw new Error('db down');
    return { id: 'x3', company_name: row.company_name };
  });
  assert.deepEqual(r.skipped, [{ priority_customer_no: '1', reason: 'already_linked' }]);
  assert.deepEqual(r.failed, [{ priority_customer_no: '2', error: 'db down' }]);
  assert.deepEqual(r.created.map((c) => c.priority_customer_no), ['3']);
});

test('runImport: לא משנה את מערך הלקוחות שהתקבל', async () => {
  const customers = [cust('c1', 'קיים', '512345678')];
  await runImport(['1'], [acc('1', 'חדש')], customers, async (row) => ({ id: 'n1', company_name: row.company_name }));
  assert.equal(customers.length, 1);
});

// ── buildImportQueue ─────────────────────────────────────────────────────────
test('buildImportQueue: עיר, סטטיסטיקה, blocked, כפילויות ב-Priority, ומיון לפי פעילות', () => {
  const accounts = [
    acc('200145', 'פארק המים בע"מ', '512345678'),
    acc('200029', 'פארק המים', '512345678', 'אשדוד'),
    acc('200300', 'בטא אבטחה', '513333333', 'חיפה'),
    acc('200400', 'גמא'),
    acc('200700', 'יוטא'),
  ];
  const customers = [
    cust('c1', 'פארק המים', '512345678', { priority_customer_no: '200145' }),
    cust('c5', 'יוטא'), cust('c6', 'יוטא בע"מ'),
  ];
  const docs = [
    doc('200029', 305, 100, '2026-05-01'),
    doc('200300', 305, 1170, '2026-07-20'),
    doc('200700', 320, 585, '2026-06-01'),
  ];
  const q = buildImportQueue(proposeMatches(accounts, customers), accounts, customers, docs);

  assert.deepEqual(q.unmatched.map((u) => u.priority_customer_no), ['200300', '200029', '200400']);
  const [beta, park, gamma] = q.unmatched;
  assert.equal(beta.city, 'חיפה');
  assert.equal(beta.doc_count, 1);
  assert.equal(beta.tax_invoices_net, 1170);
  assert.equal(beta.blocked, null);
  assert.deepEqual(beta.priority_duplicates, []);
  assert.deepEqual(park.blocked, {
    reason: 'vat_exists', customer_id: 'c1', customer_name: 'פארק המים', customer_priority_no: '200145',
  });
  assert.deepEqual(park.priority_duplicates, ['200145']);
  assert.equal(gamma.doc_count, 0);
  assert.equal(gamma.last_doc_date, null);
  assert.equal(q.summary.importable, 2);
  assert.equal(q.summary.unmatched, 3);

  assert.equal(q.ambiguous.length, 1);
  assert.equal(q.ambiguous[0].priority_customer_no, '200700');
  assert.equal(q.ambiguous[0].doc_count, 1);
  assert.deepEqual(q.ambiguous[0].customers.map((c) => c.customer_id).sort(), ['c5', 'c6']);
});

// ── אחרי הייבוא הראשון (20/10): ח.פ. דמה, כפילויות ב-Priority, כרטיסים שכבר נוצרו ──────────
const { normVat } = require('../src/services/priorityLink');

test('normVat: ח.פ. דמה (999999998 / 999999999) אינו מזהה', () => {
  assert.equal(normVat('999999998'), '');
  assert.equal(normVat('999-999-998'), '');
  assert.equal(normVat('999999999'), '');
  assert.equal(normVat('999999997'), '999999997');
});

test('ח.פ. דמה: לא מתאים חשבונות זה לזה, נשמר כריק, ולא חוסם', () => {
  const accounts = [acc('200050', 'אלפא', '999999998'), acc('200051', 'בטא', '999999998')];
  const customers = [cust('c1', 'אלפא', null, { priority_customer_no: '200050' })];
  const r = proposeMatches(accounts, [cust('c2', 'גמא', '999999998')]);
  assert.equal(r.proposals.length, 0, 'אין התאמה לפי ח.פ. דמה');
  const d = importDecision('200051', byNo(accounts), customers);
  assert.equal(d.action, 'create', 'חשבון אחר עם אותו ח.פ. דמה אינו כפילות');
  assert.equal(d.row.business_id, null);
  const q = buildImportQueue(proposeMatches(accounts, customers), accounts, customers, []);
  assert.deepEqual(q.unmatched.find((u) => u.priority_customer_no === '200051').priority_duplicates, []);
});

test('כפיל ב-Priority של חשבון מקושר — חסום גם כשבכרטיס ה-CRM אין ח.פ.', () => {
  const accounts = [acc('200145', 'פארק המים בע"מ', '512345678'), acc('200029', 'פארק המים אשדוד', '51-234567-8')];
  const customers = [cust('c1', 'פארק המים', null, { priority_customer_no: '200145' })];
  assert.equal(findExisting(accounts[1], customers), null, 'הח.פ. לא בכרטיס והשם שונה');
  assert.deepEqual(importDecision('200029', byNo(accounts), customers), {
    action: 'conflict', reason: 'priority_duplicate',
    customer_id: 'c1', customer_name: 'פארק המים', customer_priority_no: '200145',
  });
  // לקוח מקושר שנמחק לא חוסם
  const deleted = [cust('c1', 'פארק המים', null, { priority_customer_no: '200145', deleted_at: '2026-01-01' })];
  assert.equal(importDecision('200029', byNo(accounts), deleted).action, 'create');
});

test('כרטיסים שכבר נוצרו מ-Priority: המספר מדולג, וכפיל עם אותו ח.פ. — conflict', async () => {
  const accounts = [acc('200201', 'לקוח שיובא', '513000001'), acc('200202', 'לקוח שיובא - סניף', '513000001'), acc('200203', 'חדש')];
  const customers = [cust('imp1', 'לקוח שיובא', '513000001', {
    priority_customer_no: '200201', priority_matched_by: 'manual', notes: 'נוצר מ-Priority (לקוח 200201) 20/10/2026',
  })];
  const created = [];
  const r = await runImport(['200201', '200202', '200203'], accounts, customers, async (row) => {
    created.push(row.priority_customer_no);
    return { id: 'n', company_name: row.company_name };
  });
  assert.deepEqual(created, ['200203']);
  assert.deepEqual(r.skipped.map((s) => [s.priority_customer_no, s.reason]), [['200201', 'already_linked']]);
  assert.deepEqual(r.conflicts.map((c) => [c.priority_customer_no, c.reason, c.customer_id]), [['200202', 'vat_exists', 'imp1']]);
});
