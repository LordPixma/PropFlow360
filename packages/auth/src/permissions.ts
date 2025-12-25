export const PERMISSIONS = {
  // Properties
  'properties:read': 'View properties',
  'properties:write': 'Create/edit properties',
  'properties:delete': 'Delete properties',

  // Units
  'units:read': 'View units',
  'units:write': 'Create/edit units',
  'units:delete': 'Delete units',

  // Bookings
  'bookings:read': 'View bookings',
  'bookings:write': 'Create/edit bookings',
  'bookings:cancel': 'Cancel bookings',

  // Leases
  'leases:read': 'View leases',
  'leases:write': 'Create/edit leases',
  'leases:terminate': 'Terminate leases',

  // Finances
  'invoices:read': 'View invoices',
  'invoices:write': 'Create/edit invoices',
  'payments:read': 'View payments',
  'payments:refund': 'Issue refunds',
  'payouts:read': 'View payouts',
  'payouts:manage': 'Manage payouts',

  // Operations
  'maintenance:read': 'View maintenance tickets',
  'maintenance:write': 'Create/edit tickets',
  'maintenance:assign': 'Assign to vendors',
  'cleaning:read': 'View cleaning schedules',
  'cleaning:write': 'Manage cleaning schedules',

  // Calendar
  'calendar:read': 'View calendar',
  'calendar:write': 'Manage availability',

  // Reports
  'reports:read': 'View reports',
  'reports:export': 'Export reports',

  // Settings
  'tenant:settings': 'Manage tenant settings',
  'tenant:members': 'Manage team members',
  'tenant:billing': 'Manage billing',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: Object.keys(PERMISSIONS) as Permission[],

  manager: [
    'properties:read',
    'properties:write',
    'units:read',
    'units:write',
    'bookings:read',
    'bookings:write',
    'bookings:cancel',
    'leases:read',
    'leases:write',
    'invoices:read',
    'invoices:write',
    'payments:read',
    'maintenance:read',
    'maintenance:write',
    'maintenance:assign',
    'cleaning:read',
    'cleaning:write',
    'calendar:read',
    'calendar:write',
    'reports:read',
    'tenant:members',
  ],

  finance: [
    'properties:read',
    'units:read',
    'bookings:read',
    'leases:read',
    'invoices:read',
    'invoices:write',
    'payments:read',
    'payments:refund',
    'payouts:read',
    'payouts:manage',
    'reports:read',
    'reports:export',
    'tenant:billing',
  ],

  ops: [
    'properties:read',
    'units:read',
    'bookings:read',
    'maintenance:read',
    'maintenance:write',
    'maintenance:assign',
    'cleaning:read',
    'cleaning:write',
    'calendar:read',
    'calendar:write',
  ],

  readonly: [
    'properties:read',
    'units:read',
    'bookings:read',
    'leases:read',
    'invoices:read',
    'payments:read',
    'maintenance:read',
    'cleaning:read',
    'calendar:read',
    'reports:read',
  ],
};

export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(userPermissions: string[], required: Permission): boolean {
  return userPermissions.includes(required);
}

export function hasAllPermissions(userPermissions: string[], required: Permission[]): boolean {
  return required.every((p) => userPermissions.includes(p));
}

export function hasAnyPermission(userPermissions: string[], required: Permission[]): boolean {
  return required.some((p) => userPermissions.includes(p));
}
