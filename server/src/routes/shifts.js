const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');
const whatsappHelper = require('../utils/whatsappHelper');

const router = express.Router();
router.use(authenticateToken);

// Get shifts for date range
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, customer_id, site_id, status } = req.query;

    let whereClause = ['1=1'];
    let params = [];
    let paramCount = 0;

    if (start_date) {
      paramCount++;
      whereClause.push(`s.date >= $${paramCount}`);
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereClause.push(`s.date <= $${paramCount}`);
      params.push(end_date);
    }

    if (customer_id) {
      paramCount++;
      whereClause.push(`s.customer_id = $${paramCount}`);
      params.push(customer_id);
    }

    if (site_id) {
      paramCount++;
      whereClause.push(`s.site_id = $${paramCount}`);
      params.push(site_id);
    }

    if (status) {
      paramCount++;
      whereClause.push(`s.status = $${paramCount}`);
      params.push(status);
    }

    const result = await db.query(`
      SELECT s.*,
             c.company_name,
             si.name as site_name,
             si.address as site_address,
             (SELECT COUNT(*) FROM shift_assignments WHERE shift_id = s.id) as assigned_count
      FROM shifts s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE ${whereClause.join(' AND ')}
      ORDER BY s.date, s.start_time
    `, params);

    // Fetch assignments for each shift
    for (const shift of result.rows) {
      const assignResult = await db.query(`
        SELECT sa.id, sa.employee_id, e.first_name || ' ' || e.last_name as employee_name,
               sa.role, sa.status
        FROM shift_assignments sa
        JOIN employees e ON sa.employee_id = e.id
        WHERE sa.shift_id = $1
      `, [shift.id]);
      shift.assignments = assignResult.rows;
    }

    res.json({ shifts: result.rows });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת משמרות' });
  }
});

// Get single shift
router.get('/:id', async (req, res) => {
  try {
    const shiftResult = await db.query(`
      SELECT s.*,
             c.company_name,
             si.name as site_name,
             si.address as site_address
      FROM shifts s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE s.id = $1
    `, [req.params.id]);

    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ error: 'משמרת לא נמצאה' });
    }

    const assignmentsResult = await db.query(`
      SELECT sa.*,
             e.first_name || ' ' || e.last_name as employee_name,
             e.phone as employee_phone
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      WHERE sa.shift_id = $1
    `, [req.params.id]);

    res.json({
      shift: shiftResult.rows[0],
      assignments: assignmentsResult.rows
    });
  } catch (error) {
    console.error('Get shift error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת משמרת' });
  }
});

// Create shift
router.post('/', requireManager, [
  body('customer_id').notEmpty().withMessage('נדרש לקוח'),
  body('date').isDate().withMessage('נדרש תאריך'),
  body('start_time').notEmpty().withMessage('נדרשת שעת התחלה'),
  body('end_time').notEmpty().withMessage('נדרשת שעת סיום')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      site_id, customer_id, date, start_time, end_time,
      required_employees, requires_weapon, requires_vehicle, notes
    } = req.body;

    const result = await db.query(`
      INSERT INTO shifts (site_id, customer_id, date, start_time, end_time,
                         required_employees, requires_weapon, requires_vehicle, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [site_id, customer_id, date, start_time, end_time,
        required_employees || 1, requires_weapon || false, requires_vehicle || false, notes]);

    res.status(201).json({ shift: result.rows[0] });
  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משמרת' });
  }
});

// Create recurring shifts
router.post('/recurring', requireManager, [
  body('customer_id').notEmpty().withMessage('נדרש לקוח'),
  body('start_date').isDate().withMessage('נדרש תאריך התחלה'),
  body('end_date').isDate().withMessage('נדרש תאריך סיום'),
  body('days_of_week').isArray().withMessage('נדרשים ימים בשבוע')
], async (req, res) => {
  try {
    const {
      site_id, customer_id, start_date, end_date, days_of_week,
      start_time, end_time, required_employees, requires_weapon, requires_vehicle, notes
    } = req.body;

    const createdShifts = [];
    let currentDate = new Date(start_date);
    const endDateObj = new Date(end_date);

    while (currentDate <= endDateObj) {
      const dayOfWeek = currentDate.getDay();

      if (days_of_week.includes(dayOfWeek)) {
        const dateStr = currentDate.toISOString().split('T')[0];

        const result = await db.query(`
          INSERT INTO shifts (site_id, customer_id, date, start_time, end_time,
                             required_employees, requires_weapon, requires_vehicle, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [site_id, customer_id, dateStr, start_time, end_time,
            required_employees || 1, requires_weapon || false, requires_vehicle || false, notes]);

        createdShifts.push(result.rows[0]);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.status(201).json({ shifts: createdShifts, count: createdShifts.length });
  } catch (error) {
    console.error('Create recurring shifts error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משמרות חוזרות' });
  }
});

