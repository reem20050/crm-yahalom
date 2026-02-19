const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all contractors
router.get('/', async (req, res) => {
  try {
    const { search, status, limit = 50 } = req.query;

    let whereClause = [];
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause.push(`c.status = $${paramCount}`);
      params.push(status);
    }

    if (search) {
      paramCount++;
      whereClause.push(`(c.company_name LIKE $${paramCount} OR c.contact_name LIKE $${paramCount} OR c.phone LIKE $${paramCount} OR c.email LIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    const whereString = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    paramCount++;
    params.push(limit);

    const result = await db.query(`
      SELECT c.*,
             (SELECT COUNT(*) FROM contractor_workers WHERE contractor_id = c.id AND status = 'active') as workers_count
      FROM contractors c
      ${whereString}
      ORDER BY c.created_at DESC
      LIMIT $${paramCount}
    `, params);

    res.json({ contractors: result.rows });
  } catch (error) {
    console.error('Get contractors error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת קבלנים' });
  }
});

// Get single contractor with workers and event assignments
router.get('/:id', async (req, res) => {
  try {
    const contractorResult = await db.query('SELECT * FROM contractors WHERE id = $1', [req.params.id]);

    if (contractorResult.rows.length === 0) {
      return res.status(404).json({ error: 'קבלן לא נמצא' });
    }

    const [workers, eventAssignments] = await Promise.all([
      db.query('SELECT * FROM contractor_workers WHERE contractor_id = $1 ORDER BY first_name', [req.params.id]),
      db.query(`
        SELECT eca.*, e.event_name, e.event_date, e.location
        FROM event_contractor_assignments eca
        JOIN events e ON e.id = eca.event_id
        WHERE eca.contractor_id = $1
        ORDER BY e.event_date DESC
      `, [req.params.id])
    ]);

    res.json({
      contractor: contractorResult.rows[0],
      workers: workers.rows,
      eventAssignments: eventAssignments.rows
    });
  } catch (error) {
    console.error('Get contractor error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת קבלן' });
  }
});

// Create contractor
router.post('/', [
  body('company_name').notEmpty().withMessage('נדרש שם חברה'),
  body('contact_name').notEmpty().withMessage('נדרש שם איש קשר')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      company_name, contact_name, phone, email, address, city,
      specialization, hourly_rate, daily_rate, payment_terms,
      bank_name, bank_branch, bank_account, max_workers, notes
    } = req.body;

    const contractorId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO contractors (
        id, company_name, contact_name, phone, email, address, city,
        specialization, hourly_rate, daily_rate, payment_terms,
        bank_name, bank_branch, bank_account, max_workers, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [contractorId, company_name, contact_name, phone, email, address, city,
        specialization, hourly_rate, daily_rate, payment_terms,
        bank_name, bank_branch, bank_account, max_workers, notes]);

    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'contractor', $3, 'create', $4)
    `, [db.generateUUID(), req.user.id, result.rows[0].id, JSON.stringify({ company_name, contact_name })]);

    res.status(201).json({ contractor: result.rows[0] });
  } catch (error) {
    console.error('Create contractor error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת קבלן' });
  }
});

