export type TenantPlan = 'starter' | 'professional' | 'enterprise';

export type TenantStatus = 'active' | 'suspended' | 'cancelled';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  timezone: string;
  currency: string;
  locale: string;
  checkInTime: string;
  checkOutTime: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    accentColor?: string;
  };
}

export type TenantRole = 'owner' | 'manager' | 'finance' | 'ops' | 'readonly';

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantRole;
  createdAt: Date;
}
