/**
 * Scheduler Service - Automated tasks using node-cron
 * Handles shift reminders, overdue invoice alerts, document expiry warnings
 */
const cron = require('node-cron');
const { query } = require('../config/database');
const whatsappHelper = require('../utils/whatsappHelper');
const googleHelper = require('../utils/googleHelper');

class Scheduler {
  constructor() {
    this.jobs = [];
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    console.log('Starting scheduled tasks...');

    // Every day at 07:00 - Send shift reminders for today
    this.addJob('0 7 * * *', 'daily-shift-reminders', async () => {
      await this.sendTodayShiftReminders();
    });

    // Every day at 20:00 - Send tomorrow shift reminders
    this.addJob('0 20 * * *', 'tomorrow-shift-reminders', async () => {
      await this.sendTomorrowShiftReminders();
    });

    // Every day at 09:00 - Check overdue invoices
    this.addJob('0 9 * * *', 'overdue-invoice-check', async () => {
      await this.checkOverdueInvoices();
    });

    // Every Monday at 08:00 - Weekly summary
    this.addJob('0 8 * * 1', 'weekly-summary', async () => {
      await this.sendWeeklySummary();
    });

    // Every day at 08:00 - Check expiring documents
    this.addJob('0 8 * * *', 'document-expiry-check', async () => {
      await this.checkExpiringDocuments();
    });

    // Every day at 08:30 - Check expiring contracts
    this.addJob('30 8 * * *', 'contract-expiry-check', async () => {
      await this.checkExpiringContracts();
    });

    // Every day at 10:00 - Check unassigned upcoming events
    this.addJob('0 10 * * *', 'unassigned-events-check', async () => {
      await this.checkUnassignedEvents();
    });

    // Every day at 07:30 - Check expiring guard certifications
    this.addJob('30 7 * * *', 'certification-expiry-check', async () => {
      await this.checkExpiringCertifications();
    });

    // Every day at 11:00 - Check unresolved incidents (48+ hours)
    this.addJob('0 11 * * *', 'unresolved-incidents-check', async () => {
      await this.checkUnresolvedIncidents();
    });

    console.log(`${this.jobs.length} scheduled tasks registered`);
  }

  /**
   * Add a cron job with error handling
   */
  addJob(schedule, name, handler) {
    const job = cron.schedule(schedule, async () => {
      console.log(`[CRON] Running: ${name}`);
      try {
        await handler();
        console.log(`[CRON] Completed: ${name}`);
      } catch (error) {
        console.error(`[CRON] Error in ${name}:`, error.message);
      }
    }, {
      timezone: 'Asia/Jerusalem'
    });

    this.jobs.push({ name, job, schedule });
  }

  /**
   * Send reminders for today's shifts
   */
  async sendTodayShiftReminders() {
    try {
      if (!whatsappHelper.isConfigured()) {
        console.log('[CRON] WhatsApp not configured, skipping shift reminders');
        return;
      }

      const result = query(`
        SELECT sa.id, sa.shift_id, sa.employee_id,
               e.first_name, e.last_name, e.phone,
               s.date, s.start_time, s.end_time,
               c.company_name, si.name as site_name, si.address as site_address
        FROM shift_assignments sa
        JOIN employees e ON sa.employee_id = e.id
        JOIN shifts s ON sa.shift_id = s.id
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sites si ON s.site_id = si.id
        WHERE s.date = date('now')
        AND sa.status = 'assigned'
        AND e.phone IS NOT NULL
      `);

      console.log(`[CRON] Found ${result.rows.length} shift assignments for today`);

      for (const assignment of result.rows) {
        const message = `בוקר טוב ${assignment.first_name}! ☀️
תזכורת - יש לך משמרת היום:

📍 ${assignment.site_name || assignment.company_name || 'משמרת'}
🏠 ${assignment.site_address || ''}
🕐 ${assignment.start_time} - ${assignment.end_time}

נא להגיע בזמן.
צוות יהלום`;

        await whatsappHelper.safeSend(assignment.phone, message);
        // Small delay between messages
        await this.delay(1000);
      }
    } catch (error) {
      console.error('[CRON] sendTodayShiftReminders error:', error.message);
    }
  }

