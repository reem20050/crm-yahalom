# Security Company CRM - Implementation Plan

**Production URL:** https://crm-yahalom-production.up.railway.app  
**Goal:** Upgrade to high-end Security Company CRM + Operations system with full RBAC, audit logging, and operations features.

---

## EXECUTIVE SUMMARY

This document outlines the phased implementation plan to transform the existing CRM into a production-ready security company management system. All changes will be incremental, tested in staging first, and deployed with zero downtime.

**Key Principles:**
- Incremental changes only - no rewrite
- All DB changes via migrations (Alembic)
- Staging environment required before risky changes
- English labels only (no Hebrew)
- RBAC enforcement on every endpoint
- Full audit trail for critical actions

---

## ARCHITECTURE SUMMARY

### Current Architecture
```
Frontend (React + Vite)          Backend (FastAPI)              Database
┌─────────────────┐              ┌─────────────────┐            ┌──────────┐
│                 │              │                 │            │          │
│  - Dashboard    │              │  - No Auth      │            │          │
│  - Employees    │  HTTP/API    │    Middleware   │  SQLAlchemy│  SQLite  │
│  - Clients      │ ────────────>│  - No RBAC      │ ──────────>│  (File)  │
│                 │              │  - No Validation│            │          │
│  No Auth UI     │              │  - Public APIs  │            │          │
└─────────────────┘              └─────────────────┘            └──────────┘
```

### Target Architecture (After P0)
```
Frontend (React + Vite)          Backend (FastAPI)              Database
┌─────────────────┐              ┌─────────────────┐            ┌──────────┐
│                 │              │                 │            │          │
│  - Login        │              │  - JWT Auth     │            │          │
│  - Dashboard    │  HTTP/API    │    Middleware   │  SQLAlchemy│PostgreSQL│
│  - Employees    │ ────────────>│  - RBAC         │ ──────────>│  (Railway)│
│  - Clients      │  + JWT Token │  - Validation   │            │          │
│  - Users        │              │  - Rate Limit   │            │          │
│  - Audit Logs   │              │  - Audit Log    │            │          │
└─────────────────┘              └─────────────────┘            └──────────┘
                                         │
                                         ▼
                                 ┌──────────────┐
                                 │   Sentry     │
                                 │  (Monitoring)│
                                 └──────────────┘
```

### Technology Stack

**Backend:**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- Alembic (database migrations)
- PostgreSQL (database, via Railway)
- python-jose (JWT)
- google-auth (OAuth)
- slowapi (rate limiting)
- sentry-sdk (error tracking)
- pydantic (validation)

**Frontend:**
- React 19.2.0
- Vite 7.2.4
- React Router DOM 7.1.3
- Axios 1.7.9
- Custom CSS design system

**Infrastructure:**
- Railway (hosting)
- PostgreSQL (database)
- Environment-based configuration

---

## ERD SUMMARY

### Current Schema (Simplified)
```
users
├── id (PK)
├── email (unique)
├── role (admin, manager)
└── relationships: tasks, notifications

employees
├── id (PK)
├── first_name, last_name
├── id_number (unique)
├── phone
├── role (guard, shift_manager)
├── is_active
└── relationships: shifts

clients
├── id (PK)
├── name (unique)
├── address, contact_person, contact_phone
└── relationships: shifts

shifts
├── id (PK)
├── employee_id (FK)
├── client_id (FK)
├── start_time, end_time
├── status (scheduled, completed, canceled)
└── relationships: employee, client

tasks
├── id (PK)
├── assigned_to (FK → users)
├── created_by (FK → users)
├── title, description
├── status, priority
└── relationships: assigned_user, creator

notifications
├── id (PK)
├── user_id (FK)
├── title, message
├── notif_type
└── relationships: user
```

### Target Schema (After P0)
```
users
├── id (PK)
├── email (unique)
├── role (enum: Admin, OperationsManager, Scheduler, Sales, Finance, ShiftLead, Guard)
├── created_at, updated_at
└── relationships: tasks, notifications, audit_logs

user_invites
├── id (PK)
├── email (unique)
├── invited_by (FK → users)
├── role (enum)
├── token (unique, for invite link)
├── expires_at
├── accepted_at
└── relationships: inviter

audit_logs
├── id (PK)
├── user_id (FK → users, nullable)
├── action (enum: create, update, delete, role_change)
├── resource_type (enum: user, employee, client, shift)
├── resource_id (integer)
├── old_value (JSON, nullable)
├── new_value (JSON, nullable)
├── ip_address (string)
├── user_agent (string)
├── created_at
└── relationships: user

employees
├── id (PK)
├── first_name, last_name
├── id_number (unique)
├── phone, email
├── role (enum: guard, shift_manager)
├── is_active
├── created_at, updated_at
└── relationships: shifts

clients
├── id (PK)
├── name (unique)
├── address, contact_person, contact_phone, email
├── created_at, updated_at
└── relationships: shifts

[Shifts, Tasks, Notifications remain similar but add timestamps]
```

