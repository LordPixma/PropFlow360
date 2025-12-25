import type { Context } from 'hono';

export interface TenantResolution {
  slug: string | null;
  source: 'subdomain' | 'path' | 'header' | 'session' | null;
}

const RESERVED_SUBDOMAINS = ['www', 'api', 'app', 'admin', 'dashboard', 'mail', 'docs'];

export function resolveTenantFromRequest(c: Context): TenantResolution {
  // 1. Check subdomain: {slug}.propflow360.com
  const host = c.req.header('host') ?? '';
  const subdomainMatch = host.match(/^([^.]+)\.(?:propflow360\.com|localhost:\d+)$/);
  if (subdomainMatch && !RESERVED_SUBDOMAINS.includes(subdomainMatch[1]!)) {
    return {
      slug: subdomainMatch[1]!,
      source: 'subdomain',
    };
  }

  // 2. Check path: /t/{slug}/...
  const pathMatch = c.req.path.match(/^\/t\/([^/]+)/);
  if (pathMatch) {
    return {
      slug: pathMatch[1]!,
      source: 'path',
    };
  }

  // 3. Check header: X-Tenant-Slug
  const headerSlug = c.req.header('X-Tenant-Slug');
  if (headerSlug) {
    return {
      slug: headerSlug,
      source: 'header',
    };
  }

  // 4. No tenant resolved
  return {
    slug: null,
    source: null,
  };
}

export function extractPathWithoutTenant(path: string): string {
  return path.replace(/^\/t\/[^/]+/, '') || '/';
}
