const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const autoShiftGenerator = require('../services/autoShiftGenerator');
const holidayService = require('../services/holidayService');
const db = require('../config/database');

const router = express.Router();
router.use(authenticateToken);

// Get automation status and logs
router.get('/status', requireManager, async (req, res) => {
  try {
    // Count auto-generate templates
    const templates = db.query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN auto_generate = 1 THEN 1 ELSE 0 END) as auto_enabled
      FROM shift_templates WHERE is_active = 1
    `);

    // Recent generation logs
    const logs = db.query(`
      SELECT * FROM auto_generation_log
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      templates: templates.rows[0],
      recentLogs: logs.rows
    });
  } catch (error) {
    console.error('Automation status error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטוס אוטומציה' });
  }
});

// Manually trigger auto-shift generation
router.post('/generate-shifts', requireManager, async (req, res) => {
  try {
    const { week_start } = req.body;
    const targetWeek = week_start || autoShiftGenerator.getNextSunday();

    const results = autoShiftGenerator.generateWeekShifts(targetWeek, req.user.id);

    res.json({
      message: `נוצרו ${results.created} משמרות אוטומטית`,
      ...results,
      week_start: targetWeek
    });
  } catch (error) {
    console.error('Manual shift generation error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משמרות אוטומטית' });
  }
});

// Generate shifts from specific template
router.post('/generate-from-template/:templateId', requireManager, async (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    if (!start_date) {
      return res.status(400).json({ error: 'נדרש תאריך התחלה' });
    }

    const template = db.query('SELECT * FROM shift_templates WHERE id = $1', [req.params.templateId]);
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }

    const result = autoShiftGenerator.generateFromTemplate(
      template.rows[0],
      start_date,
      req.user.id
    );

    res.json({
      message: `נוצרו ${result.created} משמרות מתבנית`,
      ...result
    });
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משמרות מתבנית' });
  }
});

// Get generation logs
router.get('/logs', requireManager, async (req, res) => {
  try {
    const { type, limit = 50 } = req.query;
    let whereClause = '1=1';
    const params = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      whereClause += ` AND type = $${paramCount}`;
      params.push(type);
    }

    paramCount++;
    params.push(limit);

    const result = db.query(`
      SELECT agl.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM auto_generation_log agl
      LEFT JOIN users u ON agl.created_by = u.id
      WHERE ${whereClause}
      ORDER BY agl.created_at DESC
      LIMIT $${paramCount}
    `, params);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get automation logs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת לוגים' });
  }
});

// ===== Automation Dashboard v2 - Job Management =====

const scheduler = require('../services/scheduler');

// GET /api/automation/jobs - List all jobs with status from automation_config
router.get('/jobs', requireManager, async (req, res) => {
  try {
    const jobs = scheduler.getAllJobStatuses();
    res.json({ jobs });
  } catch (error) {
    console.error('Get automation jobs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת משימות אוטומציה' });
  }
});

// PATCH /api/automation/jobs/:name - Toggle enable/disable, update schedule
router.patch('/jobs/:name', requireManager, async (req, res) => {
  try {
    const { name } = req.params;
    const { is_enabled, cron_schedule } = req.body;

    if (is_enabled !== undefined) {
      if (is_enabled) {
        scheduler.resumeJob(name);
      } else {
        scheduler.pauseJob(name);
      }
    }

    if (cron_schedule) {
      const result = scheduler.updateJobSchedule(name, cron_schedule);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
    }

    const status = scheduler.getJobStatus(name);
    if (!status) {
      return res.status(404).json({ error: 'משימה לא נמצאה' });
    }

    res.json(status);
  } catch (error) {
    console.error('Update automation job error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון משימה' });
  }
});

// POST /api/automation/jobs/:name/run - Manual trigger for any job
router.post('/jobs/:name/run', requireManager, async (req, res) => {
  try {
    const { name } = req.params;
    const result = await scheduler.triggerJob(name);

    if (result.success) {
      res.json({
        message: result.message,
        duration: result.duration,
        counts: result.counts,
        details: result.details,
      });
    } else {
      res.status(result.error ? 500 : 404).json({
        error: result.message,
      });
    }
  } catch (error) {
    console.error('Trigger automation job error:', error);
    res.status(500).json({ error: 'שגיאה בהפעלת משימה' });
  }
});