### Target Schema (After P1)
```
clients
├── [existing fields]
├── notes (text)
├── sites (JSON or relationship table)
└── attachments (relationship → client_files)

client_files
├── id (PK)
├── client_id (FK)
├── filename
├── file_path (S3/local)
├── file_size
├── uploaded_by (FK → users)
└── created_at

employees
├── [existing fields]
├── certifications (JSON or relationship)
├── availability (JSON)
├── base_pay (decimal)
└── attachments (relationship → employee_files)

employee_files
├── id (PK)
├── employee_id (FK)
├── filename
├── file_path
├── file_size
├── uploaded_by (FK → users)
└── created_at

employee_certifications
├── id (PK)
├── employee_id (FK)
├── name (string)
├── issuer (string)
├── issued_date
├── expiry_date
├── certificate_number
└── created_at
```

### Target Schema (After P2)
```
jobs (or events)
├── id (PK)
├── client_id (FK)
├── name
├── description
├── start_date, end_date
├── status (enum)
└── relationships: shifts

shifts
├── [existing fields]
├── job_id (FK → jobs, nullable)
├── [enhanced fields]

attendance
├── id (PK)
├── shift_id (FK)
├── employee_id (FK)
├── clock_in_time
├── clock_out_time
├── approved_by (FK → users, nullable)
├── approved_at
├── is_locked (boolean)
└── relationships: shift, employee, approver

invoices
├── id (PK)
├── client_id (FK)
├── invoice_number (unique)
├── amount (decimal)
├── due_date
├── status (enum: draft, sent, paid, overdue)
├── created_at, updated_at
└── relationships: client, payments

payments
├── id (PK)
├── invoice_id (FK)
├── amount (decimal)
├── payment_date
├── payment_method
└── relationships: invoice
```

---

## ENDPOINT LIST

### Current Endpoints (Unprotected)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/` | Welcome message | Public |
| POST | `/auth/google` | Google OAuth login | Public |

| Method | Endpoint | Description | Auth | RBAC | Validation |
|--------|----------|-------------|------|------|------------|
| GET | `/employees/` | List employees | ❌ | ❌ | ❌ |
| POST | `/employees/` | Create employee | ❌ | ❌ | ❌ |
| GET | `/clients/` | List clients | ❌ | ❌ | ❌ |
| POST | `/clients/` | Create client | ❌ | ❌ | ❌ |

### Target Endpoints (After P0)

#### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/auth/google` | Google OAuth login (checks allowlist) |

#### Protected Endpoints (Require JWT)

**User Management** (Admin only)
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/users/` | List users | Admin |
| GET | `/users/{id}` | Get user details | Admin |
| PUT | `/users/{id}/role` | Update user role | Admin (audited) |
| DELETE | `/users/{id}` | Delete user | Admin (audited) |

**Invites** (Admin only)
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| POST | `/invites/` | Create invite | Admin |
| GET | `/invites/` | List invites | Admin |
| DELETE | `/invites/{id}` | Cancel invite | Admin |

**Employees** (Multiple roles)
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/employees/` | List employees (paginated, filtered) | OperationsManager, Scheduler, Sales, Finance, ShiftLead |
| GET | `/employees/{id}` | Get employee details | OperationsManager, Scheduler, Sales, Finance, ShiftLead |
| POST | `/employees/` | Create employee | OperationsManager (audited) |
| PUT | `/employees/{id}` | Update employee | OperationsManager, Scheduler (audited) |
| DELETE | `/employees/{id}` | Delete employee | OperationsManager (audited) |

