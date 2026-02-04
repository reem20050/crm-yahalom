const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

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

    const countResult = await db.query(`SELECT COUNT(*) FROM invoices i ${whereString}`, params);
    const total = parseInt(countResult.rows[0].count);

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const result = await db.query(`
      SELECT i.*,
             c.company_name,
             CASE
               WHEN i.status = 'sent' AND i.due_date < CURRENT_DATE THEN 'overdue'
               ELSE i.status
             END as computed_status,
             CASE
               WHEN i.due_date < CURRENT_DATE THEN CURRENT_DATE - i.due_date
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
  body('amount').isNumeric().withMessage('נדרש סכום'),
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
      amount, vat_amount, total_amount, description
    } = req.body;

    const vatCalc = vat_amount || (amount * 0.17);
    const totalCalc = total_amount || (amount + vatCalc);

    const result = await db.query(`
      INSERT INTO invoices (customer_id, event_id, issue_date, due_date,
                           amount, vat_amount, total_amount, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [customer_id, event_id, issue_date, due_date,
        amount, vatCalc, totalCalc, description]);

    res.status(201).json({ invoice: result.rows[0] });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת חשבונית' });
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

    res.json({ invoice: result.rows[0] });
  } catch (error) {
    console.error('Update invoice status error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון סטטוס חשבונית' });
  }
});

// Get overdue invoices
router.get('/status/overdue', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT i.*,
             c.company_name,
             CURRENT_DATE - i.due_date as days_overdue
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.status = 'sent'
      AND i.due_date < CURRENT_DATE
      ORDER BY i.due_date
    `);

    res.json({ invoices: result.rows });
  } catch (error) {
    console.error('Get overdue invoices error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת חשבוניות באיחור' });
  }
});

// Get invoice summary
router.get('/summary/monthly', async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    const result = await db.query(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) as paid_amount,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'sent'), 0) as pending_amount,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE status = 'sent') as pending_count
      FROM invoices
      WHERE EXTRACT(YEAR FROM issue_date) = $1
      AND EXTRACT(MONTH FROM issue_date) = $2
    `, [targetYear, targetMonth]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get invoice summary error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סיכום חשבוניות' });
  }
});

module.exports = router;