// GET /api/automation/jobs/:name/logs - Logs for specific job
router.get('/jobs/:name/logs', requireManager, async (req, res) => {
  try {
    const { name } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const result = db.query(`
      SELECT * FROM automation_run_log
      WHERE job_name = $1
      ORDER BY started_at DESC
      LIMIT $2
    `, [name, limit]);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get job logs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת לוגים' });
  }
});

// GET /api/automation/runs - Recent run logs (all jobs), with ?limit and ?status filters
router.get('/runs', requireManager, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;
    const job_name = req.query.job_name;

    let whereClause = '1=1';
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND arl.status = $${paramCount}`;
      params.push(status);
    }

    if (job_name) {
      paramCount++;
      whereClause += ` AND arl.job_name = $${paramCount}`;
      params.push(job_name);
    }

    paramCount++;
    params.push(limit);

    const result = db.query(`
      SELECT arl.*, ac.display_name, ac.category
      FROM automation_run_log arl
      LEFT JOIN automation_config ac ON arl.job_name = ac.job_name
      WHERE ${whereClause}
      ORDER BY arl.started_at DESC
      LIMIT $${paramCount}
    `, params);

    res.json({ runs: result.rows });
  } catch (error) {
    console.error('Get automation runs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת היסטוריית ריצות' });
  }
});

// GET /api/automation/stats - Aggregate stats: success rate, total runs, avg items
router.get('/stats', requireManager, async (req, res) => {
  try {
    // Total runs by period
    const todayRuns = db.query(`
      SELECT COUNT(*) as count,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM automation_run_log
      WHERE started_at >= date('now', 'localtime')
    `);

    const weekRuns = db.query(`
      SELECT COUNT(*) as count,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM automation_run_log
      WHERE started_at >= date('now', 'localtime', '-7 days')
    `);

    const monthRuns = db.query(`
      SELECT COUNT(*) as count,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
             SUM(items_processed) as total_processed,
             SUM(items_created) as total_created
      FROM automation_run_log
      WHERE started_at >= date('now', 'localtime', '-30 days')
    `);

    // Success rate
    const totalMonth = monthRuns.rows[0]?.count || 0;
    const successMonth = monthRuns.rows[0]?.success_count || 0;
    const successRate = totalMonth > 0 ? Math.round((successMonth / totalMonth) * 100) : 100;

    // Most active job
    const mostActive = db.query(`
      SELECT job_name, COUNT(*) as run_count, ac.display_name
      FROM automation_run_log arl
      LEFT JOIN automation_config ac ON arl.job_name = ac.job_name
      WHERE arl.started_at >= date('now', 'localtime', '-30 days')
      GROUP BY arl.job_name
      ORDER BY run_count DESC
      LIMIT 1
    `);

    // Most failed job
    const mostFailed = db.query(`
      SELECT job_name, COUNT(*) as fail_count, ac.display_name
      FROM automation_run_log arl
      LEFT JOIN automation_config ac ON arl.job_name = ac.job_name
      WHERE arl.status = 'failed' AND arl.started_at >= date('now', 'localtime', '-30 days')
      GROUP BY arl.job_name
      ORDER BY fail_count DESC
      LIMIT 1
    `);

    // Runs over time (last 14 days)
    const runsOverTime = db.query(`
      SELECT date(started_at) as day,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM automation_run_log
      WHERE started_at >= date('now', 'localtime', '-14 days')
      GROUP BY date(started_at)
      ORDER BY day
    `);

    // Enabled/disabled counts
    const jobCounts = db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN is_enabled = 0 THEN 1 ELSE 0 END) as disabled
      FROM automation_config
    `);

    res.json({
      today: todayRuns.rows[0] || {},
      week: weekRuns.rows[0] || {},
      month: monthRuns.rows[0] || {},
      successRate,
      mostActive: mostActive.rows[0] || null,
      mostFailed: mostFailed.rows[0] || null,
      runsOverTime: runsOverTime.rows,
      jobCounts: jobCounts.rows[0] || {},
    });
  } catch (error) {
    console.error('Get automation stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

// ===== Invoice Automation v2 =====

// Preview monthly invoices (dry-run - no database changes)
router.post('/invoices/preview', requireManager, async (req, res) => {
  try {
    const autoInvoiceGenerator = require('../services/autoInvoiceGenerator');
    const previews = autoInvoiceGenerator.previewMonthlyInvoices();
    res.json({ invoices: previews });
  } catch (error) {
    console.error('Invoice preview error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת תצוגה מקדימה' });
  }
});

// Generate invoices for selected contracts only
router.post('/invoices/generate-selected', requireManager, async (req, res) => {
  try {
    const { contract_ids } = req.body;
    if (!contract_ids || !Array.isArray(contract_ids) || contract_ids.length === 0) {
      return res.status(400).json({ error: 'נדרשים מזהי חוזים' });
    }
    const autoInvoiceGenerator = require('../services/autoInvoiceGenerator');
    const results = autoInvoiceGenerator.generateMonthlyInvoices(req.user.id, contract_ids);
    res.json({
      message: `נוצרו ${results.created} חשבוניות טיוטה`,
      ...results
    });
  } catch (error) {
    console.error('Selected invoice generation error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת חשבוניות נבחרות' });
  }
});

