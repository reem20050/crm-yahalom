/**
 * Shift Intelligence Service
 * Analyzes shift patterns to detect shortages, fatigue risk,
 * optimal staffing suggestions, and weekly insights.
 */
const db = require('../config/database');
const crypto = require('crypto');

class ShiftIntelligence {

  /**
   * Analyze last 3 months to find sites/days with consistent understaffing.
   * For each site + day_of_week, count shifts where assigned < required.
   * Flag patterns where understaffing rate > 30%.
   */
  detectShortagePatterns() {
    try {
      const result = db.query(`
        SELECT
          s.site_id,
          si.name as site_name,
          CAST(strftime('%w', s.date) AS INTEGER) as day_of_week,
          COUNT(*) as total_shifts,
          SUM(CASE
            WHEN (SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = s.id AND sa.status != 'cancelled') < s.required_employees
            THEN 1 ELSE 0
          END) as understaffed_count
        FROM shifts s
        JOIN sites si ON s.site_id = si.id
        WHERE s.date >= date('now', '-90 days')
        AND s.status != 'cancelled'
        AND s.site_id IS NOT NULL
        GROUP BY s.site_id, CAST(strftime('%w', s.date) AS INTEGER)
        HAVING total_shifts >= 2
        ORDER BY si.name, day_of_week
      `);

      const patterns = result.rows.map(row => ({
        site_id: row.site_id,
        site_name: row.site_name,
        day_of_week: row.day_of_week,
        total_shifts: row.total_shifts,
        understaffed_count: row.understaffed_count,
        rate: row.total_shifts > 0 ? row.understaffed_count / row.total_shifts : 0
      }));

      // Save flagged patterns to shift_analytics
      const today = new Date().toISOString().split('T')[0];
      const flagged = patterns.filter(p => p.rate > 0.3);
      for (const p of flagged) {
        db.query(`
          INSERT INTO shift_analytics (id, analysis_date, analysis_type, site_id, details, severity)
          VALUES ($1, $2, 'shortage', $3, $4, $5)
        `, [
          crypto.randomUUID(),
          today,
          p.site_id,
          JSON.stringify(p),
          p.rate > 0.5 ? 'critical' : 'warning'
        ]);
      }

      return patterns;
    } catch (error) {
      console.error('[ShiftIntelligence] detectShortagePatterns error:', error.message);
      return [];
    }
  }

