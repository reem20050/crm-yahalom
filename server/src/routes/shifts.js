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

    // Employee: only see shifts they are assigned to
    if (req.user.role === 'employee' && req.user.employeeId) {
      paramCount++;
      whereClause.push(`s.id IN (SELECT shift_id FROM shift_assignments WHERE employee_id = $${paramCount})`);
      params.push(req.user.employeeId);
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

    // Batch-fetch all assignments for the returned shifts (avoids N+1)
    if (result.rows.length > 0) {
      const shiftIds = result.rows.map(s => s.id);
      const placeholders = shiftIds.map((_, i) => '?').join(',');
      const assignResult = db.query(
        `SELECT sa.id, sa.shift_id, sa.employee_id, e.first_name || ' ' || e.last_name as employee_name,
                sa.role, sa.status
         FROM shift_assignments sa
         JOIN employees e ON sa.employee_id = e.id
         WHERE sa.shift_id IN (${placeholders})`,
        shiftIds
      );

      // Group assignments by shift_id
      const assignmentMap = {};
      for (const a of assignResult.rows) {
        if (!assignmentMap[a.shift_id]) assignmentMap[a.shift_id] = [];
        assignmentMap[a.shift_id].push(a);
      }
      for (const shift of result.rows) {
        shift.assignments = assignmentMap[shift.id] || [];
      }
    } else {
      // No shifts, nothing to do
    }

    res.json({ shifts: result.rows });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת משמרות' });
  }
});

// Get today's shifts summary (MUST be before /:id route)
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

    const shiftId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO shifts (id, site_id, customer_id, date, start_time, end_time,
                         required_employees, requires_weapon, requires_vehicle, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [shiftId, site_id, customer_id, date, start_time, end_time,
        required_employees || 1, requires_weapon ? 1 : 0, requires_vehicle ? 1 : 0, notes]);

    res.status(201).json({ shift: result.rows[0] });
  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משמרת' });
  }
});

// Update shift (partial update)
router.patch('/:id', requireManager, async (req, res) => {
  try {
    const allowedFields = ['site_id', 'customer_id', 'date', 'start_time', 'end_time',
                           'required_employees', 'requires_weapon', 'requires_vehicle', 'notes', 'status'];
    const updates = [];
    const params = [];
    let paramCount = 0;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        paramCount++;
        updates.push(`${field} = $${paramCount}`);
        let val = req.body[field];
        // Convert booleans to integers for SQLite
        if (field === 'requires_weapon' || field === 'requires_vehicle') {
          val = val ? 1 : 0;
        }
        params.push(val);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'לא נשלחו שדות לעדכון' });
    }

    paramCount++;
    params.push(req.params.id);

    const result = await db.query(`
      UPDATE shifts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'משמרת לא נמצאה' });
    }

    res.json({ shift: result.rows[0] });
  } catch (error) {
    console.error('Update shift error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון משמרת' });
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

        const recurringShiftId = db.generateUUID();
        const result = await db.query(`
          INSERT INTO shifts (id, site_id, customer_id, date, start_time, end_time,
                             required_employees, requires_weapon, requires_vehicle, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [recurringShiftId, site_id, customer_id, dateStr, start_time, end_time,
            required_employees || 1, requires_weapon ? 1 : 0, requires_vehicle ? 1 : 0, notes]);

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

    const assignmentId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO shift_assignments (id, shift_id, employee_id, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [assignmentId, req.params.id, employee_id, role || 'guard']);

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

// Employee check-in (with optional GPS location)
router.post('/check-in/:assignmentId', async (req, res) => {
  try {
    const { latitude, longitude } = req.body || {};
    let distanceMeters = null;
    let locationWarning = null;

    // Calculate distance from site if location provided
    if (latitude && longitude) {
      try {
        const siteResult = await db.query(`
          SELECT si.latitude, si.longitude, si.geofence_radius_meters, si.name
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          JOIN sites si ON s.site_id = si.id
          WHERE sa.id = $1 AND si.latitude IS NOT NULL
        `, [req.params.assignmentId]);

        if (siteResult.rows.length > 0 && siteResult.rows[0].latitude) {
          const { calculateDistance } = require('../utils/geocoder');
          const site = siteResult.rows[0];
          distanceMeters = calculateDistance(latitude, longitude, site.latitude, site.longitude);
          const radius = site.geofence_radius_meters || 200;
          if (distanceMeters > radius) {
            locationWarning = `המרחק מהאתר ${site.name} הוא ${distanceMeters} מטר (מותר: ${radius} מטר)`;
          }
        }
      } catch (e) { /* location check optional */ }
    }

    const result = await db.query(`
      UPDATE shift_assignments SET
        status = 'checked_in',
        check_in_time = datetime('now'),
        check_in_latitude = $2,
        check_in_longitude = $3,
        check_in_distance_meters = $4
      WHERE id = $1
      RETURNING *
    `, [req.params.assignmentId, latitude || null, longitude || null, distanceMeters]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    }

    // Update shift status if first check-in
    await db.query(`
      UPDATE shifts SET status = 'in_progress'
      WHERE id = (SELECT shift_id FROM shift_assignments WHERE id = $1)
      AND status = 'scheduled'
    `, [req.params.assignmentId]);

    const response = { assignment: result.rows[0], message: 'דווח כניסה בהצלחה' };
    if (locationWarning) response.location_warning = locationWarning;
    if (distanceMeters !== null) response.distance_meters = distanceMeters;
    res.json(response);
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'שגיאה בדיווח כניסה' });
  }
});

