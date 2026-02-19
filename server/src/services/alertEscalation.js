/**
 * Alert Escalation Service
 * Checks for unread critical notifications that exceeded their escalation delay.
 * Escalates by sending WhatsApp messages to admin users and creating escalation records.
 */
const db = require('../config/database');
const crypto = require('crypto');

class AlertEscalation {
  /**
   * Check for notifications that need escalation.
   * Finds unread notifications where:
   * - created_at is older than escalation_delay_hours
   * - No existing escalation record for this notification
   * - The alert_config has escalation_delay_hours set
   */
  async checkEscalations() {
    const results = { checked: 0, escalated: 0, errors: [] };

    try {
      // Load alert configs with escalation settings
      const configs = db.query(`
        SELECT * FROM alert_config WHERE is_enabled = 1 AND escalation_delay_hours > 0
      `);

      for (const config of configs.rows) {
        try {
          // Find unread notifications older than escalation delay, not yet escalated
          const unescalated = db.query(`
            SELECT n.id, n.user_id, n.type, n.title, n.message, n.related_entity_type, n.related_entity_id, n.created_at
            FROM notifications n
            WHERE n.type = $1
            AND n.is_read = 0
            AND n.created_at < datetime('now', '-' || $2 || ' hours')
            AND NOT EXISTS (
              SELECT 1 FROM alert_escalations ae WHERE ae.notification_id = n.id
            )
          `, [config.alert_type, config.escalation_delay_hours]);

          results.checked += unescalated.rows.length;

          for (const notification of unescalated.rows) {
            try {
              await this._escalateNotification(config, notification);
              results.escalated++;
            } catch (err) {
              results.errors.push({
                notification_id: notification.id,
                error: err.message
              });
            }
          }
        } catch (err) {
          console.error(`[AlertEscalation] Failed to check ${config.alert_type}:`, err.message);
          results.errors.push({ alert_type: config.alert_type, error: err.message });
        }
      }
    } catch (err) {
      console.error('[AlertEscalation] checkEscalations failed:', err.message);
      results.errors.push({ error: err.message });
    }

    console.log('[AlertEscalation] Results:', JSON.stringify(results));
    return results;
  }

  /**
   * Escalate a single notification
   */
  async _escalateNotification(config, notification) {
    // 1. Create escalation record
    const escalationId = crypto.randomUUID();
    db.query(`
      INSERT INTO alert_escalations (id, notification_id, alert_type, escalation_level, escalated_at, escalated_to)
      VALUES ($1, $2, $3, 1, datetime('now'), 'admins')
    `, [escalationId, notification.id, config.alert_type]);

    // 2. Create a new escalated notification for all admin users
    const admins = db.query(`
      SELECT u.id, e.phone, e.first_name
      FROM users u
      LEFT JOIN employees e ON u.id = e.user_id
      WHERE u.role = 'admin' AND u.is_active = 1
    `);

    for (const admin of admins.rows) {
      const notifId = crypto.randomUUID();
      db.query(`
        INSERT INTO notifications (id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, datetime('now'))
      `, [
        notifId,
        admin.id,
        config.alert_type,
        `\u26A0\uFE0F אסקלציה: ${notification.title}`,
        `התראה שלא טופלה מעל ${config.escalation_delay_hours} שעות: ${notification.message}`,
        notification.related_entity_type,
        notification.related_entity_id
      ]);
    }

    // 3. Try to send WhatsApp to admin users with phones
    try {
      const whatsappService = require('./whatsapp');
      for (const admin of admins.rows) {
        if (admin.phone) {
          const waMessage = `\u26A0\uFE0F אסקלציה - ${config.display_name}\n${notification.title}\n${notification.message}\nהתראה לא טופלה מעל ${config.escalation_delay_hours} שעות.`;
          await whatsappService.sendMessage(admin.phone, waMessage, {
            context: 'alert_escalation',
            entityType: notification.related_entity_type,
            entityId: notification.related_entity_id
          });
        }
      }
    } catch (err) {
      // WhatsApp not configured or failed - that's OK, notification was still created
      console.warn('[AlertEscalation] WhatsApp send failed:', err.message);
    }
  }

  /**
   * Get recent escalations with details
   */
  getRecentEscalations(limit = 20) {
    try {
      const result = db.query(`
        SELECT ae.*, n.title as notification_title, n.message as notification_message,
               ac.display_name as alert_display_name
        FROM alert_escalations ae
        LEFT JOIN notifications n ON ae.notification_id = n.id
        LEFT JOIN alert_config ac ON ae.alert_type = ac.alert_type
        ORDER BY ae.escalated_at DESC
        LIMIT $1
      `, [limit]);
      return result.rows;
    } catch (e) {
      console.error('[AlertEscalation] getRecentEscalations failed:', e.message);
      return [];
    }
  }
}

module.exports = new AlertEscalation();
