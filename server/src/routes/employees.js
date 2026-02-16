const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireRole, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all employees
router.get('/', async (req, res) => {
  try {
    const { status, search, has_weapon_license, page = 1, limit = 20 } = req.query;
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

    if (has_weapon_license === 'true') {
      whereClause.push(`has_weapon_license = 1`);
    }

    if (search) {
      paramCount++;
      whereClause.push(`(first_name LIKE $${paramCount} OR last_name LIKE $${paramCount} OR phone LIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    const whereString = `WHERE ${whereClause.join(' AND ')}`;

    const countResult = await db.query(`SELECT COUNT(*) as count FROM employees ${whereString}`, params);
    const total = parseInt(countResult.rows[0].count || 0);

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const result = await db.query(`
      SELECT e.*,
             (SELECT COUNT(*) FROM shift_assignments sa
              JOIN shifts s ON sa.shift_id = s.id
              WHERE sa.employee_id = e.id AND s.date = date('now')) as shifts_today
      FROM employees e
      ${whereString}
      ORDER BY e.first_name, e.last_name
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `, params);

    res.json({
      employees: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת עובדים' });
  }
});

// Get available employees for a specific date/time (MUST be before /:id route)
router.get('/available/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { start_time, end_time, requires_weapon } = req.query;

    let queryStr = `
      SELECT e.* FROM employees e
      WHERE e.status = 'active' AND e.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE sa.employee_id = e.id
        AND s.date = $1
        AND (
          (s.start_time < $3 AND s.end_time > $2)
        )
      )
    `;
    let params = [date, start_time, end_time];

    if (requires_weapon === 'true') {
      queryStr += ` AND e.has_weapon_license = 1 AND (e.weapon_license_expiry IS NULL OR e.weapon_license_expiry > $1)`;
    }

    queryStr += ` ORDER BY e.first_name, e.last_name`;

    const result = await db.query(queryStr, params);

    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Get available employees error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת עובדים זמינים' });
  }
});

// Get deleted employees (trash) - MUST be before /:id
router.get('/trash/list', requireManager, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM employees WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC
    `);
    res.json({ employees: result.rows });
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פריטים מחוקים' });
  }
});

// Get single employee with all details
router.get('/:id', async (req, res) => {
  try {
    const employeeResult = await db.query('SELECT * FROM employees WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'עובד לא נמצא' });
    }

    const [documents, availability, recentShifts] = await Promise.all([
      db.query('SELECT * FROM employee_documents WHERE employee_id = $1 ORDER BY uploaded_at DESC', [req.params.id]),
      db.query('SELECT * FROM employee_availability WHERE employee_id = $1 ORDER BY day_of_week', [req.params.id]),
      db.query(`
        SELECT sa.*, s.date, s.start_time, s.end_time, c.company_name, si.name as site_name
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sites si ON s.site_id = si.id
        WHERE sa.employee_id = $1
        ORDER BY s.date DESC
        LIMIT 20
      `, [req.params.id])
    ]);

    res.json({
      employee: employeeResult.rows[0],
      documents: documents.rows,
      availability: availability.rows,
      recentShifts: recentShifts.rows
    });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת עובד' });
  }
});

