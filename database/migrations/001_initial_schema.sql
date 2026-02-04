-- Tzevet Yahalom CRM Database Schema
-- Initial Migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS (משתמשי המערכת)
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'employee', -- admin, manager, sales, employee
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- LEADS (לידים)
-- =============================================
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255),
    contact_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    source VARCHAR(50), -- website, whatsapp, phone, referral
    service_type VARCHAR(50), -- regular, event, both
    location VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'new', -- new, contacted, meeting_scheduled, proposal_sent, negotiation, won, lost
    assigned_to UUID REFERENCES users(id),
    lost_reason TEXT,
    expected_value DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CUSTOMERS (לקוחות)
-- =============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    business_id VARCHAR(20), -- ח.פ / ע.מ
    address TEXT,
    city VARCHAR(100),
    service_type VARCHAR(50), -- regular, events, both
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, ended
    payment_terms VARCHAR(50) DEFAULT 'net30', -- immediate, net30, net60
    notes TEXT,
    lead_id UUID REFERENCES leads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CONTACTS (אנשי קשר)
-- =============================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SITES (אתרים/נקודות שמירה)
-- =============================================
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100),
    requirements TEXT, -- דרישות אבטחה
    requires_weapon BOOLEAN DEFAULT false,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- CONTRACTS (חוזים)
-- =============================================
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    monthly_value DECIMAL(10, 2),
    terms TEXT,
    document_url TEXT, -- Google Drive link
    status VARCHAR(50) DEFAULT 'active', -- draft, active, expired, terminated
    auto_renewal BOOLEAN DEFAULT true,
    renewal_reminder_days INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EMPLOYEES (עובדים)
-- =============================================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    id_number VARCHAR(20) UNIQUE NOT NULL, -- ת.ז
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    birth_date DATE,
    hire_date DATE NOT NULL,
    employment_type VARCHAR(50) DEFAULT 'hourly', -- hourly, monthly, contractor
    hourly_rate DECIMAL(8, 2),
    monthly_salary DECIMAL(10, 2),
    has_weapon_license BOOLEAN DEFAULT false,
    weapon_license_expiry DATE,
    has_driving_license BOOLEAN DEFAULT false,
    driving_license_type VARCHAR(10),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    profile_image_url TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, terminated
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EMPLOYEE_DOCUMENTS (מסמכי עובדים)
-- =============================================
CREATE TABLE employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- id_card, weapon_license, police_clearance, training_cert, contract
    document_url TEXT NOT NULL, -- Google Drive link
    expiry_date DATE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EMPLOYEE_AVAILABILITY (זמינות עובדים)
-- =============================================
CREATE TABLE employee_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT true
);

-- =============================================
-- SHIFTS (משמרות)
-- =============================================
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id),
    customer_id UUID REFERENCES customers(id),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_employees INTEGER DEFAULT 1,
    requires_weapon BOOLEAN DEFAULT false,
    requires_vehicle BOOLEAN DEFAULT false,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SHIFT_ASSIGNMENTS (שיבוצים)
-- =============================================
CREATE TABLE shift_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id),
    role VARCHAR(50) DEFAULT 'guard', -- team_leader, guard
    status VARCHAR(50) DEFAULT 'assigned', -- assigned, confirmed, checked_in, checked_out, no_show
    check_in_time TIMESTAMP,
    check_in_location POINT, -- GPS coordinates
    check_out_time TIMESTAMP,
    check_out_location POINT,
    actual_hours DECIMAL(5, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EVENTS (אירועים)
-- =============================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    lead_id UUID REFERENCES leads(id),
    event_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(50), -- wedding, conference, concert, sports, other
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(255) NOT NULL,
    address TEXT,
    expected_attendance INTEGER,
    required_guards INTEGER NOT NULL,
    requires_weapon BOOLEAN DEFAULT false,
    requires_vehicle BOOLEAN DEFAULT false,
    special_equipment TEXT,
    notes TEXT,
    price DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'quote', -- quote, approved, staffed, completed, invoiced, cancelled
    planning_document_url TEXT, -- Google Drive link
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EVENT_ASSIGNMENTS (שיבוצים לאירועים)
-- =============================================
CREATE TABLE event_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id),
    role VARCHAR(100), -- team_leader, gate, parking, vip, roaming
    status VARCHAR(50) DEFAULT 'assigned', -- assigned, confirmed, checked_in, checked_out
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    actual_hours DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INVOICES (חשבוניות - סנכרון עם חשבונית ירוקה)
-- =============================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    event_id UUID REFERENCES events(id),
    green_invoice_id VARCHAR(100), -- מזהה בחשבונית ירוקה
    invoice_number VARCHAR(50),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    vat_amount DECIMAL(10, 2),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
    payment_date DATE,
    description TEXT,
    document_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- NOTIFICATIONS (התראות)
-- =============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL, -- lead_reminder, contract_renewal, shift_unassigned, invoice_overdue, document_expiry
    title VARCHAR(255) NOT NULL,
    message TEXT,
    related_entity_type VARCHAR(50), -- lead, customer, shift, event, invoice, employee
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ACTIVITY_LOG (יומן פעילות)
-- =============================================
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    action VARCHAR(50) NOT NULL, -- create, update, delete, status_change
    changes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- =============================================
-- DEFAULT ADMIN USER
-- =============================================
-- Password: Admin123! (hashed with bcrypt)
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES ('admin@tzevetyahalom.co.il', '$2a$10$rQnM8M8kqHEqK5Y5Y5Y5YOqHEqK5Y5Y5Y5Y5YOqHEqK5Y5Y5Y5Y5Y', 'מנהל', 'ראשי', 'admin');
