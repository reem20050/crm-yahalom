const axios = require('axios');
require('dotenv').config();

class WhatsAppService {
  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  }

  async sendMessage(to, message) {
    try {
      // Format phone number (remove leading 0, add country code)
      let formattedPhone = to.replace(/[^0-9]/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '972' + formattedPhone.slice(1);
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return { success: true, messageId: response.data.messages?.[0]?.id };
    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  }

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

  // Handle incoming webhook
  async handleWebhook(webhookData) {
    try {
      const entry = webhookData.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        const message = value.messages[0];
        const from = message.from; // Phone number
        const text = message.text?.body;
        const timestamp = message.timestamp;

        // Return parsed message for processing
        return {
          type: 'message',
          from,
          text,
          timestamp: new Date(parseInt(timestamp) * 1000),
        };
      }

      if (value?.statuses) {
        const status = value.statuses[0];
        return {
          type: 'status',
          messageId: status.id,
          status: status.status, // sent, delivered, read
          timestamp: new Date(parseInt(status.timestamp) * 1000),
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
