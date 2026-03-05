const express = require('express');
const router = express.Router();
const { query, db, generateUUID } = require('../config/database');
const googleService = require('../services/google');
const whatsappService = require('../services/whatsapp');
const greenInvoiceService = require('../services/greenInvoice');
const whatsappHelper = require('../utils/whatsappHelper');
const { authenticateToken } = require('../middleware/auth');

// ====================
// PUBLIC ROUTES (no auth required)
// ====================

// Google OAuth callback - Google redirects here without JWT token
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect('/settings?google=error&reason=no_code');
    }

    // Ensure table exists before saving tokens
    try {
      await query(`CREATE TABLE IF NOT EXISTS integration_settings (
        id TEXT PRIMARY KEY, google_tokens TEXT, google_email TEXT,
        whatsapp_phone_id TEXT, whatsapp_access_token TEXT, whatsapp_phone_display TEXT,
        green_invoice_api_key TEXT, green_invoice_api_secret TEXT, green_invoice_business_name TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e) { /* table exists */ }

    const tokens = await googleService.getTokensFromCode(code);

    // Extract email from tokens if possible
    let googleEmail = '';
    try {
      if (tokens.id_token) {
        const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
        googleEmail = payload.email || '';
      }
    } catch (e) {
      console.log('Could not extract email from id_token');
    }

    // Save tokens to database
    const existingSettings = await query(`SELECT * FROM integration_settings WHERE id = 'main'`);

    if (existingSettings.rows.length === 0) {
      await query(`
        INSERT INTO integration_settings (id, google_tokens, google_email, updated_at)
        VALUES ('main', ?, ?, datetime('now'))
      `, [JSON.stringify(tokens), googleEmail]);
    } else {
      await query(`
        UPDATE integration_settings
        SET google_tokens = ?, google_email = ?, updated_at = datetime('now')
        WHERE id = 'main'
      `, [JSON.stringify(tokens), googleEmail]);
    }

    // Redirect to settings page with success
    res.redirect('/settings?google=connected');
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect('/settings?google=error&reason=' + encodeURIComponent(error.message || 'unknown'));
  }
});

// WhatsApp webhook verification (Meta sends GET without auth)
router.get('/whatsapp/webhook', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'tzevet-yahalom-verify';

  if (req.query['hub.verify_token'] === verifyToken) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp webhook incoming messages (Meta sends POST without auth)
router.post('/whatsapp/webhook', async (req, res) => {
  try {
    const result = await whatsappService.handleWebhook(req.body);

    if (result && result.type === 'message') {
      console.log('Incoming WhatsApp message:', result);
      await whatsappHelper.handleIncomingMessage(result.from, result.text, result.timestamp);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.sendStatus(500);
  }
});

// ====================
// AUTHENTICATED ROUTES
// ====================
router.use(authenticateToken);

// ====================
// GOOGLE MAPS
// ====================

// Get Google Maps API key (for frontend map components)
router.get('/google-maps-key', (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(404).json({ error: 'Google Maps API key not configured' });
  res.json({ apiKey: key });
});

// ====================
// INTEGRATION SETTINGS
// ====================

// Ensure integration_settings table exists (auto-create for PostgreSQL deployments)
async function ensureIntegrationSettingsTable() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS integration_settings (
      id TEXT PRIMARY KEY,
      google_tokens TEXT,
      google_email TEXT,
      whatsapp_phone_id TEXT,
      whatsapp_access_token TEXT,
      whatsapp_phone_display TEXT,
      green_invoice_api_key TEXT,
      green_invoice_api_secret TEXT,
      green_invoice_business_name TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) {
    // Table likely already exists, ignore
  }
}

// Get integration settings
router.get('/settings', async (req, res) => {
  try {
    // Ensure table exists before querying
    await ensureIntegrationSettingsTable();

    // Check for existing integration settings
    const result = await query(`
      SELECT * FROM integration_settings WHERE id = 'main'
    `);

    if (result.rows.length === 0) {
      // Return default empty settings
      return res.json({
        google: { connected: false },
        whatsapp: { connected: false },
        greenInvoice: { connected: false }
      });
    }

    const settings = result.rows[0];

    res.json({
      google: {
        connected: !!settings.google_tokens,
        email: settings.google_email
      },
      whatsapp: {
        connected: !!settings.whatsapp_phone_id,
        phoneNumber: settings.whatsapp_phone_display
      },
      greenInvoice: {
        connected: !!settings.green_invoice_api_key,
        businessName: settings.green_invoice_business_name
      }
    });
  } catch (error) {
    console.error('Get integration settings error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת הגדרות אינטגרציה' });
  }
});

// ====================
// GOOGLE INTEGRATION
// ====================

// Get Google auth URL
router.get('/google/auth-url', (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(400).json({
        message: 'Google API לא מוגדר. צריך להגדיר GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET בהגדרות השרת.',
        needsSetup: true
      });
    }
    const authUrl = googleService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Google auth URL error:', error);
    res.status(500).json({ message: 'שגיאה ביצירת קישור התחברות. ודא שפרטי Google OAuth מוגדרים נכון.' });
  }
});

// Google OAuth callback is defined above (public route, no auth required)

// Disconnect Google
router.post('/google/disconnect', async (req, res) => {
  try {
    await query(`
      UPDATE integration_settings
      SET google_tokens = NULL, google_email = NULL, updated_at = datetime('now')
      WHERE id = 'main'
    `);

    res.json({ message: 'Google נותק בהצלחה' });
  } catch (error) {
    console.error('Google disconnect error:', error);
    res.status(500).json({ message: 'שגיאה בניתוק Google' });
  }
});

// Get Google Calendar events
router.get('/google/calendar/events', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'נדרש start_date ו-end_date' });
    }

    // Get Google tokens
    const settings = await query(`SELECT google_tokens FROM integration_settings WHERE id = 'main'`);
    if (!settings.rows.length || !settings.rows[0].google_tokens) {
      return res.json({ events: [], connected: false });
    }

    const tokens = JSON.parse(settings.rows[0].google_tokens);
    googleService.setCredentials(tokens);

    const events = await googleService.listCalendarEvents(start_date, end_date);
    res.json({ events, connected: true });
  } catch (error) {
    console.error('Google calendar events error:', error);
    res.json({ events: [], connected: false, error: error.message });
  }
});

// ====================
// WHATSAPP INTEGRATION (WAHA)
// ====================

// Helper: get WAHA connection info from DB
async function getWahaConfig() {
  const result = await query(`SELECT * FROM integration_settings WHERE id = 'main'`);
  if (result.rows.length === 0) return null;
  const s = result.rows[0];
  if (!s.whatsapp_phone_id) return null;
  return {
    wahaUrl: s.whatsapp_phone_id,        // repurposed: stores WAHA URL
    apiKey: s.whatsapp_access_token,      // repurposed: stores WAHA API key
    phoneNumber: s.whatsapp_phone_display  // stores connected phone
  };
}

// Save WAHA URL + API key and start a session
router.post('/whatsapp/settings', async (req, res) => {
  try {
    const { wahaUrl, apiKey } = req.body;

    if (!wahaUrl) {
      return res.status(400).json({ message: 'נדרש כתובת שרת WAHA' });
    }

    // Verify WAHA is reachable
    const axios = require('axios');
    const baseUrl = wahaUrl.replace(/\/+$/, '');
    const headers = apiKey ? { 'X-Api-Key': apiKey } : {};

    try {
      await axios.get(`${baseUrl}/api/sessions`, { headers, timeout: 5000 });
    } catch (e) {
      // Even a 401/403 means server is reachable - only fail on network errors
      if (!e.response) {
        return res.status(400).json({ message: 'לא ניתן להתחבר לשרת WAHA. בדוק את הכתובת.' });
      }
    }

    // Try to start/ensure a default session
    // Webhook URL configured via WAHA_WEBHOOK_URL env variable
    try {
      await axios.post(`${baseUrl}/api/sessions/start`, {
        name: 'default',
        config: {
          proxy: null,
          webhooks: process.env.WAHA_WEBHOOK_URL ? [{
            url: process.env.WAHA_WEBHOOK_URL,
            events: ['message', 'message.ack']
          }] : []
        }
      }, { headers, timeout: 10000 });
    } catch (e) {
      // Session might already exist, that's OK
      if (e.response?.status !== 422 && e.response?.status !== 409) {
        console.log('WAHA session start note:', e.response?.data || e.message);
      }
    }

    // Save to DB
    const existingSettings = await query(`SELECT * FROM integration_settings WHERE id = 'main'`);

    if (existingSettings.rows.length === 0) {
      await query(`
        INSERT INTO integration_settings (id, whatsapp_phone_id, whatsapp_access_token, updated_at)
        VALUES ('main', ?, ?, datetime('now'))
      `, [baseUrl, apiKey || '']);
    } else {
      await query(`
        UPDATE integration_settings
        SET whatsapp_phone_id = ?, whatsapp_access_token = ?, updated_at = datetime('now')
        WHERE id = 'main'
      `, [baseUrl, apiKey || '']);
    }

    res.json({ message: 'שרת WAHA מחובר!' });
  } catch (error) {
    console.error('WhatsApp WAHA settings error:', error);
    res.status(500).json({ message: 'שגיאה בשמירת הגדרות WhatsApp' });
  }
});

// Get QR code from WAHA
router.get('/whatsapp/qr', async (req, res) => {
  try {
    const config = await getWahaConfig();
    if (!config) {
      return res.status(400).json({ message: 'שרת WAHA לא מוגדר' });
    }

    const axios = require('axios');
    const headers = config.apiKey ? { 'X-Api-Key': config.apiKey } : {};

    const response = await axios.get(
      `${config.wahaUrl}/api/screenshot?session=default`,
      { headers, timeout: 10000, responseType: 'arraybuffer' }
    ).catch(() => null);

    // Try QR endpoint
    const qrResponse = await axios.get(
      `${config.wahaUrl}/api/sessions/default/auth/qr`,
      { headers, timeout: 10000 }
    ).catch(() => null);

    if (qrResponse?.data) {
      const qrData = typeof qrResponse.data === 'string' ? qrResponse.data : qrResponse.data.data;
      return res.json({ qr: qrData });
    }

    // Fallback: try /api/{session}/auth/qr format (older WAHA versions)
    const qrFallback = await axios.get(
      `${config.wahaUrl}/api/default/auth/qr`,
      { headers, timeout: 10000 }
    ).catch(() => null);

    if (qrFallback?.data) {
      const qrData = typeof qrFallback.data === 'string' ? qrFallback.data : qrFallback.data.data;
      return res.json({ qr: qrData });
    }

    res.json({ qr: null, message: 'לא נמצא QR - ייתכן שכבר מחובר' });
  } catch (error) {
    console.error('WhatsApp QR error:', error.message);
    res.status(500).json({ message: 'שגיאה בקבלת QR' });
  }
});

// Get WAHA session status
router.get('/whatsapp/status', async (req, res) => {
  try {
    const config = await getWahaConfig();
    if (!config) {
      return res.json({ connected: false, status: 'not_configured' });
    }

    const axios = require('axios');
    const headers = config.apiKey ? { 'X-Api-Key': config.apiKey } : {};

    try {
      const response = await axios.get(
        `${config.wahaUrl}/api/sessions/default`,
        { headers, timeout: 5000 }
      );

      const session = response.data;
      const isConnected = session.status === 'WORKING' || session.status === 'CONNECTED';

      // If connected and we have phone info, save it
      if (isConnected && session.me?.id) {
        const phoneNumber = session.me.id.split('@')[0];
        await query(`
          UPDATE integration_settings
          SET whatsapp_phone_display = ?, updated_at = datetime('now')
          WHERE id = 'main'
        `, [phoneNumber]);
      }

      return res.json({
        connected: isConnected,
        status: session.status,
        phoneNumber: session.me?.id?.split('@')[0] || config.phoneNumber || null
      });
    } catch (e) {
      return res.json({ connected: false, status: 'unreachable' });
    }
  } catch (error) {
    console.error('WhatsApp status error:', error.message);
    res.status(500).json({ message: 'שגיאה בבדיקת סטטוס' });
  }
});

// Disconnect WhatsApp (stop WAHA session + clear DB)
router.post('/whatsapp/disconnect', async (req, res) => {
  try {
    const config = await getWahaConfig();

    // Try to stop WAHA session
    if (config) {
      const axios = require('axios');
      const headers = config.apiKey ? { 'X-Api-Key': config.apiKey } : {};
      try {
        await axios.post(`${config.wahaUrl}/api/sessions/stop`, { name: 'default' }, { headers, timeout: 5000 });
      } catch (e) {
        // OK if session doesn't exist
      }
    }

    await query(`
      UPDATE integration_settings
      SET whatsapp_phone_id = NULL, whatsapp_access_token = NULL, whatsapp_phone_display = NULL, updated_at = datetime('now')
      WHERE id = 'main'
    `);

    res.json({ message: 'WhatsApp נותק בהצלחה' });
  } catch (error) {
    console.error('WhatsApp disconnect error:', error);
    res.status(500).json({ message: 'שגיאה בניתוק WhatsApp' });
  }
});

// Send WhatsApp message (via WAHA)
router.post('/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    const config = await getWahaConfig();

    if (!config) {
      return res.status(400).json({ message: 'WhatsApp לא מחובר' });
    }

    // Format phone number
    let formattedPhone = to.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '972' + formattedPhone.slice(1);
    }

    const axios = require('axios');
    const headers = config.apiKey ? { 'X-Api-Key': config.apiKey } : {};

    const response = await axios.post(
      `${config.wahaUrl}/api/sendText`,
      {
        session: 'default',
        chatId: `${formattedPhone}@c.us`,
        text: message
      },
      { headers, timeout: 10000 }
    );

    res.json({ message: 'הודעה נשלחה בהצלחה', messageId: response.data?.id });
  } catch (error) {
    console.error('WhatsApp send error:', error.response?.data || error.message);
    res.status(500).json({ message: 'שגיאה בשליחת הודעה' });
  }
});

// Send WhatsApp test message
router.post('/whatsapp/test', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ message: 'נדרש מספר טלפון' });
    }

    const result = await whatsappService.sendMessage(to, '🔔 הודעת בדיקה מצוות יהלום CRM', {
      context: 'test'
    });

    if (result.success) {
      res.json({ message: 'הודעת בדיקה נשלחה בהצלחה', messageId: result.messageId });
    } else {
      res.status(400).json({ message: result.error || 'שגיאה בשליחת הודעת בדיקה' });
    }
  } catch (error) {
    console.error('WhatsApp test error:', error);
    res.status(500).json({ message: 'שגיאה בשליחת הודעת בדיקה' });
  }
});

// WhatsApp webhooks are defined above (public routes, no auth required)

// ====================
// GREEN INVOICE INTEGRATION
// ====================

// Save Green Invoice settings
router.post('/green-invoice/settings', async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;

    // Test connection
    try {
      // Temporarily set credentials
      process.env.GREEN_INVOICE_API_KEY = apiKey;
      process.env.GREEN_INVOICE_API_SECRET = apiSecret;

      const businessDetails = await greenInvoiceService.getBusinessDetails();

      const existingSettings = await query(`SELECT * FROM integration_settings WHERE id = 'main'`);

      if (existingSettings.rows.length === 0) {
        await query(`
          INSERT INTO integration_settings (id, green_invoice_api_key, green_invoice_api_secret, green_invoice_business_name, updated_at)
          VALUES ('main', ?, ?, ?, datetime('now'))
        `, [apiKey, apiSecret, businessDetails.name || 'צוות יהלום']);
      } else {
        await query(`
          UPDATE integration_settings
          SET green_invoice_api_key = ?, green_invoice_api_secret = ?, green_invoice_business_name = ?, updated_at = datetime('now')
          WHERE id = 'main'
        `, [apiKey, apiSecret, businessDetails.name || 'צוות יהלום']);
      }

      res.json({ message: 'הגדרות חשבונית ירוקה נשמרו בהצלחה', businessName: businessDetails.name });
    } catch (apiError) {
      res.status(400).json({ message: 'פרטי התחברות שגויים' });
    }
  } catch (error) {
    console.error('Green Invoice settings error:', error);
    res.status(500).json({ message: 'שגיאה בשמירת הגדרות חשבונית ירוקה' });
  }
});

// Disconnect Green Invoice
router.post('/green-invoice/disconnect', async (req, res) => {
  try {
    await query(`
      UPDATE integration_settings
      SET green_invoice_api_key = NULL, green_invoice_api_secret = NULL, green_invoice_business_name = NULL, updated_at = datetime('now')
      WHERE id = 'main'
    `);

    res.json({ message: 'חשבונית ירוקה נותקה בהצלחה' });
  } catch (error) {
    console.error('Green Invoice disconnect error:', error);
    res.status(500).json({ message: 'שגיאה בניתוק חשבונית ירוקה' });
  }
});

// Create invoice via Green Invoice
router.post('/green-invoice/create-invoice', async (req, res) => {
  try {
    const { customerId, items, dueDate, remarks } = req.body;

    // Get customer details
    const customerResult = await query(`
      SELECT c.*, ct.name as contact_name, ct.email as contact_email, ct.phone as contact_phone
      FROM customers c
      LEFT JOIN contacts ct ON ct.customer_id = c.id AND ct.is_primary = 1
      WHERE c.id = ?
    `, [customerId]);

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ message: 'לקוח לא נמצא' });
    }

    const customer = customerResult.rows[0];

    const invoice = await greenInvoiceService.createInvoice(
      {
        name: customer.company_name,
        email: customer.contact_email || customer.email,
        phone: customer.contact_phone,
        businessId: customer.business_id,
        address: customer.address,
        city: customer.city
      },
      items,
      dueDate,
      remarks
    );

    // Save invoice to our database
    const invoiceId = generateUUID();
    await query(`
      INSERT INTO invoices (id, customer_id, green_invoice_id, invoice_number, issue_date, due_date, amount, vat_amount, total_amount, status, document_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, datetime('now'))
    `, [
      invoiceId,
      customerId,
      invoice.id,
      invoice.number,
      invoice.documentDate,
      dueDate,
      invoice.amount,
      invoice.vat,
      invoice.total,
      invoice.url?.he
    ]);

    res.json({
      message: 'חשבונית נוצרה בהצלחה',
      invoice: {
        id: invoiceId,
        greenInvoiceId: invoice.id,
        number: invoice.number,
        url: invoice.url?.he
      }
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ message: 'שגיאה ביצירת חשבונית' });
  }
});

// Sync invoices from Green Invoice
router.post('/green-invoice/sync', async (req, res) => {
  try {
    const fromDate = req.body.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const count = await greenInvoiceService.syncInvoices({ query }, fromDate);

    res.json({ message: `${count} חשבוניות סונכרנו בהצלחה` });
  } catch (error) {
    console.error('Sync invoices error:', error);
    res.status(500).json({ message: 'שגיאה בסנכרון חשבוניות' });
  }
});

// ====================
// SCHEDULER STATUS
// ====================

// Get scheduler status
router.get('/scheduler/status', (req, res) => {
  try {
    const scheduler = require('../services/scheduler');
    res.json({
      jobs: scheduler.getStatus(),
      timezone: 'Asia/Jerusalem'
    });
  } catch (error) {
    console.error('Scheduler status error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת סטטוס מתזמן' });
  }
});

module.exports = router;
