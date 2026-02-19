const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// Global search across all entities
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'נדרשים לפחות 2 תווים לחיפוש' });
    }

    const searchTerm = `%${q.trim()}%`;

    // Search leads
    const leadsResult = await db.query(`
      SELECT id, contact_name, company_name, phone, status,
             'lead' as type
      FROM leads
      WHERE contact_name LIKE $1
         OR company_name LIKE $1
         OR phone LIKE $1
         OR email LIKE $1
      LIMIT 20
    `, [searchTerm]);

    // Search customers
    const customersResult = await db.query(`
      SELECT id, company_name, city, status,
             'customer' as type
      FROM customers
      WHERE company_name LIKE $1
         OR address LIKE $1
         OR city LIKE $1
      LIMIT 20
    `, [searchTerm]);

    // Search employees
    const employeesResult = await db.query(`
      SELECT id, first_name, last_name, phone, status,
             'employee' as type
      FROM employees
      WHERE first_name LIKE $1
         OR last_name LIKE $1
         OR phone LIKE $1
         OR email LIKE $1
      LIMIT 20
    `, [searchTerm]);

    // Search events (with JOIN to get customer company_name)
    const eventsResult = await db.query(`
      SELECT e.id, e.event_name, e.event_date, c.company_name, e.status,
             'event' as type
      FROM events e
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE e.event_name LIKE $1
         OR e.location LIKE $1
         OR c.company_name LIKE $1
      LIMIT 20
    `, [searchTerm]);

    // Search contractors
    const contractorsResult = await db.query(`
      SELECT id, company_name, contact_name, phone, status,
             'contractor' as type
      FROM contractors
      WHERE company_name LIKE $1
         OR contact_name LIKE $1
      LIMIT 20
    `, [searchTerm]);

    // Combine all results and limit to 20 total
    const allResults = [
      ...leadsResult.rows,
      ...customersResult.rows,
      ...employeesResult.rows,
      ...eventsResult.rows,
      ...contractorsResult.rows,
    ].slice(0, 20);

    res.json({ results: allResults });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'שגיאה בחיפוש' });
  }
});

module.exports = router;
