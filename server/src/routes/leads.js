const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const whatsappHelper = require('../utils/whatsappHelper');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Get all leads with filters
router.get('/', async (req, res) => {
  try {
    const { status, source, assigned_to, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = [];
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (source) {
      paramCount++;
      whereClause.push(`source = $${paramCount}`);
      params.push(source);
    }

    if (assigned_to) {
      paramCount++;
      whereClause.push(`assigned_to = $${paramCount}`);
      params.push(assigned_to);
    }

    if (search) {
      paramCount++;
      whereClause.push(`(company_name LIKE $${paramCount} OR contact_name LIKE $${paramCount} OR phone LIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM leads ${whereString}`,
      params
    );
    const total = parseInt(countResult.rows[0].count || 0);

    // Get leads
    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const result = await db.query(`
      SELECT l.*,
             u.first_name || ' ' || u.last_name as assigned_to_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      ${whereString}
      ORDER BY l.created_at DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `, params);

    res.json({
      leads: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת לידים' });
  }
});

// Get single lead
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.*,
             u.first_name || ' ' || u.last_name as assigned_to_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ליד לא נמצא' });
    }

    // Get activity log
    const activityResult = await db.query(`
      SELECT al.*, u.first_name || ' ' || u.last_name as user_name
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'lead' AND al.entity_id = $1
      ORDER BY al.created_at DESC
      LIMIT 20
    `, [req.params.id]);

    res.json({
      lead: result.rows[0],
      activity: activityResult.rows
    });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ליד' });
  }
});

// Create lead
router.post('/', [
  body('contact_name').notEmpty().withMessage('נדרש שם איש קשר'),
  body('phone').notEmpty().withMessage('נדרש מספר טלפון')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      company_name, contact_name, phone, email, source,
      service_type, location, description, assigned_to, expected_value
    } = req.body;

    const result = await db.query(`
      INSERT INTO leads (company_name, contact_name, phone, email, source,
                        service_type, location, description, assigned_to, expected_value)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [company_name, contact_name, phone, email, source,
        service_type, location, description, assigned_to, expected_value]);

    // Log activity
    await db.query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, changes)
      VALUES ($1, 'lead', $2, 'create', $3)
    `, [req.user.id, result.rows[0].id, JSON.stringify(result.rows[0])]);

    // Send WhatsApp notification (non-blocking)
    whatsappHelper.notifyNewLead(result.rows[0]).catch(() => {});

    res.status(201).json({ lead: result.rows[0] });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת ליד' });
  }
});

// Update lead
router.put('/:id', async (req, res) => {
  try {
    const {
      company_name, contact_name, phone, email, source,
      service_type, location, description, status,
      assigned_to, expected_value, lost_reason
    } = req.body;

    const result = await db.query(`
      UPDATE leads SET
        company_name = COALESCE($1, company_name),
        contact_name = COALESCE($2, contact_name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        source = COALESCE($5, source),
        service_type = COALESCE($6, service_type),
        location = COALESCE($7, location),
        description = COALESCE($8, description),
        status = COALESCE($9, status),
        assigned_to = COALESCE($10, assigned_to),
        expected_value = COALESCE($11, expected_value),
        lost_reason = COALESCE($12, lost_reason),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [company_name, contact_name, phone, email, source,
        service_type, location, description, status,
        assigned_to, expected_value, lost_reason, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ליד לא נמצא' });
    }

    // Log activity
    await db.query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, changes)
      VALUES ($1, 'lead', $2, 'update', $3)
    `, [req.user.id, req.params.id, JSON.stringify(req.body)]);

    // Notify on status change via WhatsApp (non-blocking)
    if (status) {
      const assignedUser = result.rows[0].assigned_to ?
        (await db.query('SELECT phone FROM users WHERE id = $1', [result.rows[0].assigned_to])).rows[0] : null;
      whatsappHelper.notifyLeadStatusChange(result.rows[0], status, assignedUser?.phone).catch(() => {});
    }

    res.json({ lead: result.rows[0] });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון ליד' });
  }
});

// Convert lead to customer
router.post('/:id/convert', async (req, res) => {
  try {
    // Get lead
    const leadResult = await db.query(
      'SELECT * FROM leads WHERE id = $1',
      [req.params.id]
    );

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'ליד לא נמצא' });
    }

    const lead = leadResult.rows[0];

    // Create customer
    const customerResult = await db.query(`
      INSERT INTO customers (company_name, service_type, lead_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [lead.company_name || lead.contact_name, lead.service_type, lead.id]);

    const customer = customerResult.rows[0];

    // Create contact
    await db.query(`
      INSERT INTO contacts (customer_id, name, phone, email, is_primary)
      VALUES ($1, $2, $3, $4, true)
    `, [customer.id, lead.contact_name, lead.phone, lead.email]);

    // Update lead status
    await db.query(
      'UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['won', lead.id]
    );

    // Log activity
    await db.query(`
      INSERT INTO activity_log (user_id, entity_type, entity_id, action, changes)
      VALUES ($1, 'lead', $2, 'convert', $3)
    `, [req.user.id, lead.id, JSON.stringify({ customer_id: customer.id })]);

    res.json({ customer, message: 'ליד הומר ללקוח בהצלחה' });
  } catch (error) {
    console.error('Convert lead error:', error);
    res.status(500).json({ error: 'שגיאה בהמרת ליד' });
  }
});

// Delete lead
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM leads WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ליד לא נמצא' });
    }

    res.json({ message: 'ליד נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת ליד' });
  }
});

// Get lead statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'proposal_sent' THEN 1 ELSE 0 END) as proposals,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN created_at >= date('now', 'start of month') THEN 1 ELSE 0 END) as this_month,
        COALESCE(SUM(CASE WHEN status != 'lost' THEN expected_value ELSE 0 END), 0) as pipeline_value
      FROM leads
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get lead stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

module.exports = router;
