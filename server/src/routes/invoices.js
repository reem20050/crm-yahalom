const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');
const greenInvoiceService = require('../services/greenInvoice');
const { query: dbQuery } = require('../config/database');

const router = express.Router();
router.use(authenticateToken);

// Get all invoices
router.get('/', async (req, res) => {
  try {
    const { status, customer_id, start_date, end_date, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = [];
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause.push(`i.status = $${paramCount}`);
      params.push(status);
    }

    if (customer_id) {
      paramCount++;
      whereClause.push(`i.customer_id = $${paramCount}`);
      params.push(customer_id);
    }

    if (start_date) {
      paramCount++;
      whereClause.push(`i.issue_date >= $${paramCount}`);
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereClause.push(`i.issue_date <= $${paramCount}`);
      params.push(end_date);
    }

    const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) as count FROM invoices i ${whereString}`, params);
    const total = parseInt(countResult.rows[0].count || 0);

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const result = await db.query(`
      SELECT i.*,
             c.company_name,
             CASE
               WHEN i.status = 'sent' AND i.due_date < date('now') THEN 'overdue'
               ELSE i.status
             END as computed_status,
             CASE
               WHEN i.due_date < date('now') THEN CAST(julianday('now') - julianday(i.due_date) AS INTEGER)
               ELSE 0
             END as days_overdue
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      ${whereString}
      ORDER BY i.issue_date DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `, params);

    res.json({
      invoices: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת חשבוניות' });
  }
});

// Get overdue invoices (MUST be before /:id route)
router.get('/status/overdue', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.*,
             c.company_name,
             CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.status = 'sent'
      AND i.due_date < date('now')
      ORDER BY i.due_date
    `);

    res.json({ invoices: result.rows });
  } catch (error) {
    console.error('Get overdue invoices error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת חשבוניות באיחור' });
  }
});

