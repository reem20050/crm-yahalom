const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateToken);

// Get all weapons
router.get('/', async (req, res) => {
  try {
    const result = db.query(`
      SELECT gw.*,
             e.first_name || ' ' || e.last_name as employee_name
      FROM guard_weapons gw
      LEFT JOIN employees e ON gw.employee_id = e.id
      ORDER BY gw.status, gw.created_at DESC
    `);
    res.json({ weapons: result.rows });
  } catch (error) {
    console.error('Get weapons error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נשקים' });
  }
});

// Get available weapons (in armory)
router.get('/available', async (req, res) => {
  try {
    const result = db.query(`
      SELECT * FROM guard_weapons
      WHERE status = 'in_armory'
      ORDER BY weapon_type, manufacturer
    `);
    res.json({ weapons: result.rows });
  } catch (error) {
    console.error('Get available weapons error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נשקים זמינים' });
  }
});

// Get weapons for employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const result = db.query(`
      SELECT * FROM guard_weapons
      WHERE employee_id = ?
      ORDER BY status, assigned_date DESC
    `, [req.params.employeeId]);
    res.json({ weapons: result.rows });
  } catch (error) {
    console.error('Get employee weapons error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת נשקים' });
  }
});

// Create weapon
router.post('/', requireAdmin, async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { employee_id, weapon_type, manufacturer, model, serial_number, license_number, license_expiry, status, notes } = req.body;

    db.query(`
      INSERT INTO guard_weapons (id, employee_id, weapon_type, manufacturer, model, serial_number, license_number, license_expiry, status, assigned_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, employee_id || null, weapon_type, manufacturer || null, model || null, serial_number, license_number || null, license_expiry || null, status || (employee_id ? 'assigned' : 'in_armory'), employee_id ? new Date().toISOString().split('T')[0] : null, notes || null]);

    const result = db.query('SELECT * FROM guard_weapons WHERE id = ?', [id]);
    res.status(201).json({ weapon: result.rows[0] });
  } catch (error) {
    console.error('Create weapon error:', error);
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'מספר סידורי כבר קיים במערכת' });
    }
    res.status(500).json({ error: 'שגיאה ביצירת נשק' });
  }
});

// Update weapon
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { employee_id, weapon_type, manufacturer, model, serial_number, license_number, license_expiry, status, notes } = req.body;

    db.query(`
      UPDATE guard_weapons SET
        employee_id = ?, weapon_type = ?, manufacturer = ?, model = ?,
        serial_number = ?, license_number = ?, license_expiry = ?,
        status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [employee_id || null, weapon_type, manufacturer, model, serial_number, license_number, license_expiry, status, notes, req.params.id]);

    const result = db.query('SELECT * FROM guard_weapons WHERE id = ?', [req.params.id]);
    res.json({ weapon: result.rows[0] });
  } catch (error) {
    console.error('Update weapon error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון נשק' });
  }
});

// Transfer weapon
router.post('/:id/transfer', requireAdmin, async (req, res) => {
  try {
    const { new_employee_id } = req.body;

    db.query(`
      UPDATE guard_weapons SET
        employee_id = ?,
        status = ?,
        assigned_date = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `, [new_employee_id || null, new_employee_id ? 'assigned' : 'in_armory', new_employee_id ? new Date().toISOString().split('T')[0] : null, req.params.id]);

    const result = db.query(`
      SELECT gw.*, e.first_name || ' ' || e.last_name as employee_name
      FROM guard_weapons gw
      LEFT JOIN employees e ON gw.employee_id = e.id
      WHERE gw.id = ?
    `, [req.params.id]);
    res.json({ weapon: result.rows[0] });
  } catch (error) {
    console.error('Transfer weapon error:', error);
    res.status(500).json({ error: 'שגיאה בהעברת נשק' });
  }
});

// Delete weapon
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    db.query('DELETE FROM guard_weapons WHERE id = ?', [req.params.id]);
    res.json({ message: 'נשק נמחק' });
  } catch (error) {
    console.error('Delete weapon error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת נשק' });
  }
});

module.exports = router;
