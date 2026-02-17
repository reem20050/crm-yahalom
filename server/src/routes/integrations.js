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

      // Log to whatsapp_messages table with entity matching
      const entity = whatsappService.findEntityByPhone(result.from);
      whatsappService.logMessage({
        phone: result.from,
        direction: 'incoming',
        message: result.text || '',
        context: 'incoming',
        entityType: entity?.type || null,
        entityId: entity?.id || null,
        status: 'received'
      });

      // Also keep activity_log for backwards compatibility
      try {
        const logId = generateUUID();
        query(`INSERT INTO activity_log (id, action, entity_type, entity_id, changes, created_at)
          VALUES (?, 'whatsapp_received', 'whatsapp', '', ?, datetime('now'))`,
          [logId, JSON.stringify({ from: result.from, text: result.text?.substring(0, 500) })]);
      } catch (logErr) { /* non-blocking */ }

      await whatsappHelper.handleIncomingMessage(result.from, result.text, result.timestamp);
    }

    if (result && result.type === 'status') {
      // Update message status in whatsapp_messages
      try {
        if (result.messageId) {
          query(`UPDATE whatsapp_messages SET status = $1 WHERE waha_message_id = $2`,
            [result.status === 3 ? 'read' : result.status === 2 ? 'delivered' : 'sent', result.messageId]);
        }
      } catch (e) { /* non-blocking */ }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.sendStatus(200); // Always return 200 to prevent retrying
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

    const settings = result.rows.length > 0 ? result.rows[0] : null;

    // Check WhatsApp status in real-time (DB config OR env vars)
    let whatsappConnected = false;
    let whatsappPhone = settings?.whatsapp_phone_display || null;
    let wahaUrl = null;
    let wahaConfigured = false;
    let sessionStatus = null;

    // First check if DB has config
    if (settings?.whatsapp_phone_id) {
      wahaUrl = settings.whatsapp_phone_id.split('|')[0];
    }

    // Try to check WAHA status in real-time
    try {
      const hasConfig = whatsappService._ensureConfig();
      // WAHA is configured if DB has config OR ENV has WAHA_API_URL
      wahaConfigured = hasConfig || !!process.env.WAHA_API_URL;

      const wahaStatus = await whatsappService.getSessionStatus();
      if (wahaStatus.success) {
        sessionStatus = wahaStatus.status;
        if (wahaStatus.status === 'WORKING') {
          whatsappConnected = true;
          if (!whatsappPhone) {
            try {
              const accountInfo = await whatsappService.getAccountInfo();
              if (accountInfo.success) {
                whatsappPhone = accountInfo.account?.id?.replace('@c.us', '') || accountInfo.account?.pushName;
              }
            } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (e) {
      // WAHA not reachable, fall back to DB check
      wahaConfigured = !!settings?.whatsapp_phone_id || !!process.env.WAHA_API_URL;
      whatsappConnected = false;
    }

    res.json({
      google: {
        connected: !!settings?.google_tokens,
        email: settings?.google_email || null
      },
      whatsapp: {
        connected: whatsappConnected,
        phoneNumber: whatsappPhone,
        wahaUrl: wahaUrl,
        wahaConfigured: wahaConfigured,
        wahaSessionStatus: sessionStatus
      },
      greenInvoice: {
        connected: !!settings?.green_invoice_api_key,
        businessName: settings?.green_invoice_business_name || null
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

// Get Google Calendar events
router.get('/google/calendar/events', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'נדרש start_date ו-end_date' });
    }

    // Get Google tokens
    const settings = query(`SELECT google_tokens FROM integration_settings WHERE id = 'main'`);
    if (!settings.rows.length || !settings.rows[0].google_tokens) {
      return res.json({ events: [], connected: false });
    }

    const tokens = JSON.parse(settings.rows[0].google_tokens);
    googleService.setCredentials(tokens);

    const events = await googleService.listCalendarEvents(start_date, end_date);
    res.json({ events, connected: true });
  } catch (error) {
    console.error('Google calendar events error:', error);
    // Return empty array instead of 500 so frontend degrades gracefully
    res.json({ events: [], connected: false, error: error.message });
  }
});

// ====================
// WHATSAPP INTEGRATION (WAHA - WhatsApp HTTP API)
// ====================

// Save WhatsApp WAHA settings (URL of WAHA instance)
router.post('/whatsapp/settings', async (req, res) => {
  try {
    const { wahaUrl, apiKey } = req.body;

    if (!wahaUrl) {
      return res.status(400).json({ message: 'נדרש כתובת שרת WAHA' });
    }

    // Validate URL by checking WAHA health (with API key if provided)
    try {
      const axios = require('axios');
      const headers = apiKey ? { 'X-Api-Key': apiKey } : {};
      await axios.get(`${wahaUrl}/api/sessions`, { headers, timeout: 5000 });
    } catch (e) {
      if (e.response?.status === 401) {
        return res.status(400).json({ message: 'API Key שגוי. בדוק את ה-WAHA_API_KEY בהגדרות WAHA.' });
      }
      return res.status(400).json({ message: 'לא ניתן להתחבר לשרת WAHA. ודא שהכתובת נכונה ושהשרת פעיל.' });
    }

    // Store "wahaUrl|apiKey" in whatsapp_phone_id field
    const storedValue = apiKey ? `${wahaUrl}|${apiKey}` : wahaUrl;
    const existingSettings = query(`SELECT * FROM integration_settings WHERE id = 'main'`);

    if (existingSettings.rows.length === 0) {
      query(`
        INSERT INTO integration_settings (id, whatsapp_phone_id, whatsapp_access_token, updated_at)
        VALUES ('main', ?, 'default', datetime('now'))
      `, [storedValue]);
    } else {
      query(`
        UPDATE integration_settings
        SET whatsapp_phone_id = ?, whatsapp_access_token = 'default', updated_at = datetime('now')
        WHERE id = 'main'
      `, [storedValue]);
    }

    // Update service in memory
    whatsappService.wahaUrl = wahaUrl;
    whatsappService.apiKey = apiKey || '';
    whatsappService.sessionName = 'default';

    // Start WAHA session
    const startResult = await whatsappService.startSession();

    res.json({ message: 'WAHA מוגדר בהצלחה', sessionStarted: startResult.success });
  } catch (error) {
    console.error('WhatsApp settings error:', error);
    res.status(500).json({ message: 'שגיאה בשמירת הגדרות WhatsApp' });
  }
});

// Get session status
router.get('/whatsapp/status', async (req, res) => {
  try {
    whatsappService._ensureConfig();
    const result = await whatsappService.getSessionStatus();
    if (result.success) {
      let phoneNumber = null;
      if (result.status === 'WORKING') {
        const accountInfo = await whatsappService.getAccountInfo();
        if (accountInfo.success) {
          phoneNumber = accountInfo.account?.id?.replace('@c.us', '') || accountInfo.account?.pushName;
          // Save phone display
          query(`UPDATE integration_settings SET whatsapp_phone_display = ? WHERE id = 'main'`, [phoneNumber || '']);
        }
      }
      res.json({ status: result.status, phoneNumber, data: result.data });
    } else {
      res.json({ status: 'ERROR', error: result.error });
    }
  } catch (error) {
    console.error('WhatsApp status error:', error);
    res.status(500).json({ message: 'שגיאה בבדיקת סטטוס' });
  }
});

// Get QR code for authentication
router.get('/whatsapp/qr', async (req, res) => {
  try {
    whatsappService._ensureConfig();

    // Make sure session is started
    await whatsappService.startSession();

    const result = await whatsappService.getQR();
    if (result.success) {
      res.json({ qr: result.qr });
    } else if (result.error === 'already_authenticated') {
      res.json({ authenticated: true, message: 'כבר מחובר!' });
    } else {
      res.status(400).json({ message: result.error });
    }
  } catch (error) {
    console.error('WhatsApp QR error:', error);
    res.status(500).json({ message: 'שגיאה בקבלת QR' });
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

// Start WAHA session (uses ENV config, no URL input needed)
router.post('/whatsapp/start-session', async (req, res) => {
  try {
    whatsappService._ensureConfig();
    const startResult = await whatsappService.startSession();
    const statusResult = await whatsappService.getSessionStatus();
    res.json({
      success: startResult.success,
      status: statusResult.success ? statusResult.status : 'UNKNOWN'
    });
  } catch (error) {
    console.error('WhatsApp start-session error:', error);
    res.status(500).json({ message: 'שגיאה בהפעלת session של WhatsApp' });
  }
});

// Disconnect WhatsApp (logout + clear settings)
router.post('/whatsapp/disconnect', async (req, res) => {
  try {
    // Logout from WAHA session
    await whatsappService.logoutSession();

    query(`
      UPDATE integration_settings
      SET whatsapp_phone_id = NULL, whatsapp_access_token = NULL, whatsapp_phone_display = NULL, updated_at = datetime('now')
      WHERE id = 'main'
    `);

    whatsappService.wahaUrl = null;
    whatsappService.connected = false;

    res.json({ message: 'WhatsApp נותק בהצלחה' });
  } catch (error) {
    console.error('WhatsApp disconnect error:', error);
    res.status(500).json({ message: 'שגיאה בניתוק WhatsApp' });
  }
});

// Send WhatsApp message (with logging)
router.post('/whatsapp/send', async (req, res) => {
  try {
    const { to, message, entityType, entityId } = req.body;

    if (!to || !message) {
      return res.status(400).json({ message: 'נדרש מספר טלפון והודעה' });
    }

    // sendMessage now auto-logs to whatsapp_messages
    const result = await whatsappService.sendMessage(to, message, {
      context: 'manual',
      entityType: entityType || null,
      entityId: entityId || null
    });

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
// WHATSAPP MESSAGE HISTORY
// ====================

// Get messages for an entity (employee/customer)
router.get('/whatsapp/messages', async (req, res) => {
  try {
    const { entityType, entityId, phone, limit: lim } = req.query;
    const messageLimit = Math.min(parseInt(lim) || 100, 500);

    let sql, params;
    if (entityType && entityId) {
      sql = `SELECT * FROM whatsapp_messages WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT $3`;
      params = [entityType, entityId, messageLimit];
    } else if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      sql = `SELECT * FROM whatsapp_messages WHERE phone LIKE '%' || $1 || '%' ORDER BY created_at DESC LIMIT $2`;
      params = [cleanPhone.slice(-9), messageLimit];
    } else {
      sql = `SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT $1`;
      params = [messageLimit];
    }

    const result = query(sql, params);
    // Return in chronological order for chat display
    res.json({ messages: result.rows.reverse() });
  } catch (error) {
    console.error('Get WhatsApp messages error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת הודעות' });
  }
});

// Get conversations list (grouped by phone number)
router.get('/whatsapp/conversations', async (req, res) => {
  try {
    const result = query(`
      SELECT phone,
             entity_type,
             entity_id,
             COUNT(*) as message_count,
             MAX(created_at) as last_message_at,
             (SELECT message FROM whatsapp_messages wm2
              WHERE wm2.phone = wm.phone
              ORDER BY wm2.created_at DESC LIMIT 1) as last_message,
             (SELECT direction FROM whatsapp_messages wm3
              WHERE wm3.phone = wm.phone
              ORDER BY wm3.created_at DESC LIMIT 1) as last_direction
      FROM whatsapp_messages wm
      GROUP BY phone
      ORDER BY last_message_at DESC
    `);

    // Enrich with entity names
    const conversations = result.rows.map(conv => {
      let entityName = null;
      if (conv.entity_type === 'employee' && conv.entity_id) {
        try {
          const emp = query(`SELECT first_name || ' ' || last_name as name FROM employees WHERE id = $1`, [conv.entity_id]);
          entityName = emp.rows[0]?.name;
        } catch (e) { /* ignore */ }
      } else if (conv.entity_type === 'customer' && conv.entity_id) {
        try {
          const cust = query(`SELECT company_name as name FROM customers WHERE id = $1`, [conv.entity_id]);
          entityName = cust.rows[0]?.name;
        } catch (e) { /* ignore */ }
      }
      return { ...conv, entity_name: entityName };
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Get WhatsApp conversations error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת שיחות' });
  }
});

// Send message and return immediately (for chat UI)
router.post('/whatsapp/chat/send', async (req, res) => {
  try {
    const { phone, message, entityType, entityId } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ message: 'נדרש מספר טלפון והודעה' });
    }

    const result = await whatsappService.sendMessage(phone, message, {
      context: 'manual',
      entityType: entityType || null,
      entityId: entityId || null
    });

    if (result.success) {
      res.json({ success: true, messageId: result.messageId });
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (error) {
    console.error('WhatsApp chat send error:', error);
    res.status(500).json({ message: 'שגיאה בשליחת הודעה' });
  }
});

// Send invoice reminder via WhatsApp
router.post('/whatsapp/invoice-remind/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // Get invoice + customer contact
    const invoiceResult = query(`
      SELECT i.*, c.company_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.id = $1
    `, [invoiceId]);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ message: 'חשבונית לא נמצאה' });
    }

    const invoice = invoiceResult.rows[0];

    // Get primary contact phone
    const contactResult = query(`
      SELECT name, phone, customer_id FROM contacts
      WHERE customer_id = $1 AND phone IS NOT NULL
      ORDER BY is_primary DESC LIMIT 1
    `, [invoice.customer_id]);

    if (contactResult.rows.length === 0) {
      return res.status(400).json({ message: 'לא נמצא איש קשר עם טלפון ללקוח זה' });
    }

    const contact = contactResult.rows[0];

    const result = await whatsappService.sendInvoiceReminder(contact, invoice);

    if (result.success) {
      res.json({ message: 'תזכורת חשבונית נשלחה בהצלחה' });
    } else {
      res.status(400).json({ message: result.error || 'שגיאה בשליחת תזכורת' });
    }
  } catch (error) {
    console.error('WhatsApp invoice remind error:', error);
    res.status(500).json({ message: 'שגיאה בשליחת תזכורת חשבונית' });
  }
});

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

// ====================
// EMAIL TEMPLATES
// ====================

// Get all email templates
router.get('/email-templates', (req, res) => {
  try {
    const result = query('SELECT * FROM email_templates ORDER BY category, name');
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Get email templates error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת תבניות אימייל' });
  }
});

// Create email template
router.post('/email-templates', (req, res) => {
  try {
    const { name, subject, body, category, variables } = req.body;
    if (!name || !subject || !body) {
      return res.status(400).json({ message: 'נדרש שם, נושא וגוף' });
    }
    const id = require('crypto').randomUUID();
    query('INSERT INTO email_templates (id, name, subject, body, category, variables) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, name, subject, body, category || 'general', variables || '']);
    res.json({ template: { id, name, subject, body, category: category || 'general', variables: variables || '' } });
  } catch (error) {
    console.error('Create email template error:', error);
    res.status(500).json({ message: 'שגיאה ביצירת תבנית אימייל' });
  }
});

// Delete email template
router.delete('/email-templates/:id', (req, res) => {
  try {
    query('DELETE FROM email_templates WHERE id = $1', [req.params.id]);
    res.json({ message: 'תבנית נמחקה' });
  } catch (error) {
    console.error('Delete email template error:', error);
    res.status(500).json({ message: 'שגיאה במחיקת תבנית' });
  }
});

// ====================
// SEND EMAIL (General)
// ====================

router.post('/google/send-email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ message: 'נדרש נמען, נושא וגוף ההודעה' });
    }

    // Get Google tokens
    const settings = query(`SELECT google_tokens FROM integration_settings WHERE id = 'main'`);
    if (!settings.rows.length || !settings.rows[0].google_tokens) {
      return res.status(400).json({ message: 'Google לא מחובר. חבר את Google בהגדרות האינטגרציות.' });
    }

    const tokens = JSON.parse(settings.rows[0].google_tokens);
    googleService.setCredentials(tokens);

    await googleService.sendEmail(to, subject, body);

    // Log the activity
    try {
      const logId = require('crypto').randomUUID();
      query(`INSERT INTO activity_logs (id, entity_type, entity_id, action, description, user_id, user_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [logId, 'email', 'sent', 'email_sent', `אימייל נשלח ל-${to}: ${subject}`, req.user?.id || null, req.user?.name || 'מערכת']);
    } catch (logErr) { /* ignore logging errors */ }

    res.json({ message: 'אימייל נשלח בהצלחה' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ message: 'שגיאה בשליחת אימייל: ' + (error.message || '') });
  }
});

module.exports = router;