// Employee check-out (with optional GPS location)
router.post('/check-out/:assignmentId', async (req, res) => {
  try {
    const { latitude, longitude } = req.body || {};
    let distanceMeters = null;
    let locationWarning = null;

    // Calculate distance from site if location provided
    if (latitude && longitude) {
      try {
        const siteResult = await db.query(`
          SELECT si.latitude, si.longitude, si.geofence_radius_meters, si.name
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          JOIN sites si ON s.site_id = si.id
          WHERE sa.id = $1 AND si.latitude IS NOT NULL
        `, [req.params.assignmentId]);

        if (siteResult.rows.length > 0 && siteResult.rows[0].latitude) {
          const { calculateDistance } = require('../utils/geocoder');
          const site = siteResult.rows[0];
          distanceMeters = calculateDistance(latitude, longitude, site.latitude, site.longitude);
          const radius = site.geofence_radius_meters || 200;
          if (distanceMeters > radius) {
            locationWarning = `המרחק מהאתר ${site.name} הוא ${distanceMeters} מטר (מותר: ${radius} מטר)`;
          }
        }
      } catch (e) { /* location check optional */ }
    }

    // Get check-in time to calculate hours
    const assignmentResult = await db.query(
      'SELECT check_in_time FROM shift_assignments WHERE id = $1',
      [req.params.assignmentId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    }

    const checkInTime = assignmentResult.rows[0].check_in_time;
    // Calculate hours using SQLite to avoid timezone issues
    const hoursResult = await db.query(
      `SELECT ROUND((julianday(datetime('now')) - julianday($1)) * 24, 2) as hours`,
      [checkInTime]
    );
    const actualHours = hoursResult.rows[0]?.hours || 0;

    const result = await db.query(`
      UPDATE shift_assignments SET
        status = 'checked_out',
        check_out_time = datetime('now'),
        actual_hours = $2,
        check_out_latitude = $3,
        check_out_longitude = $4,
        check_out_distance_meters = $5
      WHERE id = $1
      RETURNING *
    `, [req.params.assignmentId, actualHours.toFixed(2), latitude || null, longitude || null, distanceMeters]);

    // Check if all assignments are checked out
    const shiftId = (await db.query('SELECT shift_id FROM shift_assignments WHERE id = $1', [req.params.assignmentId])).rows[0].shift_id;

    const pendingResult = await db.query(`
      SELECT COUNT(*) as count FROM shift_assignments
      WHERE shift_id = $1 AND status != 'checked_out'
    `, [shiftId]);

    if (parseInt(pendingResult.rows[0].count) === 0) {
      await db.query("UPDATE shifts SET status = 'completed' WHERE id = $1", [shiftId]);
    }

    const response = { assignment: result.rows[0], message: 'דווח יציאה בהצלחה' };
    if (locationWarning) response.location_warning = locationWarning;
    if (distanceMeters !== null) response.distance_meters = distanceMeters;
    res.json(response);
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'שגיאה בדיווח יציאה' });
  }
});

