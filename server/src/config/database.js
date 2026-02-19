const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ============================================================
// Dual-mode database: SQLite (local dev) / PostgreSQL (Railway)
// ============================================================

const isPostgres = !!process.env.DATABASE_URL;

let db = null;   // SQLite instance (only in SQLite mode)
let pool = null; // pg Pool instance (only in Postgres mode)

if (isPostgres) {
  // --- PostgreSQL mode ---
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  console.log('🐘 Using PostgreSQL (DATABASE_URL detected)');
} else {
  // --- SQLite mode ---
  const Database = require('better-sqlite3');

  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'crm.db');
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  console.log('📦 Using SQLite (local mode)');
}

// Generate UUID
const generateUUID = () => crypto.randomUUID();

// ============================================================
// SQL conversion helpers (SQLite syntax -> PostgreSQL syntax)
// ============================================================

/**
 * Convert SQLite date/time functions to PostgreSQL equivalents.
 * Handles the broad set of patterns found across the codebase:
 *
 *   date('now')                         -> CURRENT_DATE
 *   date('now', 'localtime')            -> CURRENT_DATE
 *   date('now', '+N unit')              -> CURRENT_DATE + INTERVAL 'N unit'
 *   date('now', '-N unit')              -> CURRENT_DATE - INTERVAL 'N unit'
 *   date('now', 'start of month')       -> DATE_TRUNC('month', CURRENT_DATE)
 *   date('now', 'localtime', ...)       -> (same as above, localtime is ignored)
 *   date('now', 'weekday N')            -> (CURRENT_DATE + (N - EXTRACT(DOW FROM CURRENT_DATE) + 7)::int % 7)
 *   date('now', 'weekday N', '+/-M days') -> above +/- INTERVAL
 *   date('now', 'localtime', 'start of month') -> DATE_TRUNC('month', CURRENT_DATE)
 *   date(column)                        -> (column)::date
 *   date(?, '+7 days')                  -> (?::date + INTERVAL '7 days')
 *   datetime('now')                     -> NOW()
 *   datetime('now', 'localtime')        -> NOW()
 *   datetime('now', '-N hours')         -> NOW() - INTERVAL 'N hours'
 *   datetime('now', '-' || $N || ' hours') -> NOW() - ($N || ' hours')::interval
 *   strftime('%Y-%m', col)              -> TO_CHAR((col)::date, 'YYYY-MM')
 *   strftime('%w', col)                 -> EXTRACT(DOW FROM (col)::date)
 *   strftime('%Y', col)                 -> TO_CHAR((col)::date, 'YYYY')
 *   strftime('%m', col)                 -> TO_CHAR((col)::date, 'MM')
 *   strftime('%Y-%m-%d', col)           -> TO_CHAR((col)::date, 'YYYY-MM-DD')
 *   julianday(a) - julianday(b)         -> ((a)::date - (b)::date)  (integer days)
 *   julianday(expr)                     -> (expr)::timestamp
 *   LIKE                                -> ILIKE
 *   INTEGER (in boolean context)        -> handled by PG natively
 */
