const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');
const whatsappHelper = require('../utils/whatsappHelper');
const googleHelper = require('../utils/googleHelper');

const router = express.Router();
router.use(authenticateToken);

// Get all events
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, status, customer_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = [];
    let params = [];
    let paramCount = 0;

    // Always exclude soft-deleted
    whereClause.push(`e.deleted_at IS NULL`);

    if (start_date) {
      paramCount++;
      whereClause.push(`event_date >= $${paramCount}`);
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereClause.push(`event_date <= $${paramCount}`);
      params.push(end_date);
    }

    if (status) {
      paramCount++;
      whereClause.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (customer_id) {
      paramCount++;
      whereClause.push(`customer_id = $${paramCount}`);
      params.push(customer_id);
    }

    // Employee: only see events they are assigned to
    if (req.user.role === 'employee' && req.user.employeeId) {
      paramCount++;
      whereClause.push(`e.id IN (SELECT event_id FROM event_assignments WHERE employee_id = $${paramCount})`);
      params.push(req.user.employeeId);
    }

    const whereString = `WHERE ${whereClause.join(' AND ')}`;

    const countResult = await db.query(`SELECT COUNT(*) as count FROM events e ${whereString}`, params);
    const total = parseInt(countResult.rows[0].count || 0);

    paramCount++;
    params.push(limit);
    paramCount++;
    params.push(offset);

    const result = await db.query(`
      SELECT e.*,
             c.company_name,
             (SELECT COUNT(*) FROM event_assignments WHERE event_id = e.id) as assigned_count
      FROM events e
      LEFT JOIN customers c ON e.customer_id = c.id
      ${whereString}
      ORDER BY e.event_date DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `, params);

    res.json({
      events: result.rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אירועים' });
  }
});

// Get upcoming events (MUST be before /:id route)
router.get('/upcoming/week', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*,
             c.company_name,
             (SELECT COUNT(*) FROM event_assignments WHERE event_id = e.id) as assigned_count
      FROM events e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.event_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')
      AND e.status NOT IN ('completed', 'cancelled')
      AND e.deleted_at IS NULL
      ORDER BY e.event_date, e.start_time
    `);

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אירועים קרובים' });
  }
});

// Get deleted events (trash) - MUST be before /:id
router.get('/trash/list', requireManager, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, c.company_name
      FROM events e LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.deleted_at IS NOT NULL ORDER BY e.deleted_at DESC
    `);
    res.json({ events: result.rows });
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פריטים מחוקים' });
  }
});

// Get single event with assignments
router.get('/:id', async (req, res) => {
  try {
    const eventResult = await db.query(`
      SELECT e.*, c.company_name
      FROM events e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.id = $1 AND e.deleted_at IS NULL
    `, [req.params.id]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'אירוע לא נמצא' });
    }

    const assignmentsResult = await db.query(`
      SELECT ea.*,
             emp.first_name || ' ' || emp.last_name as employee_name,
             emp.phone as employee_phone,
             emp.has_weapon_license
      FROM event_assignments ea
      JOIN employees emp ON ea.employee_id = emp.id
      WHERE ea.event_id = $1
    `, [req.params.id]);

    res.json({
      event: eventResult.rows[0],
      assignments: assignmentsResult.rows
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אירוע' });
  }
});

