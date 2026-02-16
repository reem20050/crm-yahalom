const axios = require('axios');
require('dotenv').config();

// WAHA (WhatsApp HTTP API) - self-hosted WhatsApp Web API
// Docs: https://waha.devlike.pro/
const DEFAULT_WAHA_URL = process.env.WAHA_API_URL || 'http://localhost:3000';
const SESSION_NAME = 'default';

class WhatsAppService {
  constructor() {
    this.wahaUrl = DEFAULT_WAHA_URL;
    this.sessionName = SESSION_NAME;
    this.connected = false;
  }

  // Load WAHA URL from DB if set
  _ensureConfig() {
    try {
      const { query } = require('../config/database');
      const result = query("SELECT whatsapp_phone_id, whatsapp_access_token, whatsapp_phone_display FROM integration_settings WHERE id = 'main'");
      if (result.rows.length > 0 && result.rows[0].whatsapp_phone_id) {
        // whatsapp_phone_id stores WAHA URL, whatsapp_access_token stores session name
        this.wahaUrl = result.rows[0].whatsapp_phone_id;
        this.sessionName = result.rows[0].whatsapp_access_token || SESSION_NAME;
        this.connected = true;
        return true;
      }
    } catch (e) {
      // DB not ready yet
    }
    return false;
  }

  // Get WAHA base URL
  _getBaseUrl() {
    return this.wahaUrl || DEFAULT_WAHA_URL;
  }

  // ========== Session Management ==========

