// ============================================================================
// Shared TypeScript Types for CRM Yahalom
// ============================================================================

// -- Axios-style mutation error (used across many pages) ---------------------

export interface MutationError {
  response?: {
    data?: {
      error?: string;
      message?: string;
      needsSetup?: boolean;
      [key: string]: unknown;
    };
    status?: number;
  };
  message?: string;
}

// -- Core entity types -------------------------------------------------------

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  id_number?: string;
  role?: string;
  status?: string;
  has_weapon_license?: boolean;
  hire_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  company_name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Site {
  id: string;
  name: string;
  address?: string;
  city?: string;
  customer_id?: string;
  latitude?: number;
  longitude?: number;
  requires_weapon?: boolean;
  required_guards?: number;
  notes?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Shift {
  id: string;
  site_id?: string;
  site_name?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  required_employees?: number;
  notes?: string;
  check_in_time?: string;
  check_out_time?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Event {
  id: string;
  event_name?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  customer_id?: string;
  status?: string;
  description?: string;
  required_guards?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Equipment {
  id: string;
  item_name?: string;
  item_type?: string;
  serial_number?: string;
  employee_id?: string;
  status?: string;
  condition?: string;
  assigned_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Incident {
  id: string;
  title: string;
  incident_type: string;
  severity: string;
  status: string;
  description?: string;
  customer_id?: string;
  site_id?: string;
  incident_date?: string;
  incident_time?: string;
  location_details?: string;
  police_called?: boolean;
  police_report_number?: string;
  ambulance_called?: boolean;
  injuries_reported?: boolean;
  property_damage?: boolean;
  actions_taken?: string;
  resolution?: string;
  resolution_date?: string;
  reporter_name?: string;
  site_name?: string;
  company_name?: string;
  reported_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  invoice_number?: string;
  customer_id?: string;
  total_amount?: number;
  status?: string;
  issue_date?: string;
  due_date?: string;
  payment_date?: string;
  description?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Certification {
  id: string;
  employee_id?: string;
  cert_type?: string;
  cert_name?: string;
  issue_date?: string;
  expiry_date?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}