**Clients** (Multiple roles)
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/clients/` | List clients (paginated, filtered) | OperationsManager, Scheduler, Sales, Finance |
| GET | `/clients/{id}` | Get client details | OperationsManager, Scheduler, Sales, Finance |
| POST | `/clients/` | Create client | Sales, OperationsManager (audited) |
| PUT | `/clients/{id}` | Update client | Sales, OperationsManager (audited) |
| DELETE | `/clients/{id}` | Delete client | Sales, OperationsManager (audited) |

**Audit Logs** (Admin, OperationsManager)
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/audit-logs/` | List audit logs (paginated, filtered) | Admin, OperationsManager |

**Shifts** (After P2 - placeholder)
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/shifts/` | List shifts | OperationsManager, Scheduler, ShiftLead, Guard (own only) |
| POST | `/shifts/` | Create shift | OperationsManager, Scheduler (audited) |
| PUT | `/shifts/{id}` | Update shift | OperationsManager, Scheduler (audited) |
| DELETE | `/shifts/{id}` | Delete shift | OperationsManager, Scheduler (audited) |

### Target Endpoints (After P1)

**Client Files**
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| POST | `/clients/{id}/files` | Upload file | Sales, OperationsManager |
| GET | `/clients/{id}/files` | List files | Sales, OperationsManager, Finance |
| GET | `/files/{id}` | Download file | Sales, OperationsManager, Finance |
| DELETE | `/files/{id}` | Delete file | Sales, OperationsManager |

**Employee Files & Certifications**
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| POST | `/employees/{id}/files` | Upload file | OperationsManager |
| GET | `/employees/{id}/files` | List files | OperationsManager, Scheduler |
| POST | `/employees/{id}/certifications` | Add certification | OperationsManager |
| PUT | `/employees/{id}/certifications/{cert_id}` | Update certification | OperationsManager |
| DELETE | `/employees/{id}/certifications/{cert_id}` | Delete certification | OperationsManager |

**Global Search**
| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/search?q={query}` | Search across resources | All authenticated users |

### Target Endpoints (After P2)

**Jobs/Events, Attendance, Invoices, Payments, Reports** - See P2 backlog for details.

---

## DETAILED BACKLOG

### P0 - Hardening (Critical Security & Reliability)

#### P0-1: Set up Staging Environment
**Priority:** Critical  
**Effort:** 2 hours  
**Dependencies:** None

**Acceptance Criteria:**
- [ ] Separate Railway service created for staging
- [ ] Separate PostgreSQL database created for staging
- [ ] Staging URL configured and accessible
- [ ] Environment variables documented in `STAGING_SETUP.md`
- [ ] Staging can be deployed independently from production
- [ ] Both environments use same codebase (environment-based config)

**Implementation Steps:**
1. Create new Railway service named `crm-yahalom-staging`
2. Create PostgreSQL database for staging
3. Set environment variables:
   - `ENVIRONMENT=staging`
   - `DATABASE_URL=<staging-postgres-url>`
   - `GOOGLE_CLIENT_ID=<same-as-prod>`
   - `SECRET_KEY=<different-from-prod>`
   - `FRONTEND_URL=https://crm-yahalom-staging.up.railway.app`
4. Create `STAGING_SETUP.md` with deployment instructions
5. Test deployment to staging

---

#### P0-2: Add JWT Authentication Middleware
**Priority:** Critical  
**Effort:** 3 hours  
**Dependencies:** None

**Acceptance Criteria:**
- [ ] `get_current_user()` dependency function created
- [ ] JWT token extracted from `Authorization: Bearer <token>` header
- [ ] Token verified and decoded
- [ ] User fetched from database
- [ ] Returns 401 if token missing/invalid/expired
- [ ] All endpoints except `/` and `/auth/google` require authentication
- [ ] Frontend sends JWT token in Authorization header

**Implementation Steps:**
1. Create `backend/auth.py` with:
   - `get_current_user(db: Session, token: str)` function
   - JWT decode and verification logic
   - Error handling for invalid tokens
2. Update `backend/main.py`:
   - Import `get_current_user`
   - Add `Depends(get_current_user)` to all protected endpoints
   - Create `HTTPBearer` security scheme
3. Update `frontend/src/api.js`:
   - Add axios interceptor to include `Authorization: Bearer <token>` header
   - Store JWT in localStorage after login
   - Handle 401 responses (redirect to login)
4. Test authentication flow

---

#### P0-3: Implement RBAC System
**Priority:** Critical  
**Effort:** 4 hours  
**Dependencies:** P0-2