  /**
   * Send reminders for tomorrow's shifts
   */
  async sendTomorrowShiftReminders() {
    try {
      if (!whatsappHelper.isConfigured()) return;

      const result = query(`
        SELECT sa.id, sa.employee_id,
               e.first_name, e.phone,
               s.date, s.start_time, s.end_time,
               c.company_name, si.name as site_name, si.address as site_address
        FROM shift_assignments sa
        JOIN employees e ON sa.employee_id = e.id
        JOIN shifts s ON sa.shift_id = s.id
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sites si ON s.site_id = si.id
        WHERE s.date = date('now', '+1 day')
        AND sa.status = 'assigned'
        AND e.phone IS NOT NULL
      `);

      console.log(`[CRON] Found ${result.rows.length} shift assignments for tomorrow`);

      for (const assignment of result.rows) {
        const message = `ערב טוב ${assignment.first_name}! 🌙
תזכורת - מחר יש לך משמרת:

📍 ${assignment.site_name || assignment.company_name || 'משמרת'}
🏠 ${assignment.site_address || ''}
📅 ${assignment.date}
🕐 ${assignment.start_time} - ${assignment.end_time}

צוות יהלום`;

        await whatsappHelper.safeSend(assignment.phone, message);
        await this.delay(1000);
      }
    } catch (error) {
      console.error('[CRON] sendTomorrowShiftReminders error:', error.message);
    }
  }

