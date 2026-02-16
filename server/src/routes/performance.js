const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateToken);

// Get performance metrics for an employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    // Average rating
    const ratings = db.query(`
      SELECT
        ROUND(AVG(rating), 1) as avg_rating,
        COUNT(*) as total_ratings,
        SUM(CASE WHEN rating_type = 'customer_feedback' THEN 1 ELSE 0 END) as customer_ratings,
        SUM(CASE WHEN rating_type = 'manager_review' THEN 1 ELSE 0 END) as manager_ratings
      FROM guard_ratings
      WHERE employee_id = ?
    `, [employeeId]);

    // Shift attendance (last 3 months)
    const attendance = db.query(`
      SELECT
        COUNT(*) as total_assignments,
        SUM(CASE WHEN sa.check_in_time IS NOT NULL THEN 1 ELSE 0 END) as checked_in,
        SUM(CASE WHEN sa.status = 'no_show' THEN 1 ELSE 0 END) as no_shows,
        SUM(CASE WHEN sa.check_in_time IS NOT NULL AND sa.check_out_time IS NOT NULL THEN 1 ELSE 0 END) as completed
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.employee_id = ?
      AND s.date >= date('now', '-3 months')
    `, [employeeId]);

    // This month's shifts
    const thisMonth = db.query(`
      SELECT COUNT(*) as shifts_this_month
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.employee_id = ?
      AND s.date >= date('now', 'start of month')
    `, [employeeId]);

    // Total hours (last 3 months)
    const hours = db.query(`
      SELECT COALESCE(SUM(sa.actual_hours), 0) as total_hours
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.employee_id = ?
      AND s.date >= date('now', '-3 months')
    `, [employeeId]);

    // Incidents handled
    const incidents = db.query(`
      SELECT COUNT(*) as incidents_reported
      FROM incidents
      WHERE reported_by = ?
    `, [employeeId]);

    // Patrol completion
    const patrols = db.query(`
      SELECT COUNT(*) as total_patrols
      FROM patrol_logs
      WHERE employee_id = ?
      AND date(checked_at) >= date('now', '-3 months')
    `, [employeeId]);

    // Recent ratings
    const recentRatings = db.query(`
      SELECT gr.*, u.first_name || ' ' || u.last_name as rated_by_name
      FROM guard_ratings gr
      LEFT JOIN users u ON gr.rated_by = u.id
      WHERE gr.employee_id = ?
      ORDER BY gr.created_at DESC
      LIMIT 5
    `, [employeeId]);

    const att = attendance.rows[0] || {};
    const attendanceRate = att.total_assignments > 0
      ? Math.round((att.checked_in / att.total_assignments) * 100)
      : 0;

    res.json({
      ratings: ratings.rows[0] || {},
      attendance: {
        ...att,
        rate: attendanceRate
      },
      shifts_this_month: thisMonth.rows[0]?.shifts_this_month || 0,
      total_hours: hours.rows[0]?.total_hours || 0,
      incidents_reported: incidents.rows[0]?.incidents_reported || 0,
      total_patrols: patrols.rows[0]?.total_patrols || 0,
      recent_ratings: recentRatings.rows
    });
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ביצועים' });
  }
});

// Rate a guard
router.post('/rate', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { employee_id, rating_type, rating, shift_id, event_id, comments } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'דירוג חייב להיות בין 1 ל-5' });
    }

    db.query(`
      INSERT INTO guard_ratings (id, employee_id, rated_by, rating_type, rating, shift_id, event_id, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, employee_id, req.user.id, rating_type, rating, shift_id || null, event_id || null, comments || null]);

    const result = db.query('SELECT * FROM guard_ratings WHERE id = ?', [id]);
    res.status(201).json({ rating: result.rows[0] });
  } catch (error) {
    console.error('Rate guard error:', error);
    res.status(500).json({ error: 'שגיאה בדירוג מאבטח' });
  }
});

// Get company-wide rankings
router.get('/rankings', async (req, res) => {
  try {
    const result = db.query(`
      SELECT
        e.id, e.first_name, e.last_name,
        ROUND(AVG(gr.rating), 1) as avg_rating,
        COUNT(gr.id) as total_ratings,
        (SELECT COUNT(*) FROM shift_assignments sa
         JOIN shifts s ON sa.shift_id = s.id
         WHERE sa.employee_id = e.id AND s.date >= date('now', '-3 months')
         AND sa.check_in_time IS NOT NULL) as shifts_completed,
        (SELECT COUNT(*) FROM shift_assignments sa
         JOIN shifts s ON sa.shift_id = s.id
         WHERE sa.employee_id = e.id AND s.date >= date('now', '-3 months')) as shifts_total
      FROM employees e
      LEFT JOIN guard_ratings gr ON e.id = gr.employee_id
      WHERE e.status = 'active'
      GROUP BY e.id
      ORDER BY avg_rating IS NULL, avg_rating DESC, shifts_completed DESC
    `);

    res.json({ rankings: result.rows });
  } catch (error) {
    console.error('Get rankings error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת דירוגים' });
  }
});

module.exports = router;
