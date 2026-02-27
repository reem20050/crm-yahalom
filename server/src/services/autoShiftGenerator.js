/**
 * Auto Shift Generator Service
 * Automatically creates shifts from templates that have auto_generate enabled
 */
const { query, generateUUID } = require('../config/database');
const holidayService = require('./holidayService');

class AutoShiftGenerator {
  /**
   * Generate shifts for a specific week from all auto-generate templates
   * @param {string} weekStartDate - ISO date string (YYYY-MM-DD) for the start of the target week (Sunday)
   * @param {string|null} createdBy - user ID who triggered (null for cron)
   * @returns {{ created: number, skipped: number, errors: string[] }}
   */
  generateWeekShifts(weekStartDate, createdBy = null) {
    const results = { created: 0, skipped: 0, errors: [] };

    // Get all active templates with auto_generate enabled
    const templates = query(`
      SELECT st.*, s.name as site_name, c.company_name
      FROM shift_templates st
      LEFT JOIN sites s ON st.site_id = s.id
      LEFT JOIN customers c ON st.customer_id = c.id
      WHERE st.is_active = 1 AND st.auto_generate = 1
    `);

    for (const template of templates.rows) {
      try {
        const templateResult = this.generateFromTemplate(template, weekStartDate, createdBy);
        results.created += templateResult.created;
        results.skipped += templateResult.skipped;
      } catch (error) {
        results.errors.push(`Template ${template.name}: ${error.message}`);
      }
    }

    // Log the generation
    if (results.created > 0 || results.errors.length > 0) {
      const logId = generateUUID();
      query(`
        INSERT INTO auto_generation_log (id, type, generated_count, details, created_by)
        VALUES ($1, 'auto_shifts', $2, $3, $4)
      `, [logId, results.created, JSON.stringify(results), createdBy]);
    }

    return results;
  }

  /**
   * Generate shifts from a single template for a date range
   * @param {object} template - shift template object from DB
   * @param {string} weekStartDate - start date (YYYY-MM-DD)
   * @param {string|null} createdBy
   * @returns {{ created: number, skipped: number }}
   */
  generateFromTemplate(template, weekStartDate, createdBy = null) {
    const daysOfWeek = JSON.parse(template.days_of_week || '[]');
    const preferredEmployees = JSON.parse(template.preferred_employees || '[]');
    let created = 0;
    let skipped = 0;

    // Generate for 7 days starting from weekStartDate
    const startDate = new Date(weekStartDate + 'T00:00:00');

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dayOfWeek = currentDate.getDay(); // 0=Sunday

      if (!daysOfWeek.includes(dayOfWeek)) continue;

      const dateStr = currentDate.toISOString().split('T')[0];

      // Holiday/exception check: skip this date entirely if a skip-exception exists
      if (holidayService.shouldSkipShift(dateStr)) {
        skipped++;
        continue;
      }

      // Get staffing modifier for reduce/increase exceptions
      const modifier = holidayService.getStaffingModifier(dateStr);
      const adjustedRequired = Math.ceil((template.required_employees || 1) * modifier);

      // Check if shift already exists for same site/date/time
      const existing = query(`
        SELECT id FROM shifts
        WHERE site_id = $1 AND date = $2 AND start_time = $3 AND end_time = $4
      `, [template.site_id, dateStr, template.start_time, template.end_time]);

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Create the shift (with adjusted required_employees based on holiday modifier)
      const shiftId = generateUUID();
      query(`
        INSERT INTO shifts (id, site_id, customer_id, date, start_time, end_time,
                           required_employees, requires_weapon, requires_vehicle, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled')
      `, [shiftId, template.site_id, template.customer_id, dateStr,
          template.start_time, template.end_time,
          adjustedRequired,
          template.requires_weapon || 0,
          template.requires_vehicle || 0,
          template.default_notes || null]);

      // Auto-assign preferred employees if available
      for (const empId of preferredEmployees) {
        try {
          this.tryAssignEmployee(shiftId, empId, dateStr, template.start_time, template.end_time);
        } catch (e) {
          // Assignment failed (conflict, etc.) - skip silently
        }
      }

      created++;
    }

    // Log per-template generation
    if (created > 0) {
      const logId = generateUUID();
      query(`
        INSERT INTO auto_generation_log (id, type, source_id, generated_count, details, created_by)
        VALUES ($1, 'template_shifts', $2, $3, $4, $5)
      `, [logId, template.id, created, JSON.stringify({
        template_name: template.name,
        week_start: weekStartDate,
        skipped
      }), createdBy]);
    }

    return { created, skipped };
  }

  /**
   * Try to assign an employee to a shift (checks conflicts)
   */
  tryAssignEmployee(shiftId, employeeId, date, startTime, endTime) {
    // Check employee exists and is active
    const emp = query('SELECT id, status FROM employees WHERE id = $1', [employeeId]);
    if (emp.rows.length === 0 || emp.rows[0].status !== 'active') return false;

    // Check for time conflicts
    const conflict = query(`
      SELECT sa.id FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.employee_id = $1 AND s.date = $2
      AND s.start_time < $4 AND s.end_time > $3
      AND sa.status != 'cancelled'
    `, [employeeId, date, startTime, endTime]);

    if (conflict.rows.length > 0) return false;

    // Check availability
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const avail = query(`
      SELECT is_available FROM employee_availability
      WHERE employee_id = $1 AND day_of_week = $2
    `, [employeeId, dayOfWeek]);

    // If availability record exists and says not available, skip
    if (avail.rows.length > 0 && !avail.rows[0].is_available) return false;

    // Assign
    const assignId = generateUUID();
    query(`
      INSERT INTO shift_assignments (id, shift_id, employee_id, role, status)
      VALUES ($1, $2, $3, 'guard', 'assigned')
    `, [assignId, shiftId, employeeId]);

    return true;
  }

  /**
   * Get next Sunday date from today
   */
  getNextSunday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    return nextSunday.toISOString().split('T')[0];
  }
}

module.exports = new AutoShiftGenerator();
