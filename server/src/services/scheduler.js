/**
 * Scheduler Service - Automated tasks using node-cron
 * Handles shift reminders, overdue invoice alerts, document expiry warnings
 *
 * Phase 2: DB-backed config, per-job logging, retry logic, enable/disable toggles
 */
const cron = require('node-cron');
const crypto = require('crypto');
const { query, db, generateUUID } = require('../config/database');
const whatsappHelper = require('../utils/whatsappHelper');
const googleHelper = require('../utils/googleHelper');

class Scheduler {
  constructor() {
    this.jobs = new Map(); // name -> { cronJob, schedule, handler }
    this.retryTimers = new Map(); // name -> setTimeout id
  }

  // ── DB Helpers ────────────────────────────────────────────────────────

  /**
   * Load job config from DB
   */
  getJobConfig(jobName) {
    try {
      const result = query('SELECT * FROM automation_config WHERE job_name = $1', [jobName]);
      return result.rows[0] || null;
    } catch (e) {
      console.error(`[Scheduler] Error loading config for ${jobName}:`, e.message);
      return null;
    }
  }

  /**
   * Get all job configs from DB
   */
  getAllJobConfigs() {
    try {
      const result = query('SELECT * FROM automation_config ORDER BY category, display_name');
      return result.rows;
    } catch (e) {
      console.error('[Scheduler] Error loading all configs:', e.message);
      return [];
    }
  }

  /**
   * Update job config fields in DB
   */
  updateJobConfig(jobName, fields) {
    try {
      const sets = [];
      const params = [];
      let i = 1;
      for (const [key, value] of Object.entries(fields)) {
        sets.push(`${key} = $${i}`);
        params.push(value);
        i++;
      }
      sets.push(`updated_at = datetime('now')`);
      params.push(jobName);
      query(`UPDATE automation_config SET ${sets.join(', ')} WHERE job_name = $${i}`, params);
    } catch (e) {
      console.error(`[Scheduler] Error updating config for ${jobName}:`, e.message);
    }
  }

  /**
   * Create a run log entry (returns the log id)
   */
  createRunLog(jobName) {
    try {
      const id = generateUUID();
      const now = new Date().toISOString();
      query(
        `INSERT INTO automation_run_log (id, job_name, started_at, status) VALUES ($1, $2, $3, 'running')`,
        [id, jobName, now]
      );
      return id;
    } catch (e) {
      console.error(`[Scheduler] Error creating run log for ${jobName}:`, e.message);
      return null;
    }
  }

  /**
   * Complete a run log entry
   */
  completeRunLog(logId, status, counts = {}, errorMessage = null, details = null) {
    if (!logId) return;
    try {
      const now = new Date().toISOString();
      query(
        `UPDATE automation_run_log SET completed_at = $1, status = $2, items_processed = $3, items_created = $4, items_skipped = $5, error_message = $6, details = $7 WHERE id = $8`,
        [now, status, counts.processed || 0, counts.created || 0, counts.skipped || 0, errorMessage, details, logId]
      );
    } catch (e) {
      console.error(`[Scheduler] Error completing run log ${logId}:`, e.message);
    }
  }

  /**
   * Calculate next run time from a cron expression
   */
  calculateNextRun(cronExpression) {
    try {
      const parts = cronExpression.split(' ');
      if (parts.length !== 5) return null;

      const now = new Date();
      const [min, hour, dom, month, dow] = parts;

      // For every-N-minutes patterns like */15
      if (min.startsWith('*/')) {
        const interval = parseInt(min.substring(2));
        const next = new Date(now);
        const currentMin = next.getMinutes();
        const nextMin = Math.ceil((currentMin + 1) / interval) * interval;
        if (nextMin >= 60) {
          next.setHours(next.getHours() + 1);
          next.setMinutes(nextMin - 60);
        } else {
          next.setMinutes(nextMin);
        }
        next.setSeconds(0);
        return next.toISOString();
      }

      // For specific time patterns
      const targetMin = min === '*' ? now.getMinutes() : parseInt(min);
      const targetHour = hour === '*' ? now.getHours() : parseInt(hour);

      const next = new Date(now);
      next.setHours(targetHour, targetMin, 0, 0);

      // If the time already passed today, move to next occurrence
      if (next <= now) {
        if (dow !== '*') {
          const targetDow = parseInt(dow);
          let daysUntil = targetDow - now.getDay();
          if (daysUntil <= 0) daysUntil += 7;
          next.setDate(next.getDate() + daysUntil);
        } else if (dom !== '*') {
          next.setMonth(next.getMonth() + 1);
          next.setDate(parseInt(dom));
        } else {
          next.setDate(next.getDate() + 1);
        }
      }

      return next.toISOString();
    } catch (e) {
      return null;
    }
  }

  // ── Retry Logic ───────────────────────────────────────────────────────

