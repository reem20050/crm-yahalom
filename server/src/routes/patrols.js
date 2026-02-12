const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateToken);

// Get checkpoints for a site
router.get('/sites/:siteId/checkpoints', async (req, res) => {
  try {
    const result = db.query(`
      SELECT * FROM site_checkpoints
      WHERE site_id = ? AND is_active = 1
      ORDER BY sort_order, name
    `, [req.params.siteId]);
    res.json({ checkpoints: result.rows });
  } catch (error) {
    console.error('Get checkpoints error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נקודות ביקורת' });
  }
});

// Create checkpoint
router.post('/sites/:siteId/checkpoints', requireAdmin, async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { name, description, location_notes, check_interval_minutes, sort_order } = req.body;

    db.query(`
      INSERT INTO site_checkpoints (id, site_id, name, description, location_notes, check_interval_minutes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, req.params.siteId, name, description || null, location_notes || null, check_interval_minutes || null, sort_order || 0]);

    const result = db.query('SELECT * FROM site_checkpoints WHERE id = ?', [id]);
    res.status(201).json({ checkpoint: result.rows[0] });
  } catch (error) {
    console.error('Create checkpoint error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת נקודת ביקורת' });
  }
});

// Update checkpoint
router.put('/checkpoints/:id', requireAdmin, async (req, res) => {
  try {
    const { name, description, location_notes, check_interval_minutes, sort_order, is_active } = req.body;

    db.query(`
      UPDATE site_checkpoints SET
        name = ?, description = ?, location_notes = ?,
        check_interval_minutes = ?, sort_order = ?, is_active = ?
      WHERE id = ?
    `, [name, description, location_notes, check_interval_minutes, sort_order || 0, is_active !== undefined ? (is_active ? 1 : 0) : 1, req.params.id]);

    const result = db.query('SELECT * FROM site_checkpoints WHERE id = ?', [req.params.id]);
    res.json({ checkpoint: result.rows[0] });
  } catch (error) {
    console.error('Update checkpoint error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון נקודת ביקורת' });
  }
});

// Delete checkpoint
router.delete('/checkpoints/:id', requireAdmin, async (req, res) => {
  try {
    db.query('DELETE FROM site_checkpoints WHERE id = ?', [req.params.id]);
    res.json({ message: 'נקודת ביקורת נמחקה' });
  } catch (error) {
    console.error('Delete checkpoint error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת נקודת ביקורת' });
  }
});

// Log a patrol checkpoint visit
router.post('/log', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { shift_assignment_id, employee_id, checkpoint_id, site_id, status, observation } = req.body;

    db.query(`
      INSERT INTO patrol_logs (id, shift_assignment_id, employee_id, checkpoint_id, site_id, status, observation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, shift_assignment_id || null, employee_id, checkpoint_id, site_id, status || 'ok', observation || null]);

    const result = db.query('SELECT * FROM patrol_logs WHERE id = ?', [id]);
    res.status(201).json({ log: result.rows[0] });
  } catch (error) {
    console.error('Log patrol error:', error);
    res.status(500).json({ error: 'שגיאה ברישום סיור' });
  }
});

// Get patrol logs for a shift assignment
router.get('/shift/:assignmentId', async (req, res) => {
  try {
    const result = db.query(`
      SELECT pl.*, sc.name as checkpoint_name
      FROM patrol_logs pl
      LEFT JOIN site_checkpoints sc ON pl.checkpoint_id = sc.id
      WHERE pl.shift_assignment_id = ?
      ORDER BY pl.checked_at DESC
    `, [req.params.assignmentId]);
    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get shift patrols error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סיורים' });
  }
});

// Get today's patrol activity for a site
router.get('/site/:siteId/today', async (req, res) => {
  try {
    const logs = db.query(`
      SELECT pl.*, sc.name as checkpoint_name,
             e.first_name || ' ' || e.last_name as employee_name
      FROM patrol_logs pl
      LEFT JOIN site_checkpoints sc ON pl.checkpoint_id = sc.id
      LEFT JOIN employees e ON pl.employee_id = e.id
      WHERE pl.site_id = ?
      AND date(pl.checked_at) = date('now')
      ORDER BY pl.checked_at DESC
    `, [req.params.siteId]);

    const checkpoints = db.query(`
      SELECT * FROM site_checkpoints
      WHERE site_id = ? AND is_active = 1
      ORDER BY sort_order
    `, [req.params.siteId]);

    res.json({
      logs: logs.rows,
      checkpoints: checkpoints.rows,
      total_checkpoints: checkpoints.rows.length,
      visited_today: new Set(logs.rows.map(l => l.checkpoint_id)).size
    });
  } catch (error) {
    console.error('Get site patrols error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סיורים' });
  }
});

// Get patrol stats
router.get('/stats', async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const fromDate = from_date || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const toDate = to_date || new Date().toISOString().split('T')[0];

    const result = db.query(`
      SELECT
        COUNT(*) as total_checks,
        SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) as ok_checks,
        SUM(CASE WHEN status = 'issue_found' THEN 1 ELSE 0 END) as issues_found,
        SUM(CASE WHEN status = 'requires_attention' THEN 1 ELSE 0 END) as requires_attention,
        COUNT(DISTINCT employee_id) as unique_guards,
        COUNT(DISTINCT site_id) as unique_sites
      FROM patrol_logs
      WHERE date(checked_at) BETWEEN ? AND ?
    `, [fromDate, toDate]);

    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Get patrol stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

module.exports = router;