// Update contractor
router.put('/:id', async (req, res) => {
  try {
    const {
      company_name, contact_name, phone, email, address, city,
      specialization, hourly_rate, daily_rate, payment_terms,
      bank_name, bank_branch, bank_account, max_workers, status, notes
    } = req.body;

    const result = await db.query(`
      UPDATE contractors SET
        company_name = COALESCE($1, company_name),
        contact_name = COALESCE($2, contact_name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        specialization = COALESCE($7, specialization),
        hourly_rate = COALESCE($8, hourly_rate),
        daily_rate = COALESCE($9, daily_rate),
        payment_terms = COALESCE($10, payment_terms),
        bank_name = COALESCE($11, bank_name),
        bank_branch = COALESCE($12, bank_branch),
        bank_account = COALESCE($13, bank_account),
        max_workers = COALESCE($14, max_workers),
        status = COALESCE($15, status),
        notes = COALESCE($16, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *
    `, [company_name, contact_name, phone, email, address, city,
        specialization, hourly_rate, daily_rate, payment_terms,
        bank_name, bank_branch, bank_account, max_workers, status, notes, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'קבלן לא נמצא' });
    }

    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'contractor', $3, 'update', $4)
    `, [db.generateUUID(), req.user.id, result.rows[0].id, JSON.stringify(req.body)]);

    res.json({ contractor: result.rows[0] });
  } catch (error) {
    console.error('Update contractor error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון קבלן' });
  }
});

// Delete contractor
router.delete('/:id', requireManager, async (req, res) => {
  try {
    // Delete related workers first (cascade)
    await db.query('DELETE FROM contractor_workers WHERE contractor_id = $1', [req.params.id]);
    // Delete event assignments
    await db.query('DELETE FROM event_contractor_assignments WHERE contractor_id = $1', [req.params.id]);

    const result = await db.query(
      'DELETE FROM contractors WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'קבלן לא נמצא' });
    }

    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'contractor', $3, 'delete', $4)
    `, [db.generateUUID(), req.user.id, req.params.id, JSON.stringify({ id: req.params.id })]);

    res.json({ message: 'קבלן נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete contractor error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת קבלן' });
  }
});

// Add worker to contractor
router.post('/:id/workers', [
  body('first_name').notEmpty().withMessage('נדרש שם פרטי'),
  body('last_name').notEmpty().withMessage('נדרש שם משפחה')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { first_name, last_name, phone, id_number, has_weapon_license, weapon_license_expiry, notes } = req.body;

    const workerId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO contractor_workers (
        id, contractor_id, first_name, last_name, phone, id_number,
        has_weapon_license, weapon_license_expiry, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [workerId, req.params.id, first_name, last_name, phone, id_number,
        has_weapon_license ? 1 : 0, weapon_license_expiry, notes]);

    res.status(201).json({ worker: result.rows[0] });
  } catch (error) {
    console.error('Add worker error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת עובד קבלן' });
  }
});

// Update worker
router.put('/:id/workers/:workerId', async (req, res) => {
  try {
    const { first_name, last_name, phone, id_number, has_weapon_license, weapon_license_expiry, status, notes } = req.body;

    const result = await db.query(`
      UPDATE contractor_workers SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        id_number = COALESCE($4, id_number),
        has_weapon_license = COALESCE($5, has_weapon_license),
        weapon_license_expiry = COALESCE($6, weapon_license_expiry),
        status = COALESCE($7, status),
        notes = COALESCE($8, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND contractor_id = $10
      RETURNING *
    `, [first_name, last_name, phone, id_number,
        has_weapon_license !== undefined ? (has_weapon_license ? 1 : 0) : undefined,
        weapon_license_expiry, status, notes, req.params.workerId, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'עובד קבלן לא נמצא' });
    }

    res.json({ worker: result.rows[0] });
  } catch (error) {
    console.error('Update worker error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון עובד קבלן' });
  }
});

// Delete worker
router.delete('/:id/workers/:workerId', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM contractor_workers WHERE id = $1 AND contractor_id = $2 RETURNING id',
      [req.params.workerId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'עובד קבלן לא נמצא' });
    }

    res.json({ message: 'עובד קבלן נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete worker error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת עובד קבלן' });
  }
});

// Get events assigned to contractor
router.get('/:id/events', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT eca.*, e.event_name, e.event_date, e.start_time, e.end_time,
             e.location, e.status as event_status, c.company_name as customer_name
      FROM event_contractor_assignments eca
      JOIN events e ON e.id = eca.event_id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE eca.contractor_id = $1
      ORDER BY e.event_date DESC
    `, [req.params.id]);

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get contractor events error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אירועי קבלן' });
  }
});

module.exports = router;