// Create employee
router.post('/', requireManager, [
  body('first_name').notEmpty().withMessage('נדרש שם פרטי'),
  body('last_name').notEmpty().withMessage('נדרש שם משפחה'),
  body('id_number').notEmpty().withMessage('נדרש מספר ת.ז'),
  body('phone').notEmpty().withMessage('נדרש מספר טלפון'),
  body('hire_date').isDate().withMessage('נדרש תאריך תחילת עבודה')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      first_name, last_name, id_number, phone, email, address, city,
      birth_date, hire_date, employment_type, hourly_rate, monthly_salary,
      has_weapon_license, weapon_license_expiry, has_driving_license, driving_license_type,
      emergency_contact_name, emergency_contact_phone, notes
    } = req.body;

    const employeeId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO employees (
        id, first_name, last_name, id_number, phone, email, address, city,
        birth_date, hire_date, employment_type, hourly_rate, monthly_salary,
        has_weapon_license, weapon_license_expiry, has_driving_license, driving_license_type,
        emergency_contact_name, emergency_contact_phone, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [employeeId, first_name, last_name, id_number, phone, email, address, city,
        birth_date, hire_date, employment_type || 'hourly', hourly_rate, monthly_salary,
        has_weapon_license ? 1 : 0, weapon_license_expiry, has_driving_license ? 1 : 0, driving_license_type,
        emergency_contact_name, emergency_contact_phone, notes]);

    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'employee', $3, 'create', $4)
    `, [db.generateUUID(), req.user.id, result.rows[0].id, JSON.stringify({ name: `${first_name} ${last_name}` })]);

    res.status(201).json({ employee: result.rows[0] });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'מספר ת.ז כבר קיים במערכת' });
    }
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת עובד' });
  }
});

// Update employee
router.put('/:id', requireManager, async (req, res) => {
  try {
    const {
      first_name, last_name, phone, email, address, city,
      employment_type, hourly_rate, monthly_salary, status,
      has_weapon_license, weapon_license_expiry, has_driving_license, driving_license_type,
      emergency_contact_name, emergency_contact_phone, notes
    } = req.body;

    const result = await db.query(`
      UPDATE employees SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        employment_type = COALESCE($7, employment_type),
        hourly_rate = COALESCE($8, hourly_rate),
        monthly_salary = COALESCE($9, monthly_salary),
        status = COALESCE($10, status),
        has_weapon_license = COALESCE($11, has_weapon_license),
        weapon_license_expiry = COALESCE($12, weapon_license_expiry),
        has_driving_license = COALESCE($13, has_driving_license),
        driving_license_type = COALESCE($14, driving_license_type),
        emergency_contact_name = COALESCE($15, emergency_contact_name),
        emergency_contact_phone = COALESCE($16, emergency_contact_phone),
        notes = COALESCE($17, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
      RETURNING *
    `, [first_name, last_name, phone, email, address, city,
        employment_type, hourly_rate, monthly_salary, status,
        has_weapon_license, weapon_license_expiry, has_driving_license, driving_license_type,
        emergency_contact_name, emergency_contact_phone, notes, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'עובד לא נמצא' });
    }

    res.json({ employee: result.rows[0] });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון עובד' });
  }
});

// Add document to employee
router.post('/:id/documents', requireManager, [
  body('document_type').notEmpty().withMessage('נדרש סוג מסמך')
], async (req, res) => {
  try {
    const { document_type, document_url, expiry_date } = req.body;

    const docId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO employee_documents (id, employee_id, document_type, document_url, expiry_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [docId, req.params.id, document_type, document_url || '', expiry_date || null]);

    res.status(201).json({ document: result.rows[0] });
  } catch (error) {
    console.error('Add document error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת מסמך' });
  }
});

// Delete document from employee
router.delete('/:id/documents/:docId', requireManager, async (req, res) => {
  try {
    await db.query('DELETE FROM employee_documents WHERE id = $1 AND employee_id = $2', [req.params.docId, req.params.id]);
    res.json({ message: 'מסמך נמחק' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת מסמך' });
  }
});

// Set employee availability
router.post('/:id/availability', requireManager, async (req, res) => {
  try {
    const { availability } = req.body; // Array of { day_of_week, start_time, end_time, is_available }

    // Delete existing availability
    await db.query('DELETE FROM employee_availability WHERE employee_id = $1', [req.params.id]);

    // Insert new availability
    for (const av of availability) {
      await db.query(`
        INSERT INTO employee_availability (id, employee_id, day_of_week, start_time, end_time, is_available)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [db.generateUUID(), req.params.id, av.day_of_week, av.start_time, av.end_time, av.is_available ?? true]);
    }

    const result = await db.query(
      'SELECT * FROM employee_availability WHERE employee_id = $1 ORDER BY day_of_week',
      [req.params.id]
    );

    res.json({ availability: result.rows });
  } catch (error) {
    console.error('Set availability error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון זמינות' });
  }
});

// Note: /available/:date route moved before /:id to prevent route shadowing

// Get employee hours summary for a month
router.get('/:id/hours/:year/:month', async (req, res) => {
  try {
    const { id, year, month } = req.params;

    const monthStr = String(month).padStart(2, '0');

    const result = await db.query(`
      SELECT
        SUM(sa.actual_hours) as total_hours,
        SUM(CASE WHEN CAST(strftime('%w', s.date) AS INTEGER) = 6 THEN sa.actual_hours ELSE 0 END) as saturday_hours,
        COUNT(DISTINCT s.date) as days_worked
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.employee_id = $1
      AND strftime('%Y', s.date) = $2
      AND strftime('%m', s.date) = $3
      AND sa.status = 'checked_out'
    `, [id, String(year), monthStr]);

    const shiftsResult = await db.query(`
      SELECT s.date, s.start_time, s.end_time, sa.actual_hours,
             c.company_name, si.name as site_name
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE sa.employee_id = $1
      AND strftime('%Y', s.date) = $2
      AND strftime('%m', s.date) = $3
      ORDER BY s.date
    `, [id, String(year), monthStr]);

    res.json({
      summary: result.rows[0],
      shifts: shiftsResult.rows
    });
  } catch (error) {
    console.error('Get employee hours error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת שעות עבודה' });
  }
});

// Delete employee - soft delete (admin/manager only)
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE employees SET deleted_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'עובד לא נמצא' });
    }

    res.json({ message: 'עובד נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת עובד' });
  }
});

// Restore employee
router.post('/:id/restore', requireManager, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE employees SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'עובד לא נמצא בפח' });
    }
    res.json({ employee: result.rows[0], message: 'עובד שוחזר בהצלחה' });
  } catch (error) {
    console.error('Restore employee error:', error);
    res.status(500).json({ error: 'שגיאה בשחזור עובד' });
  }
});

// Permanently delete employee
router.delete('/:id/permanent', requireRole('admin'), async (req, res) => {
  try {
    const check = await db.query('SELECT id FROM employees WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'עובד לא נמצא בפח' });
    }
    await db.query('DELETE FROM employee_documents WHERE employee_id = $1', [req.params.id]);
    await db.query('DELETE FROM employee_availability WHERE employee_id = $1', [req.params.id]);
    await db.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
    res.json({ message: 'עובד נמחק לצמיתות' });
  } catch (error) {
    console.error('Permanent delete employee error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת עובד לצמיתות' });
  }
});

module.exports = router;
