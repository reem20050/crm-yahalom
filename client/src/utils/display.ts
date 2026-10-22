/**
 * עזרי תצוגה קטנים לכרטיסים ולרשימות.
 *
 * הרבה רשומות נוצרו מייבוא, ולכן אותו שם מופיע בכמה שדות (שם האירוע = שם הלקוח = המיקום; שם הקבלן = איש הקשר),
 * וטלפון חסר נשמר כ-"0000000000". בתצוגה זה יוצא שורה שחוזרת שלוש פעמים ומספר שנראה אמיתי.
 */

const norm = (s: unknown) =>
  String(s ?? '').replace(/[\s,.\-–—"'״׳()]+/g, ' ').trim().toLowerCase();

/** הערך — רק אם הוא לא ריק ולא חוזר על אחד הטקסטים שכבר מוצגים. */
export function distinct(value: string | null | undefined, ...shown: (string | null | undefined)[]): string | null {
  const v = norm(value);
  if (!v) return null;
  return shown.some((s) => norm(s) === v) ? null : (value as string);
}

/** טלפון אמיתי, או null כשהשדה ריק / ממלא-מקום ("0000000000") / קצר מדי. */
export function realPhone(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 9 || /^0+$/.test(digits)) return null;
  return phone as string;
}

/** "2026-09-06" → "יום א' 06/09/2026" (בלי המרת אזור זמן). */
export function fmtDayDate(d: string | null | undefined): string {
  if (!d) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('he-IL', { weekday: 'short' });
  return `${day} ${m[3]}/${m[2]}/${m[1]}`;
}

/** הערות שנכתבו אוטומטית (סנכרון ממערכת הסריקה) כוללות True/False — בתצוגה: כן/לא. */
export function humanizeNotes(notes: string | null | undefined): string {
  return String(notes ?? '').replace(/\bTrue\b/g, 'כן').replace(/\bFalse\b/g, 'לא');
}

/** "2026-06-05" → "05/06/2026" (בלי המרת אזור זמן). */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}
