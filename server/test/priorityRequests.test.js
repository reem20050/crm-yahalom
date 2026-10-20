// בקשות הפקה ל-Priority — אימות טהור (services/priorityRequests.js).
// הרצה (מתוך server/): node --test "test/**/*.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, netTotal, requestKey, SKUS } = require('../src/services/priorityRequests');

const TODAY = new Date('2026-10-20T09:00:00Z');
const LINE = { part: '3', qty: '2', price: '850', description: 'אבטחה אירוע 10/26' };

test('חשבונית מס: שורות מאומתות ומנורמלות, בלי לקוח ובלי חברה מהדפדפן', () => {
  const r = validateRequest({ kind: 'invoice', lines: [LINE], details: 'אירוע 10/26', customer: '999', company: 'x' }, TODAY);
  assert.deepEqual(r, {
    kind: 'invoice',
    payload: { details: 'אירוע 10/26', lines: [{ part: '3', qty: 2, price: 850, description: 'אבטחה אירוע 10/26' }] },
  });
  assert.equal(netTotal(r.payload), 1700);
});

test('חיוב חוזר: רק תאריך אופציונלי', () => {
  assert.deepEqual(validateRequest({ kind: 'rebill', date: '2026-10-31', lines: [LINE] }, TODAY),
    { kind: 'rebill', payload: { date: '2026-10-31' } });
});

for (const [name, body, msg] of [
  ['סוג אסור (ביטול)', { kind: 'cancel' }, /סוג מסמך/],
  ['מק"ט לא ברשימה', { kind: 'invoice', lines: [{ ...LINE, part: '999' }] }, /מק"ט/],
  ['כמות 0', { kind: 'invoice', lines: [{ ...LINE, qty: 0 }] }, /כמות/],
  ['מחיר שלילי', { kind: 'invoice', lines: [{ ...LINE, price: -1 }] }, /מחיר/],
  ['בלי שורות', { kind: 'invoice', lines: [] }, /שורות/],
  ['21 שורות', { kind: 'invoice', lines: Array(21).fill(LINE) }, /שורות/],
  ['תאריך רחוק', { kind: 'invoice', date: '2027-03-01', lines: [LINE] }, /רחוק/],
  ['תאריך לא תקין', { kind: 'invoice', date: '20/10/2026', lines: [LINE] }, /תאריך/],
  ['פרטים ארוכים', { kind: 'invoice', details: 'א'.repeat(41), lines: [LINE] }, /פרטים/],
]) {
  test(`נדחה: ${name}`, () => {
    assert.throws(() => validateRequest(body, TODAY), (e) => e.status === 400 && msg.test(e.message));
  });
}

test('מפתח כפילות: אותו תוכן = אותו מפתח; שינוי מחיר = מפתח אחר', () => {
  const a = validateRequest({ kind: 'invoice', lines: [LINE] }, TODAY).payload;
  const b = validateRequest({ kind: 'invoice', lines: [{ ...LINE, price: '851' }] }, TODAY).payload;
  assert.equal(requestKey('200122', 'invoice', a), requestKey('200122', 'invoice', { ...a }));
  assert.notEqual(requestKey('200122', 'invoice', a), requestKey('200122', 'invoice', b));
});

test('רשימת המק"טים זהה לזו של העובד ב-VPS', () => {
  assert.deepEqual(SKUS, ['3', '000', '1', '2', '6']);
});
