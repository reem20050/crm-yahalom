const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

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
          WHERE sa.employee_id = $1 AND s.date = date('now')
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
            AND e.event_date BETWEEN date('now') AND date('now', '+7 days')
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

// Get operations dashboard data
router.get('/operations', async (req, res) => {
  try {
    const [
      guardsOnDuty,
      guardsExpected,
      sitesTotal,
      sitesCovered,
      openIncidents,
      expiringLicenses,
      notCheckedIn,
      uncoveredSites
    ] = await Promise.all([
      // Guards currently checked in
      db.query(`
        SELECT COUNT(DISTINCT sa.employee_id) as count
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.date = date('now') AND sa.status = 'checked_in'
      `),
      // Guards expected today
      db.query(`
        SELECT COUNT(DISTINCT sa.employee_id) as count
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.date = date('now')
      `),
      // Total sites with shifts today
      db.query(`
        SELECT COUNT(DISTINCT s.site_id) as count
        FROM shifts s WHERE s.date = date('now') AND s.site_id IS NOT NULL
      `),
      // Sites with at least one checked-in guard
      db.query(`
        SELECT COUNT(DISTINCT s.site_id) as count
        FROM shifts s
        JOIN shift_assignments sa ON sa.shift_id = s.id
        WHERE s.date = date('now') AND s.site_id IS NOT NULL AND sa.status = 'checked_in'
      `),
      // Open incidents
      db.query(`
        SELECT COUNT(*) as count,
               SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical
        FROM incidents WHERE status IN ('open', 'in_progress')
      `),
      // Expiring certifications (next 30 days)
      db.query(`
        SELECT c.id, c.cert_type, c.expiry_date,
               e.first_name || ' ' || e.last_name as employee_name
        FROM certifications c
        JOIN employees e ON c.employee_id = e.id
        WHERE c.expiry_date BETWEEN date('now') AND date('now', '+30 days')
        ORDER BY c.expiry_date
        LIMIT 10
      `),
      // Guards assigned today but not checked in
      db.query(`
        SELECT e.id, e.first_name, e.last_name, e.phone,
               s.start_time, s.end_time,
               c.company_name, si.name as site_name
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN employees e ON sa.employee_id = e.id
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sites si ON s.site_id = si.id
        WHERE s.date = date('now')
          AND sa.status = 'assigned'
          AND s.start_time <= time('now', '+30 minutes')
        ORDER BY s.start_time
      `),
      // Sites without coverage today
      db.query(`
        SELECT si.id, si.name, si.address, c.company_name,
               s.start_time, s.end_time
        FROM shifts s
        LEFT JOIN sites si ON s.site_id = si.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.date = date('now')
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

module.exports = router;