// Create event
router.post('/', requireManager, [
  body('event_name').notEmpty().withMessage('נדרש שם אירוע'),
  body('event_date').isDate().withMessage('נדרש תאריך'),
  body('start_time').notEmpty().withMessage('נדרשת שעת התחלה'),
  body('end_time').notEmpty().withMessage('נדרשת שעת סיום'),
  body('location').notEmpty().withMessage('נדרש מיקום'),
  body('required_guards').isInt({ min: 1 }).withMessage('נדרש מספר מאבטחים')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      customer_id, lead_id, event_name, event_type, event_date,
      start_time, end_time, location, address, expected_attendance,
      required_guards, requires_weapon, requires_vehicle,
      special_equipment, notes, price
    } = req.body;

    const eventId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO events (
        id, customer_id, lead_id, event_name, event_type, event_date,
        start_time, end_time, location, address, expected_attendance,
        required_guards, requires_weapon, requires_vehicle,
        special_equipment, notes, price
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [eventId, customer_id, lead_id, event_name, event_type, event_date,
        start_time, end_time, location, address, expected_attendance,
        required_guards, requires_weapon ? 1 : 0, requires_vehicle ? 1 : 0,
        special_equipment, notes, price]);

    await db.query(`
      INSERT INTO activity_log (id, user_id, entity_type, entity_id, action, changes)
      VALUES ($1, $2, 'event', $3, 'create', $4)
    `, [db.generateUUID(), req.user.id, result.rows[0].id, JSON.stringify({ event_name })]);

    const createdEvent = result.rows[0];

    // Sync to Google Calendar (non-blocking)
    googleHelper.createCalendarEvent(createdEvent).then(calendarId => {
      if (calendarId) {
        db.query('UPDATE events SET google_calendar_event_id = $1 WHERE id = $2', [calendarId, createdEvent.id]);
      }
    }).catch(() => {});

    res.status(201).json({ event: createdEvent });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת אירוע' });
  }
});

// Update event
router.put('/:id', requireManager, async (req, res) => {
  try {
    const {
      event_name, event_type, event_date, start_time, end_time,
      location, address, expected_attendance, required_guards,
      requires_weapon, requires_vehicle, special_equipment,
      notes, price, status, planning_document_url
    } = req.body;

    const result = await db.query(`
      UPDATE events SET
        event_name = COALESCE($1, event_name),
        event_type = COALESCE($2, event_type),
        event_date = COALESCE($3, event_date),
        start_time = COALESCE($4, start_time),
        end_time = COALESCE($5, end_time),
        location = COALESCE($6, location),
        address = COALESCE($7, address),
        expected_attendance = COALESCE($8, expected_attendance),
        required_guards = COALESCE($9, required_guards),
        requires_weapon = COALESCE($10, requires_weapon),
        requires_vehicle = COALESCE($11, requires_vehicle),
        special_equipment = COALESCE($12, special_equipment),
        notes = COALESCE($13, notes),
        price = COALESCE($14, price),
        status = COALESCE($15, status),
        planning_document_url = COALESCE($16, planning_document_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *
    `, [event_name, event_type, event_date, start_time, end_time,
        location, address, expected_attendance, required_guards,
        requires_weapon, requires_vehicle, special_equipment,
        notes, price, status, planning_document_url, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'אירוע לא נמצא' });
    }

    const updatedEvent = result.rows[0];

    // Sync to Google Calendar if connected (non-blocking)
    if (updatedEvent.google_calendar_event_id) {
      googleHelper.updateCalendarEvent(updatedEvent.google_calendar_event_id, updatedEvent).catch(() => {});
    }

    // Auto-generate invoice for completed event
    if (status === 'completed') {
      try {
        const autoInvoiceGenerator = require('../services/autoInvoiceGenerator');
        const invoice = autoInvoiceGenerator.generateEventInvoice(req.params.id, req.user.id);
        if (invoice) {
          console.log(`Auto-generated invoice for event ${req.params.id}: ${invoice.id}`);
        }
      } catch (autoErr) {
        console.warn('Auto-invoice generation failed:', autoErr.message);
      }
    }

    res.json({ event: updatedEvent });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון אירוע' });
  }
});