  /**
   * Get backoff delay for retry attempt (1min, 5min, 15min)
   */
  getRetryDelay(retryCount) {
    const delays = [60000, 300000, 900000]; // 1min, 5min, 15min
    return delays[Math.min(retryCount, delays.length - 1)];
  }

  /**
   * Schedule a retry for a failed job
   */
  scheduleRetry(jobName, handler) {
    const config = this.getJobConfig(jobName);
    if (!config) return;

    const currentRetries = config.retry_count || 0;
    const maxRetries = config.max_retries || 3;

    if (currentRetries >= maxRetries) {
      console.log(`[Scheduler] ${jobName}: max retries (${maxRetries}) reached, skipping retry`);
      this.updateJobConfig(jobName, { last_run_status: 'failed_max_retries' });
      return;
    }

    const delay = this.getRetryDelay(currentRetries);
    const nextRetry = currentRetries + 1;
    console.log(`[Scheduler] ${jobName}: scheduling retry ${nextRetry}/${maxRetries} in ${delay / 1000}s`);

    this.updateJobConfig(jobName, { retry_count: nextRetry });

    // Clear any existing retry timer
    if (this.retryTimers.has(jobName)) {
      clearTimeout(this.retryTimers.get(jobName));
    }

    const timer = setTimeout(async () => {
      this.retryTimers.delete(jobName);
      console.log(`[Scheduler] ${jobName}: executing retry ${nextRetry}/${maxRetries}`);
      await this.executeJob(jobName, handler);
    }, delay);

    this.retryTimers.set(jobName, timer);
  }

  // ── Job Execution Wrapper ─────────────────────────────────────────────

