/**
 * Predictive Alerts Service (Smart Alert Engine)
 * Runs daily checks for expiring certifications, overworked employees,
 * unpaid invoices, expiring contracts, and weapon license expirations.
 *
 * Uses configurable thresholds from alert_config table.
 * Supports alert muting, severity levels, and configurable dedup windows.
 */
const db = require('../config/database');
const crypto = require('crypto');

class PredictiveAlerts {
  /**
   * Load all alert configurations from database
   */
  _loadAlertConfigs() {
    try {
      const result = db.query('SELECT * FROM alert_config ORDER BY alert_type');
      return result.rows;
    } catch (e) {
      console.error('[PredictiveAlerts] Failed to load alert configs:', e.message);
      return [];
    }
  }

  /**
   * Check if an alert is muted for a specific user + entity
   */
  _isAlertMuted(userId, alertType, entityType, entityId) {
    try {
      const result = db.query(`
        SELECT id FROM alert_mutes
        WHERE user_id = $1
        AND (alert_type = $2 OR alert_type IS NULL)
        AND (
          (related_entity_type = $3 AND related_entity_id = $4)
          OR (related_entity_type IS NULL AND related_entity_id IS NULL)
        )
        AND (muted_until IS NULL OR muted_until > datetime('now'))
      `, [userId, alertType, entityType, entityId]);
      return result.rows.length > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Determine severity based on config thresholds
   * For "days" type: value is days remaining (lower = more critical)
   * For "count" type: value is count (higher = more critical)
   */
  _determineSeverity(config, value) {
    if (config.threshold_unit === 'count') {
      // Higher value = worse (e.g., more shifts)
      if (config.critical_threshold && value >= config.critical_threshold) return 'critical';
      if (config.warning_threshold && value >= config.warning_threshold) return 'warning';
      return 'info';
    } else {
      // Lower days remaining = worse
      if (config.critical_threshold && value <= config.critical_threshold) return 'critical';
      if (config.warning_threshold && value <= config.warning_threshold) return 'warning';
      return 'info';
    }
  }

  /**
   * Get severity prefix emoji
   */
  _severityPrefix(severity) {
    switch (severity) {
      case 'critical': return '\uD83D\uDD34'; // red circle
      case 'warning': return '\uD83D\uDFE1';  // yellow circle
      default: return '\u2139\uFE0F';          // info
    }
  }

  /**
   * Create notification with severity, checking mutes and dedup
   */
  _createAlertNotification(config, userId, title, message, entityType, entityId, severity) {
    try {
      // Check if muted for this user
      if (this._isAlertMuted(userId, config.alert_type, entityType, entityId)) {
        return false;
      }

      const prefix = this._severityPrefix(severity);
      const prefixedTitle = `${prefix} ${title}`;

      const id = crypto.randomUUID();
      db.query(`
        INSERT INTO notifications (id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
      `, [id, userId, config.alert_type, prefixedTitle, message, entityType, entityId]);
      return true;
    } catch (e) {
      console.error('[PredictiveAlerts] Failed to create notification:', e.message);
      return false;
    }
  }

  /**
   * Create notification for all admin/manager users, with mute checking
   */
  _notifyManagers(config, title, message, entityType, entityId, severity) {
    try {
      const managers = db.query(`
        SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = 1
      `);
      let created = 0;
      for (const user of managers.rows) {
        const wasCreated = this._createAlertNotification(config, user.id, title, message, entityType, entityId, severity);
        if (wasCreated) created++;
      }
      return created;
    } catch (e) {
      console.error('[PredictiveAlerts] Failed to notify managers:', e.message);
      return 0;
    }
  }

  /**
   * Check dedup: has a notification of this type+entity been created within dedup_hours?
   */
  _isDuplicate(config, entityId) {
    try {
      const dedupHours = config.dedup_hours || 168;
      const result = db.query(`
        SELECT id FROM notifications
        WHERE type = $1 AND related_entity_id = $2
        AND created_at >= datetime('now', '-' || $3 || ' hours')
      `, [config.alert_type, entityId, dedupHours]);
      return result.rows.length > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Run all predictive alert checks
   * Called daily by cron job
   */
  runAll() {
    const configs = this._loadAlertConfigs();
    const results = {};

    // Map alert_type to check method names
    const checkMap = {
      'cert_expiry': '_check_cert_expiry',
      'overwork': '_check_overwork',
      'unpaid_invoices': '_check_unpaid_invoices',
      'contract_expiry': '_check_contract_expiry',
      'weapon_license': '_check_weapon_license',
    };

    for (const config of configs) {
      if (!config.is_enabled) {
        results[config.alert_type] = { skipped: true, reason: 'disabled' };
        continue;
      }

      const methodName = checkMap[config.alert_type];
      if (methodName && typeof this[methodName] === 'function') {
        try {
          results[config.alert_type] = this[methodName](config);
        } catch (err) {
          console.error(`[PredictiveAlerts] Alert check failed: ${config.alert_type}`, err);
          results[config.alert_type] = { error: err.message };
        }
      }
    }

    console.log('[PredictiveAlerts] Completed:', JSON.stringify(results));
    return results;
  }

  /**
   * Certifications expiring within threshold days
   */
  _check_cert_expiry(config) {
    try {
      const thresholdDays = Math.round(config.threshold_value);
      const expiring = db.query(`
        SELECT gc.id, gc.cert_type, gc.cert_name, gc.expiry_date, gc.employee_id,
               e.first_name || ' ' || e.last_name as employee_name
        FROM guard_certifications gc
        JOIN employees e ON gc.employee_id = e.id
        WHERE gc.expiry_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+${thresholdDays} days')
        AND gc.status = 'active'
        AND e.status = 'active'
      `);

      let created = 0;
      for (const cert of expiring.rows) {
        const daysLeft = Math.ceil((new Date(cert.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));

        // Check dedup
        if (this._isDuplicate(config, cert.id)) continue;

        const severity = this._determineSeverity(config, daysLeft);
        const notified = this._notifyManagers(
          config,
          `הסמכה פגת תוקף: ${cert.employee_name}`,
          `הסמכת ${cert.cert_name} של ${cert.employee_name} פגה בעוד ${daysLeft} ימים (${cert.expiry_date})`,
          'guard_certification',
          cert.id,
          severity
        );
        if (notified > 0) created++;
      }
      return { checked: expiring.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Cert check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Employees with more than threshold shifts this week
   */
  _check_overwork(config) {
    try {
      const thresholdCount = Math.round(config.threshold_value);
      const overworked = db.query(`
        SELECT sa.employee_id, e.first_name || ' ' || e.last_name as employee_name,
               COUNT(*) as shift_count
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN employees e ON sa.employee_id = e.id
        WHERE s.date BETWEEN date('now', 'localtime', 'weekday 0', '-7 days') AND date('now', 'localtime', 'weekday 0')
        AND e.status = 'active'
        GROUP BY sa.employee_id
        HAVING COUNT(*) > ${thresholdCount}
      `);

      let created = 0;
      for (const emp of overworked.rows) {
        // Check dedup
        if (this._isDuplicate(config, emp.employee_id)) continue;

        const severity = this._determineSeverity(config, emp.shift_count);
        const notified = this._notifyManagers(
          config,
          `עומס יתר: ${emp.employee_name}`,
          `${emp.employee_name} עם ${emp.shift_count} משמרות השבוע - עומס יתר!`,
          'employee',
          emp.employee_id,
          severity
        );
        if (notified > 0) created++;
      }
      return { checked: overworked.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Overwork check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Unpaid invoices past threshold days overdue
   */
  _check_unpaid_invoices(config) {
    try {
      const thresholdDays = Math.round(config.threshold_value);
      const unpaid = db.query(`
        SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
               c.company_name,
               CAST(julianday('now', 'localtime') - julianday(i.due_date) AS INTEGER) as days_overdue
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'sent' AND i.due_date < date('now', 'localtime', '-${thresholdDays} days')
      `);

      let created = 0;
      for (const inv of unpaid.rows) {
        // Check dedup
        if (this._isDuplicate(config, inv.id)) continue;

        const severity = this._determineSeverity(config, inv.days_overdue);
        const notified = this._notifyManagers(
          config,
          `חשבונית באיחור: ${inv.company_name || 'לא ידוע'}`,
          `חשבונית ${inv.invoice_number || inv.id} של ${inv.company_name || 'לא ידוע'} - ${inv.total_amount} ש"ח באיחור ${inv.days_overdue} ימים`,
          'invoice',
          inv.id,
          severity
        );
        if (notified > 0) created++;
      }
      return { checked: unpaid.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Unpaid check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Contracts expiring within threshold days
   */
  _check_contract_expiry(config) {
    try {
      const thresholdDays = Math.round(config.threshold_value);
      const expiring = db.query(`
        SELECT ct.id, ct.end_date, ct.monthly_value,
               c.company_name
        FROM contracts ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.status = 'active'
        AND ct.end_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+${thresholdDays} days')
      `);

      let created = 0;
      for (const contract of expiring.rows) {
        const daysLeft = Math.ceil((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24));

        // Check dedup
        if (this._isDuplicate(config, contract.id)) continue;

        const severity = this._determineSeverity(config, daysLeft);
        const notified = this._notifyManagers(
          config,
          `חוזה מסתיים: ${contract.company_name}`,
          `חוזה של ${contract.company_name} (${contract.monthly_value || 0} ש"ח/חודש) מסתיים בעוד ${daysLeft} ימים`,
          'contract',
          contract.id,
          severity
        );
        if (notified > 0) created++;
      }
      return { checked: expiring.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Contract check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Weapon licenses expiring within threshold days
   */
  _check_weapon_license(config) {
    try {
      const thresholdDays = Math.round(config.threshold_value);
      const expiring = db.query(`
        SELECT e.id, e.first_name || ' ' || e.last_name as employee_name,
               e.weapon_license_expiry
        FROM employees e
        WHERE e.status = 'active' AND e.has_weapon_license = 1
        AND e.weapon_license_expiry BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+${thresholdDays} days')
      `);

      let created = 0;
      for (const emp of expiring.rows) {
        const daysLeft = Math.ceil((new Date(emp.weapon_license_expiry) - new Date()) / (1000 * 60 * 60 * 24));

        // Check dedup
        if (this._isDuplicate(config, emp.id)) continue;

        const severity = this._determineSeverity(config, daysLeft);
        const notified = this._notifyManagers(
          config,
          `רישיון נשק פג: ${emp.employee_name}`,
          `רישיון נשק של ${emp.employee_name} פג בעוד ${daysLeft} ימים (${emp.weapon_license_expiry})`,
          'employee',
          emp.id,
          severity
        );
        if (notified > 0) created++;
      }
      return { checked: expiring.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Weapon license check failed:', e.message);
      return { error: e.message };
    }
  }
}

module.exports = new PredictiveAlerts();