// Send WhatsApp reminder to all employees in a shift
router.post('/:id/remind', requireManager, async (req, res) => {
  try {
    const whatsappService = require('../services/whatsapp');

    const shiftResult = await db.query(`
      SELECT s.*, c.company_name, si.name as site_name, si.address as site_address
      FROM shifts s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE s.id = $1
    `, [req.params.id]);

    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ error: 'משמרת לא נמצאה' });
    }

    const shift = shiftResult.rows[0];

    const assignResult = await db.query(`
      SELECT sa.id as assignment_id, e.id as employee_id, e.first_name, e.last_name, e.phone
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      WHERE sa.shift_id = $1 AND e.phone IS NOT NULL
    `, [req.params.id]);

    if (assignResult.rows.length === 0) {
      return res.status(400).json({ error: 'אין עובדים עם טלפון במשמרת' });
    }

    let sent = 0;
    let failed = 0;
    for (const emp of assignResult.rows) {
      const message = `שלום ${emp.first_name}! 🔔
תזכורת למשמרת:
📍 ${shift.site_name || shift.company_name || 'משמרת'}
🏠 ${shift.site_address || ''}
📅 ${shift.date}
🕐 ${shift.start_time} - ${shift.end_time}

נא להגיע בזמן.
צוות יהלום`;

      const result = await whatsappService.sendMessage(emp.phone, message, {
        context: 'shift_reminder',
        entityType: 'employee',
        entityId: emp.employee_id
      });
      if (result.success) sent++;
      else failed++;
    }

    res.json({ message: `נשלחו ${sent} תזכורות`, sent, failed });
  } catch (error) {
    console.error('Shift remind error:', error);
    res.status(500).json({ error: 'שגיאה בשליחת תזכורות' });
  }
});

