/**
 * Predictive Alerts Service
 * Runs daily checks for expiring certifications, overworked employees,
 * unpaid invoices, expiring contracts, and weapon license expirations.
 * Creates in-app notifications for admin/manager users.
 */
const db = require('../config/database');
const crypto = require('crypto');

class PredictiveAlerts {
  /**
   * Run all predictive alert checks
   * Called daily by cron job
   */
  runAll() {
    const results = {
      certExpiring: this.checkExpiringCertifications(),
      overworked: this.checkOverworkedEmployees(),
      unpaidInvoices: this.checkUnpaidInvoices(),
      contractsExpiring: this.checkExpiringContracts(),
      weaponLicenseExpiring: this.checkWeaponLicenses(),
    };
    console.log('[PredictiveAlerts] Completed:', JSON.stringify(results));
    return results;
  }

  /**
   * Certifications expiring within 30 days
   */
  checkExpiringCertifications() {
    try {
      const expiring = db.query(`
        SELECT gc.id, gc.cert_type, gc.cert_name, gc.expiry_date, gc.employee_id,
               e.first_name || ' ' || e.last_name as employee_name
        FROM guard_certifications gc
        JOIN employees e ON gc.employee_id = e.id
        WHERE gc.expiry_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')
        AND gc.status = 'active'
        AND e.status = 'active'
      `);

      let created = 0;
      for (const cert of expiring.rows) {
        const daysLeft = Math.ceil((new Date(cert.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        // Check if notification already exists for this cert in last 7 days
        const existing = db.query(`
          SELECT id FROM notifications
          WHERE type = 'cert_expiry' AND related_entity_id = ?
          AND created_at >= datetime('now', '-7 days')
        `, [cert.id]);

        if (existing.rows.length === 0) {
          this._createNotification(
            'cert_expiry',
            `הסמכה פגת תוקף: ${cert.employee_name}`,
            `הסמכת ${cert.cert_name} של ${cert.employee_name} פגה בעוד ${daysLeft} ימים (${cert.expiry_date})`,
            'guard_certification',
            cert.id
          );
          created++;
        }
      }
      return { checked: expiring.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Cert check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Employees with >6 shifts this week
   */
  checkOverworkedEmployees() {
    try {
      const overworked = db.query(`
        SELECT sa.employee_id, e.first_name || ' ' || e.last_name as employee_name,
               COUNT(*) as shift_count
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN employees e ON sa.employee_id = e.id
        WHERE s.date BETWEEN date('now', 'localtime', 'weekday 0', '-7 days') AND date('now', 'localtime', 'weekday 0')
        AND e.status = 'active'
        GROUP BY sa.employee_id
        HAVING COUNT(*) > 6
      `);

      let created = 0;
      for (const emp of overworked.rows) {
        const existing = db.query(`
          SELECT id FROM notifications
          WHERE type = 'overwork_alert' AND related_entity_id = ?
          AND created_at >= datetime('now', '-7 days')
        `, [emp.employee_id]);

        if (existing.rows.length === 0) {
          this._createNotification(
            'overwork_alert',
            `עומס יתר: ${emp.employee_name}`,
            `${emp.employee_name} עם ${emp.shift_count} משמרות השבוע - עומס יתר!`,
            'employee',
            emp.employee_id
          );
          created++;
        }
      }
      return { checked: overworked.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Overwork check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Unpaid invoices >60 days
   */
  checkUnpaidInvoices() {
    try {
      const unpaid = db.query(`
        SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
               c.company_name,
               CAST(julianday('now', 'localtime') - julianday(i.due_date) AS INTEGER) as days_overdue
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'sent' AND i.due_date < date('now', 'localtime', '-60 days')
      `);

      let created = 0;
      for (const inv of unpaid.rows) {
        const existing = db.query(`
          SELECT id FROM notifications
          WHERE type = 'overdue_payment' AND related_entity_id = ?
          AND created_at >= datetime('now', '-7 days')
        `, [inv.id]);

        if (existing.rows.length === 0) {
          this._createNotification(
            'overdue_payment',
            `חשבונית באיחור: ${inv.company_name || 'לא ידוע'}`,
            `חשבונית ${inv.invoice_number || inv.id} של ${inv.company_name || 'לא ידוע'} - ${inv.total_amount} ש"ח באיחור ${inv.days_overdue} ימים`,
            'invoice',
            inv.id
          );
          created++;
        }
      }
      return { checked: unpaid.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Unpaid check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Contracts expiring in 30 days
   */
  checkExpiringContracts() {
    try {
      const expiring = db.query(`
        SELECT ct.id, ct.end_date, ct.monthly_value,
               c.company_name
        FROM contracts ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.status = 'active'
        AND ct.end_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')
      `);

      let created = 0;
      for (const contract of expiring.rows) {
        const daysLeft = Math.ceil((new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24));
        const existing = db.query(`
          SELECT id FROM notifications
          WHERE type = 'contract_expiry' AND related_entity_id = ?
          AND created_at >= datetime('now', '-7 days')
        `, [contract.id]);

        if (existing.rows.length === 0) {
          this._createNotification(
            'contract_expiry',
            `חוזה מסתיים: ${contract.company_name}`,
            `חוזה של ${contract.company_name} (${contract.monthly_value || 0} ש"ח/חודש) מסתיים בעוד ${daysLeft} ימים`,
            'contract',
            contract.id
          );
          created++;
        }
      }
      return { checked: expiring.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Contract check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Weapon licenses expiring in 30 days
   */
  checkWeaponLicenses() {
    try {
      const expiring = db.query(`
        SELECT e.id, e.first_name || ' ' || e.last_name as employee_name,
               e.weapon_license_expiry
        FROM employees e
        WHERE e.status = 'active' AND e.has_weapon_license = 1
        AND e.weapon_license_expiry BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')
      `);

      let created = 0;
      for (const emp of expiring.rows) {
        const daysLeft = Math.ceil((new Date(emp.weapon_license_expiry) - new Date()) / (1000 * 60 * 60 * 24));
        const existing = db.query(`
          SELECT id FROM notifications
          WHERE type = 'weapon_license_expiry' AND related_entity_id = ?
          AND created_at >= datetime('now', '-7 days')
        `, [emp.id]);

        if (existing.rows.length === 0) {
          this._createNotification(
            'weapon_license_expiry',
            `רישיון נשק פג: ${emp.employee_name}`,
            `רישיון נשק של ${emp.employee_name} פג בעוד ${daysLeft} ימים (${emp.weapon_license_expiry})`,
            'employee',
            emp.id
          );
          created++;
        }
      }
      return { checked: expiring.rows.length, created };
    } catch (e) {
      console.error('[PredictiveAlerts] Weapon license check failed:', e.message);
      return { error: e.message };
    }
  }

  /**
   * Create notification for all admin/manager users
   * Uses the actual notifications table schema:
   * (id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
   */
  _createNotification(type, title, message, relatedEntityType, relatedEntityId) {
    try {
      const managers = db.query(`
        SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = 1
      `);
      for (const user of managers.rows) {
        const id = crypto.randomUUID();
        db.query(`
          INSERT INTO notifications (id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
        `, [id, user.id, type, title, message, relatedEntityType, relatedEntityId]);
      }
    } catch (e) {
      console.error('[PredictiveAlerts] Failed to create notification:', e.message);
    }
  }
}

module.exports = new PredictiveAlerts();