**Acceptance Criteria:**
- [ ] Role enum defined: `Admin, OperationsManager, Scheduler, Sales, Finance, ShiftLead, Guard`
- [ ] Permission matrix documented in `RBAC_PERMISSIONS.md`
- [ ] `require_role()` decorator/dependency created
- [ ] Can check multiple roles (OR logic)
- [ ] Returns 403 if user role not authorized
- [ ] User model updated to use new role enum
- [ ] Migration created to update existing roles

**Roles & Permissions Matrix:**

| Resource | Admin | OperationsManager | Scheduler | Sales | Finance | ShiftLead | Guard |
|----------|-------|-------------------|-----------|-------|---------|-----------|-------|
| Users (read) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Users (write) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invites | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Employees (read) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Employees (write) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Clients (read) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Clients (write) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Shifts (read all) | ✅ | ✅ | ✅ | ❌ | ❌ | Own | Own |
| Shifts (write) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Audit Logs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invoices (read) | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Invoices (write) | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

**Implementation Steps:**
1. Create `backend/permissions.py`:
   - Define `Role` enum
   - Define permission matrix
   - Create `require_role(roles: list[Role])` dependency
2. Create Alembic migration to:
   - Add new role enum type (if PostgreSQL) or update string values
   - Migrate existing "admin" → "Admin", "manager" → "OperationsManager"
3. Update `backend/models.py`:
   - Update User.role to use enum
4. Create `RBAC_PERMISSIONS.md` documentation
5. Test role checks

---

#### P0-4: Enforce RBAC on All Endpoints
**Priority:** Critical  
**Effort:** 3 hours  
**Dependencies:** P0-3

**Acceptance Criteria:**
- [ ] All endpoints have appropriate role checks
- [ ] Returns 403 if unauthorized
- [ ] Role checks documented in endpoint docstrings
- [ ] All existing endpoints protected

**Implementation Steps:**
1. Update each endpoint in `backend/main.py`:
   - Add `require_role([...])` dependency
   - Document required roles in docstring
2. Test each endpoint with different roles
3. Verify 403 responses for unauthorized roles

---

#### P0-5: Add Email Allowlist/Invite System
**Priority:** Critical  
**Effort:** 3 hours  
**Dependencies:** P0-3

**Acceptance Criteria:**
- [ ] `user_invites` table created with migration
- [ ] Check allowlist before auto-creating users in `/auth/google`
- [ ] `POST /invites/` endpoint (Admin only)
- [ ] `GET /invites/` endpoint (Admin only)
- [ ] Invite expires after 7 days
- [ ] Unique token generated per invite
- [ ] Email sent notification (optional, can be manual for now)

**Implementation Steps:**
1. Create `UserInvite` model in `backend/models.py`
2. Create Alembic migration for `user_invites` table
3. Update `backend/crud.py`:
   - `create_invite()`, `get_invite_by_token()`, `get_invites()`
4. Update `/auth/google` endpoint:
   - Check if email exists in invites table
   - Check if invite not expired and not accepted
   - Use invite role if present
5. Create invite endpoints in `backend/main.py`
6. Test invite flow

---

#### P0-6: Add Request Validation
**Priority:** High  
**Effort:** 2 hours  
**Dependencies:** None

**Acceptance Criteria:**
- [ ] Phone number format validation (basic)
- [ ] ID number validation (length, format if applicable)
- [ ] Email validation (Pydantic built-in)
- [ ] String length limits enforced
- [ ] Business rules validated (end_time > start_time for shifts)
- [ ] Returns 422 with detailed error messages

**Implementation Steps:**
1. Create `backend/validators.py`:
   - Phone validator function
   - ID number validator
   - Business rule validators
2. Update Pydantic schemas in `backend/schemas.py`:
   - Add validators using `@validator` decorators
   - Add length constraints
3. Test validation errors

---

#### P0-7: Add AuditLog Table & Logging
**Priority:** Critical  
**Effort:** 4 hours  
**Dependencies:** P0-2

**Acceptance Criteria:**
- [ ] `audit_logs` table created with migration
- [ ] AuditLog model with all required fields
- [ ] Helper function `log_audit_event()` created
- [ ] Logged events:
   - User role changes
   - Employee create/update/delete
   - Client create/update/delete
   - Shift create/update/delete (when implemented)
- [ ] `GET /audit-logs/` endpoint (Admin, OperationsManager)
- [ ] Pagination and filtering on audit logs

**Implementation Steps:**
1. Create `AuditLog` model in `backend/models.py`
2. Create Alembic migration
3. Create `backend/audit.py`:
   - `log_audit_event()` helper function
