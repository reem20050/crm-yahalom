/**
 * טופס פנייה ציבורי (/join) — בלי התחברות. הקישור לשים באתר, בפרסום ובוואטסאפ:
 *   https://crm-yahalom.onrender.com/join?utm_source=facebook&utm_campaign=<שם>
 * הפנייה נכנסת למאגר הלידים ב-CRM, ומנהלים מקבלים התראה.
 *
 * הגנות (השרת אוכף; כאן רק שולחים את הנתונים): שדה מלכודת מוסתר (website) וזמן מילוי (elapsed_ms).
 */
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Shield } from 'lucide-react';

// אותם ערכים כמו בטופס הלידים ב-CRM
const SERVICES: [string, string][] = [
  ['event', 'אבטחת אירוע'],
  ['regular', 'שמירה קבועה באתר / מוסד'],
  ['patrol', 'סיור ומוקד'],
  ['armed', 'מאבטח חמוש'],
  ['other', 'אחר'],
];

export default function LeadForm() {
  const [params] = useSearchParams();
  const startedAt = useRef(Date.now());
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: '', phone: '', company_name: '', email: '', service_type: '', location: '', message: '', website: '',
  });
  const utm = useMemo(() => ({
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    source: params.get('source') || undefined,
  }), [params]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (form.name.trim().length < 2) local.name = 'נא למלא שם';
    if (form.phone.replace(/\D/g, '').length < 9) local.phone = 'נא למלא מספר טלפון';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSending(true);
    try {
      // בלי מופע ה-api של המערכת: אין כאן התחברות, ו-401 לא אמור להעביר לדף כניסה
      await axios.post('/api/public/leads', { ...form, ...utm, elapsed_ms: Date.now() - startedAt.current });
      setDone(true);
    } catch (err) {
      const r = (err as { response?: { status?: number; data?: { errors?: Record<string, string>; error?: string } } }).response;
      if (r?.data?.errors) setErrors(r.data.errors);
      else setErrors({ form: r?.data?.error || 'השליחה לא הצליחה. נסו שוב בעוד רגע.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-start sm:items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center shadow">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 font-heading">צוות יהלום</p>
            <p className="text-sm text-gray-500">פתרונות אבטחה</p>
          </div>
        </div>

        {done ? (
          <div className="card text-center py-10">
            <CheckCircle2 className="w-12 h-12 text-success-600 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-gray-900">תודה, קיבלנו!</h1>
            <p className="text-gray-600 mt-2">נחזור אליכם בהקדם.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4" noValidate>
            <div>
              <h1 className="text-xl font-bold text-gray-900">השאירו פרטים ונחזור אליכם</h1>
              <p className="text-sm text-gray-500 mt-1">אבטחת אירועים, שמירה קבועה, סיור ומאבטחים חמושים.</p>
            </div>

            <div>
              <label className="label" htmlFor="name">שם מלא *</label>
              <input id="name" className="input" value={form.name} onChange={set('name')} autoComplete="name" />
              {errors.name && <p className="text-sm text-danger-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="label" htmlFor="phone">טלפון *</label>
              <input id="phone" className="input" dir="ltr" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" />
              {errors.phone && <p className="text-sm text-danger-600 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="label" htmlFor="company">חברה / ארגון</label>
              <input id="company" className="input" value={form.company_name} onChange={set('company_name')} autoComplete="organization" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="service">מה צריך?</label>
                <select id="service" className="input" value={form.service_type} onChange={set('service_type')}>
                  <option value="">בחרו…</option>
                  {SERVICES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="location">עיר / מקום</label>
                <input id="location" className="input" value={form.location} onChange={set('location')} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="email">אימייל</label>
              <input id="email" className="input" dir="ltr" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
              {errors.email && <p className="text-sm text-danger-600 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="label" htmlFor="message">פרטים (תאריך, מספר משתתפים, שעות…)</label>
              <textarea id="message" className="input min-h-[90px]" value={form.message} onChange={set('message')} maxLength={1000} />
            </div>

            {/* מלכודת לבוטים — מוסתרת מאדם, לא בסדר הטאב */}
            <div aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>
              <label htmlFor="website">אתר</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
            </div>

            {errors.form && <p className="text-sm text-danger-700 bg-danger-50 rounded-lg p-3">{errors.form}</p>}
            <button type="submit" disabled={sending} className="btn-primary w-full py-3 text-base">
              {sending ? 'שולח…' : 'שלחו'}
            </button>
            <p className="text-xs text-gray-400 text-center">הפרטים משמשים רק כדי לחזור אליכם.</p>
          </form>
        )}
      </div>
    </div>
  );
}