// Assign employee to shift
router.post('/:id/assign', requireManager, [
  body('employee_id').notEmpty().withMessage('נדרש עובד')
], async (req, res) => {
  try {
    const { employee_id, role } = req.body;

    // Check if already assigned
    const existingResult = await db.query(
      'SELECT id FROM shift_assignments WHERE shift_id = $1 AND employee_id = $2',
      [req.params.id, employee_id]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'העובד כבר משובץ למשמרת זו' });
    }

    // Check for conflicts
    const shiftResult = await db.query('SELECT date, start_time, end_time FROM shifts WHERE id = $1', [req.params.id]);
    const shift = shiftResult.rows[0];

    const conflictResult = await db.query(`
      SELECT s.id FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.employee_id = $1
      AND s.date = $2
      AND (
        (s.start_time < $4 AND s.end_time > $3)
      )
    `, [employee_id, shift.date, shift.start_time, shift.end_time]);

    if (conflictResult.rows.length > 0) {
      return res.status(400).json({ error: 'לעובד יש משמרת חופפת' });
    }

    const result = await db.query(`
      INSERT INTO shift_assignments (shift_id, employee_id, role)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.id, employee_id, role || 'guard']);

    // Send WhatsApp assignment confirmation (non-blocking)
    whatsappHelper.sendAssignmentConfirmation(employee_id, req.params.id).catch(() => {});

    res.status(201).json({ assignment: result.rows[0] });
  } catch (error) {
    console.error('Assign to shift error:', error);
    res.status(500).json({ error: 'שגיאה בשיבוץ לעובד' });
  }
});

// Remove employee from shift
router.delete('/:id/assign/:assignmentId', requireManager, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM shift_assignments WHERE id = $1 AND shift_id = $2 RETURNING id',
      [req.params.assignmentId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    }

    res.json({ message: 'שיבוץ הוסר בהצלחה' });
  } catch (error) {
    console.error('Remove from shift error:', error);
    res.status(500).json({ error: 'שגיאה בהסרת שיבוץ' });
  }
});

// Employee check-in
router.post('/check-in/:assignmentId', async (req, res) => {
  try {
    const result = await db.query(`
      UPDATE shift_assignments SET
        status = 'checked_in',
        check_in_time = datetime('now')
      WHERE id = $1
      RETURNING *
    `, [req.params.assignmentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    }

    // Update shift status if first check-in
    await db.query(`
      UPDATE shifts SET status = 'in_progress'
      WHERE id = (SELECT shift_id FROM shift_assignments WHERE id = $1)
      AND status = 'scheduled'
    `, [req.params.assignmentId]);

    res.json({ assignment: result.rows[0], message: 'דווח כניסה בהצלחה' });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'שגיאה בדיווח כניסה' });
  }
});

// Employee check-out
router.post('/check-out/:assignmentId', async (req, res) => {
  try {
    // Get check-in time to calculate hours
    const assignmentResult = await db.query(
      'SELECT check_in_time FROM shift_assignments WHERE id = $1',
      [req.params.assignmentId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    }

    const checkInTime = assignmentResult.rows[0].check_in_time;
    const checkOutTime = new Date();
    const actualHours = (checkOutTime - new Date(checkInTime)) / (1000 * 60 * 60);

    const result = await db.query(`
      UPDATE shift_assignments SET
        status = 'checked_out',
        check_out_time = datetime('now'),
        actual_hours = $2
      WHERE id = $1
      RETURNING *
    `, [req.params.assignmentId, actualHours.toFixed(2)]);

    // Check if all assignments are checked out
    const shiftId = (await db.query('SELECT shift_id FROM shift_assignments WHERE id = $1', [req.params.assignmentId])).rows[0].shift_id;

    const pendingResult = await db.query(`
      SELECT COUNT(*) FROM shift_assignments
      WHERE shift_id = $1 AND status != 'checked_out'
    `, [shiftId]);

    if (parseInt(pendingResult.rows[0].count) === 0) {
      await db.query("UPDATE shifts SET status = 'completed' WHERE id = $1", [shiftId]);
    }

    res.json({ assignment: result.rows[0], message: 'דווח יציאה בהצלחה' });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'שגיאה בדיווח יציאה' });
  }
});

// Get today's shifts summary
router.get('/summary/today', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_shifts,
        SUM(CASE WHEN s.status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completed,
        (SELECT COUNT(*) FROM shift_assignments sa
         JOIN shifts sh ON sa.shift_id = sh.id
         WHERE sh.date = date('now') AND sa.status = 'no_show') as no_shows
      FROM shifts s
      WHERE s.date = date('now')
    `);

    const unassignedResult = await db.query(`
      SELECT s.*, c.company_name, si.name as site_name
      FROM shifts s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE s.date = date('now')
      AND (SELECT COUNT(*) FROM shift_assignments WHERE shift_id = s.id) < s.required_employees
    `);

    res.json({
      summary: result.rows[0],
      unassignedShifts: unassignedResult.rows
    });
  } catch (error) {
    console.error('Get today summary error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סיכום יומי' });
  }
});

module.exports = router;
