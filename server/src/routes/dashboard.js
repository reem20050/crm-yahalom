const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get main dashboard data
router.get('/', async (req, res) => {
  try {
    // Employee-specific dashboard: only their own data
    if (req.user.role === 'employee' && req.user.employeeId) {
      const empId = req.user.employeeId;
      const [myShiftsToday, myUpcomingEvents, myRecentShifts, myEquipment] = await Promise.all([
        // My shifts today
        db.query(`
          SELECT s.id, s.date, s.start_time, s.end_time, s.status as shift_status,
                 c.company_name, si.name as site_name, si.address as site_address,
                 sa.id as assignment_id, sa.status as assignment_status,
                 sa.check_in_time, sa.check_out_time, sa.role as assignment_role
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          LEFT JOIN customers c ON s.customer_id = c.id
          LEFT JOIN sites si ON s.site_id = si.id
          WHERE sa.employee_id = $1 AND s.date = date('now', 'localtime')
          ORDER BY s.start_time
        `, [empId]),

        // My upcoming events (next 7 days)
        db.query(`
          SELECT e.id, e.event_name, e.event_date, e.start_time, e.end_time,
                 e.location, e.status, c.company_name,
                 ea.role as assignment_role
          FROM event_assignments ea
          JOIN events e ON ea.event_id = e.id
          LEFT JOIN customers c ON e.customer_id = c.id
          WHERE ea.employee_id = $1
            AND e.event_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')
            AND e.status NOT IN ('completed', 'cancelled')
          ORDER BY e.event_date, e.start_time
        `, [empId]),

        // My recent shifts (last 10)
        db.query(`
          SELECT s.date, s.start_time, s.end_time,
                 c.company_name, si.name as site_name,
                 sa.status as assignment_status, sa.actual_hours,
                 sa.check_in_time, sa.check_out_time
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          LEFT JOIN customers c ON s.customer_id = c.id
          LEFT JOIN sites si ON s.site_id = si.id
          WHERE sa.employee_id = $1
          ORDER BY s.date DESC, s.start_time DESC
          LIMIT 10
        `, [empId]),

        // My equipment
        db.query(`
          SELECT item_type, item_name, serial_number, condition
          FROM guard_equipment
          WHERE employee_id = $1 AND return_date IS NULL
          ORDER BY assigned_date DESC
        `, [empId])
      ]);

      return res.json({
        isEmployee: true,
        myShiftsToday: myShiftsToday.rows,
        myUpcomingEvents: myUpcomingEvents.rows,
        myRecentShifts: myRecentShifts.rows,
        myEquipment: myEquipment.rows
      });
    }

    // Admin/Manager dashboard - full data
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
          SUM(CASE WHEN status = 'won' AND updated_at >= date('now', 'localtime', 'start of month') THEN 1 ELSE 0 END) as won_this_month
        FROM leads
      `),

      // Customers statistics
      db.query(`
        SELECT
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_customers,
          SUM(CASE WHEN created_at >= date('now', 'localtime', 'start of month') THEN 1 ELSE 0 END) as new_this_month
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
        WHERE date = date('now', 'localtime')
      `),

      // Upcoming events (next 7 days)
      db.query(`
        SELECT e.id, e.event_name, e.event_date, e.start_time, e.location,
               e.required_guards, e.status,
               c.company_name,
               (SELECT COUNT(*) FROM event_assignments WHERE event_id = e.id) as assigned_count
        FROM events e
        LEFT JOIN customers c ON e.customer_id = c.id
        WHERE e.event_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')
        AND e.status NOT IN ('completed', 'cancelled')
        ORDER BY e.event_date, e.start_time
        LIMIT 5
      `),

      // Overdue invoices
      db.query(`
        SELECT i.id, i.invoice_number, i.total_amount, i.due_date,
               c.company_name,
               CAST(julianday('now', 'localtime') - julianday(i.due_date) AS INTEGER) as days_overdue
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'sent' AND i.due_date < date('now', 'localtime')
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
        WHERE issue_date >= date('now', 'localtime', 'start of month', '-5 months')
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
        AND ct.end_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')
        ORDER BY ct.end_date
        LIMIT 5
      `),

      // Unassigned shifts today
      db.query(`
        SELECT s.*, c.company_name, si.name as site_name
        FROM shifts s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sites si ON s.site_id = si.id
        WHERE s.date = date('now', 'localtime')
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

// Get 7-day trends for sparklines
router.get('/trends', async (req, res) => {
  try {
    const [dailyShifts, dailyLeads, dailyRevenue, dailyIncidents] = await Promise.all([
      // Daily shifts count (last 7 days)
      db.query(`
        SELECT date, COUNT(*) as count
        FROM shifts
        WHERE date BETWEEN date('now', 'localtime', '-6 days') AND date('now', 'localtime')
        GROUP BY date
        ORDER BY date
      `),

      // Daily new leads (last 7 days)
      db.query(`
        SELECT date(created_at) as date, COUNT(*) as count
        FROM leads
        WHERE created_at >= date('now', 'localtime', '-6 days')
        GROUP BY date(created_at)
        ORDER BY date
      `),

      // Daily revenue (last 7 days - paid invoices by payment date)
      db.query(`
        SELECT date(payment_date) as date,
               COALESCE(SUM(total_amount), 0) as amount
        FROM invoices
        WHERE status = 'paid'
          AND payment_date >= date('now', 'localtime', '-6 days')
        GROUP BY date(payment_date)
        ORDER BY date
      `),

      // Daily incidents (last 7 days)
      db.query(`
        SELECT date(created_at) as date, COUNT(*) as count
        FROM incidents
        WHERE created_at >= date('now', 'localtime', '-6 days')
        GROUP BY date(created_at)
        ORDER BY date
      `)
    ]);

    // Fill in missing days with zeros
    const fillDays = (rows, valueKey = 'count') => {
      const map = {};
      for (const row of rows) map[row.date] = row[valueKey] || 0;
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        result.push({ date: dateStr, value: map[dateStr] || 0 });
      }
      return result;
    };

    // Calculate change percentages (current 3 days vs previous 4 days)
    const calcChange = (data) => {
      const recent = data.slice(-3).reduce((s, d) => s + d.value, 0);
      const prev = data.slice(0, 4).reduce((s, d) => s + d.value, 0);
      if (prev === 0) return recent > 0 ? 100 : 0;
      return Math.round(((recent - prev) / prev) * 100);
    };

    const shifts = fillDays(dailyShifts.rows);
    const leads = fillDays(dailyLeads.rows);
    const revenue = fillDays(dailyRevenue.rows, 'amount');
    const incidents = fillDays(dailyIncidents.rows);

    res.json({
      shifts: { data: shifts, change: calcChange(shifts) },
      leads: { data: leads, change: calcChange(leads) },
      revenue: { data: revenue, change: calcChange(revenue) },
      incidents: { data: incidents, change: calcChange(incidents) },
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת מגמות' });
  }
});

// Get operations dashboard data
router.get('/operations', async (req, res) => {
  try {
    // Helper: run query safely, return empty on error
    const safeQuery = async (sql, params) => {
      try { return await db.query(sql, params); }
      catch (e) { console.warn('Operations query failed:', e.message); return { rows: [] }; }
    };

    const [
      guardsOnDuty,
      guardsExpected,
      sitesCovered,
      openIncidents,
      expiringLicenses,
      notCheckedIn,
      uncoveredSites
    ] = await Promise.all([
      // Guards currently checked in
      safeQuery(`
        SELECT COUNT(DISTINCT sa.employee_id) as count
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.date = date('now', 'localtime') AND sa.status = 'checked_in'
      `),
      // Guards expected today
      safeQuery(`
        SELECT COUNT(DISTINCT sa.employee_id) as count
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.date = date('now', 'localtime')
      `),
      // Sites with at least one checked-in guard
      safeQuery(`
        SELECT COUNT(DISTINCT s.site_id) as count
        FROM shifts s
        JOIN shift_assignments sa ON sa.shift_id = s.id
        WHERE s.date = date('now', 'localtime') AND s.site_id IS NOT NULL AND sa.status = 'checked_in'
      `),
      // Open incidents
      safeQuery(`
        SELECT COUNT(*) as count,
               SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical
        FROM incidents WHERE status IN ('open', 'in_progress')
      `),
      // Expiring certifications (next 30 days)
      safeQuery(`
        SELECT c.id, c.cert_type, c.expiry_date,
               e.first_name || ' ' || e.last_name as employee_name
        FROM certifications c
        JOIN employees e ON c.employee_id = e.id
        WHERE c.expiry_date BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+30 days')
        ORDER BY c.expiry_date
        LIMIT 10
      `),
      // Guards assigned today but not checked in
      safeQuery(`
        SELECT e.id, e.first_name, e.last_name, e.phone,
               s.start_time, s.end_time,
               c.company_name, si.name as site_name
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN employees e ON sa.employee_id = e.id
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sites si ON s.site_id = si.id
        WHERE s.date = date('now', 'localtime')
          AND sa.status = 'assigned'
          AND s.start_time <= strftime('%H:%M', 'now', '+30 minutes')
        ORDER BY s.start_time
      `),
      // Sites without coverage today
      safeQuery(`
        SELECT si.id, si.name, si.address, c.company_name,
               s.start_time, s.end_time
        FROM shifts s
        LEFT JOIN sites si ON s.site_id = si.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.date = date('now', 'localtime')
          AND s.site_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM shift_assignments sa
            WHERE sa.shift_id = s.id AND sa.status = 'checked_in'
          )
        ORDER BY s.start_time
      `)
    ]);

    res.json({
      guards_on_duty: guardsOnDuty.rows[0]?.count || 0,
      guards_expected_today: guardsExpected.rows[0]?.count || 0,
      sites_with_coverage: sitesCovered.rows[0]?.count || 0,
      open_incidents: {
        count: openIncidents.rows[0]?.count || 0,
        critical: openIncidents.rows[0]?.critical || 0
      },
      expiring_licenses: expiringLicenses.rows,
      guards_not_checked_in: notCheckedIn.rows,
      sites_without_coverage: uncoveredSites.rows
    });
  } catch (error) {
    console.error('Get operations dashboard error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת דשבורד תפעולי' });
  }
});

// Get KPI metrics with targets and trends
router.get('/kpis', requireManager, async (req, res) => {
  try {
    const safeQuery = async (sql, params) => {
      try { return await db.query(sql, params); }
      catch (e) { console.warn('KPI query failed:', e.message); return { rows: [] }; }
    };

    const [monthlyRevenue, prevMonthRevenue, activeCustomers, prevActiveCustomers,
           monthIncidents, prevMonthIncidents, employeeUtilization] = await Promise.all([
      // Current month revenue
      safeQuery(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices
        WHERE status = 'paid' AND payment_date >= date('now', 'localtime', 'start of month')`),
      // Previous month revenue
      safeQuery(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices
        WHERE status = 'paid' AND payment_date >= date('now', 'localtime', 'start of month', '-1 month')
        AND payment_date < date('now', 'localtime', 'start of month')`),
      // Active customers
      safeQuery(`SELECT COUNT(*) as count FROM customers WHERE status = 'active'`),
      // Customers last month
      safeQuery(`SELECT COUNT(*) as count FROM customers WHERE status = 'active'
        AND created_at < date('now', 'localtime', 'start of month')`),
      // Incidents this month
      safeQuery(`SELECT COUNT(*) as count FROM incidents
        WHERE created_at >= date('now', 'localtime', 'start of month')`),
      // Incidents last month
      safeQuery(`SELECT COUNT(*) as count FROM incidents
        WHERE created_at >= date('now', 'localtime', 'start of month', '-1 month')
        AND created_at < date('now', 'localtime', 'start of month')`),
      // Employee utilization (shifts assigned / total employees)
      safeQuery(`SELECT
        (SELECT COUNT(DISTINCT sa.employee_id) FROM shift_assignments sa
         JOIN shifts s ON sa.shift_id = s.id
         WHERE s.date BETWEEN date('now', 'localtime', '-7 days') AND date('now', 'localtime')) as active_employees,
        (SELECT COUNT(*) FROM employees WHERE status = 'active') as total_employees
      `)
    ]);

    const revenue = monthlyRevenue.rows[0]?.total || 0;
    const prevRevenue = prevMonthRevenue.rows[0]?.total || 0;
    const customers = activeCustomers.rows[0]?.count || 0;
    const prevCustomers = prevActiveCustomers.rows[0]?.count || 0;
    const incidents = monthIncidents.rows[0]?.count || 0;
    const prevIncidents = prevMonthIncidents.rows[0]?.count || 0;
    const util = employeeUtilization.rows[0] || {};
    const utilRate = util.total_employees ? Math.round((util.active_employees / util.total_employees) * 100) : 0;

    // Get KPI targets
    let targets = {};
    try {
      const targetRows = db.query(`SELECT metric, target_value FROM kpi_targets
        WHERE period = strftime('%Y-%m', 'now', 'localtime')
        OR (start_date <= date('now', 'localtime') AND end_date >= date('now', 'localtime'))`);
      for (const t of targetRows.rows) {
        targets[t.metric] = t.target_value;
      }
    } catch (e) { /* kpi_targets table might not exist yet */ }

    res.json({
      kpis: [
        {
          key: 'monthly_revenue',
          label: 'הכנסה חודשית',
          value: revenue,
          prevValue: prevRevenue,
          target: targets['monthly_revenue'] || null,
          format: 'currency',
        },
        {
          key: 'active_customers',
          label: 'לקוחות פעילים',
          value: customers,
          prevValue: prevCustomers,
          target: targets['active_customers'] || null,
          format: 'number',
        },
        {
          key: 'security_incidents',
          label: 'אירועי אבטחה',
          value: incidents,
          prevValue: prevIncidents,
          target: targets['security_incidents'] || null,
          format: 'number',
          invertTrend: true, // lower is better
        },
        {
          key: 'employee_utilization',
          label: 'ניצולת עובדים',
          value: utilRate,
          prevValue: null,
          target: targets['employee_utilization'] || 80,
          format: 'percent',
        },
      ],
    });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת KPIs' });
  }
});

// Get recent activity feed
router.get('/activity-recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 15;
    const result = db.query(`
      SELECT al.*, u.first_name || ' ' || u.last_name as user_name
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [limit]);
    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ error: 'שגיאה בטעינת פעילות אחרונה' });
  }
});

// Set KPI target
router.post('/kpi-targets', requireManager, async (req, res) => {
  try {
    const crypto = require('crypto');
    const { metric, target_value, period } = req.body;
    const id = crypto.randomUUID();
    const effectivePeriod = period || new Date().toISOString().slice(0, 7);

    // Upsert: delete existing target for same metric+period, then insert
    db.query('DELETE FROM kpi_targets WHERE metric = ? AND period = ?', [metric, effectivePeriod]);
    db.query(`INSERT INTO kpi_targets (id, metric, target_value, period, start_date, end_date, created_by)
      VALUES (?, ?, ?, ?, date('now', 'localtime', 'start of month'), date('now', 'localtime', 'start of month', '+1 month', '-1 day'), ?)`,
      [id, metric, target_value, effectivePeriod, req.user.id]);

    res.json({ message: 'יעד KPI נשמר', id });
  } catch (error) {
    console.error('Set KPI target error:', error);
    res.status(500).json({ error: 'שגיאה בשמירת יעד' });
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

// SSE - Real-time notification stream
const sseClients = new Map(); // userId -> Set of response objects
const jwt = require('jsonwebtoken');

router.get('/notifications/stream', (req, res) => {
  // SSE doesn't support Authorization headers, so accept token as query param
  let userId = req.user?.id;
  if (!userId && req.query.token) {
    try {
      const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch {
      return res.status(401).json({ error: 'Token expired' });
    }
  }
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // For nginx proxies
  });

  // Register this client
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  // Send initial keepalive
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(userId);
      }
    }
  });
});

// Helper to broadcast notification to a specific user
function broadcastNotification(userId, notification) {
  const clients = sseClients.get(userId);
  if (clients) {
    const data = JSON.stringify({ type: 'notification', data: notification });
    for (const client of clients) {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
}

// Export both router and broadcast function
router.broadcastNotification = broadcastNotification;

module.exports = router;
