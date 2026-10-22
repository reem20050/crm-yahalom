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
