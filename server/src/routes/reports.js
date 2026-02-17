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
          SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
          SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost,
          ROUND(CAST(SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS REAL) / MAX(COUNT(*), 1) * 100, 2) as conversion_rate
        FROM leads
        WHERE created_at BETWEEN $1 AND $2
      `, [startDateParam, endDateParam]),

      // Monthly leads
      db.query(`
        SELECT
          strftime('%Y-%m', created_at) as month,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won
        FROM leads
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month
      `, [startDateParam, endDateParam]),

      // Top sales people
      db.query(`
        SELECT
          u.first_name || ' ' || u.last_name as name,
          SUM(CASE WHEN l.status = 'won' THEN 1 ELSE 0 END) as deals_won,
          COALESCE(SUM(CASE WHEN l.status = 'won' THEN l.expected_value ELSE 0 END), 0) as revenue
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id AND l.created_at BETWEEN $1 AND $2
        WHERE u.role IN ('admin', 'manager', 'employee')
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
               COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as total_revenue,
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
        HAVING COALESCE(MAX(s.date), MAX(e.event_date), date(c.created_at)) < date('now', '-90 days')
        ORDER BY COALESCE(MAX(s.date), MAX(e.event_date), date(c.created_at)) DESC
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
    const monthStr = String(targetMonth).padStart(2, '0');

    const [hoursBreakdown, attendanceIssues, topPerformers] = await Promise.all([
      // Hours breakdown by employee
      db.query(`
        SELECT
          e.id,
          e.first_name || ' ' || e.last_name as name,
          COALESCE(SUM(sa.actual_hours), 0) as total_hours,
          COALESCE(SUM(CASE WHEN CAST(strftime('%w', s.date) AS INTEGER) = 6 THEN sa.actual_hours ELSE 0 END), 0) as saturday_hours,
          COUNT(DISTINCT s.date) as days_worked
        FROM employees e
        LEFT JOIN shift_assignments sa ON sa.employee_id = e.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
          AND strftime('%Y', s.date) = $1
          AND strftime('%m', s.date) = $2
        WHERE e.status = 'active'
        GROUP BY e.id, e.first_name, e.last_name
        ORDER BY total_hours DESC
      `, [String(targetYear), monthStr]),

      // Attendance issues (no-shows)
      db.query(`
        SELECT
          e.first_name || ' ' || e.last_name as name,
          SUM(CASE WHEN sa.status = 'no_show' THEN 1 ELSE 0 END) as no_shows
        FROM employees e
        LEFT JOIN shift_assignments sa ON sa.employee_id = e.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
          AND strftime('%Y', s.date) = $1
          AND strftime('%m', s.date) = $2
        WHERE e.status = 'active'
        GROUP BY e.id, e.first_name, e.last_name
        HAVING SUM(CASE WHEN sa.status = 'no_show' THEN 1 ELSE 0 END) > 0
        ORDER BY no_shows DESC
      `, [String(targetYear), monthStr]),

      // Top performers (most hours, no issues)
      db.query(`
        SELECT
          e.first_name || ' ' || e.last_name as name,
          COALESCE(SUM(sa.actual_hours), 0) as total_hours,
          SUM(CASE WHEN sa.status = 'no_show' THEN 1 ELSE 0 END) as no_shows
        FROM employees e
        LEFT JOIN shift_assignments sa ON sa.employee_id = e.id
        LEFT JOIN shifts s ON sa.shift_id = s.id
          AND strftime('%Y', s.date) = $1
          AND strftime('%m', s.date) = $2
        WHERE e.status = 'active'
        GROUP BY e.id, e.first_name, e.last_name
        HAVING SUM(CASE WHEN sa.status = 'no_show' THEN 1 ELSE 0 END) = 0
        ORDER BY total_hours DESC
        LIMIT 10
      `, [String(targetYear), monthStr])
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
        WHERE strftime('%Y', event_date) = $1
        GROUP BY event_type
        ORDER BY count DESC
      `, [String(targetYear)]),

      // Monthly events
      db.query(`
        SELECT
          strftime('%Y-%m', event_date) as month,
          COUNT(*) as total,
          SUM(price) as revenue
        FROM events
        WHERE strftime('%Y', event_date) = $1
        AND status = 'completed'
        GROUP BY strftime('%Y-%m', event_date)
        ORDER BY month
      `, [String(targetYear)]),

      // Revenue by event type
      db.query(`
        SELECT event_type,
               COUNT(*) as count,
               SUM(price) as total_revenue,
               AVG(price) as avg_price
        FROM events
        WHERE strftime('%Y', event_date) = $1
        AND status = 'completed'
        GROUP BY event_type
        ORDER BY total_revenue DESC
      `, [String(targetYear)])
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
          strftime('%Y-%m', issue_date) as month,
          SUM(total_amount) as invoiced,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as collected
        FROM invoices
        WHERE strftime('%Y', issue_date) = $1
        GROUP BY strftime('%Y-%m', issue_date)
        ORDER BY month
      `, [String(targetYear)]),

      // Outstanding payments
      db.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'sent' AND due_date >= date('now', 'localtime') THEN total_amount ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN status = 'sent' AND due_date < date('now', 'localtime') THEN total_amount ELSE 0 END), 0) as overdue,
          COALESCE(SUM(CASE WHEN status = 'sent' AND due_date < date('now', '-30 days') THEN total_amount ELSE 0 END), 0) as overdue_30,
          COALESCE(SUM(CASE WHEN status = 'sent' AND due_date < date('now', '-60 days') THEN total_amount ELSE 0 END), 0) as overdue_60,
          COALESCE(SUM(CASE WHEN status = 'sent' AND due_date < date('now', '-90 days') THEN total_amount ELSE 0 END), 0) as overdue_90
        FROM invoices
      `),

      // Revenue by customer (this year)
      db.query(`
        SELECT c.company_name,
               COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as paid,
               COALESCE(SUM(CASE WHEN i.status = 'sent' THEN i.total_amount ELSE 0 END), 0) as pending
        FROM customers c
        LEFT JOIN invoices i ON i.customer_id = c.id
          AND strftime('%Y', i.issue_date) = $1
        WHERE c.status = 'active'
        GROUP BY c.id, c.company_name
        HAVING SUM(i.total_amount) > 0
        ORDER BY paid DESC
        LIMIT 15
      `, [String(targetYear)])
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

// Profit & Loss report
router.get('/profit-loss', async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();

    const [monthlyRevenue, monthlyLaborCost, revenueByCustomer, costByCustomer] = await Promise.all([
      // Monthly revenue from invoices (paid)
      db.query(`
        SELECT
          strftime('%Y-%m', issue_date) as month,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as revenue,
          COALESCE(SUM(total_amount), 0) as invoiced
        FROM invoices
        WHERE strftime('%Y', issue_date) = $1
        GROUP BY strftime('%Y-%m', issue_date)
        ORDER BY month
      `, [String(targetYear)]),

      // Monthly labor costs (employee hours * hourly_rate)
      db.query(`
        SELECT
          strftime('%Y-%m', s.date) as month,
          COALESCE(SUM(
            CASE
              WHEN e.hourly_rate > 0 THEN sa.actual_hours * e.hourly_rate
              WHEN e.monthly_salary > 0 THEN (sa.actual_hours / 176.0) * e.monthly_salary
              ELSE 0
            END
          ), 0) as labor_cost,
          COALESCE(SUM(sa.actual_hours), 0) as total_hours,
          COUNT(DISTINCT sa.employee_id) as unique_employees
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN employees e ON sa.employee_id = e.id
        WHERE strftime('%Y', s.date) = $1
          AND sa.status IN ('checked_out', 'checked_in')
        GROUP BY strftime('%Y-%m', s.date)
        ORDER BY month
      `, [String(targetYear)]),

      // Revenue by customer (for per-customer profitability)
      db.query(`
        SELECT
          c.id as customer_id,
          c.company_name,
          COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as revenue
        FROM customers c
        LEFT JOIN invoices i ON i.customer_id = c.id
          AND strftime('%Y', i.issue_date) = $1
        WHERE c.status = 'active'
        GROUP BY c.id, c.company_name
        HAVING SUM(i.total_amount) > 0
        ORDER BY revenue DESC
      `, [String(targetYear)]),

      // Labor cost by customer
      db.query(`
        SELECT
          s.customer_id,
          COALESCE(SUM(
            CASE
              WHEN e.hourly_rate > 0 THEN sa.actual_hours * e.hourly_rate
              WHEN e.monthly_salary > 0 THEN (sa.actual_hours / 176.0) * e.monthly_salary
              ELSE 0
            END
          ), 0) as labor_cost,
          COALESCE(SUM(sa.actual_hours), 0) as hours
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN employees e ON sa.employee_id = e.id
        WHERE strftime('%Y', s.date) = $1
          AND sa.status IN ('checked_out', 'checked_in')
          AND s.customer_id IS NOT NULL
        GROUP BY s.customer_id
      `, [String(targetYear)])
    ]);

    // Merge monthly data
    const monthsMap = {};
    for (const row of monthlyRevenue.rows) {
      monthsMap[row.month] = { month: row.month, revenue: row.revenue, invoiced: row.invoiced, labor_cost: 0, total_hours: 0, unique_employees: 0 };
    }
    for (const row of monthlyLaborCost.rows) {
      if (!monthsMap[row.month]) {
        monthsMap[row.month] = { month: row.month, revenue: 0, invoiced: 0, labor_cost: 0, total_hours: 0, unique_employees: 0 };
      }
      monthsMap[row.month].labor_cost = row.labor_cost;
      monthsMap[row.month].total_hours = row.total_hours;
      monthsMap[row.month].unique_employees = row.unique_employees;
    }
    const monthlyPL = Object.values(monthsMap).sort((a, b) => a.month.localeCompare(b.month));
    for (const m of monthlyPL) {
      m.profit = m.revenue - m.labor_cost;
      m.margin = m.revenue > 0 ? Math.round((m.profit / m.revenue) * 100) : 0;
    }

    // Merge per-customer profitability
    const costMap = {};
    for (const row of costByCustomer.rows) {
      costMap[row.customer_id] = { labor_cost: row.labor_cost, hours: row.hours };
    }
    const customerProfitability = revenueByCustomer.rows.map(c => {
      const costs = costMap[c.customer_id] || { labor_cost: 0, hours: 0 };
      const profit = c.revenue - costs.labor_cost;
      const margin = c.revenue > 0 ? Math.round((profit / c.revenue) * 100) : 0;
      return {
        company_name: c.company_name,
        revenue: c.revenue,
        labor_cost: costs.labor_cost,
        profit,
        margin,
        hours: costs.hours
      };
    });

    // Totals
    const totalRevenue = monthlyPL.reduce((sum, m) => sum + m.revenue, 0);
    const totalLaborCost = monthlyPL.reduce((sum, m) => sum + m.labor_cost, 0);
    const totalProfit = totalRevenue - totalLaborCost;
    const totalMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

    res.json({
      monthly: monthlyPL,
      customerProfitability,
      totals: {
        revenue: totalRevenue,
        labor_cost: totalLaborCost,
        profit: totalProfit,
        margin: totalMargin
      }
    });
  } catch (error) {
    console.error('Get profit-loss report error:', error);
    res.status(500).json({ error: 'שגיאה בהפקת דוח רווח והפסד' });
  }
});

module.exports = router;