// Get system invoice config (VAT, payment days)
router.get('/invoice-config', requireManager, async (req, res) => {
  try {
    const result = db.query('SELECT key, value, description FROM system_config');
    const config = {};
    for (const row of result.rows) {
      config[row.key] = { value: row.value, description: row.description };
    }
    res.json(config);
  } catch (error) {
    console.error('Get invoice config error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הגדרות חשבוניות' });
  }
});

// Update system invoice config
router.patch('/invoice-config', requireManager, async (req, res) => {
  try {
    const autoInvoiceGenerator = require('../services/autoInvoiceGenerator');
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string' || typeof value === 'number') {
        autoInvoiceGenerator.updateSystemConfig(key, String(value));
      }
    }

    res.json({ message: 'הגדרות עודכנו בהצלחה' });
  } catch (error) {
    console.error('Update invoice config error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הגדרות חשבוניות' });
  }
});

// ===== Calendar Exceptions (Holidays / Blackouts) =====

// Get upcoming exceptions (must be before /:id route)
router.get('/calendar-exceptions/upcoming', requireManager, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const exceptions = holidayService.getUpcoming(days);
    res.json({ exceptions });
  } catch (error) {
    console.error('Get upcoming exceptions error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת חגים קרובים' });
  }
});

// List all calendar exceptions (with optional ?year filter)
router.get('/calendar-exceptions', requireManager, async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    const exceptions = holidayService.getAll(year);
    res.json({ exceptions });
  } catch (error) {
    console.error('Get calendar exceptions error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת חריגים' });
  }
});

// Create a new calendar exception
router.post('/calendar-exceptions', requireManager, async (req, res) => {
  try {
    const { date, exception_type, name, affects, action, modifier, notes, recurring } = req.body;
    if (!date || !exception_type || !name) {
      return res.status(400).json({ error: 'נדרש תאריך, סוג וכותרת' });
    }
    const exception = holidayService.create({
      date, exception_type, name, affects, action, modifier, notes, recurring
    });
    res.status(201).json(exception);
  } catch (error) {
    console.error('Create calendar exception error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת חריג' });
  }
});