  /**
   * Find employees approaching fatigue thresholds in current week (Sun-Sat).
   * Checks: total shifts, consecutive shifts with <8h gap, total weekly hours.
   * Flags if: shifts > 5, rest gap < 8h, or weekly hours > 50.
   */
  analyzeFatigueRisk() {
    try {
      // Get all employees with shifts this week
      const employees = db.query(`
        SELECT
          e.id as employee_id,
          e.first_name || ' ' || e.last_name as employee_name,
          COUNT(DISTINCT sa.shift_id) as weekly_shifts,
          COALESCE(SUM(
            CASE
              WHEN sa.actual_hours IS NOT NULL THEN sa.actual_hours
              ELSE (julianday(s.date || ' ' || s.end_time) - julianday(s.date || ' ' || s.start_time)) * 24
            END
          ), 0) as weekly_hours
        FROM employees e
        JOIN shift_assignments sa ON sa.employee_id = e.id
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.date BETWEEN date('now', 'weekday 0', '-6 days') AND date('now', 'weekday 6')
        AND sa.status NOT IN ('cancelled', 'no_show')
        AND e.status = 'active'
        GROUP BY e.id
        ORDER BY weekly_shifts DESC
      `);

      const fatigueResults = [];

      for (const emp of employees.rows) {
        // Find minimum rest gap between consecutive shifts
        const shifts = db.query(`
          SELECT s.date, s.start_time, s.end_time
          FROM shift_assignments sa
          JOIN shifts s ON sa.shift_id = s.id
          WHERE sa.employee_id = $1
          AND s.date BETWEEN date('now', 'weekday 0', '-6 days') AND date('now', 'weekday 6')
          AND sa.status NOT IN ('cancelled', 'no_show')
          ORDER BY s.date, s.start_time
        `, [emp.employee_id]);

        let minRestGap = 999;
        for (let i = 1; i < shifts.rows.length; i++) {
          const prevEnd = new Date(`${shifts.rows[i - 1].date}T${shifts.rows[i - 1].end_time}`);
          const currStart = new Date(`${shifts.rows[i].date}T${shifts.rows[i].start_time}`);
          const gapHours = (currStart - prevEnd) / (1000 * 60 * 60);
          if (gapHours >= 0 && gapHours < minRestGap) {
            minRestGap = gapHours;
          }
        }

        if (minRestGap === 999) minRestGap = null;

        // Determine risk level
        let riskLevel = 'low';
        const riskFactors = [];
        if (emp.weekly_shifts > 6) {
          riskLevel = 'high';
          riskFactors.push('shifts > 6');
        } else if (emp.weekly_shifts > 5) {
          riskLevel = riskLevel === 'high' ? 'high' : 'medium';
          riskFactors.push('shifts > 5');
        }
        if (minRestGap !== null && minRestGap < 8) {
          riskLevel = 'high';
          riskFactors.push('rest gap < 8h');
        }
        if (emp.weekly_hours > 50) {
          riskLevel = 'high';
          riskFactors.push('hours > 50');
        } else if (emp.weekly_hours > 40) {
          riskLevel = riskLevel === 'high' ? 'high' : 'medium';
          riskFactors.push('hours > 40');
        }

        // Only include employees with at least medium risk
        if (riskLevel !== 'low') {
          fatigueResults.push({
            employee_id: emp.employee_id,
            employee_name: emp.employee_name,
            weekly_shifts: emp.weekly_shifts,
            min_rest_gap_hours: minRestGap !== null ? Math.round(minRestGap * 10) / 10 : null,
            weekly_hours: Math.round(emp.weekly_hours * 10) / 10,
            risk_level: riskLevel,
            risk_factors: riskFactors
          });
        }
      }

      // Save fatigue results
      const today = new Date().toISOString().split('T')[0];
      for (const f of fatigueResults.filter(f => f.risk_level === 'high')) {
        db.query(`
          INSERT INTO shift_analytics (id, analysis_date, analysis_type, employee_id, details, severity)
          VALUES ($1, $2, 'fatigue', $3, $4, $5)
        `, [
          crypto.randomUUID(),
          today,
          f.employee_id,
          JSON.stringify(f),
          f.risk_level === 'high' ? 'critical' : 'warning'
        ]);
      }

      // Sort by risk level (high first)
      const riskOrder = { high: 0, medium: 1, low: 2 };
      fatigueResults.sort((a, b) => (riskOrder[a.risk_level] || 2) - (riskOrder[b.risk_level] || 2));

      return fatigueResults;
    } catch (error) {
      console.error('[ShiftIntelligence] analyzeFatigueRisk error:', error.message);
      return [];
    }
  }

  /**
   * Based on historical data, suggest optimal guards per site per day.
   * Calculates average assigned, no-show rate, and optimal staffing.
   */
  suggestOptimalStaffing(siteId = null) {
    try {
      let whereClause = `s.date >= date('now', '-56 days') AND s.status != 'cancelled' AND s.site_id IS NOT NULL`;
      const params = [];
      if (siteId) {
        whereClause += ` AND s.site_id = $1`;
        params.push(siteId);
      }

      const result = db.query(`
        SELECT
          s.site_id,
          si.name as site_name,
          CAST(strftime('%w', s.date) AS INTEGER) as day_of_week,
          s.required_employees as current_required,
          COUNT(DISTINCT s.id) as shift_count,
          COALESCE(AVG(
            (SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = s.id AND sa.status NOT IN ('cancelled'))
          ), 0) as avg_assigned,
          COALESCE(AVG(
            CASE WHEN (SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = s.id AND sa.status = 'no_show') > 0
            THEN CAST((SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = s.id AND sa.status = 'no_show') AS REAL) /
                 NULLIF((SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = s.id AND sa.status NOT IN ('cancelled')), 0)
            ELSE 0 END
          ), 0) as no_show_rate
        FROM shifts s
        JOIN sites si ON s.site_id = si.id
        WHERE ${whereClause}
        GROUP BY s.site_id, CAST(strftime('%w', s.date) AS INTEGER), s.required_employees
        HAVING shift_count >= 2
        ORDER BY si.name, day_of_week
      `, params);

      return result.rows.map(row => {
        const noShowRate = row.no_show_rate || 0;
        const currentRequired = row.current_required || 1;
        const suggestedRequired = Math.ceil(currentRequired + (noShowRate * currentRequired));

        return {
          site_id: row.site_id,
          site_name: row.site_name,
          day_of_week: row.day_of_week,
          current_required: currentRequired,
          suggested_required: suggestedRequired,
          no_show_rate: Math.round(noShowRate * 1000) / 1000,
          avg_assigned: Math.round(row.avg_assigned * 10) / 10
        };
      });
    } catch (error) {
      console.error('[ShiftIntelligence] suggestOptimalStaffing error:', error.message);
      return [];
    }
  }

