/**
 * Smart Guard Assignment Service v2
 * Enhanced scoring algorithm with geography, performance, fatigue,
 * team cohesion, and reliability factors.
 */
const { query } = require('../config/database');

// ── Haversine Distance (km) ──────────────────────────────────────────────────

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Guard Assignment Class ───────────────────────────────────────────────────

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
   * @returns {Array} Scored and ranked guard suggestions
   */
  getSuggestions({ date, startTime, endTime, requiresWeapon = false, siteId = null, templateId = null, limit = 5 }) {
    // ── 1. Get all active employees with home coordinates ─────────────────
    const employees = query(`
      SELECT e.id, e.first_name, e.last_name, e.phone, e.address, e.city,
             e.has_weapon_license, e.weapon_license_expiry, e.status,
             e.home_latitude, e.home_longitude
      FROM employees e
      WHERE e.status = 'active'
    `);

    if (employees.rows.length === 0) return [];

    // ── 2. Get site info (coords + required certifications) ───────────────
    let siteLat = null;
    let siteLng = null;
    let siteRequiredCerts = [];
    if (siteId) {
      const siteResult = query(
        'SELECT latitude, longitude, required_certifications FROM sites WHERE id = $1',
        [siteId]
      );
      if (siteResult.rows.length > 0) {
        const site = siteResult.rows[0];
        siteLat = site.latitude;
        siteLng = site.longitude;
        try {
          siteRequiredCerts = JSON.parse(site.required_certifications || '[]');
        } catch (e) { /* ignore */ }
      }
    }

    // ── 3. Get preferred employees from template ──────────────────────────
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
      const tmpl = query('SELECT preferred_employees FROM shift_templates WHERE site_id = $1 AND is_active = 1 LIMIT 1', [siteId]);
      if (tmpl.rows.length > 0) {
        try {
          const parsed = JSON.parse(tmpl.rows[0].preferred_employees || '[]');
          preferredEmployeeIds = new Set(parsed);
        } catch (e) { /* ignore */ }
      }
    }

    // ── 4. Calculate week boundaries for workload ─────────────────────────
    const shiftDate = new Date(date + 'T00:00:00');
    const dayOfWeek = shiftDate.getDay();
    const weekStart = new Date(shiftDate);
    weekStart.setDate(shiftDate.getDate() - dayOfWeek); // Sunday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Saturday
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // ── 5. Get weekly shift counts for all employees ──────────────────────
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

    // ── 6. Get employees with time conflicts on the target date ───────────
    const conflicts = query(`
      SELECT sa.employee_id
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE s.date = $1
      AND s.start_time < $3 AND s.end_time > $2
      AND sa.status != 'cancelled'
    `, [date, startTime, endTime]);

    const conflictSet = new Set(conflicts.rows.map(r => r.employee_id));

    // ── 7. Get availability for this day of week ──────────────────────────
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

    // ── 8. Weapon requirement filter ──────────────────────────────────────
    let weaponValidSet = null;
    if (requiresWeapon) {
      const today = new Date().toISOString().split('T')[0];
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

    // ── 9. Get performance ratings for all employees ──────────────────────
    const ratings = query(`
      SELECT employee_id, AVG(rating) as avg_rating
      FROM guard_ratings
      GROUP BY employee_id
    `);
    const ratingMap = {};
    for (const row of ratings.rows) {
      ratingMap[row.employee_id] = parseFloat(row.avg_rating) || 0;
    }

    // ── 10. Get certifications for all employees ──────────────────────────
    const certifications = query(`
      SELECT employee_id, cert_type
      FROM guard_certifications
      WHERE status = 'active'
      AND (expiry_date IS NULL OR expiry_date >= date('now'))
    `);
    const certMap = {};
    for (const row of certifications.rows) {
      if (!certMap[row.employee_id]) certMap[row.employee_id] = [];
      certMap[row.employee_id].push(row.cert_type);
    }

    // ── 11. Get last shift end time for fatigue calculation ───────────────
    // Find the most recent shift end for each employee relative to the target shift
    const lastShifts = query(`
      SELECT sa.employee_id, MAX(s.date || 'T' || s.end_time) as last_shift_end
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      WHERE sa.status != 'cancelled'
      AND s.date <= $1
      GROUP BY sa.employee_id
    `, [date]);

    const lastShiftEndMap = {};
    for (const row of lastShifts.rows) {
      lastShiftEndMap[row.employee_id] = row.last_shift_end;
    }

    // ── 12. Team cohesion: employees who worked at same site in last 3 months ──
    let siteVeteranSet = new Set();
    if (siteId) {
      const threeMonthsAgo = new Date(shiftDate);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

      const siteVeterans = query(`
        SELECT DISTINCT sa.employee_id
        FROM shift_assignments sa
        JOIN shifts s ON sa.shift_id = s.id
        WHERE s.site_id = $1
        AND s.date >= $2
        AND sa.status != 'cancelled'
      `, [siteId, threeMonthsAgoStr]);

      siteVeteranSet = new Set(siteVeterans.rows.map(r => r.employee_id));
    }

    // ── 13. Reliability: no-show ratio per employee ───────────────────────
    const reliabilityData = query(`
      SELECT employee_id,
             COUNT(*) as total_assignments,
             SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_shows
      FROM shift_assignments
      GROUP BY employee_id
    `);
    const reliabilityMap = {};
    for (const row of reliabilityData.rows) {
      const total = row.total_assignments || 0;
      const noShows = row.no_shows || 0;
      reliabilityMap[row.employee_id] = {
        total,
        noShows,
        ratio: total > 0 ? noShows / total : 0
      };
    }

    // ── 14. Score each employee ───────────────────────────────────────────
    const scored = [];

    for (const emp of employees.rows) {
      const reasons = [];
      const scoreBreakdown = { base: 40 };
      let score = 40; // base score

      // ── MANDATORY EXCLUSIONS ──

      // No time conflict
      if (conflictSet.has(emp.id)) continue;

      // Available on this day
      if (unavailableSet.has(emp.id)) continue;

      // Weapon requirement
      if (weaponValidSet && !weaponValidSet.has(emp.id)) continue;

      // ── FATIGUE: <8 hours since last shift end → EXCLUDE ──
      let fatigueWarning = false;
      const lastEnd = lastShiftEndMap[emp.id];
      if (lastEnd && startTime) {
        try {
          const lastEndTime = new Date(lastEnd);
          const targetStart = new Date(date + 'T' + startTime);
          const hoursBetween = (targetStart - lastEndTime) / (1000 * 60 * 60);
          if (hoursBetween < 8 && hoursBetween >= 0) {
            // Less than 8 hours rest → EXCLUDE
            continue;
          }
          if (hoursBetween < 12 && hoursBetween >= 8) {
            fatigueWarning = true;
          }
        } catch (e) { /* parsing error, skip fatigue check */ }
      }

      // ── SCORING FACTORS ──

      // Preferred employee (+15)
      if (preferredEmployeeIds.has(emp.id)) {
        score += 15;
        scoreBreakdown.preferred = 15;
        reasons.push('עובד מועדף לאתר');
      } else {
        scoreBreakdown.preferred = 0;
      }

      // Geographic proximity (0 to +15)
      let distanceKm = null;
      if (siteLat && siteLng && emp.home_latitude && emp.home_longitude) {
        distanceKm = haversineDistance(emp.home_latitude, emp.home_longitude, siteLat, siteLng);
        distanceKm = Math.round(distanceKm * 10) / 10; // round to 1 decimal

        if (distanceKm < 5) {
          score += 15;
          scoreBreakdown.geographic = 15;
          reasons.push(`קרוב מאוד (${distanceKm} ק"מ)`);
        } else if (distanceKm < 15) {
          score += 10;
          scoreBreakdown.geographic = 10;
          reasons.push(`קרוב לאתר (${distanceKm} ק"מ)`);
        } else if (distanceKm < 30) {
          score += 5;
          scoreBreakdown.geographic = 5;
          reasons.push(`מרחק סביר (${distanceKm} ק"מ)`);
        } else {
          scoreBreakdown.geographic = 0;
          reasons.push(`רחוק מהאתר (${distanceKm} ק"מ)`);
        }
      } else {
        scoreBreakdown.geographic = 0;
      }

      // Performance rating (0 to +10)
      const avgRating = ratingMap[emp.id] || 0;
      if (avgRating > 0) {
        const perfScore = Math.min(10, Math.round(avgRating * 2));
        score += perfScore;
        scoreBreakdown.performance = perfScore;
        reasons.push(`דירוג ${avgRating.toFixed(1)}/5`);
      } else {
        scoreBreakdown.performance = 0;
      }

      // Workload: low workload bonus / shift penalty
      const weeklyCount = shiftCountMap[emp.id] || 0;
      if (weeklyCount === 0) {
        score += 5;
        scoreBreakdown.workload = 5;
        reasons.push('ללא משמרות השבוע');
      } else {
        const penalty = weeklyCount * 8;
        score -= penalty;
        scoreBreakdown.workload = -penalty;
        reasons.push(`${weeklyCount} משמרות השבוע`);
      }

      // Fatigue prevention: >5 shifts/week → -20
      if (weeklyCount > 5) {
        score -= 20;
        scoreBreakdown.fatigue = -20;
        fatigueWarning = true;
        reasons.push('עומס יתר - מעל 5 משמרות');
      } else {
        scoreBreakdown.fatigue = 0;
      }

      // Specialization match (+10)
      if (siteRequiredCerts.length > 0) {
        const empCerts = certMap[emp.id] || [];
        const hasAllRequired = siteRequiredCerts.every(rc => empCerts.includes(rc));
        if (hasAllRequired) {
          score += 10;
          scoreBreakdown.specialization = 10;
          reasons.push('מוסמך לכל דרישות האתר');
        } else {
          scoreBreakdown.specialization = 0;
        }
      } else {
        scoreBreakdown.specialization = 0;
      }

      // Team cohesion (+5)
      if (siteVeteranSet.has(emp.id)) {
        score += 5;
        scoreBreakdown.team_cohesion = 5;
        reasons.push('היכרות עם האתר');
      } else {
        scoreBreakdown.team_cohesion = 0;
      }

      // Reliability (-15 if bad)
      const relData = reliabilityMap[emp.id];
      if (relData && relData.total >= 5 && relData.ratio > 0.1) {
        score -= 15;
        scoreBreakdown.reliability = -15;
        reasons.push('אמינות נמוכה');
      } else {
        scoreBreakdown.reliability = 0;
      }

      // Weapon license bonus (+3)
      if (emp.has_weapon_license) {
        score += 3;
        scoreBreakdown.weapon_bonus = 3;
        reasons.push('רישיון נשק');
      } else {
        scoreBreakdown.weapon_bonus = 0;
      }

      // Ensure score is at least 0
      score = Math.max(0, score);

      scored.push({
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        phone: emp.phone,
        score,
        reasons,
        score_breakdown: scoreBreakdown,
        weekly_shifts: weeklyCount,
        is_preferred: preferredEmployeeIds.has(emp.id),
        distance_km: distanceKm,
        avg_rating: avgRating > 0 ? Math.round(avgRating * 10) / 10 : null,
        fatigue_warning: fatigueWarning
      });
    }

    // Sort by score descending, then by name
    scored.sort((a, b) => b.score - a.score || a.employee_name.localeCompare(b.employee_name));

    return scored.slice(0, limit);
  }
}

module.exports = new GuardAssignment();