function convertSqliteToPostgres(sql) {
  let out = sql;

  // ---- datetime('now', '-' || $N || ' hours') pattern ----
  // e.g. datetime('now', '-' || $2 || ' hours')
  out = out.replace(
    /datetime\(\s*'now'\s*,\s*'-'\s*\|\|\s*(\$\d+)\s*\|\|\s*'\s*(hours|minutes|seconds|days)'\s*\)/gi,
    (_, param, unit) => `NOW() - (${param} || ' ${unit}')::interval`
  );

  // ---- datetime('now', '+/-N unit') ----
  out = out.replace(
    /datetime\(\s*'now'\s*(?:,\s*'localtime'\s*)?,\s*'([+-]?\d+)\s+(hours?|minutes?|seconds?|days?)'\s*\)/gi,
    (_, offset, unit) => {
      const n = parseInt(offset, 10);
      const u = unit.replace(/s$/, '') + 's';
      if (n >= 0) return `NOW() + INTERVAL '${Math.abs(n)} ${u}'`;
      return `NOW() - INTERVAL '${Math.abs(n)} ${u}'`;
    }
  );

  // ---- datetime('now', '-48 hours') style (already covered above but just to be safe with sign) ----
  out = out.replace(
    /datetime\(\s*'now'\s*(?:,\s*'localtime'\s*)?,\s*'-(\d+)\s+(hours?|minutes?|seconds?|days?)'\s*\)/gi,
    (_, n, unit) => {
      const u = unit.replace(/s$/, '') + 's';
      return `NOW() - INTERVAL '${n} ${u}'`;
    }
  );

  // ---- datetime('now') / datetime('now', 'localtime') ----
  out = out.replace(
    /datetime\(\s*'now'\s*(?:,\s*'localtime'\s*)?\)/gi,
    'NOW()'
  );

  // ---- date('now', [localtime,] 'start of month', '+/-N unit') ----
  out = out.replace(
    /date\(\s*'now'\s*(?:,\s*'localtime'\s*)?,\s*'start\s+of\s+month'\s*,\s*'([+-]?\d+)\s+(days?|months?|years?)'\s*\)/gi,
    (_, offset, unit) => {
      const n = parseInt(offset, 10);
      const u = unit.replace(/s$/, '') + 's';
      if (n >= 0) return `(DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '${Math.abs(n)} ${u}')`;
      return `(DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${Math.abs(n)} ${u}')`;
    }
  );

  // ---- date('now', 'localtime', 'start of month') / date('now', 'start of month') ----
  out = out.replace(
    /date\(\s*'now'\s*(?:,\s*'localtime'\s*)?(?:,\s*'start\s+of\s+month'\s*)\)/gi,
    "DATE_TRUNC('month', CURRENT_DATE)"
  );

  // ---- date('now', [localtime,] 'weekday N', '+/-M days') ----
  out = out.replace(
    /date\(\s*'now'\s*(?:,\s*'localtime'\s*)?,\s*'weekday\s+(\d)'\s*,\s*'([+-]?\d+)\s+(days?)'\s*\)/gi,
    (_, wd, offset, unit) => {
      const n = parseInt(offset, 10);
      const weekdayExpr = `(CURRENT_DATE + ((${wd} - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7))`;
      if (n >= 0) return `(${weekdayExpr} + INTERVAL '${Math.abs(n)} days')::date`;
      return `(${weekdayExpr} - INTERVAL '${Math.abs(n)} days')::date`;
    }
  );

  // ---- date('now', [localtime,] 'weekday N') ----
  out = out.replace(
    /date\(\s*'now'\s*(?:,\s*'localtime'\s*)?,\s*'weekday\s+(\d)'\s*\)/gi,
    (_, wd) => `(CURRENT_DATE + ((${wd} - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7))`
  );

  // ---- date('now', [localtime,] '+/-N unit') with three args (localtime + offset) ----
  out = out.replace(
    /date\(\s*'now'\s*,\s*'localtime'\s*,\s*'([+-]?\d+)\s+(days?|months?|years?)'\s*\)/gi,
    (_, offset, unit) => {
      const n = parseInt(offset, 10);
      const u = unit.replace(/s$/, '') + 's';
      if (n >= 0) return `(CURRENT_DATE + INTERVAL '${Math.abs(n)} ${u}')`;
      return `(CURRENT_DATE - INTERVAL '${Math.abs(n)} ${u}')`;
    }
  );

  // ---- date('now', '+/-N unit') without localtime ----
  out = out.replace(
    /date\(\s*'now'\s*,\s*'([+-]?\d+)\s+(days?|months?|years?)'\s*\)/gi,
    (_, offset, unit) => {
      const n = parseInt(offset, 10);
      const u = unit.replace(/s$/, '') + 's';
      if (n >= 0) return `(CURRENT_DATE + INTERVAL '${Math.abs(n)} ${u}')`;
      return `(CURRENT_DATE - INTERVAL '${Math.abs(n)} ${u}')`;
    }
  );

  // ---- date('now') / date('now', 'localtime') ----
  out = out.replace(
    /date\(\s*'now'\s*(?:,\s*'localtime'\s*)?\)/gi,
    'CURRENT_DATE'
  );

  // ---- date(?, '+N days') -> (?::date + INTERVAL 'N days') ----
  out = out.replace(
    /date\(\s*(\?|\$\d+)\s*,\s*'([+-]?\d+)\s+(days?|months?|years?)'\s*\)/gi,
    (_, param, offset, unit) => {
      const n = parseInt(offset, 10);
      const u = unit.replace(/s$/, '') + 's';
      if (n >= 0) return `(${param}::date + INTERVAL '${Math.abs(n)} ${u}')`;
      return `(${param}::date - INTERVAL '${Math.abs(n)} ${u}')`;
    }
  );

  // ---- date(column) when used as a function on a column name ----
  // Match date(something) but NOT date('now'...) which were already handled
  // This needs to NOT match things already converted, so be conservative
  out = out.replace(
    /\bdate\(([a-zA-Z_][a-zA-Z0-9_.]*)\)/gi,
    (match, col) => {
      // Skip if it looks like already-converted PG syntax
      if (col.toLowerCase() === 'now' || col.startsWith("'")) return match;
      return `(${col})::date`;
    }
  );

  // ---- julianday(a) - julianday(b) -> ((a)::timestamp - (b)::timestamp) ----
  // This covers CAST(julianday(a) - julianday(b) AS INTEGER) patterns too.
  // We need to handle nested expressions like: julianday(s.date || ' ' || s.end_time)
  // Strategy: replace julianday(X) with (X)::timestamp, then the subtraction naturally works.
  // For date-only: julianday('now') -> NOW(), julianday('now', 'localtime') -> NOW()
  out = out.replace(
    /julianday\(\s*'now'\s*(?:,\s*'localtime'\s*)?\)/gi,
    'NOW()'
  );

  // ---- julianday(expression) -> (expression)::timestamp ----
  // Use a function to handle balanced parentheses within the expression
  out = replaceJulianday(out);

  // ---- Post-process: timestamp arithmetic to PG-compatible forms ----
  // After julianday conversion, we may have patterns like:
  //   CAST((X)::timestamp - NOW() AS INTEGER) -> CAST(EXTRACT(EPOCH FROM ((X)::timestamp - NOW())) / 86400 AS INTEGER)
  //   CAST(NOW() - (X)::timestamp AS INTEGER) -> same
  //   ((X)::timestamp - (Y)::timestamp) * 24  -> EXTRACT(EPOCH FROM ...) / 3600
  // Use a function-based approach instead of simple regex for robustness
  out = fixTimestampArithmetic(out);

  // ---- strftime('%w', column) -> EXTRACT(DOW FROM (column)::date) ----
  out = out.replace(
    /strftime\(\s*'%w'\s*,\s*([^)]+)\)/gi,
    (_, col) => `EXTRACT(DOW FROM (${col.trim()})::date)`
  );

  // ---- strftime('%Y-%m', column) -> TO_CHAR((column)::date, 'YYYY-MM') ----
  out = out.replace(
    /strftime\(\s*'%Y-%m'\s*,\s*([^)]+)\)/gi,
    (_, col) => `TO_CHAR((${col.trim()})::date, 'YYYY-MM')`
  );

  // ---- strftime('%Y-%m-%d', column) -> TO_CHAR((column)::date, 'YYYY-MM-DD') ----
  out = out.replace(
    /strftime\(\s*'%Y-%m-%d'\s*,\s*([^)]+)\)/gi,
    (_, col) => `TO_CHAR((${col.trim()})::date, 'YYYY-MM-DD')`
  );

  // ---- strftime('%Y', column) -> TO_CHAR((column)::date, 'YYYY') ----
  out = out.replace(
    /strftime\(\s*'%Y'\s*,\s*([^)]+)\)/gi,
    (_, col) => `TO_CHAR((${col.trim()})::date, 'YYYY')`
  );

  // ---- strftime('%m', column) -> TO_CHAR((column)::date, 'MM') ----
  out = out.replace(
    /strftime\(\s*'%m'\s*,\s*([^)]+)\)/gi,
    (_, col) => `TO_CHAR((${col.trim()})::date, 'MM')`
  );

  // ---- LIKE -> ILIKE (case-insensitive in PG) ----
  out = out.replace(/\bLIKE\b/g, 'ILIKE');

  // ---- INTEGER DEFAULT 0/1 for booleans -> keep as-is (PG handles it) ----
  // No conversion needed for queries; schema handled separately.

  return out;
}

