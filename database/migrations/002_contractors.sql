-- Contractors Migration
-- Adds contractors, contractor_workers, and event_contractor_assignments tables

-- =============================================
-- CONTRACTORS (קבלנים)
-- =============================================
CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    specialization VARCHAR(100),
    hourly_rate DECIMAL(8, 2),
    daily_rate DECIMAL(10, 2),
    payment_terms VARCHAR(50) DEFAULT 'net30',
    bank_name VARCHAR(100),
    bank_branch VARCHAR(20),
    bank_account VARCHAR(30),
    max_workers INTEGER,
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, ended
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CONTRACTOR_WORKERS (עובדי קבלן)
-- =============================================
CREATE TABLE IF NOT EXISTS contractor_workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    id_number VARCHAR(20),
    has_weapon_license BOOLEAN DEFAULT false,
    weapon_license_expiry DATE,
    status VARCHAR(50) DEFAULT 'active', -- active, inactive
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EVENT_CONTRACTOR_ASSIGNMENTS (שיבוצי קבלנים לאירועים)
-- =============================================
CREATE TABLE IF NOT EXISTS event_contractor_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE,
    workers_count INTEGER DEFAULT 1,
    price DECIMAL(10, 2),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'assigned', -- assigned, confirmed, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_contractors_status ON contractors(status);
CREATE INDEX IF NOT EXISTS idx_contractor_workers_contractor_id ON contractor_workers(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_workers_status ON contractor_workers(status);
CREATE INDEX IF NOT EXISTS idx_event_contractor_assignments_event_id ON event_contractor_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_contractor_assignments_contractor_id ON event_contractor_assignments(contractor_id);