  // Get session status
  async getSessionStatus() {
    try {
      const url = this._getBaseUrl();
      const response = await axios.get(`${url}/api/sessions/${this.sessionName}`, {
        timeout: 5000
      });
      return { success: true, status: response.data.status, data: response.data };
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: true, status: 'STOPPED', data: null };
      }
      return { success: false, error: error.message };
    }
  }

  // Start session (creates if not exists)
  async startSession() {
    try {
      const url = this._getBaseUrl();
      // First try to create the session
      try {
        await axios.post(`${url}/api/sessions`, {
          name: this.sessionName,
          start: true,
          config: {
            proxy: null,
            webhooks: [{
              url: '',
              events: ['message']
            }]
          }
        }, { timeout: 10000 });
      } catch (e) {
        // Session might already exist, try to start it
        if (e.response?.status === 422 || e.response?.status === 409) {
          await axios.post(`${url}/api/sessions/${this.sessionName}/start`, {}, { timeout: 10000 });
        } else {
          throw e;
        }
      }
      return { success: true };
    } catch (error) {
      console.error('WAHA start session error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // Stop session
  async stopSession() {
    try {
      const url = this._getBaseUrl();
      await axios.post(`${url}/api/sessions/${this.sessionName}/stop`, {}, { timeout: 5000 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Logout session (removes auth data)
  async logoutSession() {
    try {
      const url = this._getBaseUrl();
      await axios.post(`${url}/api/sessions/${this.sessionName}/logout`, {}, { timeout: 5000 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get QR code for authentication
  async getQR() {
    try {
      const url = this._getBaseUrl();
      const response = await axios.get(`${url}/api/${this.sessionName}/auth/qr`, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000
      });
      // Returns { value: "base64..." } or { value: "raw qr data" }
      return { success: true, qr: response.data.value || response.data };
    } catch (error) {
      if (error.response?.status === 404) {
        return { success: false, error: 'Session not started. Start session first.' };
      }
      if (error.response?.status === 422) {
        // Already authenticated
        return { success: false, error: 'already_authenticated' };
      }
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // Get account info (who is logged in)
  async getAccountInfo() {
    try {
      const url = this._getBaseUrl();
      const response = await axios.get(`${url}/api/sessions/${this.sessionName}/me`, { timeout: 5000 });
      return { success: true, account: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== Messaging ==========

  // Format phone number for WAHA (needs @c.us suffix)
  _formatPhone(phone) {
    let formatted = phone.replace(/[^0-9]/g, '');
    // Israeli number: remove leading 0, add 972
    if (formatted.startsWith('0')) {
      formatted = '972' + formatted.slice(1);
    }
    // If doesn't have country code (less than 11 digits), assume Israel
    if (formatted.length <= 10) {
      formatted = '972' + formatted;
    }
    return formatted + '@c.us';
  }

  async sendMessage(to, message) {
    try {
      if (!this._ensureConfig() && !this.wahaUrl) {
        return { success: false, error: 'WhatsApp לא מוגדר. הגדר את הפרטים בדף ההגדרות.' };
      }

      const chatId = this._formatPhone(to);
      const url = this._getBaseUrl();

      const response = await axios.post(`${url}/api/sendText`, {
        session: this.sessionName,
        chatId: chatId,
        text: message
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      return { success: true, messageId: response.data.id };
    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // ========== Business Message Templates ==========

  // Send shift reminder to employee
  async sendShiftReminder(employee, shift) {
    const message = `שלום ${employee.first_name}! 🔔
תזכורת למשמרת מחר:
📍 ${shift.site_name || shift.company_name}
🕐 ${shift.start_time} - ${shift.end_time}
📅 ${shift.date}

צוות יהלום`;

    return await this.sendMessage(employee.phone, message);
  }

  // Send assignment confirmation to employee
  async sendAssignmentConfirmation(employee, shift) {
    const message = `שלום ${employee.first_name}! ✅
שובצת למשמרת:
📍 ${shift.site_name || shift.company_name}
🕐 ${shift.start_time} - ${shift.end_time}
📅 ${shift.date}

נא לאשר קבלה.
צוות יהלום`;

    return await this.sendMessage(employee.phone, message);
  }

  // Send booking confirmation to customer
  async sendBookingConfirmation(contact, event) {
    const message = `שלום ${contact.name}! ✅
הזמנתכם לאבטחת האירוע אושרה:
📅 ${event.event_date}
🕐 ${event.start_time}
📍 ${event.location}
👥 ${event.required_guards} מאבטחים

צוות יהלום`;

    return await this.sendMessage(contact.phone, message);
  }

  // Send invoice reminder to customer
  async sendInvoiceReminder(contact, invoice) {
    const message = `שלום ${contact.name},
תזכורת לתשלום חשבונית #${invoice.invoice_number}
סכום: ₪${invoice.total_amount.toLocaleString()}
תאריך תשלום: ${invoice.due_date}

לפרטים נוספים ניתן לפנות אלינו.
צוות יהלום`;

    return await this.sendMessage(contact.phone, message);
  }

  // Send guard arrival notification to customer
  async sendGuardArrivalNotification(contact, guardName, siteName) {
    const message = `שלום!
המאבטח ${guardName} בדרך אליכם ל${siteName}.
צוות יהלום`;

    return await this.sendMessage(contact.phone, message);
  }

  // Handle incoming webhook from WAHA
  async handleWebhook(webhookData) {
    try {
      // WAHA webhook format
      if (webhookData.event === 'message') {
        const msg = webhookData.payload;
        return {
          type: 'message',
          from: msg.from?.replace('@c.us', ''),
          text: msg.body || msg.text,
          timestamp: new Date(msg.timestamp * 1000),
        };
      }

      if (webhookData.event === 'message.ack') {
        return {
          type: 'status',
          messageId: webhookData.payload?.id,
          status: webhookData.payload?.ack,
          timestamp: new Date(),
        };
      }

      // Also support Meta-style format for backwards compatibility
      const entry = webhookData.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        const message = value.messages[0];
        return {
          type: 'message',
          from: message.from,
          text: message.text?.body,
          timestamp: new Date(parseInt(message.timestamp) * 1000),
        };
      }

      return null;
    } catch (error) {
      console.error('WhatsApp webhook parse error:', error);
      return null;
    }
  }
}

module.exports = new WhatsAppService();
