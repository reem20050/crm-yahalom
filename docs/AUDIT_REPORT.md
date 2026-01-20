# Security Company CRM - Phase 1 Audit Report

**Date:** 2024  
**Production URL:** https://crm-yahalom-production.up.railway.app  
**Purpose:** Repository audit to identify stack, routes, schema, and security/reliability gaps before implementing P0 hardening.

---

## 1. STACK IDENTIFICATION

### Backend
- **Framework:** FastAPI (Python)
- **ORM:** SQLAlchemy
- **Database:** SQLite (`crm.db`)
- **Authentication:** Google OAuth 2.0 (via `google-auth`) + JWT tokens (`python-jose`)
- **Password Hashing:** Passlib with bcrypt (present but not actively used; Google Auth is primary)
- **API Validation:** Pydantic schemas
- **Server:** Uvicorn (inferred from requirements)

### Frontend
- **Framework:** React 19.2.0
- **Build Tool:** Vite 7.2.4
- **Routing:** React Router DOM 7.1.3
- **HTTP Client:** Axios 1.7.9
- **No UI Framework:** Custom CSS with CSS variables

### Infrastructure
- **Deployment:** Railway (production)
- **Database:** SQLite (file-based, **CRITICAL ISSUE for production**)

---

## 2. CURRENT ROUTES & API ENDPOINTS

### Backend API Endpoints (`/backend/main.py`)

| Method | Endpoint | Description | Auth Required? | Auth Enforced? |
|--------|----------|-------------|----------------|----------------|
| GET | `/` | Welcome message | ❌ | ❌ |
| POST | `/auth/google` | Google OAuth login | ❌ | ❌ (creates user if missing) |
| GET | `/employees/` | List employees | ❌ | ❌ **CRITICAL** |
| POST | `/employees/` | Create employee | ❌ | ❌ **CRITICAL** |
| GET | `/clients/` | List clients | ❌ | ❌ **CRITICAL** |
| POST | `/clients/` | Create client | ❌ | ❌ **CRITICAL** |

### Frontend Routes (`/frontend/src/App.jsx`)

| Route | Component | Auth Protected? |
|-------|-----------|-----------------|
| `/` | Dashboard | ❌ |
| `/employees` | Employees | ❌ |
| `/clients` | Clients | ❌ |

**Missing Frontend Pages:**
- No `/users` page (mentioned in user requirements but not implemented)
- No authentication/login page visible in routing
- No protected route wrapper

---

## 3. DATABASE SCHEMA & RELATIONSHIPS

### Tables Identified (`/backend/models.py`)

#### `users`
- `id` (PK, Integer)
- `username` (String, unique, nullable)
- `email` (String, unique, indexed)
- `hashed_password` (String, nullable - for Google Auth users)
- `role` (String, default="admin") - **LIMITED ROLES: only "admin", "manager"**
- Relationships:
  - `tasks_assigned` → `Task` (foreign key: `assigned_to`)
  - `tasks_created` → `Task` (foreign key: `created_by`)
  - `notifications` → `Notification` (foreign key: `user_id`)

#### `employees`
- `id` (PK, Integer)
- `first_name` (String, indexed)
- `last_name` (String, indexed)
- `id_number` (String, unique, indexed)
- `phone` (String)
- `role` (String, default="guard") - **Values: "guard", "shift_manager"**
- `start_date` (DateTime, default=now)
- `is_active` (Boolean, default=True)
- Relationships:
  - `shifts` → `Shift` (foreign key: `employee_id`)

#### `clients`
- `id` (PK, Integer)
- `name` (String, unique, indexed)
- `address` (String, nullable)
- `contact_person` (String, nullable)
- `contact_phone` (String, nullable)
- Relationships:
  - `shifts` → `Shift` (foreign key: `client_id`)

#### `shifts`
- `id` (PK, Integer)
- `employee_id` (FK → `employees.id`, NOT NULL)
- `client_id` (FK → `clients.id`, nullable)
- `start_time` (DateTime, NOT NULL)
- `end_time` (DateTime, NOT NULL)
- `status` (String, default="scheduled") - **Values: "scheduled", "completed", "canceled"**
- `notes` (String, nullable)
- `created_at` (DateTime, default=now)
- Relationships:
  - `employee` → `Employee`
  - `client` → `Client`

