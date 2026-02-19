/**
 * Holiday / Calendar Exception Service
 * Provides holiday-aware logic for auto-shift generation and other automation.
 */
const { query, generateUUID } = require('../config/database');

class HolidayService {
  /**
   * Get all calendar exceptions within a date range
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate   - YYYY-MM-DD
   * @returns {Array} exceptions
   */
  getExceptionsForRange(startDate, endDate) {
    const result = query(
      `SELECT * FROM calendar_exceptions WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`,
      [startDate, endDate]
    );
    return result.rows;
  }

  /**
   * Check if a specific date has any exception
   * @param {string} date - YYYY-MM-DD
   * @returns {object|null} exception row or null
   */
  isException(date) {
    const result = query(
      `SELECT * FROM calendar_exceptions WHERE date = $1 LIMIT 1`,
      [date]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Check if shifts should be skipped on a given date
   * @param {string} date - YYYY-MM-DD
   * @returns {boolean}
   */
  shouldSkipShift(date) {
    const result = query(
      `SELECT id FROM calendar_exceptions
       WHERE date = $1 AND action = 'skip' AND affects IN ('all', 'shifts')`,
      [date]
    );
    return result.rows.length > 0;
  }

  /**
   * Get the staffing modifier for a date.
   * Returns a multiplier: 1.0 for normal, <1.0 for reduce, >1.0 for increase.
   * For 'reduce' action without a specific modifier, defaults to 0.5.
   * For 'increase' action without a specific modifier, defaults to 1.5.
   * @param {string} date - YYYY-MM-DD
   * @returns {number} modifier (1.0 = normal staffing)
   */
  getStaffingModifier(date) {
    const result = query(
      `SELECT action, modifier FROM calendar_exceptions
       WHERE date = $1 AND affects IN ('all', 'shifts') AND action IN ('reduce', 'increase')
       LIMIT 1`,
      [date]
    );
    if (result.rows.length === 0) return 1.0;

    const row = result.rows[0];
    if (row.modifier && row.modifier > 0) return row.modifier;

    // Default modifiers when none specified
    if (row.action === 'reduce') return 0.5;
    if (row.action === 'increase') return 1.5;
    return 1.0;
  }

  /**
   * Get upcoming exceptions in the next N days
   * @param {number} days - number of days to look ahead (default 30)
   * @returns {Array} exceptions sorted by date
   */
  getUpcoming(days = 30) {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const endDate = futureDate.toISOString().split('T')[0];

    const result = query(
      `SELECT * FROM calendar_exceptions WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`,
      [today, endDate]
    );
    return result.rows;
  }

  /**
   * Get all exceptions, optionally filtered by year
   * @param {number|null} year - optional year filter
   * @returns {Array}
   */
  getAll(year = null) {
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const result = query(
        `SELECT * FROM calendar_exceptions WHERE date BETWEEN $1 AND $2 ORDER BY date ASC`,
        [startDate, endDate]
      );
      return result.rows;
    }
    const result = query(`SELECT * FROM calendar_exceptions ORDER BY date ASC`);
    return result.rows;
  }

  /**
   * Create a new calendar exception
   * @param {object} data
   * @returns {object} created exception
   */
  create(data) {
    const id = generateUUID();
    query(
      `INSERT INTO calendar_exceptions (id, date, exception_type, name, affects, action, modifier, notes, recurring)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        data.date,
        data.exception_type,
        data.name,
        data.affects || 'all',
        data.action || 'skip',
        data.modifier || 0,
        data.notes || null,
        data.recurring ? 1 : 0,
      ]
    );
    const result = query(`SELECT * FROM calendar_exceptions WHERE id = $1`, [id]);
    return result.rows[0];
  }

  /**
   * Update an existing calendar exception
   * @param {string} id
   * @param {object} data
   * @returns {object|null} updated exception
   */
  update(id, data) {
    query(
      `UPDATE calendar_exceptions
       SET date = $1, exception_type = $2, name = $3, affects = $4,
           action = $5, modifier = $6, notes = $7, recurring = $8
       WHERE id = $9`,
      [
        data.date,
        data.exception_type,
        data.name,
        data.affects || 'all',
        data.action || 'skip',
        data.modifier || 0,
        data.notes || null,
        data.recurring ? 1 : 0,
        id,
      ]
    );
    const result = query(`SELECT * FROM calendar_exceptions WHERE id = $1`, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Delete a calendar exception
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const result = query(`DELETE FROM calendar_exceptions WHERE id = $1`, [id]);
    return result.rowCount > 0;
  }
}

module.exports = new HolidayService();