// Update a calendar exception
router.put('/calendar-exceptions/:id', requireManager, async (req, res) => {
  try {
    const { date, exception_type, name, affects, action, modifier, notes, recurring } = req.body;
    if (!date || !exception_type || !name) {
      return res.status(400).json({ error: 'נדרש תאריך, סוג וכותרת' });
    }
    const exception = holidayService.update(req.params.id, {
      date, exception_type, name, affects, action, modifier, notes, recurring
    });
    if (!exception) {
      return res.status(404).json({ error: 'חריג לא נמצא' });
    }
    res.json(exception);
  } catch (error) {
    console.error('Update calendar exception error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון חריג' });
  }
});

// Delete a calendar exception
router.delete('/calendar-exceptions/:id', requireManager, async (req, res) => {
  try {
    const deleted = holidayService.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'חריג לא נמצא' });
    }
    res.json({ message: 'חריג נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete calendar exception error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת חריג' });
  }
});

// ===== Smart Alert Engine Routes =====

const alertEscalation = require('../services/alertEscalation');
const crypto = require('crypto');

// GET /api/automation/alerts/config - List all alert configurations
router.get('/alerts/config', requireManager, async (req, res) => {
  try {
    const result = db.query('SELECT * FROM alert_config ORDER BY alert_type');
    res.json({ configs: result.rows });
  } catch (error) {
    console.error('Get alert config error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הגדרות התראות' });
  }
});

// PATCH /api/automation/alerts/config/:type - Update alert config thresholds, enable/disable
router.patch('/alerts/config/:type', requireManager, async (req, res) => {
  try {
    const { type } = req.params;
    const {
      is_enabled,
      threshold_value,
      warning_threshold,
      critical_threshold,
      dedup_hours,
      escalation_delay_hours,
      channels
    } = req.body;

    // Check config exists
    const existing = db.query('SELECT * FROM alert_config WHERE alert_type = $1', [type]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'סוג התראה לא נמצא' });
    }

    // Build update dynamically
    const updates = [];
    const params = [];
    let paramIdx = 0;

    if (is_enabled !== undefined) {
      paramIdx++;
      updates.push(`is_enabled = $${paramIdx}`);
      params.push(is_enabled ? 1 : 0);
    }
    if (threshold_value !== undefined) {
      paramIdx++;
      updates.push(`threshold_value = $${paramIdx}`);
      params.push(threshold_value);
    }
    if (warning_threshold !== undefined) {
      paramIdx++;
      updates.push(`warning_threshold = $${paramIdx}`);
      params.push(warning_threshold);
    }
    if (critical_threshold !== undefined) {
      paramIdx++;
      updates.push(`critical_threshold = $${paramIdx}`);
      params.push(critical_threshold);
    }
    if (dedup_hours !== undefined) {
      paramIdx++;
      updates.push(`dedup_hours = $${paramIdx}`);
      params.push(dedup_hours);
    }
    if (escalation_delay_hours !== undefined) {
      paramIdx++;
      updates.push(`escalation_delay_hours = $${paramIdx}`);
      params.push(escalation_delay_hours);
    }
    if (channels !== undefined) {
      paramIdx++;
      updates.push(`channels = $${paramIdx}`);
      params.push(typeof channels === 'string' ? channels : JSON.stringify(channels));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'לא סופקו שדות לעדכון' });
    }

    paramIdx++;
    updates.push(`updated_at = datetime('now')`);
    params.push(type);

    db.query(`
      UPDATE alert_config SET ${updates.join(', ')} WHERE alert_type = $${paramIdx}
    `, params);

    // Return updated config
    const updated = db.query('SELECT * FROM alert_config WHERE alert_type = $1', [type]);
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Update alert config error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הגדרות התראה' });
  }
});

// POST /api/automation/alerts/mute - Mute an alert
router.post('/alerts/mute', async (req, res) => {
  try {
    const { alert_type, related_entity_type, related_entity_id, muted_until, reason } = req.body;
    const userId = req.user.id;

    if (!alert_type) {
      return res.status(400).json({ error: 'נדרש סוג התראה' });
    }

    const id = crypto.randomUUID();
    db.query(`
      INSERT INTO alert_mutes (id, user_id, alert_type, related_entity_type, related_entity_id, muted_until, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, datetime('now'))
    `, [id, userId, alert_type, related_entity_type || null, related_entity_id || null, muted_until || null, reason || null]);

    res.status(201).json({ id, message: 'התראה הושתקה בהצלחה' });
  } catch (error) {
    console.error('Mute alert error:', error);
    res.status(500).json({ error: 'שגיאה בהשתקת התראה' });
  }
});