#### `tasks`
- `id` (PK, Integer)
- `title` (String, NOT NULL)
- `description` (String, nullable)
- `assigned_to` (FK → `users.id`, nullable)
- `created_by` (FK → `users.id`, nullable)
- `due_date` (DateTime, nullable)
- `status` (String, default="open") - **Values: "open", "in_progress", "done"**
- `priority` (String, default="normal") - **Values: "low", "normal", "high"**
- `created_at` (DateTime, default=now)
- Relationships:
  - `assigned_user` → `User`
  - `creator` → `User`

#### `notifications`
- `id` (PK, Integer)
- `user_id` (FK → `users.id`, NOT NULL)
- `title` (String, NOT NULL)
- `message` (String, NOT NULL)
- `notif_type` (String, default="info") - **Values: "info", "warning", "success"**
- `is_read` (Boolean, default=False)
- `created_at` (DateTime, default=now)
- Relationships:
  - `user` → `User`

### Schema Issues
1. **No AuditLog table** - Required for P0
2. **No email allowlist/invite table** - Required for P0
3. **Limited user roles** - Only "admin", "manager" (need: Admin, OperationsManager, Scheduler, Sales, Finance, ShiftLead, Guard)
4. **No migrations system** - Using `Base.metadata.create_all()` which is unsafe for production
5. **SQLite in production** - Should use PostgreSQL on Railway
6. **No soft deletes** - No `deleted_at` columns
7. **Missing indexes** - Some foreign keys and commonly queried fields lack indexes
8. **No timestamps on User table** - Missing `created_at`, `updated_at`

---

## 4. SECURITY GAPS

### Authentication & Authorization
1. **🔴 CRITICAL: No JWT token verification on protected endpoints**
   - All endpoints (`/employees/`, `/clients/`) are publicly accessible
   - No `get_current_user` dependency function
   - JWT tokens are created but never verified on API calls
   - Frontend API client (`api.js`) doesn't send Authorization headers

2. **🔴 CRITICAL: No RBAC enforcement**
   - No role-based access control checks anywhere
   - Any authenticated user can perform any action
   - Role is stored in JWT but not checked

3. **🔴 CRITICAL: Auto-user creation on Google login**
   - `/auth/google` creates new users automatically without allowlist check
   - Any Google account can gain access (line 96-97 in `main.py`)

4. **🔴 CRITICAL: Missing email allowlist/invite flow**
   - No mechanism to restrict access to approved emails only

5. **🟡 MEDIUM: Weak default role**
   - New users default to "admin" role (line 20 in `crud.py`)
   - Should default to lowest privilege or require manual assignment

6. **🟡 MEDIUM: Long-lived tokens**
   - JWT tokens expire in 24 hours (line 34 in `main.py`)
   - No refresh token mechanism

7. **🟡 MEDIUM: CORS too permissive**
   - Only allows localhost origins (line 24 in `main.py`)
   - Production Railway URL not in allowlist

### Input Validation
8. **🔴 CRITICAL: No request validation beyond Pydantic schemas**
   - Pydantic validates types, but:
     - No business logic validation (e.g., id_number format, phone format)
     - No unique constraint checks before creation (relies on DB exception)
     - No length limits enforced
     - No SQL injection protection beyond SQLAlchemy ORM (should be sufficient, but no tests)

9. **🟡 MEDIUM: Missing validation on update operations**
   - No PUT/PATCH endpoints exist, but when added, need validation

### Session & Cookies
10. **🟡 MEDIUM: JWT stored client-side only**
    - No httpOnly cookies for tokens
    - Vulnerable to XSS attacks if token storage is compromised
    - No token revocation mechanism

### Rate Limiting
11. **🔴 CRITICAL: No rate limiting**
    - `/auth/google` endpoint vulnerable to brute force
    - All endpoints vulnerable to DDoS

### Data Exposure
12. **🟡 MEDIUM: Sensitive data in responses**
    - Employee `id_number` exposed in API responses
    - No field-level access control

---

## 5. RELIABILITY GAPS

### Logging
1. **🟡 MEDIUM: Basic logging only**
   - Using Python `logging` module with INFO level
   - No structured logging (JSON format)
   - No log aggregation (Sentry missing)
   - No correlation IDs for request tracking

### Error Handling
2. **🟡 MEDIUM: Basic error handling**
   - Generic HTTPException usage
   - No centralized error handler
   - Error messages may leak internal details
   - No error tracking/monitoring

