// בדיקות לפונקציות הטהורות של קישור CRM ↔ Priority (services/priorityLink.js).
// הרצה (מתוך server/): node --test "test/**/*.test.js"   (node:test מובנה — אין jest בפרויקט)
// ב-Node 24 ארגומנט הוא glob — `node --test server/test` (תיקייה) לא מוצא את הקבצים.
// דורש רק את priorityLink — לא את database.js, שמאתחל DB בטעינה ומשאיר את התהליך חי.

const test = require('node:test');
const assert = require('node:assert/strict');
const { normVat, normName, proposeMatches, documentTotals, DOC_TYPES } = require('../src/services/priorityLink');

// ── normVat ──────────────────────────────────────────────────────────────────
test('normVat: ספרות בלבד, בלי אפסים מובילים', () => {
  assert.equal(normVat('051234567'), '51234567');
  assert.equal(normVat('0051234567'), '51234567');
  assert.equal(normVat('51-234567-8'), '512345678');
  assert.equal(normVat(' 51 234 567 8 '), '512345678');
  assert.equal(normVat(512345678), '512345678');
});

test('normVat: ערך קצר / זבל / ריק → מחרוזת ריקה', () => {
  assert.equal(normVat('123'), '');
  assert.equal(normVat('00012'), '');
  assert.equal(normVat('0000000'), '');
  assert.equal(normVat('abc'), '');
  assert.equal(normVat('-'), '');
  assert.equal(normVat(''), '');
  assert.equal(normVat(null), '');
  assert.equal(normVat(undefined), '');
});

// ── normName ─────────────────────────────────────────────────────────────────
test('normName: וריאציות של בע"מ שוות', () => {
  const base = normName('אלפא שמירה');
  assert.equal(base, 'אלפא שמירה');
  for (const v of [
    'אלפא שמירה בע"מ',
    'אלפא שמירה בע״מ',          // גרשיים עבריים
    'אלפא שמירה בע\'\'מ',
    'אלפא שמירה בעמ',
    'אלפא שמירה בע מ',
    'אלפא שמירה (בע"מ)',
    'אלפא שמירה, בע"מ.',
    '  אלפא   שמירה   בע"מ  ',
    'אלפא-שמירה בע"מ',
  ]) {
    assert.equal(normName(v), base, v);
  }
});

test('normName: Ltd / Limited / Inc, אותיות גדולות ופיסוק', () => {
  const base = normName('acme security');
  for (const v of ['Acme Security Ltd', 'ACME SECURITY LTD.', 'Acme Security Limited', 'Acme, Security Inc.', 'Acme  Security']) {
    assert.equal(normName(v), base, v);
  }
});

test('normName: ע"ר ומרכאות בתוך השם', () => {
  assert.equal(normName('עמותת הגנה ע"ר'), normName('עמותת הגנה'));
  assert.equal(normName('ג\'ורג\' שירותים'), normName('גורג שירותים'));
});

test('normName: ריק / רק סיומת → מחרוזת ריקה', () => {
  assert.equal(normName(''), '');
  assert.equal(normName(null), '');
  assert.equal(normName('בע"מ'), '');
});

test('normName: שמות שונים נשארים שונים', () => {
  assert.notEqual(normName('אלפא שמירה'), normName('אלפא אבטחה'));
});

// ── proposeMatches ───────────────────────────────────────────────────────────
const acc = (account_key, account_name, party_vat_id = null) => ({ account_key, account_name, party_vat_id });
const cust = (id, company_name, business_id = null, extra = {}) => ({
  id, company_name, business_id, priority_customer_no: null, priority_matched_by: null, deleted_at: null, ...extra,
});

test('proposeMatches: התאמה לפי ח.פ. גוברת על שם שונה', () => {
  const r = proposeMatches(
    [acc('200100', 'שם אחר לגמרי', '51-234567-8')],
    [cust('c1', 'אלפא שמירה בע"מ', '512345678')],
  );
  assert.equal(r.proposals.length, 1);
  assert.deepEqual(r.proposals[0], {
    priority_customer_no: '200100',
    priority_name: 'שם אחר לגמרי',
    priority_vat_id: '51-234567-8',
    customer_id: 'c1',
    customer_name: 'אלפא שמירה בע"מ',
    business_id: '512345678',
    matched_by: 'vat',
  });
  assert.equal(r.summary.proposals_vat, 1);
  assert.equal(r.summary.proposals_name, 0);
});

test('proposeMatches: אפסים מובילים בח.פ. לא מונעים התאמה', () => {
  const r = proposeMatches([acc('200101', 'X', '051234567')], [cust('c1', 'Y', '51234567')]);
  assert.equal(r.proposals.length, 1);
  assert.equal(r.proposals[0].matched_by, 'vat');
});