/**
 * Replace julianday(expr) with (expr)::timestamp, handling nested parentheses.
 * Skips julianday('now'...) which was already converted above.
 */
function replaceJulianday(sql) {
  let result = '';
  let i = 0;
  const lower = sql.toLowerCase();

  while (i < sql.length) {
    const remaining = lower.substring(i);
    const jdMatch = remaining.match(/^julianday\s*\(/);
    if (jdMatch) {
      // Find the matching closing paren
      const start = i + jdMatch[0].length;
      let depth = 1;
      let j = start;
      while (j < sql.length && depth > 0) {
        if (sql[j] === '(') depth++;
        else if (sql[j] === ')') depth--;
        j++;
      }
      const inner = sql.substring(start, j - 1).trim();
      // If inner starts with 'now' it was already converted above, skip
      if (inner.toLowerCase().startsWith("'now")) {
        result += sql.substring(i, j);
      } else {
        result += `(${inner})::timestamp`;
      }
      i = j;
    } else {
      result += sql[i];
      i++;
    }
  }
  return result;
}

/**
 * Fix timestamp arithmetic patterns after julianday conversion.
 * Uses a procedural approach to avoid regex catastrophic backtracking.
 *
 * Handles:
 *   CAST(expr1 - expr2 AS INTEGER) where expr involves ::timestamp or NOW()
 *     -> CAST(EXTRACT(EPOCH FROM (expr1 - expr2)) / 86400 AS INTEGER)
 *   (expr1 - expr2) * 24 where expr involves ::timestamp or NOW()
 *     -> EXTRACT(EPOCH FROM (expr1 - expr2)) / 3600
 */
function fixTimestampArithmetic(sql) {
  let out = sql;

  // Pattern 1: CAST(... AS INTEGER) where the inner expression has ::timestamp or NOW() subtraction
  // Use balanced-paren matching to find the content inside CAST(...)
  const castPattern = /CAST\s*\(/gi;
  let castMatch;
  const castReplacements = [];

  while ((castMatch = castPattern.exec(out)) !== null) {
    const contentStart = castMatch.index + castMatch[0].length;
    let depth = 1;
    let j = contentStart;
    while (j < out.length && depth > 0) {
      if (out[j] === '(') depth++;
      else if (out[j] === ')') depth--;
      j++;
    }
    // j now points past the closing )
    const fullCast = out.substring(castMatch.index, j);
    const innerContent = out.substring(contentStart, j - 1);

    // Check for "AS INTEGER" at the end of inner content
    const asIntMatch = innerContent.match(/^([\s\S]+)\s+AS\s+INTEGER$/i);
    if (asIntMatch) {
      const expr = asIntMatch[1].trim();
      if ((expr.includes('::timestamp') || expr.includes('NOW()')) && expr.includes(' - ')) {
        castReplacements.push({
          start: castMatch.index,
          end: j,
          replacement: `CAST(EXTRACT(EPOCH FROM (${expr})) / 86400 AS INTEGER)`
        });
      }
    }
  }

  // Apply in reverse
  for (let i = castReplacements.length - 1; i >= 0; i--) {
    const r = castReplacements[i];
    out = out.substring(0, r.start) + r.replacement + out.substring(r.end);
  }

  // Pattern 2: (...) * 24 where inside parens has ::timestamp subtraction
  // Find balanced paren groups followed by * 24
  // We look for ) * 24 and work backwards to find the matching (
  const mulPattern = /\)\s*\*\s*24/g;
  let mulMatch;
  const replacements = [];

  while ((mulMatch = mulPattern.exec(out)) !== null) {
    // Find the matching opening paren
    const closeIdx = mulMatch.index; // position of the )
    let depth = 1;
    let openIdx = closeIdx - 1;
    while (openIdx >= 0 && depth > 0) {
      if (out[openIdx] === ')') depth++;
      else if (out[openIdx] === '(') depth--;
      openIdx--;
    }
    openIdx++; // now points to the (

    const innerExpr = out.substring(openIdx + 1, closeIdx);
    if ((innerExpr.includes('::timestamp') || innerExpr.includes('NOW()')) && innerExpr.includes(' - ')) {
      const fullEnd = mulMatch.index + mulMatch[0].length;
      replacements.push({
        start: openIdx,
        end: fullEnd,
        replacement: `EXTRACT(EPOCH FROM (${innerExpr.trim()})) / 3600`
      });
    }
  }

  // Apply replacements in reverse order to preserve indices
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    out = out.substring(0, r.start) + r.replacement + out.substring(r.end);
  }

  return out;
}