3. **🔴 CRITICAL: Database exceptions not handled gracefully**
   - Unique constraint violations will return 500 instead of 400

### Database Migrations
4. **🔴 CRITICAL: No migration system**
   - Using `Base.metadata.create_all()` (line 18 in `main.py`)
   - Will fail on schema changes in production
   - No Alembic or other migration tool

5. **🔴 CRITICAL: SQLite in production**
   - SQLite is file-based, not suitable for Railway/cloud
   - No connection pooling
   - Concurrent write issues
   - Should migrate to PostgreSQL

### Backups
6. **🔴 CRITICAL: No backup strategy visible**
   - SQLite file backup not configured
   - No automated backups

### Database Indexing
7. **🟡 MEDIUM: Missing indexes**
   - Foreign keys have indexes (SQLAlchemy default)
   - But commonly queried fields like `employees.is_active`, `shifts.status`, `shifts.start_time` lack indexes
   - Will impact performance as data grows

### Health & Monitoring
8. **🔴 CRITICAL: No health endpoint**
   - No `/health` endpoint for Railway/liveness checks

9. **🔴 CRITICAL: No monitoring**
   - No Sentry integration
   - No application performance monitoring (APM)

### Pagination & Filtering
10. **🟡 MEDIUM: Basic pagination only**
    - `skip` and `limit` parameters exist but:
      - No default limits enforced
      - No maximum limit cap
      - No filtering/search capability
      - Frontend fetches all records (no pagination UI)

### Database Connection Management
11. **🟢 LOW: Basic connection management**
    - `SessionLocal` properly managed with context managers
    - But SQLite doesn't benefit from connection pooling

---

## 6. CONCRETE FIXES PRIORITIZED

### P0 - Critical Security (Must Fix Before Production Changes)

1. **Add JWT token verification middleware/dependency**
   - Create `get_current_user()` dependency
   - Verify JWT on all protected endpoints
   - Return 401 if invalid/missing token

2. **Implement RBAC enforcement**
   - Create role-based permission system
   - Define permissions for each role:
     - Admin: full access
     - OperationsManager: manage shifts, employees, clients
     - Scheduler: read employees/clients, create/edit shifts
     - Sales: read/write clients only
     - Finance: read all, write invoices/payments
     - ShiftLead: read assigned shifts, update attendance
     - Guard: read own shifts only
   - Add `require_role()` or `require_permission()` decorators

3. **Add email allowlist/invite system**
   - Create `user_invites` or `allowed_emails` table
   - Check allowlist before auto-creating users
   - Add invite generation endpoint (Admin only)

4. **Add request validation**
   - Add length limits, format validation (phone, email, id_number)
   - Validate business rules (end_time > start_time, etc.)
   - Return 422 with detailed errors

5. **Add rate limiting**
   - Use `slowapi` or similar
   - Rate limit `/auth/google` (5/min per IP)
   - Rate limit write endpoints (100/min per user)

6. **Add health endpoint**
   - `/health` returning 200 OK
   - Optionally check DB connection

7. **Add Sentry + structured logging**
   - Install `sentry-sdk`
   - Configure structured JSON logging
   - Add correlation IDs

8. **Add pagination with limits**
   - Enforce max `limit=100`
   - Add filtering to employees/clients endpoints
   - Add search query parameter

9. **Add AuditLog table**
   - Log: user role changes, CRUD on clients/employees, shift creation/updates
   - Fields: user_id, action, resource_type, resource_id, old_value, new_value, timestamp, ip_address

### P1 - Database & Infrastructure

10. **Set up Alembic migrations**
    - Initialize Alembic
    - Create initial migration from current schema
    - Document migration process

11. **Migrate to PostgreSQL**
    - Update `DATABASE_URL` to use PostgreSQL
    - Test locally with PostgreSQL
    - Update Railway config

12. **Add missing indexes**
    - `employees.is_active`
    - `shifts.status`, `shifts.start_time`, `shifts.end_time`
    - `clients.name` (already has unique index)
    - `audit_logs.user_id`, `audit_logs.resource_type`, `audit_logs.created_at`

13. **Add timestamps to all tables**
    - `created_at`, `updated_at` on all tables
    - Auto-update `updated_at` on changes