test('proposeMatches: בלי ח.פ. (או ח.פ. שלא נמצא) → נפילה לשם', () => {
  const r = proposeMatches(
    [acc('200200', 'בטא אבטחה בע״מ'), acc('200201', 'גמא בע"מ', '599999999')],
    [cust('c2', 'בטא אבטחה'), cust('c3', 'גמא')],
  );
  assert.equal(r.proposals.length, 2);
  const byNo = Object.fromEntries(r.proposals.map((p) => [p.priority_customer_no, p]));
  assert.equal(byNo['200200'].customer_id, 'c2');
  assert.equal(byNo['200200'].matched_by, 'name');
  assert.equal(byNo['200201'].customer_id, 'c3');
  assert.equal(byNo['200201'].matched_by, 'name');
  assert.equal(r.summary.proposals_name, 2);
});

test('proposeMatches: שם זהה אבל ח.פ. תקין ושונה בשני הצדדים → לא הצעה', () => {
  const r = proposeMatches(
    [acc('200202', 'דלתא בע"מ', '599999999')],
    [cust('c4', 'דלתא', '511111111')],
  );
  assert.equal(r.proposals.length, 0);
  assert.equal(r.ambiguous.length, 0);
  assert.equal(r.unmatched.length, 1);
});

test('proposeMatches: account_key מספרי מוחזר כמחרוזת', () => {
  const r = proposeMatches([acc(200300, 'דלתא')], [cust('c4', 'דלתא')]);
  assert.equal(r.proposals[0].priority_customer_no, '200300');
});

test('proposeMatches: לקוח שכבר קושר — ב-linked, לא בהצעות, ולא מועמד לחשבון אחר', () => {
  const linkedCust = cust('c5', 'אפסילון', '512345678', { priority_customer_no: '200400', priority_matched_by: 'vat' });
  const r = proposeMatches(
    [acc('200400', 'אפסילון', '512345678'), acc('200401', 'אפסילון סניף', '512345678')],
    [linkedCust],
  );
  assert.equal(r.proposals.length, 0);
  assert.equal(r.linked.length, 1);
  assert.equal(r.linked[0].priority_customer_no, '200400');
  assert.equal(r.linked[0].customer_id, 'c5');
  assert.equal(r.linked[0].matched_by, 'vat');
  assert.deepEqual(r.unmatched.map((u) => u.priority_customer_no), ['200401']);
  assert.equal(r.summary.linked, 1);
});

test('proposeMatches: קישור עם מספר מספרי בצד ה-CRM מזוהה מול account_key מחרוזת', () => {
  const r = proposeMatches([acc('200410', 'Z')], [cust('c6', 'Z', null, { priority_customer_no: 200410 })]);
  assert.equal(r.linked.length, 1);
  assert.equal(r.orphan_links.length, 0);
});

test('proposeMatches: לקוח שנמחק (soft-delete) לא מוצע ולא נחשב קישור', () => {
  const r = proposeMatches(
    [acc('200500', 'זטא', '512345678'), acc('200501', 'אטא')],
    [
      cust('c7', 'זטא', '512345678', { deleted_at: '2026-01-01T00:00:00Z' }),
      cust('c8', 'אטא', null, { deleted_at: '2026-01-01', priority_customer_no: '209000' }),
    ],
  );
  assert.equal(r.proposals.length, 0);
  assert.equal(r.linked.length, 0);
  assert.equal(r.orphan_links.length, 0);
  assert.equal(r.unmatched.length, 2);
});

test('proposeMatches: חשבון אחד ← כמה לקוחות CRM = ambiguous several_crm_customers', () => {
  const r = proposeMatches(
    [acc('200600', 'תטא', '512345678')],
    [cust('c9', 'תטא צפון', '512345678'), cust('c10', 'תטא דרום', '51-234567-8')],
  );
  assert.equal(r.proposals.length, 0);
  assert.equal(r.ambiguous.length, 1);
  const a = r.ambiguous[0];
  assert.equal(a.reason, 'several_crm_customers');
  assert.equal(a.matched_by, 'vat');
  assert.equal(a.priority_customer_no, '200600');
  assert.deepEqual(a.customers.map((c) => c.customer_id).sort(), ['c10', 'c9']);
});

test('proposeMatches: כמה לקוחות CRM באותו שם = ambiguous several_crm_customers לפי שם', () => {
  const r = proposeMatches([acc('200610', 'יוטא')], [cust('c11', 'יוטא בע"מ'), cust('c12', 'יוטא')]);
  assert.equal(r.ambiguous.length, 1);
  assert.equal(r.ambiguous[0].reason, 'several_crm_customers');
  assert.equal(r.ambiguous[0].matched_by, 'name');
});

test('proposeMatches: שני חשבונות ← אותו לקוח = שניהם ambiguous priority_duplicate', () => {
  const r = proposeMatches(
    [acc('200700', 'קאפא', '512345678'), acc('200701', 'קאפא (כפול)', '512345678')],
    [cust('c13', 'קאפא', '512345678')],
  );
  assert.equal(r.proposals.length, 0);
  assert.equal(r.ambiguous.length, 2);
  for (const a of r.ambiguous) {
    assert.equal(a.reason, 'priority_duplicate');
    assert.deepEqual(a.customers.map((c) => c.customer_id), ['c13']);
  }
  assert.deepEqual(r.ambiguous.map((a) => a.priority_customer_no).sort(), ['200700', '200701']);
  assert.equal(r.summary.ambiguous, 2);
});