  /**
   * Execute a job with DB logging, config checks, and retry logic
   */
  async executeJob(jobName, handler) {
    // Check if job is enabled in DB
    const config = this.getJobConfig(jobName);
    if (config && config.is_enabled === 0) {
      console.log(`[CRON] Skipped (disabled): ${jobName}`);
      return;
    }

    const logId = this.createRunLog(jobName);
    const startTime = Date.now();

    console.log(`[CRON] Running: ${jobName}`);

    try {
      const result = await handler();

      const duration = Date.now() - startTime;
      const counts = {
        processed: result?.processed || result?.total || 0,
        created: result?.created || 0,
        skipped: result?.skipped || 0,
      };
      const details = result?.details || result?.message || null;

      this.completeRunLog(logId, 'success', counts, null, details);

      const nextRun = config ? this.calculateNextRun(config.cron_schedule) : null;
      this.updateJobConfig(jobName, {
        last_run_at: new Date().toISOString(),
        last_run_status: 'success',
        last_run_details: details,
        next_run_at: nextRun,
        retry_count: 0,
      });

      console.log(`[CRON] Completed: ${jobName} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error.message || String(error);

      this.completeRunLog(logId, 'failed', {}, errorMsg, null);

      const nextRun = config ? this.calculateNextRun(config.cron_schedule) : null;
      this.updateJobConfig(jobName, {
        last_run_at: new Date().toISOString(),
        last_run_status: 'failed',
        last_run_details: errorMsg,
        next_run_at: nextRun,
      });

      console.error(`[CRON] Error in ${jobName} (${duration}ms):`, errorMsg);

      // Schedule retry
      this.scheduleRetry(jobName, handler);
    }
  }

  // ── Public Management Methods ─────────────────────────────────────────

  /**
   * Pause a job (disable in DB, stop cron)
   */
  pauseJob(name) {
    this.updateJobConfig(name, { is_enabled: 0 });
    const jobEntry = this.jobs.get(name);
    if (jobEntry && jobEntry.cronJob) {
      jobEntry.cronJob.stop();
    }
    if (this.retryTimers.has(name)) {
      clearTimeout(this.retryTimers.get(name));
      this.retryTimers.delete(name);
    }
    return { success: true, message: `Job ${name} paused` };
  }

  /**
   * Resume a job (enable in DB, restart cron)
   */
  resumeJob(name) {
    this.updateJobConfig(name, { is_enabled: 1, retry_count: 0 });
    const jobEntry = this.jobs.get(name);
    if (jobEntry && jobEntry.cronJob) {
      jobEntry.cronJob.start();
    }
    const config = this.getJobConfig(name);
    if (config) {
      const nextRun = this.calculateNextRun(config.cron_schedule);
      this.updateJobConfig(name, { next_run_at: nextRun });
    }
    return { success: true, message: `Job ${name} resumed` };
  }

  /**
   * Manually trigger a job (runs immediately regardless of schedule)
   */
  async triggerJob(name) {
    const jobEntry = this.jobs.get(name);
    if (!jobEntry) {
      return { success: false, message: `Job ${name} not found` };
    }

    // Reset retry count before manual trigger
    this.updateJobConfig(name, { retry_count: 0 });

    const logId = this.createRunLog(name);
    const startTime = Date.now();

    try {
      const result = await jobEntry.handler();
      const duration = Date.now() - startTime;
      const counts = {
        processed: result?.processed || result?.total || 0,
        created: result?.created || 0,
        skipped: result?.skipped || 0,
      };
      const details = result?.details || result?.message || null;

      this.completeRunLog(logId, 'success', counts, null, details);

      const config = this.getJobConfig(name);
      const nextRun = config ? this.calculateNextRun(config.cron_schedule) : null;
      this.updateJobConfig(name, {
        last_run_at: new Date().toISOString(),
        last_run_status: 'success',
        last_run_details: details,
        next_run_at: nextRun,
        retry_count: 0,
      });

      return { success: true, duration, counts, details, message: `Job ${name} completed successfully` };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error.message || String(error);

      this.completeRunLog(logId, 'failed', {}, errorMsg, null);
      this.updateJobConfig(name, {
        last_run_at: new Date().toISOString(),
        last_run_status: 'failed',
        last_run_details: errorMsg,
      });

      return { success: false, duration, error: errorMsg, message: `Job ${name} failed: ${errorMsg}` };
    }
  }

  /**
   * Get status of a specific job
   */
  getJobStatus(name) {
    const config = this.getJobConfig(name);
    if (!config) return null;

    const jobEntry = this.jobs.get(name);
    return {
      ...config,
      is_registered: !!jobEntry,
      has_pending_retry: this.retryTimers.has(name),
    };
  }

  /**
   * Get status of all jobs
   */
  getAllJobStatuses() {
    const configs = this.getAllJobConfigs();
    return configs.map(config => ({
      ...config,
      is_registered: this.jobs.has(config.job_name),
      has_pending_retry: this.retryTimers.has(config.job_name),
    }));
  }

  /**
   * Update the cron schedule for a job
   */
  updateJobSchedule(name, newSchedule) {
    if (!cron.validate(newSchedule)) {
      return { success: false, message: 'Invalid cron expression' };
    }

    const jobEntry = this.jobs.get(name);
    if (!jobEntry) {
      return { success: false, message: `Job ${name} not found` };
    }

    if (jobEntry.cronJob) {
      jobEntry.cronJob.stop();
    }

    const newCronJob = cron.schedule(newSchedule, async () => {
      await this.executeJob(name, jobEntry.handler);
    }, { timezone: 'Asia/Jerusalem' });

    jobEntry.cronJob = newCronJob;
    jobEntry.schedule = newSchedule;

    const nextRun = this.calculateNextRun(newSchedule);
    this.updateJobConfig(name, { cron_schedule: newSchedule, next_run_at: nextRun });

    return { success: true, message: `Schedule updated to ${newSchedule}` };
  }

  // ── Job Registration ──────────────────────────────────────────────────

  /**
   * Add a cron job with DB-backed config and logging
   */
  addJob(schedule, name, handler) {
    const cronJob = cron.schedule(schedule, async () => {
      await this.executeJob(name, handler);
    }, {
      timezone: 'Asia/Jerusalem'
    });

    this.jobs.set(name, { cronJob, schedule, handler });

    // Check if job is disabled in DB and stop cron if so
    const config = this.getJobConfig(name);
    if (config && config.is_enabled === 0) {
      cronJob.stop();
    }

    // Update next_run_at
    const nextRun = this.calculateNextRun(schedule);
    if (config) {
      this.updateJobConfig(name, { next_run_at: nextRun });
    }
  }

  /**
   * Seed a job config into DB if it doesn't exist yet
   */
  seedJobConfig(jobName, displayName, description, cronSchedule, category) {
    try {
      const existing = this.getJobConfig(jobName);
      if (!existing) {
        query(
          `INSERT OR IGNORE INTO automation_config (id, job_name, display_name, description, cron_schedule, category) VALUES ($1, $2, $3, $4, $5, $6)`,
          [generateUUID(), jobName, displayName, description, cronSchedule, category]
        );
      }
    } catch (e) {
      // ignore - table might not exist yet on first boot
    }
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    console.log('Starting scheduled tasks...');

    // Seed any new jobs that may not be in DB yet (e.g. shift-intelligence-weekly added later)
    this.seedJobConfig('shift-intelligence-weekly', 'ניתוח משמרות שבועי', 'ניתוח חכם של דפוסי משמרות, שעות עודפות ובעיות כיסוי', '0 6 * * 3', 'monitoring');

    // Every day at 07:00 - Send shift reminders for today
    this.addJob('0 7 * * *', 'daily-shift-reminders', async () => {
      return await this.sendTodayShiftReminders();
    });

    // Every day at 07:15 - Predictive alerts
    const predictiveAlerts = require('./predictiveAlerts');
    this.addJob('15 7 * * *', 'predictive-alerts', () => {
      console.log('[Scheduler] Running predictive alerts...');
      const result = predictiveAlerts.runAll();
      return result || { processed: 0 };
    });

    // Every day at 20:00 - Send tomorrow shift reminders
    this.addJob('0 20 * * *', 'tomorrow-shift-reminders', async () => {
      return await this.sendTomorrowShiftReminders();
    });

    // Every day at 09:00 - Check overdue invoices (notify admins)
    this.addJob('0 9 * * *', 'overdue-invoice-check', async () => {
      return await this.checkOverdueInvoices();
    });

    // Every day at 10:00 - Send invoice reminders to customers
    this.addJob('0 10 * * *', 'customer-invoice-reminders', async () => {
      return await this.sendCustomerInvoiceReminders();
    });

    // Every Monday at 08:00 - Weekly summary
    this.addJob('0 8 * * 1', 'weekly-summary', async () => {
      return await this.sendWeeklySummary();
    });

    // Every day at 08:00 - Check expiring documents
    this.addJob('0 8 * * *', 'document-expiry-check', async () => {
      return await this.checkExpiringDocuments();
    });

    // Every day at 08:30 - Check expiring contracts
    this.addJob('30 8 * * *', 'contract-expiry-check', async () => {
      return await this.checkExpiringContracts();
    });

    // Every day at 10:00 - Check unassigned upcoming events
    this.addJob('0 10 * * *', 'unassigned-events-check', async () => {
      return await this.checkUnassignedEvents();
    });

    // Every day at 07:30 - Check expiring guard certifications
    this.addJob('30 7 * * *', 'certification-expiry-check', async () => {
      return await this.checkExpiringCertifications();
    });

    // Every day at 11:00 - Check unresolved incidents (48+ hours)
    this.addJob('0 11 * * *', 'unresolved-incidents-check', async () => {
      return await this.checkUnresolvedIncidents();
    });

    // Every 15 minutes - Check for guard no-shows
    this.addJob('*/15 * * * *', 'guard-no-show-check', async () => {
      return await this.checkGuardNoShows();
    });

    // Every day at 03:00 - Cleanup old guard location data
    this.addJob('0 3 * * *', 'guard-location-cleanup', async () => {
      return await this.cleanupGuardLocations();
    });

    // Every Sunday at 06:00 - Auto-generate shifts for next week
    this.addJob('0 6 * * 0', 'auto-generate-shifts', async () => {
      return await this.autoGenerateShifts();
    });

    // 1st of every month at 08:00 - Auto-generate monthly contract invoices
    this.addJob('0 8 1 * *', 'auto-generate-invoices', async () => {
      return await this.autoGenerateInvoices();
    });

    // Every Wednesday at 06:00 - Shift Intelligence weekly report
    const shiftIntelligence = require('./shiftIntelligence');
    this.addJob('0 6 * * 3', 'shift-intelligence-weekly', () => {
      console.log('[Scheduler] Running shift intelligence weekly analysis...');
      const result = shiftIntelligence.generateWeeklyInsights();
      return result || { processed: 0 };
    });

    console.log(`${this.jobs.size} scheduled tasks registered`);
  }

  // ── Job Handlers (original logic preserved) ───────────────────────────

  /**
   * Send reminders for today's shifts
   */
  async sendTodayShiftReminders() {
    if (!whatsappHelper.isConfigured()) {
      console.log('[CRON] WhatsApp not configured, skipping shift reminders');
      return { processed: 0, created: 0, skipped: 0, details: 'WhatsApp not configured' };
    }

    const whatsappService = require('./whatsapp');

    const result = query(`
      SELECT sa.id, sa.shift_id, sa.employee_id,
             e.first_name, e.last_name, e.phone, e.id as emp_id,
             s.date, s.start_time, s.end_time,
             c.company_name, si.name as site_name, si.address as site_address
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE s.date = date('now', 'localtime')
      AND sa.status = 'assigned'
      AND e.phone IS NOT NULL
    `);

    console.log(`[CRON] Found ${result.rows.length} shift assignments for today`);
    let sent = 0;

    for (const assignment of result.rows) {
      const message = `בוקר טוב ${assignment.first_name}! ☀️
תזכורת - יש לך משמרת היום:

📍 ${assignment.site_name || assignment.company_name || 'משמרת'}
🏠 ${assignment.site_address || ''}
🕐 ${assignment.start_time} - ${assignment.end_time}

נא להגיע בזמן.
צוות יהלום`;

      await whatsappService.sendMessage(assignment.phone, message, {
        context: 'shift_reminder',
        entityType: 'employee',
        entityId: assignment.emp_id
      });
      sent++;
      await this.delay(1000);
    }

    return { processed: result.rows.length, created: sent, skipped: 0, details: `Sent ${sent} shift reminders` };
  }

  /**
   * Send reminders for tomorrow's shifts
   */
  async sendTomorrowShiftReminders() {
    if (!whatsappHelper.isConfigured()) return { processed: 0, details: 'WhatsApp not configured' };

    const whatsappService = require('./whatsapp');

    const result = query(`
      SELECT sa.id, sa.employee_id,
             e.first_name, e.phone, e.id as emp_id,
             s.date, s.start_time, s.end_time,
             c.company_name, si.name as site_name, si.address as site_address
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE s.date = date('now', 'localtime', '+1 day')
      AND sa.status = 'assigned'
      AND e.phone IS NOT NULL
    `);

    console.log(`[CRON] Found ${result.rows.length} shift assignments for tomorrow`);
    let sent = 0;

    for (const assignment of result.rows) {
      const message = `ערב טוב ${assignment.first_name}! 🌙
תזכורת - מחר יש לך משמרת:

📍 ${assignment.site_name || assignment.company_name || 'משמרת'}
🏠 ${assignment.site_address || ''}
📅 ${assignment.date}
🕐 ${assignment.start_time} - ${assignment.end_time}

צוות יהלום`;

      await whatsappService.sendMessage(assignment.phone, message, {
        context: 'shift_reminder',
        entityType: 'employee',
        entityId: assignment.emp_id
      });
      sent++;
      await this.delay(1000);
    }

    return { processed: result.rows.length, created: sent, details: `Sent ${sent} tomorrow reminders` };
  }

  /**
   * Check and notify about overdue invoices
   */
  async checkOverdueInvoices() {
    if (!whatsappHelper.isConfigured()) return { processed: 0, details: 'WhatsApp not configured' };

    const result = query(`
      SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
             c.company_name,
             CAST(julianday('now', 'localtime') - julianday(i.due_date) AS INTEGER) as days_overdue
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.status = 'sent'
      AND i.due_date < date('now', 'localtime')
      ORDER BY i.due_date
    `);

    if (result.rows.length === 0) return { processed: 0, details: 'No overdue invoices' };

    console.log(`[CRON] Found ${result.rows.length} overdue invoices`);

    const admins = query(`
      SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
    `);

    if (admins.rows.length === 0) return { processed: result.rows.length, details: 'No admin phones configured' };

    let summary = `התראת חשבוניות באיחור! ⚠️\n\n`;
    for (const inv of result.rows) {
      summary += `• ${inv.company_name || 'לא ידוע'} - חשבונית ${inv.invoice_number || inv.id}\n`;
      summary += `  סכום: ${inv.total_amount} | איחור: ${inv.days_overdue} ימים\n\n`;
    }
    summary += `סה"כ: ${result.rows.length} חשבוניות באיחור\nצוות יהלום CRM`;

    let sent = 0;
    for (const admin of admins.rows) {
      await whatsappHelper.safeSend(admin.phone, summary);
      sent++;
      await this.delay(500);
    }

    return { processed: result.rows.length, created: sent, details: `${result.rows.length} overdue invoices, notified ${sent} admins` };
  }

  /**
   * Send invoice reminders directly to customers (at 3, 7, 14, 30 days overdue)
   */
  async sendCustomerInvoiceReminders() {
    if (!whatsappHelper.isConfigured()) {
      console.log('[CRON] WhatsApp not configured, skipping customer invoice reminders');
      return { processed: 0, details: 'WhatsApp not configured' };
    }

    const whatsappService = require('./whatsapp');

    const result = query(`
      SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
             i.customer_id, c.company_name,
             ct.name as contact_name, ct.phone as contact_phone, ct.customer_id,
             CAST(julianday('now', 'localtime') - julianday(i.due_date) AS INTEGER) as days_overdue
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN contacts ct ON ct.customer_id = i.customer_id AND ct.is_primary = 1
      WHERE i.status = 'sent'
      AND i.due_date < date('now', 'localtime')
      AND CAST(julianday('now', 'localtime') - julianday(i.due_date) AS INTEGER) IN (3, 7, 14, 30)
      AND ct.phone IS NOT NULL
      ORDER BY i.due_date
    `);

    if (result.rows.length === 0) return { processed: 0, details: 'No reminders to send today' };

    console.log(`[CRON] Sending ${result.rows.length} customer invoice reminders`);
    let sent = 0;

    for (const inv of result.rows) {
      const message = `שלום ${inv.contact_name || inv.company_name},
תזכורת לתשלום חשבונית ${inv.invoice_number ? '#' + inv.invoice_number : ''}
💰 סכום: ₪${Number(inv.total_amount).toLocaleString()}
📅 תאריך תשלום: ${inv.due_date}
⏰ איחור: ${inv.days_overdue} ימים

לפרטים נוספים ניתן לפנות אלינו.
צוות יהלום`;

      await whatsappService.sendMessage(inv.contact_phone, message, {
        context: 'invoice_reminder',
        entityType: 'customer',
        entityId: inv.customer_id
      });
      sent++;
      await this.delay(1500);
    }

    return { processed: result.rows.length, created: sent, details: `Sent ${sent} customer invoice reminders` };
  }

  /**
   * Send weekly summary to managers
   */
  async sendWeeklySummary() {
    if (!whatsappHelper.isConfigured()) return { processed: 0, details: 'WhatsApp not configured' };

    const shiftsResult = query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM shifts
      WHERE date BETWEEN date('now', 'localtime', '-7 days') AND date('now', 'localtime')
    `);

    const eventsResult = query(`
      SELECT COUNT(*) as total
      FROM events
      WHERE event_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')
    `);

    const leadsResult = query(`
      SELECT
        COUNT(*) as new_leads,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won
      FROM leads
      WHERE created_at >= date('now', 'localtime', '-7 days')
    `);

    const invoiceResult = query(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid,
        COUNT(CASE WHEN status = 'sent' AND due_date < date('now', 'localtime') THEN 1 END) as overdue_count
      FROM invoices
      WHERE issue_date >= date('now', 'localtime', '-7 days') OR (status = 'sent' AND due_date < date('now', 'localtime'))
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

    let sent = 0;
    for (const admin of admins.rows) {
      await whatsappHelper.safeSend(admin.phone, message);
      sent++;
      await this.delay(500);
    }

    return { processed: 1, created: sent, details: `Weekly summary sent to ${sent} admins` };
  }

  /**
   * Check for expiring employee documents (licenses, certifications)
   */
  async checkExpiringDocuments() {
    if (!whatsappHelper.isConfigured()) return { processed: 0, details: 'WhatsApp not configured' };

    const result = query(`
      SELECT ed.id, ed.document_type, ed.expiry_date,
             e.first_name, e.last_name, e.phone,
             CAST(julianday(ed.expiry_date) - julianday('now', 'localtime') AS INTEGER) as days_until_expiry
      FROM employee_documents ed
      JOIN employees e ON ed.employee_id = e.id
      WHERE ed.expiry_date IS NOT NULL
      AND ed.expiry_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+14 days')
      ORDER BY ed.expiry_date
    `);

    if (result.rows.length === 0) return { processed: 0, details: 'No expiring documents' };

    console.log(`[CRON] Found ${result.rows.length} expiring documents`);

    const admins = query(`
      SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
    `);

    let summary = `התראת מסמכים שפגי תוקף! 📄⚠️\n\n`;
    for (const doc of result.rows) {
      summary += `• ${doc.first_name} ${doc.last_name} - ${doc.document_type}\n`;
      summary += `  פג תוקף בעוד ${doc.days_until_expiry} ימים (${doc.expiry_date})\n\n`;
    }
    summary += `צוות יהלום CRM`;

    let sent = 0;
    for (const admin of admins.rows) {
      await whatsappHelper.safeSend(admin.phone, summary);
      sent++;
      await this.delay(500);
    }

    for (const doc of result.rows) {
      if (doc.phone && doc.days_until_expiry <= 7) {
        const empMessage = `שלום ${doc.first_name}! 📋
תזכורת - המסמך "${doc.document_type}" שלך פג תוקף בתאריך ${doc.expiry_date}.
נא לחדש בהקדם.

צוות יהלום`;
        await whatsappHelper.safeSend(doc.phone, empMessage);
        sent++;
        await this.delay(1000);
      }
    }

    return { processed: result.rows.length, created: sent, details: `${result.rows.length} expiring documents, ${sent} notifications sent` };
  }

  /**
   * Check for expiring customer contracts
   */
  async checkExpiringContracts() {
    if (!whatsappHelper.isConfigured()) return { processed: 0, details: 'WhatsApp not configured' };

    const result = query(`
      SELECT cc.id, cc.end_date, cc.monthly_value,
             c.company_name,
             CAST(julianday(cc.end_date) - julianday('now', 'localtime') AS INTEGER) as days_until_expiry
      FROM customer_contracts cc
      JOIN customers c ON cc.customer_id = c.id
      WHERE cc.status = 'active'
      AND cc.end_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')
      ORDER BY cc.end_date
    `);

    if (result.rows.length === 0) return { processed: 0, details: 'No expiring contracts' };

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

    let sent = 0;
    for (const admin of admins.rows) {
      await whatsappHelper.safeSend(admin.phone, summary);
      sent++;
      await this.delay(500);
    }

    return { processed: result.rows.length, created: sent, details: `${result.rows.length} expiring contracts, ${sent} admins notified` };
  }

  /**
   * Check for upcoming events that are not fully staffed
   */
  async checkUnassignedEvents() {
    if (!whatsappHelper.isConfigured()) return { processed: 0, details: 'WhatsApp not configured' };

    const result = query(`
      SELECT e.id, e.event_name, e.event_date, e.start_time, e.location,
             e.required_guards,
             (SELECT COUNT(*) FROM event_assignments WHERE event_id = e.id) as assigned_count,
             c.company_name
      FROM events e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.event_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+3 days')
      AND e.status NOT IN ('completed', 'cancelled')
      AND (SELECT COUNT(*) FROM event_assignments WHERE event_id = e.id) < e.required_guards
      ORDER BY e.event_date, e.start_time
    `);

    if (result.rows.length === 0) return { processed: 0, details: 'All events fully staffed' };

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

    let sent = 0;
    for (const admin of admins.rows) {
      await whatsappHelper.safeSend(admin.phone, summary);
      sent++;
      await this.delay(500);
    }

    return { processed: result.rows.length, created: sent, details: `${result.rows.length} understaffed events, ${sent} admins notified` };
  }

  /**
   * Check for expiring guard certifications (next 14 days)
   */
  async checkExpiringCertifications() {
    if (!whatsappHelper.isConfigured()) return { processed: 0, details: 'WhatsApp not configured' };

    const result = query(`
      SELECT gc.id, gc.cert_type, gc.cert_name, gc.expiry_date,
             e.first_name, e.last_name, e.phone,
             CAST(julianday(gc.expiry_date) - julianday('now', 'localtime') AS INTEGER) as days_until_expiry
      FROM guard_certifications gc
      JOIN employees e ON gc.employee_id = e.id
      WHERE gc.expiry_date IS NOT NULL
      AND gc.status = 'active'
      AND gc.expiry_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+14 days')
      ORDER BY gc.expiry_date
    `);

    if (result.rows.length === 0) return { processed: 0, details: 'No expiring certifications' };

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

    let sent = 0;
    for (const admin of admins.rows) {
      await whatsappHelper.safeSend(admin.phone, summary);
      sent++;
      await this.delay(500);
    }

    for (const cert of result.rows) {
      if (cert.phone && cert.days_until_expiry <= 7) {
        const msg = `שלום ${cert.first_name}! 📋\nההסמכה "${cert.cert_name}" שלך פגה תוקף בתאריך ${cert.expiry_date}.\nנא לחדש בהקדם.\n\nצוות יהלום`;
        await whatsappHelper.safeSend(cert.phone, msg);
        sent++;
        await this.delay(1000);
      }
    }

    return { processed: result.rows.length, created: sent, details: `${result.rows.length} expiring certifications, ${sent} notifications sent` };
  }

  /**
   * Check for unresolved incidents (open > 48 hours)
   */
  async checkUnresolvedIncidents() {
    if (!whatsappHelper.isConfigured()) return { processed: 0, details: 'WhatsApp not configured' };

    const result = query(`
      SELECT i.id, i.title, i.severity, i.incident_type, i.incident_date, i.status,
             c.company_name, s.name as site_name,
             CAST(julianday('now', 'localtime') - julianday(i.created_at) AS INTEGER) as days_open
      FROM incidents i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN sites s ON i.site_id = s.id
      WHERE i.status IN ('open', 'investigating')
      AND i.created_at <= datetime('now', '-48 hours')
      ORDER BY i.severity DESC, i.created_at
    `);

    if (result.rows.length === 0) return { processed: 0, details: 'No unresolved incidents' };

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

    let sent = 0;
    for (const admin of admins.rows) {
      await whatsappHelper.safeSend(admin.phone, summary);
      sent++;
      await this.delay(500);
    }

    return { processed: result.rows.length, created: sent, details: `${result.rows.length} unresolved incidents, ${sent} admins notified` };
  }

  /**
   * Check for guard no-shows (shift started 15+ min ago, no check-in)
   */
  async checkGuardNoShows() {
    const result = query(`
      SELECT sa.id as assignment_id, sa.employee_id, sa.shift_id,
             e.first_name, e.last_name, e.phone,
             s.date, s.start_time, s.end_time,
             c.company_name, si.name as site_name, si.address as site_address
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE s.date = date('now', 'localtime')
      AND sa.status = 'assigned'
      AND sa.check_in_time IS NULL
      AND time('now', 'localtime') > time(s.start_time, '+15 minutes')
      AND time('now', 'localtime') < time(s.end_time)
    `);

    if (result.rows.length === 0) return { processed: 0, details: 'No guard no-shows' };

    console.log(`[CRON] Found ${result.rows.length} guard no-shows`);

    for (const ns of result.rows) {
      const admins = query(`SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = 1`);
      for (const admin of admins.rows) {
        const notifId = crypto.randomUUID();
        query(`
          INSERT INTO notifications (id, user_id, type, title, message, related_entity_type, related_entity_id)
          VALUES (?, ?, 'no_show', ?, ?, 'shift_assignment', ?)
        `, [notifId, admin.id,
            `אי הגעה: ${ns.first_name} ${ns.last_name}`,
            `${ns.first_name} ${ns.last_name} לא ביצע/ה צ'ק-אין למשמרת ${ns.start_time}-${ns.end_time} ב${ns.site_name || ns.company_name || 'אתר'}`,
            ns.assignment_id]);
      }

