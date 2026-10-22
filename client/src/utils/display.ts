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
  return String(notes ?? '')
    .replace(/\bTrue\b/g, 'כן').replace(/\bFalse\b/g, 'לא')
    // הערת הייבוא של הלקוחות (239 לקוחות): "Imported from Green Invoice archive; documents=0"
    .replace(/Imported from Green Invoice archive/g, 'יובא מארכיון חשבונית ירוקה')
    .replace(/\bdocuments=(\d+)/g, 'מסמכים: $1');
}

/** "2026-06-05" → "05/06/2026" (בלי המרת אזור זמן). */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

/** תאריך מקומי "YYYY-MM-DD". לא toISOString — הוא לפי UTC, ובין חצות ל-03:00 (שעון ישראל) נותן את התאריך של אתמול. */
export function localIsoDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** תאריך מחותמת זמן (created_at וכד') בשעון מקומי, "22/10/2026" — כמו fmtDate (toLocaleDateString נותן 22.10.2026). */
export function fmtStamp(v: string | number | Date | null | undefined): string {
  if (v == null || v === '') return '—';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return typeof v === 'string' ? fmtDate(v) : '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "22/10/2026 15:29" — תאריך ושעה מקומיים. */
export function fmtStampTime(v: string | number | Date | null | undefined): string {
  if (v == null || v === '') return '—';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fmtStamp(d)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** תנאי תשלום: הקודים שבנתונים (כולל הייבוא מחשבונית ירוקה — eom, eom10…) עם תווית בעברית. */
export const PAYMENT_TERMS: { value: string; label: string }[] = [
  { value: 'immediate', label: 'מיידי' },
  { value: 'eom', label: 'שוטף' },
  { value: 'eom10', label: 'שוטף + 10' },
  { value: 'eom15', label: 'שוטף + 15' },
  { value: 'net30', label: 'שוטף + 30' },
  { value: 'net45', label: 'שוטף + 45' },
  { value: 'net60', label: 'שוטף + 60' },
  { value: 'net90', label: 'שוטף + 90' },
];

export function paymentTermsLabel(v: string | null | undefined): string {
  if (!v) return '-';
  const known = PAYMENT_TERMS.find((o) => o.value === v);
  if (known) return known.label;
  const m = /^(?:net|eom)(\d+)$/.exec(v);
  return m ? `שוטף + ${m[1]}` : v;
}
