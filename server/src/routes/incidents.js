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
    let paramIndex = 0;

    if (status) {
      params.push(status);
      paramIndex++;
      sql += ` AND i.status = $${paramIndex}`;
    }
    if (severity) {
      params.push(severity);
      paramIndex++;
      sql += ` AND i.severity = $${paramIndex}`;
    }
    if (customer_id) {
      params.push(customer_id);
      paramIndex++;
      sql += ` AND i.customer_id = $${paramIndex}`;
    }
    if (site_id) {
      params.push(site_id);
      paramIndex++;
      sql += ` AND i.site_id = $${paramIndex}`;
    }
    if (from_date) {
      params.push(from_date);
      paramIndex++;
      sql += ` AND i.incident_date >= $${paramIndex}`;
    }
    if (to_date) {
      params.push(to_date);
      paramIndex++;
      sql += ` AND i.incident_date <= $${paramIndex}`;
    }
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      paramIndex++;
      const p1 = paramIndex;
      paramIndex++;
      const p2 = paramIndex;
      sql += ` AND (i.title LIKE $${p1} OR i.description LIKE $${p2})`;
    }

    sql += ` ORDER BY i.incident_date DESC, i.incident_time DESC`;

    const result = await db.query(sql, params);
    res.json({ incidents: result.rows });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת אירועי אבטחה' });
  }
});

// Get incident stats
router.get('/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'investigating' THEN 1 ELSE 0 END) as investigating_count,
        SUM(CASE WHEN status = 'resolved' AND resolution_date >= date_trunc('month', CURRENT_DATE) THEN 1 ELSE 0 END) as resolved_this_month,
        SUM(CASE WHEN status = 'closed' AND resolution_date >= date_trunc('month', CURRENT_DATE) THEN 1 ELSE 0 END) as closed_this_month,
        SUM(CASE WHEN severity = 'critical' AND status IN ('open', 'investigating') THEN 1 ELSE 0 END) as critical_open,
        SUM(CASE WHEN incident_date >= date_trunc('month', CURRENT_DATE) THEN 1 ELSE 0 END) as total_this_month
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
    const incident = await db.query(`
      SELECT i.*,
             c.company_name,
             s.name as site_name, s.address as site_address,
             e.first_name || ' ' || e.last_name as reporter_name, e.phone as reporter_phone
      FROM incidents i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN employees e ON i.reported_by = e.id
      WHERE i.id = $1
    `, [req.params.id]);

    if (incident.rows.length === 0) {
      return res.status(404).json({ error: 'אירוע אבטחה לא נמצא' });
    }

    const updates = await db.query(`
      SELECT iu.*, u.first_name || ' ' || u.last_name as user_name
      FROM incident_updates iu
      LEFT JOIN users u ON iu.user_id = u.id
      WHERE iu.incident_id = $1
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

    await db.query(`
      INSERT INTO incidents (id, site_id, customer_id, shift_id, reported_by,
        incident_type, severity, title, description, location_details,
        incident_date, incident_time, police_called, police_report_number,
        ambulance_called, injuries_reported, property_damage, witnesses, actions_taken)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `, [id, site_id || null, customer_id || null, shift_id || null, reported_by || null,
        incident_type, severity || 'low', title, description, location_details || null,
        incident_date, incident_time, police_called ? 1 : 0, police_report_number || null,
        ambulance_called ? 1 : 0, injuries_reported ? 1 : 0, property_damage ? 1 : 0,
        witnesses || null, actions_taken || null]);

    const result = await db.query('SELECT * FROM incidents WHERE id = $1', [id]);
    const incident = result.rows[0];

    // Create notifications for admins/managers on critical/high severity
    if (severity === 'critical' || severity === 'high') {
      const admins = await db.query(`SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = 1`);
      const severityLabel = severity === 'critical' ? 'קריטי' : 'גבוה';
      for (const admin of admins.rows) {
        const notifId = crypto.randomUUID();
        await db.query(`
          INSERT INTO notifications (id, user_id, type, title, message, related_entity_type, related_entity_id)
          VALUES ($1, $2, 'incident', $3, $4, 'incident', $5)
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

    await db.query(`
      UPDATE incidents SET
        incident_type = $1, severity = $2, title = $3, description = $4,
        location_details = $5, incident_date = $6, incident_time = $7,
        police_called = $8, police_report_number = $9, ambulance_called = $10,
        injuries_reported = $11, property_damage = $12, witnesses = $13,
        actions_taken = $14, status = $15, updated_at = NOW()
      WHERE id = $16
    `, [incident_type, severity, title, description,
        location_details, incident_date, incident_time,
        police_called ? 1 : 0, police_report_number, ambulance_called ? 1 : 0,
        injuries_reported ? 1 : 0, property_damage ? 1 : 0, witnesses,
        actions_taken, status, req.params.id]);

    const result = await db.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
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

    await db.query(`
      INSERT INTO incident_updates (id, incident_id, user_id, update_text)
      VALUES ($1, $2, $3, $4)
    `, [id, req.params.id, req.user.id, update_text]);

    await db.query(`UPDATE incidents SET updated_at = NOW() WHERE id = $1`, [req.params.id]);

    const result = await db.query(`
      SELECT iu.*, u.first_name || ' ' || u.last_name as user_name
      FROM incident_updates iu
      LEFT JOIN users u ON iu.user_id = u.id
      WHERE iu.id = $1
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

    await db.query(`
      UPDATE incidents SET
        status = 'resolved', resolution = $1, resolution_date = CURRENT_DATE,
        updated_at = NOW()
      WHERE id = $2
    `, [resolution, req.params.id]);

    const result = await db.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
    res.json({ incident: result.rows[0] });
  } catch (error) {
    console.error('Resolve incident error:', error);
    res.status(500).json({ error: 'שגיאה בסגירת אירוע' });
  }
});

module.exports = router;
