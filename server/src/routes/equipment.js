const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateToken);

// Get all equipment (with optional filters)
router.get('/', (req, res) => {
  try {
    const { employee_id, item_type, status } = req.query;
    let sql = `
      SELECT ge.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM guard_equipment ge
      LEFT JOIN employees e ON ge.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (employee_id) {
      sql += ' AND ge.employee_id = ?';
      params.push(employee_id);
    }
    if (item_type) {
      sql += ' AND ge.item_type = ?';
      params.push(item_type);
    }
    if (status === 'assigned') {
      sql += ' AND ge.employee_id IS NOT NULL AND ge.return_date IS NULL';
    } else if (status === 'available') {
      sql += ' AND (ge.employee_id IS NULL OR ge.return_date IS NOT NULL)';
    }

    sql += ' ORDER BY ge.created_at DESC';

    const result = db.query(sql, params);
    res.json({ equipment: result.rows });
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ציוד' });
  }
});

// Get equipment by employee
router.get('/employee/:employeeId', (req, res) => {
  try {
    const result = db.query(`
      SELECT * FROM guard_equipment
      WHERE employee_id = ? AND return_date IS NULL
      ORDER BY assigned_date DESC
    `, [req.params.employeeId]);
    res.json({ equipment: result.rows });
  } catch (error) {
    console.error('Get employee equipment error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת ציוד עובד' });
  }
});

// Create equipment
router.post('/', requireAdmin, (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { employee_id, item_type, item_name, serial_number, condition, assigned_date, notes } = req.body;

    if (!item_type || !item_name) {
      return res.status(400).json({ error: 'סוג ושם הציוד נדרשים' });
    }

    db.query(`
      INSERT INTO guard_equipment (id, employee_id, item_type, item_name, serial_number, condition, assigned_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, employee_id || null, item_type, item_name, serial_number || null, condition || 'good', assigned_date || new Date().toISOString().split('T')[0], notes || null]);

    const result = db.query('SELECT * FROM guard_equipment WHERE id = ?', [id]);
    res.status(201).json({ equipment: result.rows[0] });
  } catch (error) {
    console.error('Create equipment error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת ציוד' });
  }
});

// Update equipment
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { employee_id, item_type, item_name, serial_number, condition, assigned_date, return_date, notes } = req.body;

    db.query(`
      UPDATE guard_equipment SET
        employee_id = ?, item_type = ?, item_name = ?, serial_number = ?,
        condition = ?, assigned_date = ?, return_date = ?, notes = ?
      WHERE id = ?
    `, [employee_id || null, item_type, item_name, serial_number || null, condition || 'good', assigned_date || null, return_date || null, notes || null, req.params.id]);

    const result = db.query('SELECT * FROM guard_equipment WHERE id = ?', [req.params.id]);
    res.json({ equipment: result.rows[0] });
  } catch (error) {
    console.error('Update equipment error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון ציוד' });
  }
});

// Return equipment (set return date)
router.post('/:id/return', requireAdmin, (req, res) => {
  try {
    db.query(`
      UPDATE guard_equipment SET return_date = ?, condition = ?
      WHERE id = ?
    `, [new Date().toISOString().split('T')[0], req.body.condition || 'good', req.params.id]);

    const result = db.query('SELECT * FROM guard_equipment WHERE id = ?', [req.params.id]);
    res.json({ equipment: result.rows[0] });
  } catch (error) {
    console.error('Return equipment error:', error);
    res.status(500).json({ error: 'שגיאה בהחזרת ציוד' });
  }
});

// Delete equipment
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    db.query('DELETE FROM guard_equipment WHERE id = ?', [req.params.id]);
    res.json({ message: 'ציוד נמחק בהצלחה' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת ציוד' });
  }
});

module.exports = router;
