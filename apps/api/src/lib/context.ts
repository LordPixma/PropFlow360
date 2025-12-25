import type { Context } from 'hono';
import type { Env } from './bindings';
import type { Database } from '@propflow360/db';
import type { Tenant, TenantMembership } from '@propflow360/db/schema';

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: TenantMembership['role'];
  permissions: string[];
}

export interface AppContext {
  db: Database;
  session?: SessionData;
  tenant?: Tenant;
  tenantId?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    db: Database;
    session: SessionData | undefined;
    tenant: Tenant | undefined;
    tenantId: string | undefined;
  }
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppContext;
};

export type HonoContext = Context<AppEnv>;