// ============================================================
// query() - unified interface, returns { rows, rowCount? }
// ============================================================

const query = async (sql, params = []) => {
  if (isPostgres) {
    return queryPostgres(sql, params);
  } else {
    return querySqlite(sql, params);
  }
};

// --- SQLite query (synchronous, wrapped in resolved promise shape) ---
function querySqlite(sql, params = []) {
  try {
    // Convert $1, $2 params to ? for SQLite
    let sqliteQuery = sql;
    const newParams = [];
    let maxParam = 0;
    for (let i = 1; i <= params.length + 5; i++) {
      if (sql.includes(`$${i}`)) maxParam = i;
    }
    if (maxParam > 0) {
      sqliteQuery = sql.replace(/\$(\d+)/g, (match, num) => {
        const idx = parseInt(num) - 1;
        newParams.push(params[idx]);
        return '?';
      });
      params = newParams;
    }

    const isSelect = sqliteQuery.trim().toUpperCase().startsWith('SELECT');
    const isReturning = sqliteQuery.toUpperCase().includes('RETURNING');

    if (isSelect) {
      const rows = db.prepare(sqliteQuery).all(...params);
      return { rows };
    } else if (isReturning) {
      const returningMatch = sqliteQuery.match(/RETURNING\s+(.+)$/i);
      let cleanSql = sqliteQuery.replace(/RETURNING\s+.+$/i, '').trim();

      if (cleanSql.toUpperCase().startsWith('INSERT')) {
        const result = db.prepare(cleanSql).run(...params);
        const tableName = cleanSql.match(/INSERT INTO (\w+)/i)?.[1];
        if (tableName && result.lastInsertRowid) {
          const row = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(result.lastInsertRowid);
          return { rows: row ? [row] : [] };
        }
        return { rows: [], rowCount: result.changes };
      } else if (cleanSql.toUpperCase().startsWith('UPDATE')) {
        const tableName = cleanSql.match(/UPDATE (\w+)/i)?.[1];
        const whereMatch = cleanSql.match(/WHERE\s+(.+)$/i);
        db.prepare(cleanSql).run(...params);
        if (tableName && whereMatch) {
          const lastParam = params[params.length - 1];
          const row = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(lastParam);
          return { rows: row ? [row] : [] };
        }
        return { rows: [] };
      } else if (cleanSql.toUpperCase().startsWith('DELETE')) {
        const result = db.prepare(cleanSql).run(...params);
        return { rows: result.changes > 0 ? [{ id: params[0] }] : [] };
      }
      return { rows: [] };
    } else {
      const result = db.prepare(sqliteQuery).run(...params);
      return { rowCount: result.changes, rows: [] };
    }
  } catch (error) {
    console.error('Database error (SQLite):', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
}

// --- PostgreSQL query ---
async function queryPostgres(sql, params = []) {
  try {
    // Step 1: Convert SQLite date functions to PG equivalents
    let pgSql = convertSqliteToPostgres(sql);

    // Step 2: Ensure params use $N notation (most queries already do)
    // If query still has ? placeholders (from direct-? usage), convert to $N
    if (pgSql.includes('?')) {
      let paramIndex = 0;
      pgSql = pgSql.replace(/\?/g, () => {
        paramIndex++;
        return `$${paramIndex}`;
      });
    }

    // Step 3: Execute via pg pool
    const result = await pool.query(pgSql, params);
    return { rows: result.rows, rowCount: result.rowCount };
  } catch (error) {
    console.error('Database error (PostgreSQL):', error.message);
    console.error('SQL:', sql);
    console.error('Converted SQL:', convertSqliteToPostgres(sql));
    console.error('Params:', params);
    throw error;
  }
}

// ============================================================
// initializeDatabase() - create tables + seed admin
// ============================================================

const initializeDatabase = async () => {
  console.log(isPostgres ? '🐘 Initializing PostgreSQL database...' : '📦 Initializing SQLite database...');

  // Helper to execute a DDL statement
  const execDDL = async (ddl) => {
    if (isPostgres) {
      await pool.query(ddl);
    } else {
      db.exec(ddl);
    }
  };

  // In PostgreSQL we use BOOLEAN/TIMESTAMP/SERIAL differently, but since all
  // our columns are TEXT and INTEGER with TEXT dates, the schemas are compatible.
  // We keep INTEGER for booleans (0/1) - PG handles this fine.

  try {
    // Users table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'employee',
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Leads table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        company_name TEXT,
        contact_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        source TEXT,
        service_type TEXT,
        location TEXT,
        description TEXT,
        status TEXT DEFAULT 'new',
        assigned_to TEXT REFERENCES users(id),
        lost_reason TEXT,
        expected_value REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Customers table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        business_id TEXT,
        address TEXT,
        city TEXT,
        service_type TEXT,
        status TEXT DEFAULT 'active',
        payment_terms TEXT DEFAULT 'net30',
        notes TEXT,
        lead_id TEXT REFERENCES leads(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Contacts table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT,
        phone TEXT,
        email TEXT,
        is_primary INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sites table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT,
        requirements TEXT,
        requires_weapon INTEGER DEFAULT 0,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Contracts table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
        start_date TEXT NOT NULL,
        end_date TEXT,
        monthly_value REAL,
        terms TEXT,
        document_url TEXT,
        status TEXT DEFAULT 'active',
        auto_renewal INTEGER DEFAULT 1,
        renewal_reminder_days INTEGER DEFAULT 30,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employees table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        id_number TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        city TEXT,
        birth_date TEXT,
        hire_date TEXT NOT NULL,
        employment_type TEXT DEFAULT 'hourly',
        hourly_rate REAL,
        monthly_salary REAL,
        has_weapon_license INTEGER DEFAULT 0,
        weapon_license_expiry TEXT,
        has_driving_license INTEGER DEFAULT 0,
        driving_license_type TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        profile_image_url TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employee documents table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS employee_documents (
        id TEXT PRIMARY KEY,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        document_type TEXT NOT NULL,
        document_url TEXT NOT NULL,
        expiry_date TEXT,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employee availability table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS employee_availability (
        id TEXT PRIMARY KEY,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        start_time TEXT,
        end_time TEXT,
        is_available INTEGER DEFAULT 1
      )
    `);

    // Shifts table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        site_id TEXT REFERENCES sites(id),
        customer_id TEXT REFERENCES customers(id),
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        required_employees INTEGER DEFAULT 1,
        requires_weapon INTEGER DEFAULT 0,
        requires_vehicle INTEGER DEFAULT 0,
        notes TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Shift assignments table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS shift_assignments (
        id TEXT PRIMARY KEY,
        shift_id TEXT REFERENCES shifts(id) ON DELETE CASCADE,
        employee_id TEXT REFERENCES employees(id),
        role TEXT DEFAULT 'guard',
        status TEXT DEFAULT 'assigned',
        check_in_time TEXT,
        check_out_time TEXT,
        actual_hours REAL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Events table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        customer_id TEXT REFERENCES customers(id),
        lead_id TEXT REFERENCES leads(id),
        event_name TEXT NOT NULL,
        event_type TEXT,
        event_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location TEXT NOT NULL,
        address TEXT,
        expected_attendance INTEGER,
        required_guards INTEGER NOT NULL,
        requires_weapon INTEGER DEFAULT 0,
        requires_vehicle INTEGER DEFAULT 0,
        special_equipment TEXT,
        notes TEXT,
        price REAL,
        status TEXT DEFAULT 'quote',
        planning_document_url TEXT,
        google_calendar_event_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Event assignments table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS event_assignments (
        id TEXT PRIMARY KEY,
        event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
        employee_id TEXT REFERENCES employees(id),
        role TEXT,
        status TEXT DEFAULT 'assigned',
        check_in_time TEXT,
        check_out_time TEXT,
        actual_hours REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Invoices table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        customer_id TEXT REFERENCES customers(id),
        event_id TEXT REFERENCES events(id),
        green_invoice_id TEXT,
        invoice_number TEXT,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        amount REAL NOT NULL,
        vat_amount REAL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'draft',
        payment_date TEXT,
        description TEXT,
        document_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notifications table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        related_entity_type TEXT,
        related_entity_id TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Activity log table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        action TEXT NOT NULL,
        changes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Integration settings table
    await execDDL(`
      CREATE TABLE IF NOT EXISTS integration_settings (
        id TEXT PRIMARY KEY,
        google_tokens TEXT,
        google_email TEXT,
        whatsapp_phone_id TEXT,
        whatsapp_access_token TEXT,
        whatsapp_phone_display TEXT,
        green_invoice_api_key TEXT,
        green_invoice_api_secret TEXT,
        green_invoice_business_name TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add google_calendar_event_id column to events if not exists (SQLite migration)
    if (!isPostgres) {
      try {
        db.exec(`ALTER TABLE events ADD COLUMN google_calendar_event_id TEXT`);
      } catch (e) {
        // Column already exists, ignore
      }
    }

    // Add google_calendar_event_id column to shifts if not exists
    if (isPostgres) {
      await pool.query(`
        DO $$ BEGIN
          ALTER TABLE shifts ADD COLUMN google_calendar_event_id TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
      `);
    } else {
      try {
        db.exec(`ALTER TABLE shifts ADD COLUMN google_calendar_event_id TEXT`);
      } catch (e) {
        // Column already exists, ignore
      }
    }

    // --------------------------------------------------
    // Contractor tables (new)
    // --------------------------------------------------
    await execDDL(`
      CREATE TABLE IF NOT EXISTS contractors (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        business_id TEXT,
        contact_name TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        specialization TEXT,
        hourly_rate REAL,
        daily_rate REAL,
        payment_terms TEXT,
        bank_name TEXT,
        bank_branch TEXT,
        bank_account TEXT,
        max_workers INTEGER,
        rating REAL,
        notes TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await execDDL(`
      CREATE TABLE IF NOT EXISTS contractor_workers (
        id TEXT PRIMARY KEY,
        contractor_id TEXT REFERENCES contractors(id),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        id_number TEXT,
        has_weapon_license INTEGER DEFAULT 0,
        weapon_license_expiry TEXT,
        notes TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await execDDL(`
      CREATE TABLE IF NOT EXISTS event_contractor_assignments (
        id TEXT PRIMARY KEY,
        event_id TEXT REFERENCES events(id),
        contractor_id TEXT REFERENCES contractors(id),
        workers_count INTEGER,
        hourly_rate REAL,
        total_cost REAL,
        notes TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await execDDL(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`);
    await execDDL(`CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)`);
    await execDDL(`CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)`);
    await execDDL(`CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date)`);
    await execDDL(`CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date)`);
    await execDDL(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);

    // Create default admin user if not exists
    let adminExists;
    if (isPostgres) {
      const res = await pool.query("SELECT id FROM users WHERE email = $1", ['admin@tzevetyahalom.co.il']);
      adminExists = res.rows.length > 0;
    } else {
      adminExists = !!db.prepare('SELECT id FROM users WHERE email = ?').get('admin@tzevetyahalom.co.il');
    }

    if (!adminExists) {
      const passwordHash = bcrypt.hashSync('Admin123!', 10);
      const adminId = generateUUID();
      if (isPostgres) {
        await pool.query(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5, $6)`,
          [adminId, 'admin@tzevetyahalom.co.il', passwordHash, '\u05DE\u05E0\u05D4\u05DC', '\u05E8\u05D0\u05E9\u05D9', 'admin']
        );
      } else {
        db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(adminId, 'admin@tzevetyahalom.co.il', passwordHash, '\u05DE\u05E0\u05D4\u05DC', '\u05E8\u05D0\u05E9\u05D9', 'admin');
      }
      console.log('Admin user created: admin@tzevetyahalom.co.il / Admin123!');
    }

    // Create Reem user if not exists
    let reemExists;
    if (isPostgres) {
      const res = await pool.query("SELECT id FROM users WHERE email = $1", ['yahalomreem@gmail.com']);
      reemExists = res.rows.length > 0;
    } else {
      reemExists = !!db.prepare('SELECT id FROM users WHERE email = ?').get('yahalomreem@gmail.com');
    }

    if (!reemExists) {
      const passwordHash = bcrypt.hashSync('Reem123!', 10);
      const reemId = generateUUID();
      if (isPostgres) {
        await pool.query(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5, $6)`,
          [reemId, 'yahalomreem@gmail.com', passwordHash, '\u05E8\u05D9\u05DD', '\u05D9\u05D4\u05DC\u05D5\u05DD', 'admin']
        );
      } else {
        db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(reemId, 'yahalomreem@gmail.com', passwordHash, '\u05E8\u05D9\u05DD', '\u05D9\u05D4\u05DC\u05D5\u05DD', 'admin');
      }
      console.log('Reem user created: yahalomreem@gmail.com');
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

// Initialize on load
initializeDatabase().catch(err => {
  console.error('Fatal: could not initialize database', err);
  process.exit(1);
});

module.exports = {
  query,
  generateUUID,
  initializeDatabase
};
