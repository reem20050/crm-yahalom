import { useAuthStore } from '../stores/authStore';

export type UserRole = 'admin' | 'manager' | 'employee';

// Permissions matrix: what each role can access
const permissions: Record<string, UserRole[]> = {
  // Navigation / Pages
  'page:dashboard': ['admin', 'manager', 'employee'],
  'page:leads': ['admin', 'manager'],
  'page:customers': ['admin', 'manager'],
  'page:employees': ['admin', 'manager'],
  'page:shifts': ['admin', 'manager', 'employee'],
  'page:calendar': ['admin', 'manager', 'employee'],
  'page:events': ['admin', 'manager', 'employee'],
  'page:incidents': ['admin', 'manager', 'employee'],
  'page:weapons': ['admin', 'manager', 'employee'],
  'page:invoices': ['admin', 'manager'],
  'page:reports': ['admin', 'manager'],
  'page:sites-map': ['admin', 'manager'],
  'page:guard-tracking': ['admin', 'manager'],
  'page:guard-panel': ['admin', 'manager', 'employee'],
  'page:open-shifts': ['admin', 'manager', 'employee'],
  'page:users': ['admin'],
  'page:settings': ['admin'],
  'page:profile': ['admin', 'manager', 'employee'],

  // Actions - Leads
  'leads:create': ['admin', 'manager'],
  'leads:edit': ['admin', 'manager'],
  'leads:delete': ['admin'],
  'leads:convert': ['admin', 'manager'],

  // Actions - Customers
  'customers:create': ['admin', 'manager'],
  'customers:edit': ['admin', 'manager'],
  'customers:delete': ['admin'],

  // Actions - Employees
  'employees:create': ['admin', 'manager'],
  'employees:edit': ['admin', 'manager'],
  'employees:delete': ['admin'],

  // Actions - Contractors
  'page:contractors': ['admin', 'manager'],
  'contractors:create': ['admin', 'manager'],
  'contractors:edit': ['admin', 'manager'],
  'contractors:delete': ['admin'],

  // Actions - Shifts
  'shifts:create': ['admin', 'manager'],
  'shifts:edit': ['admin', 'manager'],
  'shifts:delete': ['admin', 'manager'],
  'shifts:assign': ['admin', 'manager'],
  'shifts:checkin': ['admin', 'manager', 'employee'],

  // Actions - Events
  'events:create': ['admin', 'manager'],
  'events:edit': ['admin', 'manager'],
  'events:delete': ['admin', 'manager'],
  'events:assign': ['admin', 'manager'],

  // Actions - Incidents
  'incidents:create': ['admin', 'manager', 'employee'],
  'incidents:edit': ['admin', 'manager'],
  'incidents:resolve': ['admin', 'manager'],

  // Actions - Invoices
  'invoices:create': ['admin', 'manager'],
  'invoices:edit': ['admin', 'manager'],
  'invoices:delete': ['admin'],
  'invoices:status': ['admin', 'manager'],

  // Actions - Weapons & Equipment
  'weapons:manage': ['admin', 'manager'],
  'equipment:manage': ['admin', 'manager'],

  // Actions - Reports
  'reports:view': ['admin', 'manager'],
  'reports:export': ['admin', 'manager'],

  // Actions - Users
  'users:manage': ['admin'],

  // Actions - Settings
  'settings:manage': ['admin'],
};

export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const role = (user?.role || 'employee') as UserRole;

  const can = (permission: string): boolean => {
    const allowed = permissions[permission];
    if (!allowed) return false;
    return allowed.includes(role);
  };

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isEmployee = role === 'employee';

  return { can, role, isAdmin, isManager, isEmployee };
}

// Get allowed navigation items for a role
export function getNavigationForRole(role: UserRole): string[] {
  return Object.entries(permissions)
    .filter(([key, roles]) => key.startsWith('page:') && roles.includes(role))
    .map(([key]) => key.replace('page:', ''));
}
