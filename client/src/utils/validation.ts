/**
 * שגיאות אימות מהשרת (express-validator) חוזרות כ-{ errors: [{ path, msg }] } בלי error — ולכן המסכים מציגים רק
 * "שגיאה ביצירת…" בלי לומר מה לתקן. כאן הן הופכות ל-error בעברית שאומר איזה שדה; המסכים כבר מציגים את data.error.
 */

const FIELD_LABELS: Record<string, string> = {
  employee_id: 'עובד', customer_id: 'לקוח', contractor_id: 'קבלן', status: 'סטטוס',
  first_name: 'שם פרטי', last_name: 'שם משפחה', name: 'שם', company_name: 'שם חברה', contact_name: 'איש קשר',
  phone: 'טלפון', email: 'אימייל', password: 'סיסמה', id_number: 'תעודת זהות',
  date: 'תאריך', start_date: 'תאריך התחלה', end_date: 'תאריך סיום', start_time: 'שעת התחלה', end_time: 'שעת סיום',
  hire_date: 'תאריך קליטה', issue_date: 'תאריך הנפקה', due_date: 'תאריך יעד', days_of_week: 'ימים בשבוע',
  event_name: 'שם האירוע', event_date: 'תאריך האירוע', required_guards: 'מספר מאבטחים', location: 'מיקום',
  title: 'כותרת', severity: 'חומרה', incident_type: 'סוג אירוע', incident_date: 'תאריך האירוע', rating: 'דירוג',
  weapon_type: 'סוג נשק', serial_number: 'מספר סידורי', manufacturer: 'יצרן', model: 'דגם',
  license_number: 'מספר רישיון', license_expiry: 'תוקף רישיון', item_type: 'סוג פריט', item_name: 'שם פריט',
  document_type: 'סוג מסמך',
};

const HEBREW = /[֐-׿]/;

type ValidationBody = {
  error?: string;
  message?: string;
  errors?: { path?: string; param?: string; msg?: string }[];
};

/** ממלא data.error (ו-data.message אם חסר) מתוך errors[]. לא נוגע כשיש כבר error. */
export function explainValidation(data: unknown): void {
  const d = data as ValidationBody | undefined;
  if (!d || typeof d !== 'object' || d.error || !Array.isArray(d.errors) || !d.errors.length) return;
  const parts = d.errors.map((e) => {
    if (e.msg && HEBREW.test(e.msg)) return e.msg;
    const field = e.path ?? e.param ?? '';
    return `השדה "${FIELD_LABELS[field] ?? field}" לא תקין`;
  });
  d.error = [...new Set(parts)].join(' · ');
  d.message ??= d.error;
}