  /**
   * Weekly digest combining all analyses.
   * Includes shortages, fatigue, staffing, no-show rates,
   * declining ratings, cert gaps, and overtime analysis.
   */
  generateWeeklyInsights() {
    const today = new Date().toISOString().split('T')[0];

    // Clean old analytics for today to avoid duplicates
    db.query(`DELETE FROM shift_analytics WHERE analysis_date = $1 AND analysis_type IN ('shortage', 'fatigue', 'weekly_insights')`, [today]);

    const shortages = this.detectShortagePatterns();
    const fatigue = this.analyzeFatigueRisk();
    const staffing = this.suggestOptimalStaffing();

    // Sites with >20% no-show rate this month
    let highNoShowSites = [];
    try {
      const noShowResult = db.query(`
        SELECT
          s.site_id, si.name as site_name,
          COUNT(DISTINCT sa.id) as total_assignments,
          SUM(CASE WHEN sa.status = 'no_show' THEN 1 ELSE 0 END) as no_shows
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        JOIN sites si ON s.site_id = si.id
        WHERE s.date >= date('now', '-30 days')
        AND s.site_id IS NOT NULL
        GROUP BY s.site_id
        HAVING total_assignments > 0 AND CAST(no_shows AS REAL) / total_assignments > 0.2
      `);
      highNoShowSites = noShowResult.rows.map(r => ({
        site_id: r.site_id,
        site_name: r.site_name,
        no_show_rate: r.total_assignments > 0 ? r.no_shows / r.total_assignments : 0,
        total_assignments: r.total_assignments,
        no_shows: r.no_shows
      }));
    } catch (e) {
      console.error('[ShiftIntelligence] No-show sites error:', e.message);
    }

    // Employees with declining ratings (compare last 30 vs previous 30 days)
    let decliningRatings = [];
    try {
      const ratingsResult = db.query(`
        SELECT
          e.id as employee_id,
          e.first_name || ' ' || e.last_name as employee_name,
          COALESCE(AVG(CASE WHEN gr.created_at >= date('now', '-30 days') THEN gr.rating END), 0) as recent_avg,
          COALESCE(AVG(CASE WHEN gr.created_at >= date('now', '-60 days') AND gr.created_at < date('now', '-30 days') THEN gr.rating END), 0) as previous_avg
        FROM employees e
        JOIN guard_ratings gr ON gr.employee_id = e.id
        WHERE gr.created_at >= date('now', '-60 days')
        AND e.status = 'active'
        GROUP BY e.id
        HAVING recent_avg > 0 AND previous_avg > 0 AND recent_avg < previous_avg - 0.5
      `);
      decliningRatings = ratingsResult.rows.map(r => ({
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        recent_avg: Math.round(r.recent_avg * 10) / 10,
        previous_avg: Math.round(r.previous_avg * 10) / 10,
        change: Math.round((r.recent_avg - r.previous_avg) * 10) / 10
      }));
    } catch (e) {
      console.error('[ShiftIntelligence] Declining ratings error:', e.message);
    }

    // Overtime employees (>5 shifts this week)
    let overtimeEmployees = [];
    try {
      const overtimeResult = db.query(`
        SELECT
          e.id as employee_id,
          e.first_name || ' ' || e.last_name as employee_name,
          e.hourly_rate,
          COUNT(DISTINCT sa.shift_id) as shift_count,
          COALESCE(SUM(
            CASE
              WHEN sa.actual_hours IS NOT NULL THEN sa.actual_hours
              ELSE (julianday(s.date || ' ' || s.end_time) - julianday(s.date || ' ' || s.start_time)) * 24
            END
          ), 0) as total_hours
        FROM employees e
        JOIN shift_assignments sa ON sa.employee_id = e.id
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.date BETWEEN date('now', 'weekday 0', '-6 days') AND date('now', 'weekday 6')
        AND sa.status NOT IN ('cancelled', 'no_show')
        AND e.status = 'active'
        GROUP BY e.id
        HAVING shift_count > 5
        ORDER BY total_hours DESC
      `);
      overtimeEmployees = overtimeResult.rows.map(r => ({
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        shift_count: r.shift_count,
        total_hours: Math.round(r.total_hours * 10) / 10,
        estimated_overtime_cost: r.hourly_rate ? Math.round(Math.max(0, r.total_hours - 42) * r.hourly_rate * 1.25) : null
      }));
    } catch (e) {
      console.error('[ShiftIntelligence] Overtime analysis error:', e.message);
    }

    const insights = {
      date: today,
      shortage_sites: shortages.filter(s => s.rate > 0.3).length,
      fatigue_risk_employees: fatigue.filter(f => f.risk_level === 'high').length,
      optimization_opportunities: staffing.filter(s => s.suggested_required !== s.current_required).length,
      high_no_show_sites: highNoShowSites.length,
      declining_ratings_count: decliningRatings.length,
      overtime_employees_count: overtimeEmployees.length,
      details: {
        shortages,
        fatigue,
        staffing,
        highNoShowSites,
        decliningRatings,
        overtimeEmployees
      }
    };

    // Save summary to shift_analytics
    db.query(`
      INSERT INTO shift_analytics (id, analysis_date, analysis_type, details, severity)
      VALUES ($1, $2, 'weekly_insights', $3, $4)
    `, [
      crypto.randomUUID(),
      today,
      JSON.stringify(insights),
      insights.fatigue_risk_employees > 0 ? 'warning' : 'info'
    ]);

    console.log('[ShiftIntelligence] Weekly insights generated:', {
      shortage_sites: insights.shortage_sites,
      fatigue_risk: insights.fatigue_risk_employees,
      optimizations: insights.optimization_opportunities
    });

    return insights;
  }

