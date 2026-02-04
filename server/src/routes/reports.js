const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireManager);

// Sales report
router.get('/sales', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDateParam = start_date || new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0];
    const endDateParam = end_date || new Date().toISOString().split('T')[0];

    const [leadsBySource, conversionRate, monthlyLeads, topSales] = await Promise.all([
      // Leads by source
      db.query(`
        SELECT source, COUNT(*) as count
        FROM leads
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY source
        ORDER BY count DESC
      `, [startDateParam, endDateParam]),

      // Conversion rate
      db.query(`
        SELECT
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE status = 'won') as won,
          COUNT(*) FILTER (WHERE status = 'lost') as lost,
          ROUND(COUNT(*) FILTER (WHERE status = 'won')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as conversion_rate
        FROM leads
        WHERE created_at BETWEEN $1 AND $2
      `, [startDateParam, endDateParam]),

      // Monthly leads
      db.query(`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'won') as won
        FROM leads
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month
      `, [startDateParam, endDateParam]),

      // Top sales people
      db.query(`
        SELECT
          u.first_name || ' ' || u.last_name as name,
          COUNT(*) FILTER (WHERE l.status = 'won') as deals_won,
          COALESCE(SUM(l.expected_value) FILTER (WHERE l.status = 'won'), 0) as revenue
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.created_at BETWEEN $1 AND $2
        WHERE u.role IN ('admin', 'manager', 'sales')
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY deals_won DESC
        LIMIT 10
      `, [startDateParam, endDateParam])
    ]);

    res.json({
      leadsBySource: leadsBySource.rows,
      conversionRate: conversionRate.rows[0],
      monthlyLeads: monthlyLeads.rows,
      topSales: topSales.rows
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ error: 'שגיאה בהפקת דוח מכירות' });
  }
});

// Customer report
router.get('/customers', async (req, res) => {
  try {
    const [revenueByCustomer, customersByType, churnRisk] = await Promise.all([
      // Revenue by customer (top 10)
      db.query(`
        SELECT c.id, c.company_name,
               COALESCE(SUM(i.total_amount) FILTER (WHERE i.status = 'paid'), 0) as total_revenue,
               COUNT(DISTINCT i.id) as invoice_count
        FROM customers c
        LEFT JOIN invoices i ON i.customer_id = c.id
        WHERE c.status = 'active'
        GROUP BY c.id, c.company_name
        ORDER BY total_revenue DESC
        LIMIT 10
      `),

      // Customers by service type
      db.query(`
        SELECT service_type, COUNT(*) as count
        FROM customers
        WHERE status = 'active'
        GROUP BY service_type
      `),

      // Churn risk (no activity in 90 days)
      db.query(`
        SELECT c.id, c.company_name, c.created_at,
               MAX(s.date) as last_shift_date,
               MAX(e.event_date) as last_event_date
        FROM customers c
        LEFT JOIN shifts s ON s.customer_id = c.id
        LEFT JOIN events e ON e.customer_id = c.id
        WHERE c.status = 'active'
        GROUP BY c.id, c.company_name, c.created_at
        HAVING COALESCE(MAX(s.date), MAX(e.event_date), c.created_at::date) < CURRENT_DATE - INTERVAL '90 days'
        ORDER BY COALESCE(MAX(s.date), MAX(e.event_date), c.created_at::date) DESC
        LIMIT 10
      `)
    ]);

    res.json({
      revenueByCustomer: revenueByCustomer.rows,
      customersByType: customersByType.rows,
      churnRisk: churnRisk.rows
    });
  } catch (error) {
    console.error('Get customer report error:', error);
    res.status(500).json({ error: 'שגיאה בהפקת דוח לקוחות' });
  }
});

// Employee report
router.get('/employees', async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    const [hoursBreakdown, attendanceIssues, topPerformers] = await Promise.all([
      // Hours breakdown by employee
      db.query(`
        SELECT
          e.id,
          e.first_name || ' ' || e.last_name as name,
          COALESCE(SUM(sa.actual_hours), 0) as total_hours,
          COALESCE(SUM(sa.actual_hours) FILTER (WHERE EXTRACT(DOW FROM s.date) = 6), 0) as saturday_hours,
          COUNT(DISTINCT s.date) as days_worked
        FROM employees e
        LEFT JOIN shift_assignments sa ON sa.employee_id = e.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
          AND EXTRACT(YEAR FROM s.date) = $1
          AND EXTRACT(MONTH FROM s.date) = $2
        WHERE e.status = 'active'
        GROUP BY e.id, e.first_name, e.last_name
        ORDER BY total_hours DESC
      `, [targetYear, targetMonth]),

      // Attendance issues (no-shows, late check-ins)
      db.query(`
        SELECT
          e.first_name || ' ' || e.last_name as name,
          COUNT(*) FILTER (WHERE sa.status = 'no_show') as no_shows,
          COUNT(*) FILTER (WHERE sa.check_in_time > (s.date + s.start_time + INTERVAL '15 minutes')) as late_checkins
        FROM employees e
        LEFT JOIN shift_assignments sa ON sa.employee_id = e.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
          AND EXTRACT(YEAR FROM s.date) = $1
          AND EXTRACT(MONTH FROM s.date) = $2
        WHERE e.status = 'active'
        GROUP BY e.id, e.first_name, e.last_name
        HAVING COUNT(*) FILTER (WHERE sa.status = 'no_show') > 0
           OR COUNT(*) FILTER (WHERE sa.check_in_time > (s.date + s.start_time + INTERVAL '15 minutes')) > 0
        ORDER BY no_shows DESC, late_checkins DESC
      `, [targetYear, targetMonth]),

      // Top performers (most hours, no issues)
      db.query(`
        SELECT
          e.first_name || ' ' || e.last_name as name,
          COALESCE(SUM(sa.actual_hours), 0) as total_hours,
          COUNT(*) FILTER (WHERE sa.status = 'no_show') as no_shows
        FROM employees e
        LEFT JOIN shift_assignments sa ON sa.employee_id = e.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
          AND EXTRACT(YEAR FROM s.date) = $1
          AND EXTRACT(MONTH FROM s.date) = $2
        WHERE e.status = 'active'
        GROUP BY e.id, e.first_name, e.last_name
        HAVING COUNT(*) FILTER (WHERE sa.status = 'no_show') = 0
        ORDER BY total_hours DESC
        LIMIT 10
      `, [targetYear, targetMonth])
    ]);

    res.json({
      hoursBreakdown: hoursBreakdown.rows,
      attendanceIssues: attendanceIssues.rows,
      topPerformers: topPerformers.rows
    });
  } catch (error) {
    console.error('Get employee report error:', error);
    res.status(500).json({ error: 'שגיאה בהפקת דוח עובדים' });
  }
});