test('proposeMatches: קישור למספר שלא קיים ב-p_accounts → orphan_links', () => {
  const r = proposeMatches(
    [acc('200800', 'למדא')],
    [cust('c14', 'מו', null, { priority_customer_no: '209999' })],
  );
  assert.deepEqual(r.orphan_links, [
    { priority_customer_no: '209999', customer_id: 'c14', customer_name: 'מו', business_id: null },
  ]);
  assert.equal(r.summary.orphan_links, 1);
  assert.equal(r.unmatched.length, 1);
});

test('proposeMatches: summary מלא, ו-0 חשבונות נראה כ-accounts_read = 0', () => {
  const empty = proposeMatches([], [cust('c15', 'נו', '512345678')]);
  assert.deepEqual(empty.summary, {
    accounts_read: 0, linked: 0, proposals_vat: 0, proposals_name: 0, ambiguous: 0, unmatched: 0, orphan_links: 0,
  });
  for (const k of ['proposals', 'ambiguous', 'unmatched', 'linked', 'orphan_links']) {
    assert.ok(Array.isArray(empty[k]), k);
  }

  const r = proposeMatches(
    [acc('1', 'A', '511111111'), acc('2', 'B'), acc('3', 'C'), acc('4', 'D')],
    [cust('x1', 'A1', '511111111'), cust('x2', 'B'), cust('x4', 'D', null, { priority_customer_no: '4' })],
  );
  assert.deepEqual(r.summary, {
    accounts_read: 4, linked: 1, proposals_vat: 1, proposals_name: 1, ambiguous: 0, unmatched: 1, orphan_links: 0,
  });
});

// ── documentTotals ───────────────────────────────────────────────────────────
const doc = (doc_type, total_incl_vat, cancelled = false) => ({ doc_type, total_incl_vat, cancelled });

test('documentTotals: מבוטלים לא נסכמים אבל נספרים ב-cancelled', () => {
  const t = documentTotals([doc(305, 1170), doc(305, 500, true), doc(305, 234)]);
  assert.deepEqual(t.by_type[305], { label: DOC_TYPES[305].label, count: 2, cancelled: 1, total_incl_vat: 1404 });
  assert.equal(t.tax_invoices_net, 1404);
});

test('documentTotals: סוג שכל מסמכיו מבוטלים — count 0, סכום 0', () => {
  const t = documentTotals([doc(310, 999, true)]);
  assert.deepEqual(t.by_type[310], { label: DOC_TYPES[310].label, count: 0, cancelled: 1, total_incl_vat: 0 });
  assert.equal(t.tax_invoices_net, 0);
});

test('documentTotals: זיכוי (330) תמיד שלילי — בין אם נשמר חיובי ובין אם שלילי', () => {
  const pos = documentTotals([doc(330, 117)]);
  const neg = documentTotals([doc(330, -117)]);
  assert.equal(pos.by_type[330].total_incl_vat, -117);
  assert.equal(neg.by_type[330].total_incl_vat, -117);
  const both = documentTotals([doc(330, 117), doc(330, -234), doc(330, 50, true)]);
  assert.equal(both.by_type[330].total_incl_vat, -351);
  assert.equal(both.by_type[330].cancelled, 1);
});

test('documentTotals: tax_invoices_net = 305 + 310 + 320 − 330; 300 ו-400 בנפרד', () => {
  const t = documentTotals([
    doc(305, 1170),
    doc(305, 500, true),
    doc(310, 2340),
    doc(320, 585),
    doc(330, 117),
    doc(330, -234),
    doc(300, 1000),
    doc(400, 2000),
    doc(400, 300),
  ]);
  assert.equal(t.tax_invoices_net, 1170 + 2340 + 585 - 117 - 234);
  assert.equal(t.deal_invoices, 1000);
  assert.equal(t.receipts, 2300);
  assert.equal(t.by_type[300].label, DOC_TYPES[300].label);
  assert.equal(t.by_type[400].count, 2);
});

test('documentTotals: doc_type וסכום כמחרוזת, עיגול לאגורות, סוג לא מוכר', () => {
  const t = documentTotals([
    { doc_type: '305', total_incl_vat: '0.1', cancelled: false },
    { doc_type: '305', total_incl_vat: '0.2', cancelled: false },
    { doc_type: 999, total_incl_vat: 5, cancelled: false },
    { doc_type: 320, total_incl_vat: null, cancelled: false },
  ]);
  assert.equal(t.by_type[305].total_incl_vat, 0.3);
  assert.equal(t.by_type[305].count, 2);
  assert.equal(t.by_type[999].label, '999');
  assert.equal(t.by_type[320].total_incl_vat, 0);
  assert.equal(t.tax_invoices_net, 0.3);       // 999 לא נכנס לנטו
});

test('documentTotals: רשימה ריקה', () => {
  assert.deepEqual(documentTotals([]), { by_type: {}, tax_invoices_net: 0, deal_invoices: 0, receipts: 0 });
});