  /**
   * Get the most recent weekly insights from shift_analytics.
   */
  getLatestInsights() {
    try {
      const result = db.query(`
        SELECT * FROM shift_analytics
        WHERE analysis_type = 'weekly_insights'
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        ...row,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      };
    } catch (error) {
      console.error('[ShiftIntelligence] getLatestInsights error:', error.message);
      return null;
    }
  }

  /**
   * Get shortage heatmap data: matrix of site x day_of_week with understaffing rates.
   */
  getShortageHeatmap() {
    try {
      const result = db.query(`
        SELECT
          s.site_id,
          si.name as site_name,
          CAST(strftime('%w', s.date) AS INTEGER) as day_of_week,
          COUNT(*) as total_shifts,
          SUM(CASE
            WHEN (SELECT COUNT(*) FROM shift_assignments sa WHERE sa.shift_id = s.id AND sa.status NOT IN ('cancelled')) < s.required_employees
            THEN 1 ELSE 0
          END) as understaffed_count
        FROM shifts s
        JOIN sites si ON s.site_id = si.id
        WHERE s.date >= date('now', '-90 days')
        AND s.status != 'cancelled'
        AND s.site_id IS NOT NULL
        GROUP BY s.site_id, CAST(strftime('%w', s.date) AS INTEGER)
        ORDER BY si.name, day_of_week
      `);

      // Build heatmap structure
      const sitesMap = {};
      for (const row of result.rows) {
        if (!sitesMap[row.site_id]) {
          sitesMap[row.site_id] = {
            site_id: row.site_id,
            site_name: row.site_name,
            days: {}
          };
        }
        sitesMap[row.site_id].days[row.day_of_week] = {
          total: row.total_shifts,
          understaffed: row.understaffed_count,
          rate: row.total_shifts > 0 ? Math.round((row.understaffed_count / row.total_shifts) * 100) : 0
        };
      }

      return Object.values(sitesMap);
    } catch (error) {
      console.error('[ShiftIntelligence] getShortageHeatmap error:', error.message);
      return [];
    }
  }
}

module.exports = new ShiftIntelligence();