// Get invoice summary (MUST be before /:id route)
router.get('/summary/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    const result = await db.query(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END), 0) as pending_amount,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as pending_count
      FROM invoices
      WHERE CAST(strftime('%Y', issue_date) AS INTEGER) = $1
      AND CAST(strftime('%m', issue_date) AS INTEGER) = $2
    `, [targetYear, targetMonth]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get invoice summary error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סיכום חשבוניות' });
  }
});

// Get single invoice
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.*,
             c.company_name,
             c.business_id,
             c.address as customer_address,
             e.event_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN events e ON i.event_id = e.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'חשבונית לא נמצאה' });
    }

    res.json({ invoice: result.rows[0] });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת חשבונית' });
  }
});

// Create invoice (will integrate with Green Invoice)
router.post('/', requireManager, [
  body('customer_id').notEmpty().withMessage('נדרש לקוח'),
  body('issue_date').isDate().withMessage('נדרש תאריך הפקה'),
  body('due_date').isDate().withMessage('נדרש תאריך תשלום')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      customer_id, event_id, issue_date, due_date,
      amount, vat_amount, total_amount, description,
      payment_type // 1=cash, 2=check, 3=credit card, 4=bank transfer
    } = req.body;

    // Support both: total_amount from frontend, or amount (pre-VAT) + calculated VAT
    const baseAmount = amount || total_amount;
    if (!baseAmount || isNaN(baseAmount) || baseAmount <= 0) {
      return res.status(400).json({ error: 'נדרש סכום תקין' });
    }

    const vatCalc = vat_amount || (amount ? amount * 0.17 : 0);
    const totalCalc = total_amount || (amount ? amount + vatCalc : baseAmount);

    const invoiceId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO invoices (id, customer_id, event_id, issue_date, due_date,
                           amount, vat_amount, total_amount, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [invoiceId, customer_id, event_id, issue_date, due_date,
        baseAmount, vatCalc, totalCalc, description]);

    const invoice = result.rows[0];

    // Try to create on Green Invoice if configured (non-blocking)
    try {
      const settings = dbQuery(`SELECT green_invoice_api_key FROM integration_settings WHERE id = 'main'`);
      if (settings.rows.length > 0 && settings.rows[0].green_invoice_api_key) {
        const customerResult = await db.query(`
          SELECT c.*, ct.name as contact_name, ct.email as contact_email
          FROM customers c
          LEFT JOIN contacts ct ON ct.customer_id = c.id AND ct.is_primary = 1
          WHERE c.id = $1
        `, [customer_id]);

        if (customerResult.rows.length > 0) {
          const customer = customerResult.rows[0];
          const giInvoice = await greenInvoiceService.createInvoice(
            {
              name: customer.company_name,
              email: customer.contact_email,
              businessId: customer.business_id,
              address: customer.address,
              city: customer.city
            },
            [{ description: description || 'שירותי אבטחה', price: baseAmount, quantity: 1 }],
            due_date,
            description,
            payment_type || 4
          );

          // Update our invoice with Green Invoice ID
          await db.query(`
            UPDATE invoices SET green_invoice_id = $1, invoice_number = $2, document_url = $3
            WHERE id = $4
          `, [giInvoice.id, giInvoice.number, giInvoice.url?.he, invoice.id]);

          invoice.green_invoice_id = giInvoice.id;
          invoice.invoice_number = giInvoice.number;
          invoice.document_url = giInvoice.url?.he;
        }
      }
    } catch (giError) {
      console.warn('Green Invoice sync failed (invoice still created locally):', giError.message);
    }

    res.status(201).json({ invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת חשבונית' });
  }
});

// Send invoice email to customer
router.post('/:id/send-email', requireManager, async (req, res) => {
  try {
    // Get invoice with customer details
    const result = await db.query(`
      SELECT i.*,
             c.company_name,
             ct.email as contact_email,
             ct.name as contact_name
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN contacts ct ON ct.customer_id = c.id AND ct.is_primary = 1
      WHERE i.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'חשבונית לא נמצאה' });
    }

    const invoice = result.rows[0];

    // Try: 1) email from request body, 2) primary contact, 3) any contact with email
    let email = req.body.email || invoice.contact_email;
    if (!email && invoice.customer_id) {
      const anyContact = await db.query(
        `SELECT email, name FROM contacts WHERE customer_id = $1 AND email IS NOT NULL AND email != '' ORDER BY is_primary DESC LIMIT 1`,
        [invoice.customer_id]
      );
      if (anyContact.rows.length > 0) {
        email = anyContact.rows[0].email;
        if (!invoice.contact_name) invoice.contact_name = anyContact.rows[0].name;
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'לא נמצא אימייל ללקוח. הוסף איש קשר עם כתובת אימייל בדף הלקוח, או שלח עם אימייל ידני.' });
    }

    const googleHelper = require('../utils/googleHelper');
    if (!googleHelper.isConfigured()) {
      return res.status(400).json({ error: 'Gmail לא מחובר. חבר Google בדף ההגדרות, ולוודא שניתנו הרשאות Gmail (צריך להתנתק ולהתחבר מחדש אם חיברת בעבר בלי הרשאות Gmail).' });
    }

    const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8);
    const customerName = invoice.contact_name || invoice.company_name;

    const emailBody = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #2563eb; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">חשבונית #${invoiceNumber}</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">צוות יהלום - שירותי אבטחה</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0;">
          <p style="font-size: 16px;">שלום ${customerName},</p>
          <p>מצורפת חשבונית מספר <strong>#${invoiceNumber}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">תאריך הפקה:</td>
              <td style="padding: 8px 0; font-weight: bold;">${invoice.issue_date}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">תאריך לתשלום:</td>
              <td style="padding: 8px 0; font-weight: bold;">${invoice.due_date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">סכום לתשלום:</td>
              <td style="padding: 8px 0; font-weight: bold; font-size: 18px; color: #2563eb;">₪${Number(invoice.total_amount).toLocaleString()}</td>
            </tr>
          </table>
          ${invoice.description ? `<p style="color: #64748b;">פירוט: ${invoice.description}</p>` : ''}
          ${invoice.document_url ? `<p style="margin-top: 16px;"><a href="${invoice.document_url}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">צפה בחשבונית</a></p>` : ''}
          <p style="margin-top: 24px; color: #64748b;">לכל שאלה, אנו כאן לשירותכם.</p>
        </div>
        <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
          צוות יהלום - שירותי אבטחה ו-CRM
        </div>
      </div>
    `;

    await googleHelper.sendEmail(email, `חשבונית #${invoiceNumber} - צוות יהלום`, emailBody);

    // Update invoice status to sent if it was draft
    if (invoice.status === 'draft') {
      await db.query(`UPDATE invoices SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id]);
    }

    res.json({ message: `חשבונית נשלחה בהצלחה ל-${email}` });
  } catch (error) {
    console.error('Send invoice email error:', error);
    const errMsg = error.message || 'שגיאה בשליחת חשבונית במייל';
    // Provide helpful error messages
    if (errMsg.includes('insufficient') || errMsg.includes('scope') || errMsg.includes('permission')) {
      return res.status(400).json({ error: 'אין הרשאות Gmail. יש להתנתק מ-Google בהגדרות ולהתחבר מחדש כדי לאשר הרשאות שליחת מייל.' });
    }
    if (errMsg.includes('Gmail לא מחובר') || errMsg.includes('invalid_grant') || errMsg.includes('Token')) {
      return res.status(400).json({ error: errMsg });
    }
    res.status(500).json({ error: 'שגיאה בשליחת חשבונית במייל: ' + errMsg });
  }
});

// Update invoice status
router.patch('/:id/status', requireManager, [
  body('status').isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']).withMessage('סטטוס לא תקין')
], async (req, res) => {
  try {
    const { status, payment_date } = req.body;

    let query = `
      UPDATE invoices SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
    `;
    let params = [status];
    let paramCount = 1;

    if (status === 'paid' && payment_date) {
      paramCount++;
      query += `, payment_date = $${paramCount}`;
      params.push(payment_date);
    } else if (status === 'paid') {
      query += `, payment_date = CURRENT_DATE`;
    }

    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(req.params.id);

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'חשבונית לא נמצאה' });
    }

    const updatedInvoice = result.rows[0];

    // Sync status to Green Invoice if connected (non-blocking)
    if (updatedInvoice.green_invoice_id && status === 'paid') {
      try {
        await greenInvoiceService.markAsPaid(updatedInvoice.green_invoice_id, payment_date);
      } catch (giError) {
        console.warn('Green Invoice status sync failed:', giError.message);
      }
    }

    res.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error('Update invoice status error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון סטטוס חשבונית' });
  }
});

// Delete invoice (admin/manager only, draft status only)
router.delete('/:id', requireManager, async (req, res) => {
  try {
    // Check if invoice is in draft status
    const invoiceResult = await db.query(
      'SELECT status FROM invoices WHERE id = $1',
      [req.params.id]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'חשבונית לא נמצאה' });
    }

    if (invoiceResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'ניתן למחוק רק חשבוניות בסטטוס טיוטה' });
    }

    const result = await db.query(
      'DELETE FROM invoices WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    res.json({ message: 'חשבונית נמחקה בהצלחה' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת חשבונית' });
  }
});

module.exports = router;
