const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole, requireManager } = require('../middleware/auth');
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

    // Always exclude soft-deleted
    whereClause.push(`deleted_at IS NULL`);

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

    const whereString = `WHERE ${whereClause.join(' AND ')}`;

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

// Get lead statistics (MUST be before /:id route)
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'proposal_sent' THEN 1 ELSE 0 END) as proposals,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
        SUM(CASE WHEN created_at >= date('now', 'localtime', 'start of month') THEN 1 ELSE 0 END) as this_month,
        COALESCE(SUM(CASE WHEN status != 'lost' THEN expected_value ELSE 0 END), 0) as pipeline_value
      FROM leads
      WHERE deleted_at IS NULL
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get lead stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

// Get deleted leads (trash) - MUST be before /:id
router.get('/trash/list', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.*, u.first_name || ' ' || u.last_name as assigned_to_name
      FROM leads l LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.deleted_at IS NOT NULL ORDER BY l.deleted_at DESC
    `);
    res.json({ leads: result.rows });
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פריטים מחוקים' });
  }
});

// Bulk update lead status
router.post('/bulk-status', requireManager, async (req, res) => {
  try {
    const { lead_ids, status } = req.body;
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'נדרשים מזהי לידים' });
    }
    const validStatuses = ['new', 'contacted', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'סטטוס לא תקין' });
    }
    const placeholders = lead_ids.map(() => '?').join(',');
    db.query(`UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`, [status, ...lead_ids]);
    res.json({ message: `${lead_ids.length} לידים עודכנו`, count: lead_ids.length });
  } catch (error) {
    console.error('Bulk status update error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון לידים' });
  }
});

// Bulk delete leads
router.post('/bulk-delete', requireManager, async (req, res) => {
  try {
    const { lead_ids } = req.body;
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'נדרשים מזהי לידים' });
    }
    const placeholders = lead_ids.map(() => '?').join(',');
    db.query(`DELETE FROM activity_logs WHERE entity_type = 'lead' AND entity_id IN (${placeholders})`, lead_ids);
    db.query(`DELETE FROM leads WHERE id IN (${placeholders})`, lead_ids);
    res.json({ message: `${lead_ids.length} לידים נמחקו`, count: lead_ids.length });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת לידים' });
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
      WHERE l.id = $1 AND l.deleted_at IS NULL
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
router.post('/', requireManager, [
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

    const leadId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO leads (id, company_name, contact_name, phone, email, source,
                        service_type, location, description, assigned_to, expected_value)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [leadId, company_name, contact_name, phone, email, source,
        service_type, location, description, assigned_to, expected_value]);

    // Log activity
    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'lead', $3, 'create', $4)
    `, [db.generateUUID(), req.user.id, result.rows[0].id, JSON.stringify(result.rows[0])]);

    // Send WhatsApp notification (non-blocking)
    whatsappHelper.notifyNewLead(result.rows[0]).catch(() => {});

    res.status(201).json({ lead: result.rows[0] });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת ליד' });
  }
});

// Update lead
router.put('/:id', requireManager, async (req, res) => {
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
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'lead', $3, 'update', $4)
    `, [db.generateUUID(), req.user.id, req.params.id, JSON.stringify(req.body)]);

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

// Convert lead to customer (with optional contract & site via wizard)
router.post('/:id/convert', requireManager, async (req, res) => {
  try {
    const { customer: customerData, contract: contractData, site: siteData } = req.body;

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
    const newCustomerId = db.generateUUID();
    const companyName = customerData?.company_name || lead.company_name || lead.contact_name;
    const address = customerData?.address || '';
    const city = customerData?.city || '';
    const serviceType = customerData?.service_type || lead.service_type || '';
    const notes = customerData?.notes || lead.description || '';

    const customerResult = await db.query(`
      INSERT INTO customers (id, company_name, address, city, service_type, notes, lead_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [newCustomerId, companyName, address, city, serviceType, notes, lead.id]);

    const customer = customerResult.rows[0];

    // Create primary contact
    const newContactId = db.generateUUID();
    const contactName = customerData?.contact_name || lead.contact_name;
    const contactPhone = customerData?.phone || lead.phone;
    const contactEmail = customerData?.email || lead.email || '';
    await db.query(`
      INSERT INTO contacts (id, customer_id, name, phone, email, is_primary)
      VALUES ($1, $2, $3, $4, $5, 1)
    `, [newContactId, customer.id, contactName, contactPhone, contactEmail]);

    // Create contract if provided
    let contractId = null;
    if (contractData && contractData.monthly_value) {
      contractId = db.generateUUID();
      await db.query(`
        INSERT INTO contracts (id, customer_id, start_date, end_date, monthly_value, terms, status, auto_renewal)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
      `, [
        contractId,
        customer.id,
        contractData.start_date || new Date().toISOString().split('T')[0],
        contractData.end_date || '',
        contractData.monthly_value,
        contractData.terms || 'שוטף + 30',
        contractData.auto_renewal ? 1 : 0,
      ]);
    }

    // Create site if provided
    let siteId = null;
    if (siteData && siteData.name) {
      siteId = db.generateUUID();
      await db.query(`
        INSERT INTO sites (id, customer_id, name, address, city, requirements, notes, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
      `, [
        siteId,
        customer.id,
        siteData.name,
        siteData.address || '',
        siteData.city || '',
        siteData.requirements || '',
        siteData.notes || '',
      ]);
    }

    // Update lead status to won
    await db.query(
      'UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['won', lead.id]
    );

    // Log activity
    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'lead', $3, 'convert', $4)
    `, [db.generateUUID(), req.user.id, lead.id, JSON.stringify({
      customer_id: customer.id,
      contract_id: contractId,
      site_id: siteId,
    })]);

    res.json({
      customer,
      contract_id: contractId,
      site_id: siteId,
      message: 'ליד הומר ללקוח בהצלחה',
    });
  } catch (error) {
    console.error('Convert lead error:', error);
    res.status(500).json({ error: 'שגיאה בהמרת ליד' });
  }
});

// Delete lead - soft delete
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE leads SET deleted_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
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

// Restore lead
router.post('/:id/restore', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE leads SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ליד לא נמצא בפח' });
    }
    res.json({ lead: result.rows[0], message: 'ליד שוחזר בהצלחה' });
  } catch (error) {
    console.error('Restore lead error:', error);
    res.status(500).json({ error: 'שגיאה בשחזור ליד' });
  }
});

// Permanently delete lead
router.delete('/:id/permanent', requireRole('admin'), async (req, res) => {
  try {
    const check = await db.query('SELECT id FROM leads WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'ליד לא נמצא בפח' });
    }
    await db.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ message: 'ליד נמחק לצמיתות' });
  } catch (error) {
    console.error('Permanent delete lead error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת ליד לצמיתות' });
  }
});

// Get activities for lead
router.get('/:id/activities', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM activity_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 50',
      ['lead', req.params.id]
    );
    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פעולות' });
  }
});

// Add activity to lead
router.post('/:id/activities', async (req, res) => {
  try {
    const { action, description } = req.body;
    if (!action) return res.status(400).json({ error: 'נדרש סוג פעולה' });

    const activityId = db.generateUUID();
    const result = await db.query(
      `INSERT INTO activity_logs (id, entity_type, entity_id, action, description, user_id, user_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [activityId, 'lead', req.params.id, action, description || '', req.user?.id || '', ((req.user?.first_name || '') + ' ' + (req.user?.last_name || '')).trim() || 'מערכת']
    );
    res.status(201).json({ activity: result.rows[0] });
  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת פעולה' });
  }
});

module.exports = router;
