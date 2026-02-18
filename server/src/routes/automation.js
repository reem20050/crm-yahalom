const express = require('express');
const { authenticateToken, requireManager } = require('../middleware/auth');
const autoShiftGenerator = require('../services/autoShiftGenerator');
const db = require('../config/database');

const router = express.Router();
router.use(authenticateToken);

// Get automation status and logs
router.get('/status', requireManager, async (req, res) => {
  try {
    // Count auto-generate templates
    const templates = db.query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN auto_generate = 1 THEN 1 ELSE 0 END) as auto_enabled
      FROM shift_templates WHERE is_active = 1
    `);

    // Recent generation logs
    const logs = db.query(`
      SELECT * FROM auto_generation_log
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      templates: templates.rows[0],
      recentLogs: logs.rows
    });
  } catch (error) {
    console.error('Automation status error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת סטטוס אוטומציה' });
  }
});

// Manually trigger auto-shift generation
router.post('/generate-shifts', requireManager, async (req, res) => {
  try {
    const { week_start } = req.body;
    const targetWeek = week_start || autoShiftGenerator.getNextSunday();

    const results = autoShiftGenerator.generateWeekShifts(targetWeek, req.user.id);

    res.json({
      message: `נוצרו ${results.created} משמרות אוטומטית`,
      ...results,
      week_start: targetWeek
    });
  } catch (error) {
    console.error('Manual shift generation error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משמרות אוטומטית' });
  }
});

// Generate shifts from specific template
router.post('/generate-from-template/:templateId', requireManager, async (req, res) => {
  try {
    const { start_date, end_date } = req.body;
    if (!start_date) {
      return res.status(400).json({ error: 'נדרש תאריך התחלה' });
    }

    const template = db.query('SELECT * FROM shift_templates WHERE id = $1', [req.params.templateId]);
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'תבנית לא נמצאה' });
    }

    const result = autoShiftGenerator.generateFromTemplate(
      template.rows[0],
      start_date,
      req.user.id
    );

    res.json({
      message: `נוצרו ${result.created} משמרות מתבנית`,
      ...result
    });
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משמרות מתבנית' });
  }
});

// Get generation logs
router.get('/logs', requireManager, async (req, res) => {
  try {
    const { type, limit = 50 } = req.query;
    let whereClause = '1=1';
    const params = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      whereClause += ` AND type = $${paramCount}`;
      params.push(type);
    }

    paramCount++;
    params.push(limit);

    const result = db.query(`
      SELECT agl.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM auto_generation_log agl
      LEFT JOIN users u ON agl.created_by = u.id
      WHERE ${whereClause}
      ORDER BY agl.created_at DESC
      LIMIT $${paramCount}
    `, params);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get automation logs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת לוגים' });
  }
});

module.exports = router;