### P2 - Additional Hardening

14. **Improve CORS configuration**
    - Add production frontend URL to allowlist
    - Make it environment-based

15. **Add centralized error handler**
    - Custom exception classes
    - Standardized error responses
    - Log errors to Sentry

16. **Add soft deletes**
    - `deleted_at` column on all main tables
    - Filter deleted records in queries
    - Restore endpoint (Admin only)

17. **Implement refresh tokens**
    - Shorter access token (15 min)
    - Longer refresh token (7 days)
    - Refresh endpoint

18. **Add request/response logging middleware**
    - Log all requests with user, method, path, status
    - Redact sensitive fields (passwords, tokens)

---

## 7. ARCHITECTURE SUMMARY

### Current Architecture
```
┌─────────────┐      HTTP/HTTPS       ┌─────────────┐
│   Browser   │ ────────────────────> │   Railway   │
│  (React)    │ <──────────────────── │  (FastAPI)  │
└─────────────┘      JWT Token        └─────────────┘
                                              │
                                              │ SQLAlchemy ORM
                                              ▼
                                      ┌─────────────┐
                                      │   SQLite    │
                                      │  (crm.db)   │
                                      └─────────────┘

Auth Flow:
1. User logs in via Google OAuth (frontend)
2. Frontend sends Google token to `/auth/google`
3. Backend verifies token, creates/finds user
4. Backend returns JWT (stored client-side, NOT sent on subsequent requests ❌)
5. All API calls are unauthenticated ❌
```

### Recommended Architecture
```
┌─────────────┐      HTTP/HTTPS       ┌─────────────┐
│   Browser   │ ────────────────────> │   Railway   │
│  (React)    │ <──────────────────── │  (FastAPI)  │
└─────────────┘   JWT in Header       └─────────────┘
      │                                      │
      │ Axios Interceptor                    │ SQLAlchemy ORM
      │ (adds Authorization)                 ▼
      │                              ┌─────────────┐
      └────────────────────────────> │  PostgreSQL │
         JWT from localStorage       │  (Railway)  │
                                     └─────────────┘

Auth Flow (Fixed):
1. User logs in via Google OAuth
2. Backend verifies token, checks email allowlist
3. Backend returns JWT
4. Frontend stores JWT in localStorage
5. Axios interceptor adds `Authorization: Bearer <token>` to all requests
6. Backend `get_current_user()` dependency verifies JWT
7. RBAC checks enforce permissions
8. AuditLog records all write actions
```

---

## 8. ERD SUMMARY

### Current Entity Relationships

```
users (1) ──────< (N) tasks [assigned_to]
users (1) ──────< (N) tasks [created_by]
users (1) ──────< (N) notifications

employees (1) ───< (N) shifts
clients (1) ─────< (N) shifts
```

### Required Additions for P0

```
users (1) ──────< (N) audit_logs
user_invites (standalone, no FK to users initially)
```

### Entity Cardinality Details

- **User** → **Task**: One user can be assigned many tasks, one task assigned to one user
- **User** → **Task** (creator): One user can create many tasks, one task created by one user
- **User** → **Notification**: One user has many notifications, one notification belongs to one user
- **Employee** → **Shift**: One employee can have many shifts, one shift belongs to one employee
- **Client** → **Shift**: One client can have many shifts, one shift belongs to one client

---

## 9. ENDPOINT LIST (Current + Planned)

### Current Endpoints
- `GET /` - Welcome (public)
- `POST /auth/google` - Google login (public, but should check allowlist)
- `GET /employees/` - List employees (public ❌)
- `POST /employees/` - Create employee (public ❌)
- `GET /clients/` - List clients (public ❌)
- `POST /clients/` - Create client (public ❌)

### Missing P0 Endpoints (To Add)
- `GET /health` - Health check (public)
- `GET /users/` - List users (Admin only)
- `PUT /users/{id}/role` - Update user role (Admin only, audited)
- `GET /audit-logs/` - View audit logs (Admin, OperationsManager)
- `POST /invites/` - Create invite (Admin only)
- `GET /invites/` - List invites (Admin only)
- `PUT /employees/{id}` - Update employee (OperationsManager, Scheduler)
- `DELETE /employees/{id}` - Delete employee (OperationsManager, audited)
- `PUT /clients/{id}` - Update client (Sales, OperationsManager)
- `DELETE /clients/{id}` - Delete client (Sales, OperationsManager, audited)