  /**
   * Check and notify about overdue invoices
   */
  async checkOverdueInvoices() {
    try {
      if (!whatsappHelper.isConfigured()) return;

      const result = query(`
        SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
               c.company_name,
               CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'sent'
        AND i.due_date < date('now')
        ORDER BY i.due_date
      `);

      if (result.rows.length === 0) return;

      console.log(`[CRON] Found ${result.rows.length} overdue invoices`);

      // Get admin phones
      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      if (admins.rows.length === 0) return;

      let summary = `התראת חשבוניות באיחור! ⚠️\n\n`;
      for (const inv of result.rows) {
        summary += `• ${inv.company_name || 'לא ידוע'} - חשבונית ${inv.invoice_number || inv.id}\n`;
        summary += `  סכום: ${inv.total_amount} | איחור: ${inv.days_overdue} ימים\n\n`;
      }
      summary += `סה"כ: ${result.rows.length} חשבוניות באיחור\nצוות יהלום CRM`;

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, summary);
        await this.delay(500);
      }
    } catch (error) {
      console.error('[CRON] checkOverdueInvoices error:', error.message);
    }
  }

  /**
   * Send weekly summary to managers
   */
  async sendWeeklySummary() {
    try {
      if (!whatsappHelper.isConfigured()) return;

      const shiftsResult = query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM shifts
        WHERE date BETWEEN date('now', '-7 days') AND date('now')
      `);

      const eventsResult = query(`
        SELECT COUNT(*) as total
        FROM events
        WHERE event_date BETWEEN date('now') AND date('now', '+7 days')
      `);

      const leadsResult = query(`
        SELECT
          COUNT(*) as new_leads,
          SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won
        FROM leads
        WHERE created_at >= date('now', '-7 days')
      `);

      const invoiceResult = query(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid,
          COUNT(CASE WHEN status = 'sent' AND due_date < date('now') THEN 1 END) as overdue_count
        FROM invoices
        WHERE issue_date >= date('now', '-7 days') OR (status = 'sent' AND due_date < date('now'))
      `);

      const shifts = shiftsResult.rows[0] || {};
      const events = eventsResult.rows[0] || {};
      const leads = leadsResult.rows[0] || {};
      const invoices = invoiceResult.rows[0] || {};

      const message = `סיכום שבועי - צוות יהלום 📊

📋 משמרות (שבוע שעבר):
• סה"כ: ${shifts.total || 0}
• הושלמו: ${shifts.completed || 0}
• בוטלו: ${shifts.cancelled || 0}

🎪 אירועים (שבוע הבא): ${events.total || 0}

💼 לידים חדשים: ${leads.new_leads || 0}
✅ נסגרו בהצלחה: ${leads.won || 0}

💰 הכנסות (שבוע שעבר): ${invoices.paid || 0} ש"ח
⚠️ חשבוניות באיחור: ${invoices.overdue_count || 0}

שבוע טוב! 🌟
צוות יהלום CRM`;

      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, message);
        await this.delay(500);
      }
    } catch (error) {
      console.error('[CRON] sendWeeklySummary error:', error.message);
    }
  }

  /**
   * Check for expiring employee documents (licenses, certifications)
   */
  async checkExpiringDocuments() {
    try {
      if (!whatsappHelper.isConfigured()) return;

      const result = query(`
        SELECT ed.id, ed.document_type, ed.expiry_date,
               e.first_name, e.last_name, e.phone,
               CAST(julianday(ed.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM employee_documents ed
        JOIN employees e ON ed.employee_id = e.id
        WHERE ed.expiry_date IS NOT NULL
        AND ed.expiry_date BETWEEN date('now') AND date('now', '+14 days')
        ORDER BY ed.expiry_date
      `);

      if (result.rows.length === 0) return;

      console.log(`[CRON] Found ${result.rows.length} expiring documents`);

      // Notify admins
      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      let summary = `התראת מסמכים שפגי תוקף! 📄⚠️\n\n`;
      for (const doc of result.rows) {
        summary += `• ${doc.first_name} ${doc.last_name} - ${doc.document_type}\n`;
        summary += `  פג תוקף בעוד ${doc.days_until_expiry} ימים (${doc.expiry_date})\n\n`;
      }
      summary += `צוות יהלום CRM`;

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, summary);
        await this.delay(500);
      }

      // Also notify the employees themselves
      for (const doc of result.rows) {
        if (doc.phone && doc.days_until_expiry <= 7) {
          const empMessage = `שלום ${doc.first_name}! 📋
תזכורת - המסמך "${doc.document_type}" שלך פג תוקף בתאריך ${doc.expiry_date}.
נא לחדש בהקדם.

צוות יהלום`;
          await whatsappHelper.safeSend(doc.phone, empMessage);
          await this.delay(1000);
        }
      }
    } catch (error) {
      console.error('[CRON] checkExpiringDocuments error:', error.message);
    }
  }

  /**
   * Check for expiring customer contracts
   */
  async checkExpiringContracts() {
    try {
      if (!whatsappHelper.isConfigured()) return;

      const result = query(`
        SELECT cc.id, cc.end_date, cc.monthly_value,
               c.company_name,
               CAST(julianday(cc.end_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM customer_contracts cc
        JOIN customers c ON cc.customer_id = c.id
        WHERE cc.status = 'active'
        AND cc.end_date BETWEEN date('now') AND date('now', '+30 days')
        ORDER BY cc.end_date
      `);

      if (result.rows.length === 0) return;

      console.log(`[CRON] Found ${result.rows.length} expiring contracts`);

      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      let summary = `התראת חוזים לחידוש! 📝\n\n`;
      for (const contract of result.rows) {
        summary += `• ${contract.company_name}\n`;
        summary += `  סיום: ${contract.end_date} (עוד ${contract.days_until_expiry} ימים)\n`;
        summary += `  ערך חודשי: ${contract.monthly_value || '-'} ש"ח\n\n`;
      }
      summary += `צוות יהלום CRM`;

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, summary);
        await this.delay(500);
      }
    } catch (error) {
      console.error('[CRON] checkExpiringContracts error:', error.message);
    }
  }

  /**
   * Check for upcoming events that are not fully staffed
   */
  async checkUnassignedEvents() {
    try {
      if (!whatsappHelper.isConfigured()) return;

      const result = query(`
        SELECT e.id, e.event_name, e.event_date, e.start_time, e.location,
               e.required_guards,
               (SELECT COUNT(*) FROM event_assignments WHERE event_id = e.id) as assigned_count,
               c.company_name
        FROM events e
        LEFT JOIN customers c ON e.customer_id = c.id
        WHERE e.event_date BETWEEN date('now') AND date('now', '+3 days')
        AND e.status NOT IN ('completed', 'cancelled')
        AND (SELECT COUNT(*) FROM event_assignments WHERE event_id = e.id) < e.required_guards
        ORDER BY e.event_date, e.start_time
      `);

      if (result.rows.length === 0) return;

      console.log(`[CRON] Found ${result.rows.length} understaffed upcoming events`);

      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      let summary = `התראה - אירועים ללא כיסוי מלא! 🚨\n\n`;
      for (const event of result.rows) {
        const missing = event.required_guards - event.assigned_count;
        summary += `• ${event.event_name}\n`;
        summary += `  📅 ${event.event_date} | 🕐 ${event.start_time}\n`;
        summary += `  📍 ${event.location || ''}\n`;
        summary += `  חסרים: ${missing} מאבטחים (${event.assigned_count}/${event.required_guards})\n\n`;
      }
      summary += `צוות יהלום CRM`;

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, summary);
        await this.delay(500);
      }
    } catch (error) {
      console.error('[CRON] checkUnassignedEvents error:', error.message);
    }
  }

  /**
   * Check for expiring guard certifications (next 14 days)
   */
  async checkExpiringCertifications() {
    try {
      if (!whatsappHelper.isConfigured()) return;

      const result = query(`
        SELECT gc.id, gc.cert_type, gc.cert_name, gc.expiry_date,
               e.first_name, e.last_name, e.phone,
               CAST(julianday(gc.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
        FROM guard_certifications gc
        JOIN employees e ON gc.employee_id = e.id
        WHERE gc.expiry_date IS NOT NULL
        AND gc.status = 'active'
        AND gc.expiry_date BETWEEN date('now') AND date('now', '+14 days')
        ORDER BY gc.expiry_date
      `);

      if (result.rows.length === 0) return;

      console.log(`[CRON] Found ${result.rows.length} expiring certifications`);

      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      let summary = `התראת הסמכות שפגות תוקף! 🔴\n\n`;
      for (const cert of result.rows) {
        summary += `• ${cert.first_name} ${cert.last_name}\n`;
        summary += `  ${cert.cert_name} - פג בעוד ${cert.days_until_expiry} ימים (${cert.expiry_date})\n\n`;
      }
      summary += `סה"כ: ${result.rows.length} הסמכות\nצוות יהלום CRM`;

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, summary);
        await this.delay(500);
      }

      // Notify employees with expiring certs (7 days or less)
      for (const cert of result.rows) {
        if (cert.phone && cert.days_until_expiry <= 7) {
          const msg = `שלום ${cert.first_name}! 📋\nההסמכה "${cert.cert_name}" שלך פגה תוקף בתאריך ${cert.expiry_date}.\nנא לחדש בהקדם.\n\nצוות יהלום`;
          await whatsappHelper.safeSend(cert.phone, msg);
          await this.delay(1000);
        }
      }
    } catch (error) {
      console.error('[CRON] checkExpiringCertifications error:', error.message);
    }
  }

  /**
   * Check for unresolved incidents (open > 48 hours)
   */
  async checkUnresolvedIncidents() {
    try {
      if (!whatsappHelper.isConfigured()) return;

      const result = query(`
        SELECT i.id, i.title, i.severity, i.incident_type, i.incident_date, i.status,
               c.company_name, s.name as site_name,
               CAST(julianday('now') - julianday(i.created_at) AS INTEGER) as days_open
        FROM incidents i
        LEFT JOIN customers c ON i.customer_id = c.id
        LEFT JOIN sites s ON i.site_id = s.id
        WHERE i.status IN ('open', 'investigating')
        AND i.created_at <= datetime('now', '-48 hours')
        ORDER BY i.severity DESC, i.created_at
      `);

      if (result.rows.length === 0) return;

      console.log(`[CRON] Found ${result.rows.length} unresolved incidents (48h+)`);

      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      const severityLabels = { critical: '🔴 קריטי', high: '🟠 גבוה', medium: '🟡 בינוני', low: '🟢 נמוך' };
      let summary = `אירועי אבטחה לא פתורים (48+ שעות)! ⚠️\n\n`;
      for (const inc of result.rows) {
        summary += `${severityLabels[inc.severity] || inc.severity} - ${inc.title}\n`;
        summary += `  ${inc.company_name || ''} ${inc.site_name ? '/ ' + inc.site_name : ''}\n`;
        summary += `  פתוח ${inc.days_open} ימים | סטטוס: ${inc.status === 'open' ? 'פתוח' : 'בחקירה'}\n\n`;
      }
      summary += `סה"כ: ${result.rows.length} אירועים\nצוות יהלום CRM`;

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, summary);
        await this.delay(500);
      }
    } catch (error) {
      console.error('[CRON] checkUnresolvedIncidents error:', error.message);
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    for (const { name, job } of this.jobs) {
      job.stop();
      console.log(`[CRON] Stopped: ${name}`);
    }
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    return this.jobs.map(({ name, schedule }) => ({
      name,
      schedule,
      active: true
    }));
  }
}

module.exports = new Scheduler();
