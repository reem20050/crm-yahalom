const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateToken);

// Get all incidents with filters
router.get('/', async (req, res) => {
  try {
    const { status, severity, customer_id, site_id, from_date, to_date, search } = req.query;

    let sql = `
      SELECT i.*,
             c.company_name,
             s.name as site_name,
             e.first_name || ' ' || e.last_name as reporter_name,
             (SELECT COUNT(*) FROM incident_updates WHERE incident_id = i.id) as updates_count
      FROM incidents i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN employees e ON i.reported_by = e.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND i.status = ?`;
    }
    if (severity) {
      params.push(severity);
      sql += ` AND i.severity = ?`;
    }
    if (customer_id) {
      params.push(customer_id);
      sql += ` AND i.customer_id = ?`;
    }
    if (site_id) {
      params.push(site_id);
      sql += ` AND i.site_id = ?`;
    }
    if (from_date) {
      params.push(from_date);
      sql += ` AND i.incident_date >= ?`;
    }
    if (to_date) {
      params.push(to_date);
      sql += ` AND i.incident_date <= ?`;
    }
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      sql += ` AND (i.title LIKE ? OR i.description LIKE ?)`;
    }

    sql += ` ORDER BY i.incident_date DESC, i.incident_time DESC`;

    const result = db.query(sql, params);
    res.json({ incidents: result.rows });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אירועי אבטחה' });
  }
});

// Get incident stats
router.get('/stats', async (req, res) => {
  try {
    const result = db.query(`
      SELECT
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'investigating' THEN 1 ELSE 0 END) as investigating_count,
        SUM(CASE WHEN status = 'resolved' AND resolution_date >= date('now', 'start of month') THEN 1 ELSE 0 END) as resolved_this_month,
        SUM(CASE WHEN status = 'closed' AND resolution_date >= date('now', 'start of month') THEN 1 ELSE 0 END) as closed_this_month,
        SUM(CASE WHEN severity = 'critical' AND status IN ('open', 'investigating') THEN 1 ELSE 0 END) as critical_open,
        SUM(CASE WHEN incident_date >= date('now', 'start of month') THEN 1 ELSE 0 END) as total_this_month
      FROM incidents
    `);
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Get incident stats error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטיסטיקות' });
  }
});

// Get single incident with updates
router.get('/:id', async (req, res) => {
  try {
    const incident = db.query(`
      SELECT i.*,
             c.company_name,
             s.name as site_name, s.address as site_address,
             e.first_name || ' ' || e.last_name as reporter_name, e.phone as reporter_phone
      FROM incidents i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN employees e ON i.reported_by = e.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (incident.rows.length === 0) {
      return res.status(404).json({ error: 'אירוע אבטחה לא נמצא' });
    }

    const updates = db.query(`
      SELECT iu.*, u.first_name || ' ' || u.last_name as user_name
      FROM incident_updates iu
      LEFT JOIN users u ON iu.user_id = u.id
      WHERE iu.incident_id = ?
      ORDER BY iu.created_at DESC
    `, [req.params.id]);

    res.json({
      incident: incident.rows[0],
      updates: updates.rows
    });
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אירוע' });
  }
});

// Create incident
router.post('/', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const {
      site_id, customer_id, shift_id, reported_by,
      incident_type, severity, title, description,
      location_details, incident_date, incident_time,
      police_called, police_report_number, ambulance_called,
      injuries_reported, property_damage, witnesses,
      actions_taken
    } = req.body;

    db.query(`
      INSERT INTO incidents (id, site_id, customer_id, shift_id, reported_by,
        incident_type, severity, title, description, location_details,
        incident_date, incident_time, police_called, police_report_number,
        ambulance_called, injuries_reported, property_damage, witnesses, actions_taken)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, site_id || null, customer_id || null, shift_id || null, reported_by || null,
        incident_type, severity || 'low', title, description, location_details || null,
        incident_date, incident_time, police_called ? 1 : 0, police_report_number || null,
        ambulance_called ? 1 : 0, injuries_reported ? 1 : 0, property_damage ? 1 : 0,
        witnesses || null, actions_taken || null]);

    const result = db.query('SELECT * FROM incidents WHERE id = ?', [id]);
    const incident = result.rows[0];

    // Create notifications for admins/managers on critical/high severity
    if (severity === 'critical' || severity === 'high') {
      const admins = db.query(`SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = 1`);
      const severityLabel = severity === 'critical' ? 'קריטי' : 'גבוה';
      for (const admin of admins.rows) {
        const notifId = crypto.randomUUID();
        db.query(`
          INSERT INTO notifications (id, user_id, type, title, message, related_entity_type, related_entity_id)
          VALUES (?, ?, 'incident', ?, ?, 'incident', ?)
        `, [notifId, admin.id,
            `אירוע אבטחה ${severityLabel}: ${title}`,
            `${description?.substring(0, 100) || ''}${description?.length > 100 ? '...' : ''}`,
            id]);
      }
    }

    res.status(201).json({ incident });
  } catch (error) {
    console.error('Create incident error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת אירוע אבטחה' });
  }
});

// Update incident
router.put('/:id', requireManager, async (req, res) => {
  try {
    const {
      incident_type, severity, title, description,
      location_details, incident_date, incident_time,
      police_called, police_report_number, ambulance_called,
      injuries_reported, property_damage, witnesses,
      actions_taken, status
    } = req.body;

    db.query(`
      UPDATE incidents SET
        incident_type = ?, severity = ?, title = ?, description = ?,
        location_details = ?, incident_date = ?, incident_time = ?,
        police_called = ?, police_report_number = ?, ambulance_called = ?,
        injuries_reported = ?, property_damage = ?, witnesses = ?,
        actions_taken = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [incident_type, severity, title, description,
        location_details, incident_date, incident_time,
        police_called ? 1 : 0, police_report_number, ambulance_called ? 1 : 0,
        injuries_reported ? 1 : 0, property_damage ? 1 : 0, witnesses,
        actions_taken, status, req.params.id]);

    const result = db.query('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    res.json({ incident: result.rows[0] });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון אירוע' });
  }
});

// Add update to incident timeline
router.post('/:id/updates', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const { update_text } = req.body;

    db.query(`
      INSERT INTO incident_updates (id, incident_id, user_id, update_text)
      VALUES (?, ?, ?, ?)
    `, [id, req.params.id, req.user.id, update_text]);

    db.query(`UPDATE incidents SET updated_at = datetime('now') WHERE id = ?`, [req.params.id]);

    const result = db.query(`
      SELECT iu.*, u.first_name || ' ' || u.last_name as user_name
      FROM incident_updates iu
      LEFT JOIN users u ON iu.user_id = u.id
      WHERE iu.id = ?
    `, [id]);

    res.status(201).json({ update: result.rows[0] });
  } catch (error) {
    console.error('Add incident update error:', error);
    res.status(500).json({ error: 'שגיאה בהוספת עדכון' });
  }
});

// Resolve incident
router.patch('/:id/resolve', requireManager, async (req, res) => {
  try {
    const { resolution } = req.body;

    db.query(`
      UPDATE incidents SET
        status = 'resolved', resolution = ?, resolution_date = date('now', 'localtime'),
        updated_at = datetime('now')
      WHERE id = ?
    `, [resolution, req.params.id]);

    const result = db.query('SELECT * FROM incidents WHERE id = ?', [req.params.id]);
    res.json({ incident: result.rows[0] });
  } catch (error) {
    console.error('Resolve incident error:', error);
    res.status(500).json({ error: 'שגיאה בסגירת אירוע' });
  }
});

module.exports = router;
