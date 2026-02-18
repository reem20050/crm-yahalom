const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateToken);

// Get all templates
router.get('/', async (req, res) => {
  try {
    const result = db.query(`
      SELECT st.*,
             c.company_name,
             s.name as site_name
      FROM shift_templates st
      LEFT JOIN customers c ON st.customer_id = c.id
      LEFT JOIN sites s ON st.site_id = s.id
      ORDER BY st.is_active DESC, st.name
    `);
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת תבניות' });
  }
});

// Get single template
router.get('/:id', async (req, res) => {
  try {
    const result = db.query(`
      SELECT st.*,
             c.company_name,
             s.name as site_name
      FROM shift_templates st
      LEFT JOIN customers c ON st.customer_id = c.id
      LEFT JOIN sites s ON st.site_id = s.id
      WHERE st.id = ?
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת תבנית' });
  }
});

// Create template
router.post('/', requireAdmin, async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { name, customer_id, site_id, start_time, end_time, required_employees, requires_weapon, requires_vehicle, days_of_week, shift_type, default_notes, preferred_employees } = req.body;

    db.query(`
      INSERT INTO shift_templates (id, name, customer_id, site_id, start_time, end_time, required_employees, requires_weapon, requires_vehicle, days_of_week, shift_type, default_notes, preferred_employees)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, customer_id || null, site_id || null, start_time, end_time, required_employees || 1, requires_weapon ? 1 : 0, requires_vehicle ? 1 : 0, JSON.stringify(days_of_week || []), shift_type || 'regular', default_notes || null, JSON.stringify(preferred_employees || [])]);

    const result = db.query(`
      SELECT st.*, c.company_name, s.name as site_name
      FROM shift_templates st
      LEFT JOIN customers c ON st.customer_id = c.id
      LEFT JOIN sites s ON st.site_id = s.id
      WHERE st.id = ?
    `, [id]);
    res.status(201).json({ template: result.rows[0] });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת תבנית' });
  }
});

// Update template
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, customer_id, site_id, start_time, end_time, required_employees, requires_weapon, requires_vehicle, days_of_week, shift_type, default_notes, preferred_employees, is_active, auto_generate } = req.body;

    db.query(`
      UPDATE shift_templates SET
        name = ?, customer_id = ?, site_id = ?, start_time = ?, end_time = ?,
        required_employees = ?, requires_weapon = ?, requires_vehicle = ?,
        days_of_week = ?, shift_type = ?, default_notes = ?,
        preferred_employees = ?, is_active = ?, auto_generate = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [name, customer_id, site_id, start_time, end_time, required_employees, requires_weapon ? 1 : 0, requires_vehicle ? 1 : 0, JSON.stringify(days_of_week || []), shift_type, default_notes, JSON.stringify(preferred_employees || []), is_active !== undefined ? (is_active ? 1 : 0) : 1, auto_generate ? 1 : 0, req.params.id]);

    const result = db.query(`
      SELECT st.*, c.company_name, s.name as site_name
      FROM shift_templates st
      LEFT JOIN customers c ON st.customer_id = c.id
      LEFT JOIN sites s ON st.site_id = s.id
      WHERE st.id = ?
    `, [req.params.id]);
    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון תבנית' });
  }
});

// Generate shifts from template
router.post('/:id/generate', requireAdmin, async (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    const template = db.query('SELECT * FROM shift_templates WHERE id = ?', [req.params.id]);

    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }

    const tmpl = template.rows[0];
    const daysOfWeek = JSON.parse(tmpl.days_of_week || '[]');
    const createdShifts = [];

    // Iterate through each day in range
    const start = new Date(start_date);
    const end = new Date(end_date);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay(); // 0=Sunday

      if (daysOfWeek.includes(dayOfWeek)) {
        const dateStr = d.toISOString().split('T')[0];

        // Check if shift already exists for same site/date/time
        const existing = db.query(`
          SELECT id FROM shifts
          WHERE site_id = ? AND date = ? AND start_time = ? AND end_time = ?
        `, [tmpl.site_id, dateStr, tmpl.start_time, tmpl.end_time]);

        if (existing.rows.length === 0) {
          const shiftId = crypto.randomUUID();
          db.query(`
            INSERT INTO shifts (id, site_id, customer_id, date, start_time, end_time, required_employees, requires_weapon, requires_vehicle, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [shiftId, tmpl.site_id, tmpl.customer_id, dateStr, tmpl.start_time, tmpl.end_time, tmpl.required_employees, tmpl.requires_weapon, tmpl.requires_vehicle, tmpl.default_notes]);

          createdShifts.push({ id: shiftId, date: dateStr });
        }
      }
    }

    res.json({
      message: `נוצרו ${createdShifts.length} משמרות מתבנית`,
      shifts: createdShifts
    });
  } catch (error) {
    console.error('Generate shifts error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משמרות מתבנית' });
  }
});

// Toggle auto-generate for a template
router.patch('/:id/auto-generate', requireAdmin, async (req, res) => {
  try {
    const { auto_generate } = req.body;
    db.query(`
      UPDATE shift_templates SET auto_generate = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [auto_generate ? 1 : 0, req.params.id]);

    const result = db.query(`
      SELECT st.*, c.company_name, s.name as site_name
      FROM shift_templates st
      LEFT JOIN customers c ON st.customer_id = c.id
      LEFT JOIN sites s ON st.site_id = s.id
      WHERE st.id = ?
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Toggle auto-generate error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון יצירה אוטומטית' });
  }
});

// Delete template
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    db.query('DELETE FROM shift_templates WHERE id = ?', [req.params.id]);
    res.json({ message: 'תבנית נמחקה' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'שגיאה במחיקת תבנית' });
  }
});

module.exports = router;
