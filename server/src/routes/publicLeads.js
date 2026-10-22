/**
 * קליטת לידים ציבורית — טופס באתר / בפרסום (/join) → מאגר הלידים ב-CRM.
 *
 * בלי התחברות, ולכן כל שדה נבדק כאן ולא סומכים על הדפדפן:
 *  - מגבלת קצב לכל IP (5 בשעה), מעבר למגבלה הכללית של /api.
 *  - שדה מלכודת (website) שאדם לא רואה ובוט ממלא, וזמן מילוי מינימלי — בשניהם עונים "תודה" ולא שומרים כלום,
 *    כדי שבוט לא ילמד מה נחסם.
 *  - אותו טלפון בתוך 24 שעות לא יוצר ליד כפול.
 * ליד חדש: סטטוס "חדש", התראה לכל מנהל בפעמון, רישום ביומן הפעולות.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PUBLIC_LEADS_PER_HOUR) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'יותר מדי פניות מהכתובת הזו. נסו שוב בעוד שעה, או התקשרו אלינו.' },
});

const SOURCES = new Set(['website', 'facebook', 'instagram', 'google', 'whatsapp', 'referral', 'other']);
// אותם ערכים כמו בטופס הלידים ב-CRM (regular / event / both) + סיור / חמוש / אחר
const SERVICES = new Set(['event', 'regular', 'both', 'patrol', 'armed', 'other']);
const MIN_FILL_MS = 2000;
const DEDUPE_MS = 24 * 60 * 60 * 1000;

const str = (v, max) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/** טלפון ישראלי → 0XXXXXXXXX, או null. מקבל +972 / 972 / רווחים ומקפים. */
function normalizePhone(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('972')) d = `0${d.slice(3)}`;
  return /^0\d{8,9}$/.test(d) ? d : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', limiter, async (req, res) => {
  try {
    const b = req.body || {};

    // בוט: מילא את שדה המלכודת, או שלח מהר מדי. עונים כמו להצלחה ולא שומרים.
    const elapsed = Number(b.elapsed_ms);
    if (str(b.website, 200) || (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)) {
      return res.status(201).json({ ok: true });
    }

    const name = str(b.name, 80);
    const phone = normalizePhone(b.phone);
    const email = str(b.email, 120);
    const errors = {};
    if (!name || name.length < 2) errors.name = 'נא למלא שם';
    if (!phone) errors.phone = 'נא למלא מספר טלפון תקין';
    if (email && !EMAIL_RE.test(email)) errors.email = 'כתובת אימייל לא תקינה';
    if (Object.keys(errors).length) return res.status(400).json({ errors });

    const utm = {
      source: str(b.utm_source, 60),
      medium: str(b.utm_medium, 60),
      campaign: str(b.utm_campaign, 80),
    };
    const requested = String(b.source ?? utm.source ?? '').toLowerCase();
    const source = SOURCES.has(requested) ? requested : 'website';
    const service = SERVICES.has(String(b.service_type)) ? String(b.service_type) : null;
    const message = str(b.message, 1000);
    const utmLine = [utm.source && `מקור: ${utm.source}`, utm.medium && `ערוץ: ${utm.medium}`, utm.campaign && `קמפיין: ${utm.campaign}`]
      .filter(Boolean).join(' · ');
    const description = [message, utmLine && `— ${utmLine}`, '(התקבל מטופס באתר)'].filter(Boolean).join('\n\n');

    // אותו טלפון ב-24 השעות האחרונות — כבר יש ליד; לא יוצרים כפילות
    const since = new Date(Date.now() - DEDUPE_MS).toISOString().replace('T', ' ').slice(0, 19);
    const dup = await db.query('SELECT id FROM leads WHERE phone = $1 AND created_at >= $2 LIMIT 1', [phone, since]);
    if (dup.rows.length) return res.status(201).json({ ok: true });

    const id = db.generateUUID();
    const created = await db.query(`
      INSERT INTO leads (id, company_name, contact_name, phone, email, source, service_type, location, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new')
      RETURNING *
    `, [id, str(b.company_name, 120), name, phone, email, source, service, str(b.location, 120), description]);
    const lead = created.rows[0];

    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes, description)
      VALUES ($1, NULL, 'lead', $2, 'create', $3, $4)
    `, [db.generateUUID(), id, JSON.stringify({ source, utm }), 'ליד מטופס באתר']);

    // התראה בפעמון לכל מנהל. כשל כאן לא מפיל את הקליטה — הליד כבר נשמר.
    try {
      const managers = (await db.query("SELECT id FROM users WHERE role IN ('admin', 'manager')")).rows;
      for (const m of managers) {
        await db.query(`
          INSERT INTO notifications (id, user_id, type, title, message, related_entity_type, related_entity_id)
          VALUES ($1, $2, 'lead_new', $3, $4, 'lead', $5)
        `, [db.generateUUID(), m.id, `ליד חדש: ${name}`, [phone, str(b.company_name, 120)].filter(Boolean).join(' · '), id]);
      }
    } catch (e) {
      console.error('public lead: notification failed', e.message);
    }

    try {
      // eslint-disable-next-line global-require
      require('../utils/whatsappHelper').notifyNewLead(lead).catch(() => {});
    } catch (e) { /* וואטסאפ לא מוגדר */ }

    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Public lead error:', error);
    res.status(500).json({ error: 'שגיאה בשליחת הפרטים. נסו שוב או התקשרו אלינו.' });
  }
});

module.exports = router;
module.exports.normalizePhone = normalizePhone;