// Send WhatsApp reminder to specific employee in a shift
router.post('/:id/remind/:assignmentId', requireManager, async (req, res) => {
  try {
    const whatsappService = require('../services/whatsapp');

    const result = await db.query(`
      SELECT sa.id, e.id as employee_id, e.first_name, e.phone,
             s.date, s.start_time, s.end_time,
             c.company_name, si.name as site_name, si.address as site_address
      FROM shift_assignments sa
      JOIN employees e ON sa.employee_id = e.id
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sites si ON s.site_id = si.id
      WHERE sa.id = $1 AND s.id = $2
    `, [req.params.assignmentId, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    }

    const emp = result.rows[0];
    if (!emp.phone) {
      return res.status(400).json({ error: 'לעובד אין מספר טלפון' });
    }

    const message = `שלום ${emp.first_name}! 🔔
תזכורת למשמרת:
📍 ${emp.site_name || emp.company_name || 'משמרת'}
🏠 ${emp.site_address || ''}
📅 ${emp.date}
🕐 ${emp.start_time} - ${emp.end_time}

נא להגיע בזמן.
צוות יהלום`;

    const sendResult = await whatsappService.sendMessage(emp.phone, message, {
      context: 'shift_reminder',
      entityType: 'employee',
      entityId: emp.employee_id
    });

    if (sendResult.success) {
      res.json({ message: 'תזכורת נשלחה בהצלחה' });
    } else {
      res.status(400).json({ error: sendResult.error || 'שגיאה בשליחה' });
    }
  } catch (error) {
    console.error('Shift remind single error:', error);
    res.status(500).json({ error: 'שגיאה בשליחת תזכורת' });
  }
});

// Guard location report (every 5 minutes from frontend)
router.post('/location-report', async (req, res) => {
  try {
    const assignment_id = req.body.assignment_id || req.body.shift_assignment_id;
    const { latitude, longitude, accuracy } = req.body;
    if (!assignment_id || !latitude || !longitude) {
      return res.status(400).json({ error: 'חסרים פרמטרים' });
    }

    // Verify the assignment belongs to this user and is checked_in
    const assignment = await db.query(`
      SELECT sa.id, sa.employee_id, s.site_id
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      JOIN employees e ON sa.employee_id = e.id
      JOIN users u ON u.employee_id = e.id
      WHERE sa.id = $1 AND u.id = $2 AND sa.status = 'checked_in'
    `, [assignment_id, req.user.id]);

    if (assignment.rows.length === 0) {
      return res.status(403).json({ error: 'שיבוץ לא תקין או שהעובד לא בצ\'ק-אין' });
    }

    const crypto = require('crypto');
    const id = crypto.randomUUID();
    await db.query(`
      INSERT INTO guard_locations (id, shift_assignment_id, employee_id, site_id, latitude, longitude, accuracy, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, datetime('now'))
    `, [id, assignment_id, assignment.rows[0].employee_id, assignment.rows[0].site_id, latitude, longitude, accuracy || null]);

    res.json({ success: true });
  } catch (error) {
    console.error('Location report error:', error);
    res.status(500).json({ error: 'שגיאה בדיווח מיקום' });
  }
});

// Get active guards with latest location (for guard tracking map)
router.get('/active-guards', requireManager, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sa.id as assignment_id, sa.employee_id,
             e.first_name || ' ' || e.last_name as employee_name,
             s.site_id, si.name as site_name, si.address as site_address,
             si.latitude as site_latitude, si.longitude as site_longitude,
             c.company_name,
             gl.latitude, gl.longitude, gl.accuracy, gl.recorded_at
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      JOIN employees e ON sa.employee_id = e.id
      LEFT JOIN sites si ON s.site_id = si.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN (
        SELECT gl1.shift_assignment_id, gl1.latitude, gl1.longitude, gl1.accuracy, gl1.recorded_at
        FROM guard_locations gl1
        INNER JOIN (
          SELECT shift_assignment_id, MAX(recorded_at) as max_recorded
          FROM guard_locations
          GROUP BY shift_assignment_id
        ) gl2 ON gl1.shift_assignment_id = gl2.shift_assignment_id AND gl1.recorded_at = gl2.max_recorded
      ) gl ON gl.shift_assignment_id = sa.id
      WHERE sa.status = 'checked_in'
      AND s.date = date('now')
      ORDER BY e.first_name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Active guards error:', error);
    res.status(500).json({ error: 'שגיאה בשליפת שומרים פעילים' });
  }
});

// Get guard location history for an assignment
router.get('/guard-location-history/:assignmentId', requireManager, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT latitude, longitude, accuracy, recorded_at
      FROM guard_locations
      WHERE shift_assignment_id = $1
      ORDER BY recorded_at ASC
    `, [req.params.assignmentId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Guard location history error:', error);
    res.status(500).json({ error: 'שגיאה בשליפת היסטוריית מיקום' });
  }
});

// Delete shift (admin/manager only)
router.delete('/:id', requireManager, async (req, res) => {
  try {
    // Delete related assignments first
    await db.query('DELETE FROM shift_assignments WHERE shift_id = $1', [req.params.id]);

    const result = await db.query(
      'DELETE FROM shifts WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'משמרת לא נמצאה' });
    }

    res.json({ message: 'משמרת נמחקה בהצלחה' });
  } catch (error) {
    console.error('Delete shift error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת משמרת' });
  }
});

module.exports = router;
