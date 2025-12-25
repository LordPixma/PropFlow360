import { eq, and, type SQL } from 'drizzle-orm';
import type { Database } from '@propflow360/db';

export interface TenantScopedTable {
  tenantId: any;
}

export function withTenantScope<T extends TenantScopedTable>(
  table: T,
  tenantId: string,
  additionalWhere?: SQL
): SQL {
  const tenantCondition = eq(table.tenantId, tenantId);

  if (additionalWhere) {
    return and(tenantCondition, additionalWhere)!;
  }

  return tenantCondition;
}

export class TenantScopedDb {
  constructor(
    private db: Database,
    private tenantId: string
  ) {}

  getTenantId(): string {
    return this.tenantId;
  }

  getDb(): Database {
    return this.db;
  }

  scopeWhere<T extends TenantScopedTable>(table: T, additionalWhere?: SQL): SQL {
    return withTenantScope(table, this.tenantId, additionalWhere);
  }
}

export function createTenantScopedDb(db: Database, tenantId: string): TenantScopedDb {
  return new TenantScopedDb(db, tenantId);
}
