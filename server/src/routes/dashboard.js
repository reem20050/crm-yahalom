const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get main dashboard data
router.get('/', async (req, res) => {
  try {
    // Run all queries in parallel
    const [
      leadsStats,
      customersStats,
      shiftsToday,
      upcomingEvents,
      overdueInvoices,
      monthlyRevenue,
      recentActivity,
      contractsExpiring,
      unassignedShifts
    ] = await Promise.all([
      // Leads statistics
      db.query(`
        SELECT
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_leads,
          SUM(CASE WHEN status IN ('contacted', 'meeting_scheduled', 'proposal_sent', 'negotiation') THEN 1 ELSE 0 END) as active_leads,
          SUM(CASE WHEN status = 'won' AND updated_at >= date('now', 'start of month') THEN 1 ELSE 0 END) as won_this_month
        FROM leads
      `),

      // Customers statistics
      db.query(`
        SELECT
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_customers,
          SUM(CASE WHEN created_at >= date('now', 'start of month') THEN 1 ELSE 0 END) as new_this_month
        FROM customers
      `),

      // Today's shifts
      db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM shifts
        WHERE date = date('now')
      `),

      // Upcoming events (next 7 days)
      db.query(`
        SELECT e.id, e.event_name, e.event_date, e.start_time, e.location,
               e.required_guards, e.status,
               c.company_name,
               (SELECT COUNT(*) FROM event_assignments WHERE event_id = e.id) as assigned_count
        FROM events e
        LEFT JOIN customers c ON e.customer_id = c.id
        WHERE e.event_date BETWEEN date('now') AND date('now', '+7 days')
        AND e.status NOT IN ('completed', 'cancelled')
        ORDER BY e.event_date, e.start_time
        LIMIT 5
      `),

      // Overdue invoices
      db.query(`
        SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
               c.company_name,
               CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'sent' AND i.due_date < date('now')
        ORDER BY i.due_date
        LIMIT 5
      `),

      // Monthly revenue (last 6 months)
      db.query(`
        SELECT
          strftime('%Y-%m', issue_date) as month,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as revenue,
          SUM(total_amount) as total_invoiced
        FROM invoices
        WHERE issue_date >= date('now', 'start of month', '-5 months')
        GROUP BY strftime('%Y-%m', issue_date)
        ORDER BY month
      `),

      // Recent activity
      db.query(`
        SELECT al.*, u.first_name || ' ' || u.last_name as user_name
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 10
      `),

      // Contracts expiring soon (next 30 days)
      db.query(`
        SELECT ct.id, ct.end_date, ct.monthly_value,
               c.company_name, c.id as customer_id
        FROM contracts ct
        JOIN customers c ON ct.customer_id = c.id
        WHERE ct.status = 'active'
        AND ct.end_date BETWEEN date('now') AND date('now', '+30 days')
        ORDER BY ct.end_date
        LIMIT 5
      `),

      // Unassigned shifts today
      db.query(`
        SELECT s.*, c.company_name, si.name as site_name
        FROM shifts s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sites si ON s.site_id = si.id
        WHERE s.date = date('now')
        AND (SELECT COUNT(*) FROM shift_assignments WHERE shift_id = s.id) < s.required_employees
        ORDER BY s.start_time
      `)
    ]);

    res.json({
      leads: leadsStats.rows[0],
      customers: customersStats.rows[0],
      shiftsToday: shiftsToday.rows[0],
      upcomingEvents: upcomingEvents.rows,
      overdueInvoices: overdueInvoices.rows,
      monthlyRevenue: monthlyRevenue.rows,
      recentActivity: recentActivity.rows,
      contractsExpiring: contractsExpiring.rows,
      unassignedShifts: unassignedShifts.rows
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת דשבורד' });
  }
});

// Operations dashboard data
router.get('/operations', async (req, res) => {
  try {
    const [
      guardsToday,
      siteCoverage,
      openIncidents,
      guardsNotCheckedIn,
      sitesNoCoverage,
      shiftChanges,
      expiringCerts,
      todayIncidents
    ] = await Promise.all([
      // Guards on duty today
      db.query(`
        SELECT
          COUNT(DISTINCT sa.employee_id) as on_duty,
          (SELECT SUM(s2.required_employees) FROM shifts s2 WHERE s2.date = date('now') AND s2.status != 'cancelled') as expected
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.date = date('now') AND s.status IN ('in_progress', 'completed')
      `),

      // Sites with coverage today
      db.query(`
        SELECT COUNT(DISTINCT s.site_id) as covered
        FROM shifts s
        WHERE s.date = date('now') AND s.status != 'cancelled' AND s.site_id IS NOT NULL
      `),

      // Open incidents
      db.query(`
        SELECT
          COUNT(*) as count,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical
        FROM incidents
        WHERE status IN ('open', 'investigating')
      `),

      // Guards not checked in (assigned but no check-in)
      db.query(`
        SELECT e.id, e.first_name, e.last_name, e.phone,
               s.start_time, si.name as site_name, c.company_name
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN employees e ON sa.employee_id = e.id
        LEFT JOIN sites si ON s.site_id = si.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.date = date('now')
          AND s.status = 'scheduled'
          AND sa.check_in_time IS NULL
          AND s.start_time <= strftime('%H:%M', 'now', 'localtime')
        ORDER BY s.start_time
        LIMIT 10
      `),

      // Sites without coverage today
      db.query(`
        SELECT si.id, si.name, si.address, c.company_name,
               s.start_time, s.end_time
        FROM shifts s
        JOIN sites si ON s.site_id = si.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.date = date('now')
          AND s.status != 'cancelled'
          AND (SELECT COUNT(*) FROM shift_assignments WHERE shift_id = s.id) < s.required_employees
        ORDER BY s.start_time
        LIMIT 10
      `),

      // Upcoming shift changes (next 3 days)
      db.query(`
        SELECT s.*, c.company_name,
               (SELECT COUNT(*) FROM shift_assignments WHERE shift_id = s.id) as assigned_count
        FROM shifts s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.date BETWEEN date('now', '+1 days') AND date('now', '+3 days')
          AND s.status != 'cancelled'
        ORDER BY s.date, s.start_time
        LIMIT 10
      `),

      // Expiring licenses/certifications (next 30 days)
      db.query(`
        SELECT gc.id, gc.type, gc.name as cert_name, gc.expiry_date,
               e.first_name || ' ' || e.last_name as employee_name,
               CAST(julianday(gc.expiry_date) - julianday('now') AS INTEGER) as days_left
        FROM guard_certifications gc
        JOIN employees e ON gc.employee_id = e.id
        WHERE gc.status = 'active'
          AND gc.expiry_date BETWEEN date('now') AND date('now', '+30 days')
        ORDER BY gc.expiry_date
        LIMIT 10
      `),

      // Today's incidents
      db.query(`
        SELECT i.*, si.name as site_name, c.company_name
        FROM incidents i
        LEFT JOIN sites si ON i.site_id = si.id
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.incident_date = date('now') OR (i.incident_date IS NULL AND i.created_at >= date('now'))
        ORDER BY i.created_at DESC
        LIMIT 10
      `)
    ]);

    res.json({
      guards_on_duty: guardsToday.rows[0]?.on_duty || 0,
      guards_expected_today: guardsToday.rows[0]?.expected || 0,
      sites_with_coverage: siteCoverage.rows[0]?.covered || 0,
      open_incidents: openIncidents.rows[0] || { count: 0, critical: 0 },
      guards_not_checked_in: guardsNotCheckedIn.rows,
      sites_without_coverage: sitesNoCoverage.rows,
      upcoming_shift_changes: shiftChanges.rows,
      expiring_licenses: expiringCerts.rows,
      today_incidents: todayIncidents.rows
    });
  } catch (error) {
    console.error('Get operations dashboard error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת דשבורד מבצעי' });
  }
});

// Get notifications
router.get('/notifications', async (req, res) => {
  try {
    const { unread_only } = req.query;

    let queryStr = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;
    if (unread_only === 'true') {
      queryStr += ` AND is_read = 0`;
    }
    queryStr += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await db.query(queryStr, [req.user.id]);

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת התראות' });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'התראה סומנה כנקראה' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון התראה' });
  }
});

// SSE stream for real-time notifications
router.get('/notifications/stream', async (req, res) => {
  try {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Heartbeat to keep connection alive (every 30 seconds)
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);

    // Poll for new notifications every 15 seconds
    let lastCheck = new Date().toISOString();
    const pollInterval = setInterval(async () => {
      try {
        const result = await db.query(
          `SELECT * FROM notifications
           WHERE user_id = $1 AND created_at > $2
           ORDER BY created_at DESC LIMIT 10`,
          [req.user.id, lastCheck]
        );

        if (result.rows.length > 0) {
          lastCheck = new Date().toISOString();
          for (const notification of result.rows) {
            res.write(`data: ${JSON.stringify({
              type: 'notification',
              data: notification
            })}\n\n`);
          }
        }
      } catch (err) {
        console.error('SSE poll error:', err);
      }
    }, 15000);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      clearInterval(pollInterval);
    });
  } catch (error) {
    console.error('SSE stream error:', error);
    res.status(500).json({ error: 'שגיאה בחיבור SSE' });
  }
});

// Mark all notifications as read
router.patch('/notifications/read-all', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'כל ההתראות סומנו כנקראו' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'שגיאה בעדכון התראות' });
  }
});

module.exports = router;