4. Update endpoints to log audit events:
   - User role update
   - Employee CRUD
   - Client CRUD
5. Create `GET /audit-logs/` endpoint
6. Test audit logging

---

#### P0-8: Add Sentry Integration
**Priority:** High  
**Effort:** 1 hour  
**Dependencies:** None

**Acceptance Criteria:**
- [ ] Sentry SDK installed
- [ ] Sentry initialized in `main.py`
- [ ] Environment variable `SENTRY_DSN` configured
- [ ] Errors automatically sent to Sentry
- [ ] Environment tags (staging/production)

**Implementation Steps:**
1. Add `sentry-sdk` to `requirements.txt`
2. Initialize Sentry in `backend/main.py`
3. Configure environment variables
4. Test error reporting

---

#### P0-9: Add Structured Logging
**Priority:** High  
**Effort:** 2 hours  
**Dependencies:** P0-8

**Acceptance Criteria:**
- [ ] JSON formatted logs
- [ ] Correlation ID per request
- [ ] Request logging middleware logs: method, path, user, status, duration
- [ ] Sensitive fields redacted (passwords, tokens)

**Implementation Steps:**
1. Install `python-json-logger` or use structlog
2. Configure JSON logging in `backend/main.py`
3. Create middleware for:
   - Correlation ID generation
   - Request/response logging
   - Redaction of sensitive fields
4. Test logging output

---

#### P0-10: Add Health Endpoint
**Priority:** High  
**Effort:** 1 hour  
**Dependencies:** None

**Acceptance Criteria:**
- [ ] `GET /health` endpoint returns 200 OK
- [ ] Optionally checks database connection
- [ ] Returns simple JSON: `{"status": "healthy", "database": "connected"}`

**Implementation Steps:**
1. Create `GET /health` endpoint in `backend/main.py`
2. Add basic DB connection check
3. Test endpoint

---

#### P0-11: Add Pagination & Filtering
**Priority:** High  
**Effort:** 4 hours  
**Dependencies:** None

**Acceptance Criteria:**
- [ ] Max limit=100 enforced on all list endpoints
- [ ] Default limit=20 if not specified
- [ ] Search query parameter on employees/clients
- [ ] Filtering by status, role, etc.
- [ ] Response includes: `data`, `total`, `page`, `limit`, `has_next`, `has_prev`
- [ ] Frontend pagination UI on employees/clients pages

**Implementation Steps:**
1. Create `backend/pagination.py`:
   - `PaginatedResponse` schema
   - Helper function for pagination
2. Update `GET /employees/` and `GET /clients/`:
   - Add search parameter
   - Add filtering parameters
   - Return paginated response
3. Update frontend pages:
   - Add pagination controls
   - Add search input
   - Add filter dropdowns
4. Test pagination and filtering

---

#### P0-12: Add Rate Limiting
**Priority:** Medium  
**Effort:** 2 hours  
**Dependencies:** None

**Acceptance Criteria:**
- [ ] Rate limiting middleware installed (`slowapi`)
- [ ] `/auth/google` limited to 5 requests/minute per IP
- [ ] Write endpoints (POST, PUT, DELETE) limited to 100 requests/minute per user
- [ ] Returns 429 Too Many Requests with retry-after header

**Implementation Steps:**
1. Install `slowapi` package
2. Configure rate limiter in `backend/main.py`
3. Apply limits to endpoints
4. Test rate limiting

---

### P1 - CRM Features (After P0 Complete)

#### P1-1: Extend Client Model
**Priority:** High  
**Effort:** 3 hours

**Acceptance Criteria:**
- [ ] Client model extended with: email, notes (text field)
- [ ] Sites as JSON field or relationship table
- [ ] Contacts as JSON field or relationship table
- [ ] Migration created
- [ ] Frontend form updated

#### P1-2: Client File Attachments
**Priority:** High  
**Effort:** 6 hours

**Acceptance Criteria:**
- [ ] File storage integration (local or S3)
- [ ] Upload endpoint for client files
- [ ] Download endpoint for files
- [ ] File listing endpoint
- [ ] Frontend UI for upload/download
- [ ] File size limits enforced

#### P1-3: Extend Employee Model
**Priority:** High  
**Effort:** 4 hours

**Acceptance Criteria:**
- [ ] Employee model extended with:
   - Email field
   - Certifications (relationship table with expiry dates)
   - Availability schedule (JSON)
   - Base pay (decimal)
