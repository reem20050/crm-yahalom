/**
 * Smart Guard Assignment Service
 * Suggests best employees for shift assignment using scoring algorithm
 */
const { query } = require('../config/database');

class GuardAssignment {
  /**
   * Get top suggestions for a shift
   * @param {object} params
   * @param {string} params.date - Shift date (YYYY-MM-DD)
   * @param {string} params.startTime - Shift start time (HH:MM)
   * @param {string} params.endTime - Shift end time (HH:MM)
   * @param {boolean} params.requiresWeapon - Whether shift requires armed guard
   * @param {string|null} params.siteId - Site ID (for template matching)
   * @param {string|null} params.templateId - Shift template ID (for preferred employees)
   * @param {number} params.limit - Max suggestions to return (default 5)
   * @returns {Array<{employee_id: string, employee_name: string, score: number, reasons: string[]}>}
   */
  getSuggestions({ date, startTime, endTime, requiresWeapon = false, siteId = null, templateId = null, limit = 5 }) {
    // 1. Get all active employees
    const employees = query(`
      SELECT e.id, e.first_name, e.last_name, e.phone, e.address, e.city,
             e.has_weapon_license, e.weapon_license_expiry, e.status
      FROM employees e
      WHERE e.status = 'active'
    `);

    if (employees.rows.length === 0) return [];

    // 2. Get preferred employees from template
    let preferredEmployeeIds = new Set();
    if (templateId) {
      const tmpl = query('SELECT preferred_employees FROM shift_templates WHERE id = $1', [templateId]);
      if (tmpl.rows.length > 0) {
        try {
          const parsed = JSON.parse(tmpl.rows[0].preferred_employees || '[]');
          preferredEmployeeIds = new Set(parsed);
        } catch (e) { /* ignore parse error */ }
      }
    } else if (siteId) {
      // Try to find a template for this site
      const tmpl = query('SELECT preferred_employees FROM shift_templates WHERE site_id = $1 AND is_active = 1 LIMIT 1', [siteId]);
      if (tmpl.rows.length > 0) {
        try {
          const parsed = JSON.parse(tmpl.rows[0].preferred_employees || '[]');
          preferredEmployeeIds = new Set(parsed);
        } catch (e) { /* ignore */ }
      }
    }

    // 3. Calculate week boundaries for workload
    const shiftDate = new Date(date + 'T00:00:00');
    const dayOfWeek = shiftDate.getDay();
    const weekStart = new Date(shiftDate);
    weekStart.setDate(shiftDate.getDate() - dayOfWeek); // Sunday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Saturday
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // 4. Get weekly shift counts for all employees
    const weeklyShifts = query(`
      SELECT sa.employee_id, COUNT(*) as shift_count
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE s.date BETWEEN $1 AND $2
      AND sa.status != 'cancelled'
      GROUP BY sa.employee_id
    `, [weekStartStr, weekEndStr]);

    const shiftCountMap = {};
    for (const row of weeklyShifts.rows) {
      shiftCountMap[row.employee_id] = row.shift_count;
    }

    // 5. Get employees with time conflicts on the target date
    const conflicts = query(`
      SELECT sa.employee_id
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE s.date = $1
      AND s.start_time < $3 AND s.end_time > $2
      AND sa.status != 'cancelled'
    `, [date, startTime, endTime]);

    const conflictSet = new Set(conflicts.rows.map(r => r.employee_id));

    // 6. Get availability for this day of week
    const targetDayOfWeek = shiftDate.getDay();
    const availability = query(`
      SELECT employee_id, is_available
      FROM employee_availability
      WHERE day_of_week = $1
    `, [targetDayOfWeek]);

    const unavailableSet = new Set();
    for (const row of availability.rows) {
      if (!row.is_available) {
        unavailableSet.add(row.employee_id);
      }
    }

    // 7. If weapon required, get employees with valid weapon credentials
    let weaponValidSet = null;
    if (requiresWeapon) {
      const today = new Date().toISOString().split('T')[0];

      // Check both weapon license on employee and guard_certifications
      const weaponEmployees = query(`
        SELECT DISTINCT e.id FROM employees e
        WHERE e.status = 'active'
        AND (
          (e.has_weapon_license = 1 AND (e.weapon_license_expiry IS NULL OR e.weapon_license_expiry >= $1))
          OR e.id IN (
            SELECT gc.employee_id FROM guard_certifications gc
            WHERE gc.cert_type IN ('weapon', 'firearm', 'armed_guard')
            AND gc.status = 'active'
            AND (gc.expiry_date IS NULL OR gc.expiry_date >= $1)
          )
        )
      `, [today]);

      weaponValidSet = new Set(weaponEmployees.rows.map(r => r.id));
    }

    // 8. Score each employee
    const scored = [];

    for (const emp of employees.rows) {
      const reasons = [];
      let score = 50; // base score

      // Mandatory: no time conflict
      if (conflictSet.has(emp.id)) {
        continue; // skip entirely
      }

      // Mandatory: available on this day
      if (unavailableSet.has(emp.id)) {
        continue; // skip entirely
      }

      // Mandatory: weapon requirement
      if (weaponValidSet && !weaponValidSet.has(emp.id)) {
        continue; // skip entirely
      }

      // Scoring: preferred employee (+15)
      if (preferredEmployeeIds.has(emp.id)) {
        score += 15;
        reasons.push('\u05E2\u05D5\u05D1\u05D3 \u05DE\u05D5\u05E2\u05D3\u05E3 \u05DC\u05D0\u05EA\u05E8');
      }

      // Scoring: workload (-10 per shift this week)
      const weeklyCount = shiftCountMap[emp.id] || 0;
      if (weeklyCount > 0) {
        const penalty = weeklyCount * 10;
        score -= penalty;
        reasons.push(`${weeklyCount} \u05DE\u05E9\u05DE\u05E8\u05D5\u05EA \u05D4\u05E9\u05D1\u05D5\u05E2`);
      } else {
        score += 5;
        reasons.push('\u05DC\u05DC\u05D0 \u05DE\u05E9\u05DE\u05E8\u05D5\u05EA \u05D4\u05E9\u05D1\u05D5\u05E2');
      }

      // Scoring: has weapon license (+5 bonus even if not required)
      if (emp.has_weapon_license) {
        score += 5;
        reasons.push('\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05E0\u05E9\u05E7');
      }

      scored.push({
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        phone: emp.phone,
        score,
        reasons,
        weekly_shifts: weeklyCount,
        is_preferred: preferredEmployeeIds.has(emp.id)
      });
    }

    // Sort by score descending, then by name
    scored.sort((a, b) => b.score - a.score || a.employee_name.localeCompare(b.employee_name));

    return scored.slice(0, limit);
  }
}

module.exports = new GuardAssignment();