      query(`UPDATE shift_assignments SET status = 'no_show' WHERE id = ?`, [ns.assignment_id]);
    }

    if (!whatsappHelper.isConfigured()) {
      return { processed: result.rows.length, created: result.rows.length, details: `${result.rows.length} no-shows detected (WhatsApp not configured)` };
    }

    const admins = query(`
      SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
    `);

    let summary = `התראת אי-הגעה! 🚨\n\n`;
    for (const ns of result.rows) {
      summary += `• ${ns.first_name} ${ns.last_name}\n`;
      summary += `  ${ns.site_name || ns.company_name || 'משמרת'} | ${ns.start_time}-${ns.end_time}\n\n`;
    }
    summary += `סה"כ: ${result.rows.length} מאבטחים\nצוות יהלום CRM`;

    let sent = 0;
    for (const admin of admins.rows) {
      await whatsappHelper.safeSend(admin.phone, summary);
      sent++;
      await this.delay(500);
    }

    return { processed: result.rows.length, created: result.rows.length, details: `${result.rows.length} no-shows detected, ${sent} admins notified` };
  }

  /**
   * Cleanup old guard location data (older than 30 days)
   */
  async cleanupGuardLocations() {
    const result = query(`
      DELETE FROM guard_locations
      WHERE recorded_at < datetime('now', '-30 days')
    `);
    const deleted = result.rowCount || 0;
    console.log(`[CRON] Cleaned up ${deleted} old guard locations`);
    return { processed: deleted, created: 0, details: `Deleted ${deleted} old location records` };
  }

  /**
   * Auto-generate shifts from templates for next week
   */
  async autoGenerateShifts() {
    const autoShiftGenerator = require('./autoShiftGenerator');
    const nextSunday = autoShiftGenerator.getNextSunday();

    console.log(`[CRON] Auto-generating shifts for week starting ${nextSunday}`);
    const results = autoShiftGenerator.generateWeekShifts(nextSunday, null);

    console.log(`[CRON] Auto-shift results: created=${results.created}, skipped=${results.skipped}, errors=${results.errors.length}`);

    if (results.created > 0 && whatsappHelper.isConfigured()) {
      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      const message = `יצירת משמרות אוטומטית 🤖\n\nנוצרו ${results.created} משמרות לשבוע ${nextSunday}\n${results.skipped > 0 ? `דולגו: ${results.skipped} (כבר קיימות)\n` : ''}${results.errors.length > 0 ? `שגיאות: ${results.errors.length}\n` : ''}\nצוות יהלום CRM`;

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, message);
        await this.delay(500);
      }
    }

    return {
      processed: (results.created || 0) + (results.skipped || 0) + (results.errors?.length || 0),
      created: results.created || 0,
      skipped: results.skipped || 0,
      details: `Created ${results.created}, skipped ${results.skipped}, errors ${results.errors?.length || 0}`,
    };
  }

  /**
   * Auto-generate monthly invoices from contracts
   */
  async autoGenerateInvoices() {
    const autoInvoiceGenerator = require('./autoInvoiceGenerator');

    console.log('[CRON] Auto-generating monthly invoices');
    const results = autoInvoiceGenerator.generateMonthlyInvoices(null);

    console.log(`[CRON] Auto-invoice results: created=${results.created}, skipped=${results.skipped}, errors=${results.errors.length}`);

    if (results.created > 0 && whatsappHelper.isConfigured()) {
      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      const message = `חשבוניות אוטומטיות 🧾\n\nנוצרו ${results.created} חשבוניות טיוטה לחודש זה\n${results.skipped > 0 ? `דולגו: ${results.skipped} (כבר נוצרו)\n` : ''}${results.errors.length > 0 ? `שגיאות: ${results.errors.length}\n` : ''}\nכנס למערכת לאישור ושליחה.\nצוות יהלום CRM`;

      for (const admin of admins.rows) {
        await whatsappHelper.safeSend(admin.phone, message);
        await this.delay(500);
      }
    }

    return {
      processed: (results.created || 0) + (results.skipped || 0) + (results.errors?.length || 0),
      created: results.created || 0,
      skipped: results.skipped || 0,
      details: `Created ${results.created}, skipped ${results.skipped}, errors ${results.errors?.length || 0}`,
    };
  }

  // ── Utility ───────────────────────────────────────────────────────────

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    for (const [name, { cronJob }] of this.jobs) {
      cronJob.stop();
      console.log(`[CRON] Stopped: ${name}`);
    }
    for (const [name, timer] of this.retryTimers) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
  }

  /**
   * Get status of all jobs (legacy compatibility)
   */
  getStatus() {
    return Array.from(this.jobs.entries()).map(([name, { schedule }]) => ({
      name,
      schedule,
      active: true
    }));
  }
}

module.exports = new Scheduler();
