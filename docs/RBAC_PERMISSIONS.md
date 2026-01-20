# RBAC Permissions Matrix

This document describes the Role-Based Access Control (RBAC) system and permission matrix.

## Roles

1. **Admin** - Full system access
2. **OperationsManager** - Manage operations, employees, clients, shifts
3. **Scheduler** - Schedule shifts, view employees/clients, manage tasks
4. **Sales** - Manage clients only
5. **Finance** - View employees/clients, manage invoices/payments
6. **ShiftLead** - View and manage assigned shifts
7. **Guard** - View own shifts only

## Permission Matrix

| Resource | Action | Admin | OperationsManager | Scheduler | Sales | Finance | ShiftLead | Guard |
|----------|--------|-------|-------------------|-----------|-------|---------|-----------|-------|
| Users | Read | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Users | Write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Users | Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invites | Read | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invites | Write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invites | Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Allowed Emails | Read | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Allowed Emails | Write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Allowed Emails | Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Employees | Read | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Employees | Write | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Employees | Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Clients | Read | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Clients | Write | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Clients | Delete | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Shifts | Read (All) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Shifts | Read (Own/Assigned) | - | - | - | - | - | ✅ | ✅ |
| Shifts | Write | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Shifts | Delete | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tasks | Read (All) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tasks | Read (Assigned) | - | - | - | - | - | ✅ | ✅ |
| Tasks | Write | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Tasks | Delete | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Audit Logs | Read | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Audit Logs | Write | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Audit Logs | Delete | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invoices | Read | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Invoices | Write | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Invoices | Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Row-Level Access Control

In addition to resource-level permissions, some roles have row-level restrictions:

### Guard
- Can only read shifts where they are the assigned employee
- Can only read tasks assigned to them

### ShiftLead
- Can read shifts assigned to them or to guards they manage
- Can read tasks assigned to them
- Row-level filtering is applied in queries, not just endpoint checks

### Scheduler
- Can read all employees and clients, but cannot modify users
- Can create/edit/delete shifts
- Cannot delete employees

## Implementation Notes

- Permission checks are enforced at the endpoint level using `require_role()` or `require_permission()` dependencies
- Row-level filtering is applied in CRUD queries using helper functions in `data_access.py`
- All permission denials return HTTP 403 Forbidden
- Permission matrix is defined in `backend/permissions.py`

## Migration from Old Roles

Old roles were:
- `admin` → `Admin`
- `manager` → `OperationsManager`
- `user` → `Guard` (default)

Migration script should update existing roles during database migration.