// Events report
router.get('/events', async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();

    const [eventsByType, monthlyEvents, revenueByType] = await Promise.all([
      // Events by type
      db.query(`
        SELECT event_type, COUNT(*) as count
        FROM events
        WHERE EXTRACT(YEAR FROM event_date) = $1
        GROUP BY event_type
        ORDER BY count DESC
      `, [targetYear]),

      // Monthly events
      db.query(`
        SELECT
          TO_CHAR(event_date, 'YYYY-MM') as month,
          COUNT(*) as total,
          SUM(price) as revenue
        FROM events
        WHERE EXTRACT(YEAR FROM event_date) = $1
        AND status = 'completed'
        GROUP BY TO_CHAR(event_date, 'YYYY-MM')
        ORDER BY month
      `, [targetYear]),

      // Revenue by event type
      db.query(`
        SELECT event_type,
               COUNT(*) as count,
               SUM(price) as total_revenue,
               AVG(price) as avg_price
        FROM events
        WHERE EXTRACT(YEAR FROM event_date) = $1
        AND status = 'completed'
        GROUP BY event_type
        ORDER BY total_revenue DESC
      `, [targetYear])
    ]);

    res.json({
      eventsByType: eventsByType.rows,
      monthlyEvents: monthlyEvents.rows,
      revenueByType: revenueByType.rows
    });
  } catch (error) {
    console.error('Get events report error:', error);
    res.status(500).json({ error: 'שגיאה בהפקת דוח אירועים' });
  }
});

// Financial report
router.get('/financial', async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();

    const [monthlyRevenue, outstandingPayments, revenueByCustomer] = await Promise.all([
      // Monthly revenue
      db.query(`
        SELECT
          TO_CHAR(issue_date, 'YYYY-MM') as month,
          SUM(total_amount) as invoiced,
          SUM(total_amount) FILTER (WHERE status = 'paid') as collected
        FROM invoices
        WHERE EXTRACT(YEAR FROM issue_date) = $1
        GROUP BY TO_CHAR(issue_date, 'YYYY-MM')
        ORDER BY month
      `, [targetYear]),

      // Outstanding payments
      db.query(`
        SELECT
          SUM(total_amount) FILTER (WHERE status = 'sent' AND due_date >= CURRENT_DATE) as pending,
          SUM(total_amount) FILTER (WHERE status = 'sent' AND due_date < CURRENT_DATE) as overdue,
          SUM(total_amount) FILTER (WHERE status = 'sent' AND due_date < CURRENT_DATE - INTERVAL '30 days') as overdue_30,
          SUM(total_amount) FILTER (WHERE status = 'sent' AND due_date < CURRENT_DATE - INTERVAL '60 days') as overdue_60,
          SUM(total_amount) FILTER (WHERE status = 'sent' AND due_date < CURRENT_DATE - INTERVAL '90 days') as overdue_90
        FROM invoices
      `),

      // Revenue by customer (this year)
      db.query(`
        SELECT c.company_name,
               SUM(i.total_amount) FILTER (WHERE i.status = 'paid') as paid,
               SUM(i.total_amount) FILTER (WHERE i.status = 'sent') as pending
        FROM customers c
        LEFT JOIN invoices i ON i.customer_id = c.id
          AND EXTRACT(YEAR FROM i.issue_date) = $1
        WHERE c.status = 'active'
        GROUP BY c.id, c.company_name
        HAVING SUM(i.total_amount) > 0
        ORDER BY paid DESC NULLS LAST
        LIMIT 15
      `, [targetYear])
    ]);

    res.json({
      monthlyRevenue: monthlyRevenue.rows,
      outstandingPayments: outstandingPayments.rows[0],
      revenueByCustomer: revenueByCustomer.rows
    });
  } catch (error) {
    console.error('Get financial report error:', error);
    res.status(500).json({ error: 'שגיאה בהפקת דוח כספי' });
  }
});

module.exports = router;
