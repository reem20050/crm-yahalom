const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'crm.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Generate UUID function for SQLite
const generateUUID = () => crypto.randomUUID();

// Helper function to run queries with params (similar to pg interface)
const query = (sql, params = []) => {
  try {
    // Convert $1, $2 params to ? for SQLite
    let sqliteQuery = sql;
    let paramIndex = 1;
    while (sqliteQuery.includes(`$${paramIndex}`)) {
      sqliteQuery = sqliteQuery.replace(`$${paramIndex}`, '?');
      paramIndex++;
    }

    // Check if it's a SELECT query
    const isSelect = sqliteQuery.trim().toUpperCase().startsWith('SELECT');
    const isReturning = sqliteQuery.toUpperCase().includes('RETURNING');

    if (isSelect) {
      const rows = db.prepare(sqliteQuery).all(...params);
      return { rows };
    } else if (isReturning) {
      // Remove RETURNING clause for SQLite and handle manually
      const returningMatch = sqliteQuery.match(/RETURNING\s+(.+)$/i);
      let cleanSql = sqliteQuery.replace(/RETURNING\s+.+$/i, '').trim();

      // For INSERT, get the rowid
      if (cleanSql.toUpperCase().startsWith('INSERT')) {
        const result = db.prepare(cleanSql).run(...params);
        // Get the inserted row
        const tableName = cleanSql.match(/INSERT INTO (\w+)/i)?.[1];
        if (tableName && result.lastInsertRowid) {
          const row = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(result.lastInsertRowid);
          return { rows: row ? [row] : [] };
        }
        return { rows: [], rowCount: result.changes };
      } else if (cleanSql.toUpperCase().startsWith('UPDATE')) {
        // For UPDATE with RETURNING
        const tableName = cleanSql.match(/UPDATE (\w+)/i)?.[1];
        const whereMatch = cleanSql.match(/WHERE\s+(.+)$/i);

        db.prepare(cleanSql).run(...params);

        if (tableName && whereMatch) {
          const selectSql = `SELECT * FROM ${tableName} WHERE ${whereMatch[1]}`;
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
    console.error('Database error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
};

// Initialize database schema
const initializeDatabase = () => {
  console.log('📦 Initializing SQLite database...');

  // Users table
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Event assignments table
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
    CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
    CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  `);

  // Create default admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@tzevetyahalom.co.il');

  if (!adminExists) {
    const passwordHash = bcrypt.hashSync('Admin123!', 10);
    const adminId = generateUUID();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminId, 'admin@tzevetyahalom.co.il', passwordHash, 'מנהל', 'ראשי', 'admin');

    console.log('✅ Admin user created: admin@tzevetyahalom.co.il / Admin123!');
  }

  console.log('✅ Database initialized successfully');
};

// Initialize on load
initializeDatabase();

module.exports = {
  query,
  db,
  generateUUID
};
