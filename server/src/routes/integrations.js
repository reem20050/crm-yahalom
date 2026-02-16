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

    const tokens = await googleService.getTokensFromCode(code);

    // Save tokens to database
    const existingSettings = query(`SELECT * FROM integration_settings WHERE id = 'main'`);

    if (existingSettings.rows.length === 0) {
      query(`
        INSERT INTO integration_settings (id, google_tokens, google_email, updated_at)
        VALUES ('main', ?, ?, datetime('now'))
      `, [JSON.stringify(tokens), '']);
    } else {
      query(`
        UPDATE integration_settings
        SET google_tokens = ?, updated_at = datetime('now')
        WHERE id = 'main'
      `, [JSON.stringify(tokens)]);
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
      console.log('Incoming WhatsApp message from:', result.from);
      try {
        const logId = generateUUID();
        query(`INSERT INTO activity_log (id, action, entity_type, details, created_at)
          VALUES (?, 'whatsapp_received', 'whatsapp', ?, datetime('now'))`,
          [logId, JSON.stringify({ from: result.from, text: result.text?.substring(0, 200) })]);
      } catch (logErr) { /* non-blocking */ }
      await whatsappHelper.handleIncomingMessage(result.from, result.text, result.timestamp);
    }

    if (result && result.type === 'status') {
      try {
        const logId = generateUUID();
        query(`INSERT INTO activity_log (id, action, entity_type, details, created_at)
          VALUES (?, 'whatsapp_status', 'whatsapp', ?, datetime('now'))`,
          [logId, JSON.stringify({ messageId: result.messageId, status: result.status })]);
      } catch (logErr) { /* non-blocking */ }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.sendStatus(200); // Always return 200 to prevent Meta from retrying
  }
});

// ====================
// AUTHENTICATED ROUTES
// ====================
router.use(authenticateToken);

// ====================
// INTEGRATION SETTINGS
// ====================

// Get integration settings
router.get('/settings', async (req, res) => {
  try {
    // Check for existing integration settings
    const result = query(`
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
    const authUrl = googleService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Google auth URL error:', error);
    res.status(500).json({ message: 'שגיאה ביצירת קישור התחברות' });
  }
});

// Google OAuth callback is defined above (public route, no auth required)

// Disconnect Google
router.post('/google/disconnect', async (req, res) => {
  try {
    query(`
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

// ====================
// WHATSAPP INTEGRATION
// ====================

// Save WhatsApp settings (with validation)
router.post('/whatsapp/settings', async (req, res) => {
  try {
    const { phoneNumberId, accessToken, phoneDisplay } = req.body;

    if (!phoneNumberId || !accessToken) {
      return res.status(400).json({ message: 'נדרש Phone Number ID ו-Access Token' });
    }

    const existingSettings = query(`SELECT * FROM integration_settings WHERE id = 'main'`);

    if (existingSettings.rows.length === 0) {
      query(`
        INSERT INTO integration_settings (id, whatsapp_phone_id, whatsapp_access_token, whatsapp_phone_display, updated_at)
        VALUES ('main', ?, ?, ?, datetime('now'))
      `, [phoneNumberId, accessToken, phoneDisplay]);
    } else {
      query(`
        UPDATE integration_settings
        SET whatsapp_phone_id = ?, whatsapp_access_token = ?, whatsapp_phone_display = ?, updated_at = datetime('now')
        WHERE id = 'main'
      `, [phoneNumberId, accessToken, phoneDisplay]);
    }

    // Update service credentials in memory
    whatsappService.phoneNumberId = phoneNumberId;
    whatsappService.accessToken = accessToken;

    res.json({ message: 'הגדרות WhatsApp נשמרו בהצלחה' });
  } catch (error) {
    console.error('WhatsApp settings error:', error);
    res.status(500).json({ message: 'שגיאה בשמירת הגדרות WhatsApp' });
  }
});

// Test WhatsApp connection
router.post('/whatsapp/test', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ message: 'נדרש מספר טלפון לבדיקה' });
    }
    const result = await whatsappService.sendMessage(to, 'בדיקת חיבור WhatsApp - צוות יהלום ✅');
    if (result.success) {
      res.json({ message: 'הודעת בדיקה נשלחה בהצלחה!' });
    } else {
      res.status(400).json({ message: result.error || 'שגיאה בשליחת הודעת בדיקה' });
    }
  } catch (error) {
    console.error('WhatsApp test error:', error);
    res.status(500).json({ message: 'שגיאה בבדיקת חיבור WhatsApp' });
  }
});

// Disconnect WhatsApp
router.post('/whatsapp/disconnect', async (req, res) => {
  try {
    query(`
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

// Send WhatsApp message (with logging)
router.post('/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ message: 'נדרש מספר טלפון והודעה' });
    }

    const result = await whatsappService.sendMessage(to, message);

    // Log to activity_log
    try {
      const logId = generateUUID();
      query(`INSERT INTO activity_log (id, action, entity_type, details, user_id, created_at)
        VALUES (?, 'whatsapp_sent', 'whatsapp', ?, ?, datetime('now'))`,
        [logId, JSON.stringify({ to, success: result.success, messageId: result.messageId }), req.user?.id]);
    } catch (logErr) {
      // Don't fail the request if logging fails
    }

    if (result.success) {
      res.json({ message: 'הודעה נשלחה בהצלחה', messageId: result.messageId });
    } else {
      res.status(400).json({ message: result.error || 'שגיאה בשליחת הודעה' });
    }
  } catch (error) {
    console.error('WhatsApp send error:', error);
    res.status(500).json({ message: 'שגיאה בשליחת הודעה' });
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

      const existingSettings = query(`SELECT * FROM integration_settings WHERE id = 'main'`);

      if (existingSettings.rows.length === 0) {
        query(`
          INSERT INTO integration_settings (id, green_invoice_api_key, green_invoice_api_secret, green_invoice_business_name, updated_at)
          VALUES ('main', ?, ?, ?, datetime('now'))
        `, [apiKey, apiSecret, businessDetails.name || 'צוות יהלום']);
      } else {
        query(`
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
    query(`
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
    const customerResult = query(`
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
    query(`
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
    const count = await greenInvoiceService.syncInvoices({ query: query }, fromDate);

    res.json({ message: `סונכרנו ${count} חשבוניות בהצלחה`, count });
  } catch (error) {
    console.error('Sync invoices error:', error);
    res.status(500).json({ message: 'שגיאה בסנכרון חשבוניות' });
  }
});

// ====================
// INTEGRATION HEALTH CHECK
// ====================

router.get('/health', async (req, res) => {
  const health = {
    google: { configured: !!process.env.GOOGLE_CLIENT_ID, connected: false },
    whatsapp: { configured: !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN), connected: false },
    greenInvoice: { configured: !!(process.env.GREEN_INVOICE_API_KEY && process.env.GREEN_INVOICE_API_SECRET), connected: false },
  };

  // Check DB settings
  try {
    const settings = query(`SELECT * FROM integration_settings WHERE id = 'main'`);
    if (settings.rows.length > 0) {
      const s = settings.rows[0];
      health.google.connected = !!s.google_tokens;
      health.whatsapp.configured = health.whatsapp.configured || !!s.whatsapp_phone_id;
      health.whatsapp.connected = !!s.whatsapp_phone_id;
      health.greenInvoice.configured = health.greenInvoice.configured || !!s.green_invoice_api_key;
      health.greenInvoice.connected = !!s.green_invoice_api_key;
    }
  } catch (err) { /* ignore */ }

  res.json(health);
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