// DELETE /api/automation/alerts/mute/:id - Unmute an alert
router.delete('/alerts/mute/:id', async (req, res) => {
  try {
    const result = db.query('DELETE FROM alert_mutes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'השתקה לא נמצאה' });
    }
    res.json({ message: 'ביטול השתקה בוצע בהצלחה' });
  } catch (error) {
    console.error('Unmute alert error:', error);
    res.status(500).json({ error: 'שגיאה בביטול השתקה' });
  }
});

// GET /api/automation/alerts/mutes - List active mutes for current user
router.get('/alerts/mutes', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = db.query(`
      SELECT am.*, ac.display_name as alert_display_name
      FROM alert_mutes am
      LEFT JOIN alert_config ac ON am.alert_type = ac.alert_type
      WHERE am.user_id = $1
      AND (am.muted_until IS NULL OR am.muted_until > datetime('now'))
      ORDER BY am.created_at DESC
    `, [userId]);
    res.json({ mutes: result.rows });
  } catch (error) {
    console.error('Get mutes error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת השתקות' });
  }
});

// GET /api/automation/alerts/escalations - List recent escalations
router.get('/alerts/escalations', requireManager, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const escalations = alertEscalation.getRecentEscalations(limit);
    res.json({ escalations });
  } catch (error) {
    console.error('Get escalations error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אסקלציות' });
  }
});

// ===== Shift Intelligence Routes =====

const shiftIntelligence = require('../services/shiftIntelligence');

// Get shortage patterns
router.get('/intelligence/shortages', requireManager, async (req, res) => {
  try {
    const patterns = shiftIntelligence.detectShortagePatterns();
    res.json({ shortages: patterns });
  } catch (error) {
    console.error('Intelligence shortages error:', error);
    res.status(500).json({ error: 'שגיאה בניתוח מחסורים' });
  }
});

// Get fatigue risk report
router.get('/intelligence/fatigue', requireManager, async (req, res) => {
  try {
    const risks = shiftIntelligence.analyzeFatigueRisk();
    res.json({ fatigue: risks });
  } catch (error) {
    console.error('Intelligence fatigue error:', error);
    res.status(500).json({ error: 'שגיאה בניתוח עייפות' });
  }
});

// Get optimal staffing suggestions
router.get('/intelligence/staffing', requireManager, async (req, res) => {
  try {
    const siteId = req.query.site_id || null;
    const suggestions = shiftIntelligence.suggestOptimalStaffing(siteId);
    res.json({ staffing: suggestions });
  } catch (error) {
    console.error('Intelligence staffing error:', error);
    res.status(500).json({ error: 'שגיאה בחישוב אופטימיזציה' });
  }
});

// Get latest weekly insights
router.get('/intelligence/insights', requireManager, async (req, res) => {
  try {
    const insights = shiftIntelligence.getLatestInsights();
    res.json({ insights });
  } catch (error) {
    console.error('Intelligence insights error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ניתוח שבועי' });
  }
});

// Manually trigger insight generation
router.post('/intelligence/generate', requireManager, async (req, res) => {
  try {
    const insights = shiftIntelligence.generateWeeklyInsights();
    res.json({
      message: 'ניתוח שבועי חולל בהצלחה',
      insights
    });
  } catch (error) {
    console.error('Intelligence generate error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת ניתוח שבועי' });
  }
});

// Get shortage heatmap data
router.get('/intelligence/heatmap', requireManager, async (req, res) => {
  try {
    const heatmap = shiftIntelligence.getShortageHeatmap();
    res.json({ heatmap });
  } catch (error) {
    console.error('Intelligence heatmap error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת מפת חום' });
  }
});

module.exports = router;