- [ ] Migration created
- [ ] Frontend form updated

#### P1-4: Employee File Attachments
**Priority:** High  
**Effort:** 6 hours

**Acceptance Criteria:**
- [ ] Same as P1-2 but for employees
- [ ] Documents can be tagged (e.g., "ID Copy", "Contract", "Certificate")

#### P1-5: Global Search
**Priority:** Medium  
**Effort:** 4 hours

**Acceptance Criteria:**
- [ ] `GET /search?q={query}` endpoint
- [ ] Searches across: clients (name), employees (name, id_number), shifts
- [ ] Returns ranked results with resource type
- [ ] Frontend search bar in navbar
- [ ] Search results page

---

### P2 - Operations Features (After P1 Complete)

#### P2-1: Jobs/Events CRUD
**Priority:** High  
**Effort:** 6 hours

**Acceptance Criteria:**
- [ ] Jobs table with full CRUD
- [ ] Relationship to clients
- [ ] Status workflow
- [ ] Frontend UI

#### P2-2: Shifts Management
**Priority:** High  
**Effort:** 8 hours

**Acceptance Criteria:**
- [ ] Full CRUD for shifts
- [ ] Assign employees to shifts
- [ ] Conflict detection (double-booking)
- [ ] Frontend UI

#### P2-3: Assignments Calendar
**Priority:** High  
**Effort:** 12 hours

**Acceptance Criteria:**
- [ ] Calendar view of shifts
- [ ] Drag-drop assignment
- [ ] Visual conflict indicators
- [ ] Filtering by employee/client
- [ ] Month/week/day views

#### P2-4: Attendance System
**Priority:** High  
**Effort:** 8 hours

**Acceptance Criteria:**
- [ ] Clock in/out endpoints
- [ ] Approval workflow (ShiftLead/OperationsManager)
- [ ] Locking mechanism (prevents edits after lock)
- [ ] Frontend UI for guards and approvers

#### P2-5: Invoices & Payments
**Priority:** Medium  
**Effort:** 10 hours

**Acceptance Criteria:**
- [ ] Invoice generation from shifts
- [ ] Payment tracking
- [ ] Client association
- [ ] Status workflow
- [ ] Frontend UI

#### P2-6: Reports
**Priority:** Medium  
**Effort:** 10 hours

**Acceptance Criteria:**
- [ ] Dashboard with KPIs
- [ ] Employee hours report
- [ ] Client reports
- [ ] Export to CSV/PDF
- [ ] Date range filtering

---

## COMMIT STRATEGY

All changes will be committed incrementally with clear, descriptive messages:

**Commit Message Format:**
```
[P0-X] Brief description

Detailed description of what was changed and why.
Related to issue/task P0-X.
```

**Example Commits:**
- `[P0-2] Add JWT authentication middleware`
- `[P0-3] Implement RBAC system with role enum`
- `[P0-4] Enforce RBAC on employees endpoints`
- `[P0-7] Add AuditLog table and logging for employee CRUD`

**Branching Strategy:**
- `main` - Production (protected)
- `staging` - Staging environment
- `feature/P0-X-description` - Feature branches for P0 tasks

---

## TESTING STRATEGY

### Manual Testing Checklist (Per P0 Task)
- [ ] Test in staging environment first
- [ ] Test with different user roles
- [ ] Test error cases (invalid tokens, missing permissions)
- [ ] Test edge cases (empty data, large datasets)
- [ ] Verify audit logs are created
- [ ] Check Sentry for errors

### Automated Testing (Future)
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical flows

---

## DEPLOYMENT PROCESS

1. **Develop in feature branch**
2. **Test in local environment**
3. **Merge to `staging` branch → Auto-deploy to staging**
4. **Test in staging with real data**
5. **Merge to `main` branch → Auto-deploy to production**
6. **Monitor Sentry and logs**

---

## ROLLBACK PLAN

If issues occur in production:
1. Revert last commit in `main` branch
2. Railway will auto-deploy previous version
3. Investigate issue in staging
4. Fix and re-test before re-deploying

---

## NOTES

- All Hebrew text in UI must be replaced with English
- All database changes must go through Alembic migrations
- No direct database modifications in production
- Staging environment is required before P0-2 and beyond
- All P0 tasks are prerequisites for P1/P2

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Next Review:** After P0 completion