---

## 10. P0/P1/P2 BACKLOG

### P0 - Hardening (Critical Security & Reliability)

| ID | Task | Acceptance Criteria | Effort |
|----|------|---------------------|--------|
| P0-1 | Set up staging environment on Railway | Separate service + PostgreSQL DB created, documented in `STAGING_SETUP.md` | 2h |
| P0-2 | Add JWT authentication middleware | All endpoints except `/` and `/auth/google` require valid JWT, 401 if missing/invalid | 3h |
| P0-3 | Implement RBAC system | Role enum defined, `require_role()` decorator, permissions matrix documented | 4h |
| P0-4 | Enforce RBAC on all endpoints | Each endpoint checks user role, returns 403 if unauthorized | 3h |
| P0-5 | Add email allowlist/invite system | `user_invites` table, check before user creation, invite endpoint (Admin) | 3h |
| P0-6 | Add request validation | Pydantic validators for phone/id_number format, length limits, business rules | 2h |
| P0-7 | Add AuditLog table & logging | Table created, log role changes + CRUD on clients/employees, query endpoint | 4h |
| P0-8 | Add Sentry integration | SDK installed, errors logged, environment configured | 1h |
| P0-9 | Add structured logging | JSON logs with correlation IDs, request logging middleware | 2h |
| P0-10 | Add `/health` endpoint | Returns 200 OK, optionally checks DB connection | 1h |
| P0-11 | Add pagination & filtering | Max limit=100, search on employees/clients, frontend pagination UI | 4h |
| P0-12 | Add rate limiting | 5/min on auth, 100/min on write endpoints per IP/user | 2h |

**P0 Total Estimate: ~31 hours**

### P1 - CRM Features

| ID | Task | Acceptance Criteria | Effort |
|----|------|---------------------|--------|
| P1-1 | Extend Client model | Add fields: email, notes, site_addresses (JSON/relationship), contacts (JSON/relationship) | 3h |
| P1-2 | Client file attachments | Storage integration (S3/local), upload/download endpoints, UI | 6h |
| P1-3 | Extend Employee model | Add: certifications (with expiry), availability schedule, base_pay, documents | 4h |
| P1-4 | Employee file attachments | Storage integration, upload/download endpoints, UI | 6h |
| P1-5 | Global search | Search across clients, employees, shifts by name/ID, return ranked results | 4h |

**P1 Total Estimate: ~23 hours**

### P2 - Operations Features

| ID | Task | Acceptance Criteria | Effort |
|----|------|---------------------|--------|
| P2-1 | Jobs/Events CRUD | Full CRUD endpoints, relationship to clients, status workflow | 6h |
| P2-2 | Shifts management | Create/edit/delete shifts, assign employees, calendar view | 8h |
| P2-3 | Assignments calendar | Calendar UI showing shifts, drag-drop assignments, conflicts detection | 12h |
| P2-4 | Attendance system | Clock in/out, approvals workflow, locking mechanism | 8h |
| P2-5 | Invoices & Payments | Invoice generation, payment tracking, client association | 10h |
| P2-6 | Reports | Dashboard with KPIs, employee hours, client reports, export | 10h |

**P2 Total Estimate: ~54 hours**

---

## 11. NEXT STEPS

1. **Review this audit report** with stakeholders
2. **Approve P0 backlog** and prioritize
3. **Set up staging environment** (P0-1) first
4. **Begin P0 implementation** commit-by-commit:
   - Start with authentication (P0-2)
   - Then RBAC (P0-3, P0-4)
   - Then allowlist (P0-5)
   - Then validation & audit (P0-6, P0-7)
   - Then monitoring & reliability (P0-8, P0-9, P0-10)
   - Finally pagination & rate limiting (P0-11, P0-12)
5. **Test in staging** before production deployment
6. **Proceed to P1/P2** after P0 complete

---

## APPENDIX: Code Locations Reference

- **Backend main:** `backend/main.py`
- **Models:** `backend/models.py`
- **Schemas:** `backend/schemas.py`
- **CRUD:** `backend/crud.py`
- **Database config:** `backend/database.py`
- **Frontend app:** `frontend/src/App.jsx`
- **API client:** `frontend/src/api.js`
- **Pages:** `frontend/src/pages/`