// Assign employee to event
router.post('/:id/assign', requireManager, [
  body('employee_id').notEmpty().withMessage('נדרש עובד')
], async (req, res) => {
  try {
    const { employee_id, role } = req.body;

    // Check if already assigned
    const existingResult = await db.query(
      'SELECT id FROM event_assignments WHERE event_id = $1 AND employee_id = $2',
      [req.params.id, employee_id]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'העובד כבר משובץ לאירוע זה' });
    }

    const assignmentId = db.generateUUID();
    const result = await db.query(`
      INSERT INTO event_assignments (id, event_id, employee_id, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [assignmentId, req.params.id, employee_id, role || 'guard']);

    // Update event status if fully staffed
    const eventResult = await db.query('SELECT required_guards FROM events WHERE id = $1', [req.params.id]);
    const assignedResult = await db.query('SELECT COUNT(*) FROM event_assignments WHERE event_id = $1', [req.params.id]);

    if (parseInt(assignedResult.rows[0].count) >= eventResult.rows[0].required_guards) {
      await db.query("UPDATE events SET status = 'staffed' WHERE id = $1 AND status = 'approved'", [req.params.id]);
    }

    // Send WhatsApp notification to assigned employee (non-blocking)
    whatsappHelper.notifyEventAssignment(employee_id, req.params.id).catch(() => {});

    res.status(201).json({ assignment: result.rows[0] });
  } catch (error) {
    console.error('Assign to event error:', error);
    res.status(500).json({ error: 'שגיאה בשיבוץ לאירוע' });
  }
});

// Remove employee from event
router.delete('/:id/assign/:assignmentId', requireManager, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM event_assignments WHERE id = $1 AND event_id = $2 RETURNING id',
      [req.params.assignmentId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    }

    res.json({ message: 'שיבוץ הוסר בהצלחה' });
  } catch (error) {
    console.error('Remove from event error:', error);
    res.status(500).json({ error: 'שגיאה בהסרת שיבוץ' });
  }
});

// Note: /upcoming/week route moved before /:id to prevent route shadowing

// Mark event as completed
router.post('/:id/complete', requireManager, async (req, res) => {
  try {
    const { report_notes } = req.body;

    const result = await db.query(`
      UPDATE events SET
        status = 'completed',
        notes = CASE WHEN notes IS NOT NULL AND notes != '' THEN notes || char(10) || char(10) ELSE '' END || 'דוח אירוע: ' || COALESCE($2, ''),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [req.params.id, report_notes || '']);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'אירוע לא נמצא' });
    }

    // Auto-generate invoice for completed event
    try {
      const autoInvoiceGenerator = require('../services/autoInvoiceGenerator');
      const invoice = autoInvoiceGenerator.generateEventInvoice(req.params.id, req.user.id);
      if (invoice) {
        console.log(`Auto-generated invoice for event ${req.params.id}: ${invoice.id}`);
      }
    } catch (autoErr) {
      console.warn('Auto-invoice generation failed:', autoErr.message);
    }

    res.json({ event: result.rows[0], message: 'אירוע סומן כהושלם' });
  } catch (error) {
    console.error('Complete event error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון אירוע' });
  }
});

// Delete event - soft delete (admin/manager only)
router.delete('/:id', requireManager, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE events SET deleted_at = datetime('now'), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'אירוע לא נמצא' });
    }

    res.json({ message: 'אירוע נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת אירוע' });
  }
});

// Restore event
router.post('/:id/restore', requireManager, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE events SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'אירוע לא נמצא בפח' });
    }
    res.json({ event: result.rows[0], message: 'אירוע שוחזר בהצלחה' });
  } catch (error) {
    console.error('Restore event error:', error);
    res.status(500).json({ error: 'שגיאה בשחזור אירוע' });
  }
});

// Permanently delete event
router.delete('/:id/permanent', requireManager, async (req, res) => {
  try {
    const check = await db.query('SELECT id FROM events WHERE id = $1 AND deleted_at IS NOT NULL', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'אירוע לא נמצא בפח' });
    }
    await db.query('DELETE FROM event_assignments WHERE event_id = $1', [req.params.id]);
    await db.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ message: 'אירוע נמחק לצמיתות' });
  } catch (error) {
    console.error('Permanent delete event error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת אירוע לצמיתות' });
  }
});

module.exports = router;
