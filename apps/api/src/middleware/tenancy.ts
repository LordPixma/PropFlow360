import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { resolveTenantFromRequest } from '@propflow360/tenancy';
import { tenants } from '@propflow360/db/schema';
import type { AppEnv } from '../lib/context';
import { notFound, badRequest } from '../lib/responses';

const TENANT_CACHE_TTL = 300; // 5 minutes

export const tenancyMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const resolution = resolveTenantFromRequest(c);

  if (!resolution.slug) {
    // No tenant in request - this might be okay for some routes
    c.set('tenant', undefined);
    c.set('tenantId', undefined);
    await next();
    return;
  }

  const db = c.get('db');
  const cacheKey = `tenant:${resolution.slug}`;

  // Try cache first
  let tenant = await getCachedTenant(c.env.KV_CACHE, cacheKey);

  if (!tenant) {
    // Fetch from database
    tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, resolution.slug),
    });

    if (tenant) {
      // Cache for subsequent requests
      await cacheTenant(c.env.KV_CACHE, cacheKey, tenant);
    }
  }

  if (!tenant) {
    return notFound(c, 'Tenant');
  }

  if (tenant.status !== 'active') {
    return badRequest(c, `Tenant is ${tenant.status}`);
  }

  c.set('tenant', tenant);
  c.set('tenantId', tenant.id);

  await next();
});

export const requireTenant = createMiddleware<AppEnv>(async (c, next) => {
  const tenantId = c.get('tenantId');

  if (!tenantId) {
    return badRequest(c, 'Tenant context required for this operation');
  }

  await next();
});

export const requireTenantMatch = createMiddleware<AppEnv>(async (c, next) => {
  const session = c.get('session');
  const tenantId = c.get('tenantId');

  if (!session) {
    return badRequest(c, 'Authentication required');
  }

  if (!tenantId) {
    return badRequest(c, 'Tenant context required');
  }

  if (session.tenantId && session.tenantId !== tenantId) {
    return badRequest(c, 'Token tenant does not match request tenant');
  }

  await next();
});

async function getCachedTenant(kv: KVNamespace, key: string): Promise<any | null> {
  try {
    const cached = await kv.get(key, 'json');
    return cached;
  } catch {
    return null;
  }
}

async function cacheTenant(kv: KVNamespace, key: string, tenant: any): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(tenant), {
      expirationTtl: TENANT_CACHE_TTL,
    });
  } catch {
    // Ignore cache errors
  }
}
