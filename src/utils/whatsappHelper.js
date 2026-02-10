/**
 * WhatsApp Helper - Safe wrapper for sending WhatsApp messages
 * Failures are logged but never break the main flow
 */
const whatsappService = require('../services/whatsapp');
const { query, generateUUID } = require('../config/database');

class WhatsAppHelper {
  /**
   * Check if WhatsApp is configured
   */
  isConfigured() {
    try {
      const settings = query(`SELECT whatsapp_phone_id, whatsapp_access_token FROM integration_settings WHERE id = 'main'`);
      if (settings.rows.length === 0) return false;
      const s = settings.rows[0];
      return !!(s.whatsapp_phone_id && s.whatsapp_access_token);
    } catch {
      return false;
    }
  }

  /**
   * Load WhatsApp credentials from DB and update service
   */
  loadCredentials() {
    try {
      const settings = query(`SELECT * FROM integration_settings WHERE id = 'main'`);
      if (settings.rows.length > 0) {
        const s = settings.rows[0];
        if (s.whatsapp_phone_id) {
          whatsappService.phoneNumberId = s.whatsapp_phone_id;
          whatsappService.accessToken = s.whatsapp_access_token;
          whatsappService.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Safe send - never throws, always logs
   */
  async safeSend(to, message) {
    try {
      if (!this.loadCredentials()) return null;
      const result = await whatsappService.sendMessage(to, message);
      if (result.success) {
        console.log(`WhatsApp sent to ${to}`);
      } else {
        console.warn(`WhatsApp send failed to ${to}: ${result.error}`);
      }
      return result;
    } catch (error) {
      console.error('WhatsApp helper error:', error.message);
      return null;
    }
  }

  /**
   * Notify admins/managers about a new lead
   */
  async notifyNewLead(lead) {
    try {
      if (!this.isConfigured()) return;

      // Get admin users with phone numbers
      const admins = query(`
        SELECT phone FROM users WHERE role IN ('admin', 'manager') AND phone IS NOT NULL AND is_active = 1
      `);

      const message = `ליד חדש! 📋
שם: ${lead.contact_name}
חברה: ${lead.company_name || '-'}
טלפון: ${lead.phone}
מקור: ${lead.source || '-'}
שירות: ${lead.service_type || '-'}

צוות יהלום CRM`;

      for (const admin of admins.rows) {
        await this.safeSend(admin.phone, message);
      }
    } catch (error) {
      console.error('WhatsApp notifyNewLead error:', error.message);
    }
  }

  /**
   * Notify about lead status change
   */
  async notifyLeadStatusChange(lead, newStatus, assignedToPhone) {
    try {
      if (!this.isConfigured() || !assignedToPhone) return;

      const statusMap = {
        'new': 'חדש',
        'contacted': 'נוצר קשר',
        'meeting_scheduled': 'פגישה נקבעה',
        'proposal_sent': 'הצעה נשלחה',
        'negotiation': 'משא ומתן',
        'won': 'נסגר בהצלחה! 🎉',
        'lost': 'אבוד ❌'
      };

      const message = `עדכון ליד 📊
${lead.contact_name} (${lead.company_name || '-'})
סטטוס: ${statusMap[newStatus] || newStatus}

צוות יהלום CRM`;

      await this.safeSend(assignedToPhone, message);
    } catch (error) {
      console.error('WhatsApp notifyLeadStatusChange error:', error.message);
    }
  }

  /**
   * Send shift reminder to employee
   */
  async sendShiftReminder(employee, shift) {
    try {
      if (!this.isConfigured()) return;
      await whatsappService.sendShiftReminder(employee, shift);
    } catch (error) {
      console.error('WhatsApp sendShiftReminder error:', error.message);
    }
  }

  /**
   * Send shift assignment confirmation
   */
  async sendAssignmentConfirmation(employeeId, shiftId) {
    try {
      if (!this.isConfigured()) return;
      if (!this.loadCredentials()) return;

      const empResult = query(`SELECT first_name, phone FROM employees WHERE id = ?`, [employeeId]);
      const shiftResult = query(`
        SELECT s.date, s.start_time, s.end_time, c.company_name, si.name as site_name
        FROM shifts s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sites si ON s.site_id = si.id
        WHERE s.id = ?
      `, [shiftId]);

      if (empResult.rows.length > 0 && shiftResult.rows.length > 0) {
        const emp = empResult.rows[0];
        const shift = shiftResult.rows[0];
        await whatsappService.sendAssignmentConfirmation(emp, shift);
      }
    } catch (error) {
      console.error('WhatsApp sendAssignmentConfirmation error:', error.message);
    }
  }

  /**
   * Send event notification to assigned staff
   */
  async notifyEventAssignment(employeeId, eventId) {
    try {
      if (!this.isConfigured()) return;
      if (!this.loadCredentials()) return;

      const empResult = query(`SELECT first_name, phone FROM employees WHERE id = ?`, [employeeId]);
      const eventResult = query(`SELECT event_name, event_date, start_time, end_time, location FROM events WHERE id = ?`, [eventId]);

      if (empResult.rows.length > 0 && eventResult.rows.length > 0) {
        const emp = empResult.rows[0];
        const event = eventResult.rows[0];

        const message = `שלום ${emp.first_name}! 📌
שובצת לאירוע:
🎪 ${event.event_name}
📅 ${event.event_date}
🕐 ${event.start_time} - ${event.end_time}
📍 ${event.location}

נא לאשר קבלה.
צוות יהלום`;

        await this.safeSend(emp.phone, message);
      }
    } catch (error) {
      console.error('WhatsApp notifyEventAssignment error:', error.message);
    }
  }

  /**
   * Handle incoming WhatsApp message - log and auto-reply
   */
  async handleIncomingMessage(from, text, timestamp) {
    try {
      // Log the incoming message
      const id = generateUUID();
      query(`
        INSERT INTO activity_log (id, entity_type, action, changes, created_at)
        VALUES (?, 'whatsapp', 'incoming_message', ?, datetime('now'))
      `, [id, JSON.stringify({ from, text, timestamp })]);

      // Auto-reply
      if (this.loadCredentials()) {
        const autoReply = `שלום! 👋
תודה על פנייתכם לצוות יהלום.
הודעתכם התקבלה ונציג יחזור אליכם בהקדם.

לדחוף - חייגו: 📞

צוות יהלום`;

        await whatsappService.sendMessage(from, autoReply);
      }
    } catch (error) {
      console.error('WhatsApp handleIncomingMessage error:', error.message);
    }
  }
}

module.exports = new WhatsAppHelper();
