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
    // Convert undefined to null and booleans to integers - better-sqlite3 requirements
    params = params.map(p => {
      if (p === undefined) return null;
      if (p === true) return 1;
      if (p === false) return 0;
      return p;
    });

    // Convert $1, $2 params to ? for SQLite
    // Handle repeated parameter references (e.g. $1 used multiple times)
    let sqliteQuery = sql;
    const newParams = [];
    // Find the highest param index used
    let maxParam = 0;
    for (let i = 1; i <= params.length + 5; i++) {
      if (sql.includes(`$${i}`)) maxParam = i;
    }
    // Replace all $N with ? and build expanded params array
    if (maxParam > 0) {
      // Use regex to find all $N references in order and build new params
      sqliteQuery = sql.replace(/\$(\d+)/g, (match, num) => {
        const idx = parseInt(num) - 1; // $1 -> index 0
        newParams.push(params[idx]);
        return '?';
      });
      params = newParams;
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
        db.prepare(cleanSql).run(...params);

        if (tableName) {
          // The id is the last param in UPDATE ... WHERE id = $N queries
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

  // Add google_calendar_event_id column to events if not exists
  try {
    db.exec(`ALTER TABLE events ADD COLUMN google_calendar_event_id TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Add google_calendar_event_id column to shifts if not exists
  try {
    db.exec(`ALTER TABLE shifts ADD COLUMN google_calendar_event_id TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Activity logs table (for customer/lead activity tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      user_id TEXT,
      user_name TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  // Email templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      variables TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Documents table (Google Drive)
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      google_drive_id TEXT,
      google_drive_url TEXT,
      uploaded_by TEXT,
      uploaded_by_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default email templates
  const templateCount = db.prepare('SELECT COUNT(*) as c FROM email_templates').get();
  if (templateCount.c === 0) {
    const crypto = require('crypto');
    const templates = [
      {
        id: crypto.randomUUID(),
        name: 'תזכורת חשבונית',
        subject: 'תזכורת תשלום - חשבונית #{invoice_number}',
        body: '<div dir="rtl"><h2>שלום {customer_name},</h2><p>ברצוננו להזכיר כי חשבונית מספר <strong>#{invoice_number}</strong> בסך <strong>₪{amount}</strong> טרם שולמה.</p><p>נשמח אם תוכלו לטפל בתשלום בהקדם.</p><p>בברכה,<br>צוות יהלום</p></div>',
        category: 'invoices',
        variables: 'customer_name,invoice_number,amount'
      },
      {
        id: crypto.randomUUID(),
        name: 'אישור משמרת',
        subject: 'אישור שיבוץ משמרת - {date}',
        body: '<div dir="rtl"><h2>שלום {employee_name},</h2><p>שובצת למשמרת בתאריך <strong>{date}</strong> באתר <strong>{site_name}</strong>.</p><p>שעות: {start_time} - {end_time}</p><p>אנא אשר קבלה.</p><p>בברכה,<br>צוות יהלום</p></div>',
        category: 'shifts',
        variables: 'employee_name,date,site_name,start_time,end_time'
      },
      {
        id: crypto.randomUUID(),
        name: 'ברוכים הבאים',
        subject: 'ברוכים הבאים לצוות יהלום!',
        body: '<div dir="rtl"><h2>שלום {customer_name},</h2><p>תודה שבחרתם בצוות יהלום לשירותי אבטחה.</p><p>אנו שמחים להציע לכם שירות מקצועי ואמין. מנהל השירות שלכם ייצור אתכם קשר בימים הקרובים.</p><p>לכל שאלה, אנו כאן לשירותכם.</p><p>בברכה,<br>צוות יהלום</p></div>',
        category: 'general',
        variables: 'customer_name'
      }
    ];
    const stmt = db.prepare('INSERT INTO email_templates (id, name, subject, body, category, variables) VALUES (?, ?, ?, ?, ?, ?)');
    for (const t of templates) {
      stmt.run(t.id, t.name, t.subject, t.body, t.category, t.variables);
    }
  }

  // ===== Security Company Tables =====

  // Incidents table - security incident reporting
  db.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      site_id TEXT REFERENCES sites(id),
      customer_id TEXT REFERENCES customers(id),
      shift_id TEXT REFERENCES shifts(id),
      reported_by TEXT REFERENCES employees(id),
      incident_type TEXT NOT NULL,
      severity TEXT DEFAULT 'low',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location_details TEXT,
      incident_date TEXT NOT NULL,
      incident_time TEXT NOT NULL,
      police_called INTEGER DEFAULT 0,
      police_report_number TEXT,
      ambulance_called INTEGER DEFAULT 0,
      injuries_reported INTEGER DEFAULT 0,
      property_damage INTEGER DEFAULT 0,
      witnesses TEXT,
      actions_taken TEXT,
      resolution TEXT,
      resolution_date TEXT,
      status TEXT DEFAULT 'open',
      customer_notified INTEGER DEFAULT 0,
      customer_notification_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Incident updates timeline
  db.exec(`
    CREATE TABLE IF NOT EXISTS incident_updates (
      id TEXT PRIMARY KEY,
      incident_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      update_text TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Guard certifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS guard_certifications (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
      cert_type TEXT NOT NULL,
      cert_name TEXT NOT NULL,
      cert_number TEXT,
      issuing_authority TEXT,
      issue_date TEXT,
      expiry_date TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Guard weapons tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS guard_weapons (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id),
      weapon_type TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT UNIQUE NOT NULL,
      license_number TEXT,
      license_expiry TEXT,
      status TEXT DEFAULT 'assigned',
      assigned_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Guard equipment tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS guard_equipment (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id),
      item_type TEXT NOT NULL,
      item_name TEXT NOT NULL,
      serial_number TEXT,
      condition TEXT DEFAULT 'good',
      assigned_date TEXT,
      return_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Shift templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS shift_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      customer_id TEXT REFERENCES customers(id),
      site_id TEXT REFERENCES sites(id),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      required_employees INTEGER DEFAULT 1,
      requires_weapon INTEGER DEFAULT 0,
      requires_vehicle INTEGER DEFAULT 0,
      days_of_week TEXT,
      shift_type TEXT DEFAULT 'regular',
      default_notes TEXT,
      preferred_employees TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Site checkpoints for patrols
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_checkpoints (
      id TEXT PRIMARY KEY,
      site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      location_notes TEXT,
      check_interval_minutes INTEGER,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Patrol logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS patrol_logs (
      id TEXT PRIMARY KEY,
      shift_assignment_id TEXT REFERENCES shift_assignments(id),
      employee_id TEXT REFERENCES employees(id),
      checkpoint_id TEXT REFERENCES site_checkpoints(id),
      site_id TEXT REFERENCES sites(id),
      checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT DEFAULT 'ok',
      observation TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Guard ratings / performance
  db.exec(`
    CREATE TABLE IF NOT EXISTS guard_ratings (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
      rated_by TEXT REFERENCES users(id),
      rating_type TEXT NOT NULL,
      rating INTEGER NOT NULL,
      shift_id TEXT REFERENCES shifts(id),
      event_id TEXT REFERENCES events(id),
      comments TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // WhatsApp messages table (conversation history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      entity_type TEXT,
      entity_id TEXT,
      status TEXT DEFAULT 'sent',
      waha_message_id TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
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
    CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);
    CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
    CREATE INDEX IF NOT EXISTS idx_guard_certs_employee ON guard_certifications(employee_id);
    CREATE INDEX IF NOT EXISTS idx_guard_certs_expiry ON guard_certifications(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_guard_weapons_employee ON guard_weapons(employee_id);
    CREATE INDEX IF NOT EXISTS idx_patrol_logs_shift ON patrol_logs(shift_assignment_id);
    CREATE INDEX IF NOT EXISTS idx_guard_ratings_employee ON guard_ratings(employee_id);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_entity ON whatsapp_messages(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at);
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

  // Create Reem user if not exists (for Google OAuth)
  const reemExists = db.prepare('SELECT id FROM users WHERE email = ?').get('yahalomreem@gmail.com');

  if (!reemExists) {
    const passwordHash = bcrypt.hashSync('Reem123!', 10);
    const reemId = generateUUID();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reemId, 'yahalomreem@gmail.com', passwordHash, 'רים', 'יהלום', 'admin');

    console.log('✅ Reem user created: yahalomreem@gmail.com');
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
