const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all customers
router.get('/', async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = [];
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (search) {
      paramCount++;
      whereClause.push(`(company_name LIKE $${paramCount} OR business_id LIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) as count FROM customers ${whereString}`, params);
    const total = parseInt(countResult.rows[0].count || 0);

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const result = await db.query(`
      SELECT c.*,
             (SELECT COUNT(*) FROM sites WHERE customer_id = c.id) as sites_count,
             (SELECT COUNT(*) FROM contracts WHERE customer_id = c.id AND status = 'active') as active_contracts
      FROM customers c
      ${whereString}
      ORDER BY c.company_name
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `, params);

    res.json({
      customers: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת לקוחות' });
  }
});

// Get single customer with all related data
router.get('/:id', async (req, res) => {
  try {
    const customerResult = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }

    const [contacts, sites, contracts, invoices] = await Promise.all([
      db.query('SELECT * FROM contacts WHERE customer_id = $1 ORDER BY is_primary DESC', [req.params.id]),
      db.query('SELECT * FROM sites WHERE customer_id = $1 ORDER BY name', [req.params.id]),
      db.query('SELECT * FROM contracts WHERE customer_id = $1 ORDER BY start_date DESC', [req.params.id]),
      db.query('SELECT * FROM invoices WHERE customer_id = $1 ORDER BY issue_date DESC LIMIT 10', [req.params.id])
    ]);

    res.json({
      customer: customerResult.rows[0],
      contacts: contacts.rows,
      sites: sites.rows,
      contracts: contracts.rows,
      invoices: invoices.rows
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת לקוח' });
  }
});

// Create customer
router.post('/', [
  body('company_name').notEmpty().withMessage('נדרש שם חברה')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { company_name, business_id, address, city, service_type, payment_terms, notes } = req.body;

    const customerId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO customers (id, company_name, business_id, address, city, service_type, payment_terms, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [customerId, company_name, business_id, address, city, service_type, payment_terms, notes]);

    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'customer', $3, 'create', $4)
    `, [db.generateUUID(), req.user.id, result.rows[0].id, JSON.stringify(result.rows[0])]);

    res.status(201).json({ customer: result.rows[0] });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת לקוח' });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const { company_name, business_id, address, city, service_type, status, payment_terms, notes } = req.body;

    const result = await db.query(`
      UPDATE customers SET
        company_name = COALESCE($1, company_name),
        business_id = COALESCE($2, business_id),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        service_type = COALESCE($5, service_type),
        status = COALESCE($6, status),
        payment_terms = COALESCE($7, payment_terms),
        notes = COALESCE($8, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [company_name, business_id, address, city, service_type, status, payment_terms, notes, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }

    res.json({ customer: result.rows[0] });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון לקוח' });
  }
});

// Add contact to customer
router.post('/:id/contacts', [
  body('name').notEmpty().withMessage('נדרש שם')
], async (req, res) => {
  try {
    const { name, role, phone, email, is_primary } = req.body;

    if (is_primary) {
      await db.query('UPDATE contacts SET is_primary = 0 WHERE customer_id = $1', [req.params.id]);
    }

    const contactId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO contacts (id, customer_id, name, role, phone, email, is_primary)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [contactId, req.params.id, name, role, phone, email, is_primary ? 1 : 0]);

    res.status(201).json({ contact: result.rows[0] });
  } catch (error) {
    console.error('Add contact error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת איש קשר' });
  }
});

// Get sites for customer
router.get('/:id/sites', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM sites WHERE customer_id = $1 ORDER BY name',
      [req.params.id]
    );
    res.json({ sites: result.rows });
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אתרים' });
  }
});

// Add site to customer
router.post('/:id/sites', [
  body('name').notEmpty().withMessage('נדרש שם אתר'),
  body('address').notEmpty().withMessage('נדרשת כתובת')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, address, city, requirements, requires_weapon, notes } = req.body;

    const siteId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO sites (id, customer_id, name, address, city, requirements, requires_weapon, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [siteId, req.params.id, name, address, city, requirements, requires_weapon ? 1 : 0, notes]);

    res.status(201).json({ site: result.rows[0] });
  } catch (error) {
    console.error('Add site error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת אתר' });
  }
});

// Add contract to customer
router.post('/:id/contracts', [
  body('start_date').isDate().withMessage('נדרש תאריך התחלה')
], async (req, res) => {
  try {
    const { start_date, end_date, monthly_value, terms, document_url, auto_renewal, renewal_reminder_days } = req.body;

    const contractId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO contracts (id, customer_id, start_date, end_date, monthly_value, terms, document_url, auto_renewal, renewal_reminder_days)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [contractId, req.params.id, start_date, end_date, monthly_value, terms, document_url, auto_renewal ?? true, renewal_reminder_days || 30]);

    res.status(201).json({ contract: result.rows[0] });
  } catch (error) {
    console.error('Add contract error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת חוזה' });
  }
});

// Delete customer (admin/manager only)
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    // Delete related data first
    await db.query('DELETE FROM contacts WHERE customer_id = $1', [req.params.id]);
    await db.query('DELETE FROM sites WHERE customer_id = $1', [req.params.id]);
    await db.query('DELETE FROM contracts WHERE customer_id = $1', [req.params.id]);

    const result = await db.query(
      'DELETE FROM customers WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'לקוח לא נמצא' });
    }

    res.json({ message: 'לקוח נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת לקוח' });
  }
});

// Get activities for customer
router.get('/:id/activities', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM activity_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 50',
      ['customer', req.params.id]
    );
    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פעולות' });
  }
});

// Add activity to customer
router.post('/:id/activities', async (req, res) => {
  try {
    const { action, description } = req.body;
    if (!action) return res.status(400).json({ error: 'נדרש סוג פעולה' });

    const activityId = db.generateUUID();
    const result = await db.query(
      `INSERT INTO activity_logs (id, entity_type, entity_id, action, description, user_id, user_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [activityId, 'customer', req.params.id, action, description || '', req.user?.id || '', ((req.user?.firstName || '') + ' ' + (req.user?.lastName || '')).trim() || 'מערכת']
    );
    res.status(201).json({ activity: result.rows[0] });
  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת פעולה' });
  }
});

module.exports = router;
