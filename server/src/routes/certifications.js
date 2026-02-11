const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateToken);

// Get expiring certifications (next 30 days)
router.get('/expiring', async (req, res) => {
  try {
    const result = db.query(`
      SELECT gc.*,
             e.first_name || ' ' || e.last_name as employee_name, e.phone as employee_phone,
             CAST(julianday(gc.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry
      FROM guard_certifications gc
      JOIN employees e ON gc.employee_id = e.id
      WHERE gc.expiry_date IS NOT NULL
      AND gc.expiry_date BETWEEN date('now') AND date('now', '+30 days')
      AND gc.status != 'expired'
      ORDER BY gc.expiry_date
    `);
    res.json({ certifications: result.rows });
  } catch (error) {
    console.error('Get expiring certs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הסמכות' });
  }
});

// Get certifications for an employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const result = db.query(`
      SELECT *,
             CASE
               WHEN expiry_date IS NULL THEN 'no_expiry'
               WHEN expiry_date < date('now') THEN 'expired'
               WHEN expiry_date < date('now', '+30 days') THEN 'expiring_soon'
               WHEN expiry_date < date('now', '+60 days') THEN 'expiring'
               ELSE 'valid'
             END as expiry_status
      FROM guard_certifications
      WHERE employee_id = ?
      ORDER BY expiry_date
    `, [req.params.employeeId]);
    res.json({ certifications: result.rows });
  } catch (error) {
    console.error('Get employee certs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת הסמכות' });
  }
});

// Create certification
router.post('/', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { employee_id, cert_type, cert_name, cert_number, issuing_authority, issue_date, expiry_date, notes } = req.body;

    db.query(`
      INSERT INTO guard_certifications (id, employee_id, cert_type, cert_name, cert_number, issuing_authority, issue_date, expiry_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, employee_id, cert_type, cert_name, cert_number || null, issuing_authority || null, issue_date || null, expiry_date || null, notes || null]);

    const result = db.query('SELECT * FROM guard_certifications WHERE id = ?', [id]);
    res.status(201).json({ certification: result.rows[0] });
  } catch (error) {
    console.error('Create cert error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת הסמכה' });
  }
});

// Update certification
router.put('/:id', async (req, res) => {
  try {
    const { cert_type, cert_name, cert_number, issuing_authority, issue_date, expiry_date, status, notes } = req.body;

    db.query(`
      UPDATE guard_certifications SET
        cert_type = ?, cert_name = ?, cert_number = ?, issuing_authority = ?,
        issue_date = ?, expiry_date = ?, status = ?, notes = ?
      WHERE id = ?
    `, [cert_type, cert_name, cert_number, issuing_authority, issue_date, expiry_date, status || 'active', notes, req.params.id]);

    const result = db.query('SELECT * FROM guard_certifications WHERE id = ?', [req.params.id]);
    res.json({ certification: result.rows[0] });
  } catch (error) {
    console.error('Update cert error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון הסמכה' });
  }
});

// Delete certification
router.delete('/:id', async (req, res) => {
  try {
    db.query('DELETE FROM guard_certifications WHERE id = ?', [req.params.id]);
    res.json({ message: 'הסמכה נמחקה' });
  } catch (error) {
    console.error('Delete cert error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת הסמכה' });
  }
});

module.exports = router;
