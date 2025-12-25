import { createMiddleware } from 'hono/factory';
import { createJWTService, getPermissionsForRole, type Permission } from '@propflow360/auth';
import type { AppEnv, SessionData } from '../lib/context';
import { unauthorized, forbidden } from '../lib/responses';

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorized(c, 'Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const jwtService = createJWTService(c.env.JWT_SIGNING_KEY);
  const payload = await jwtService.verifyAccessToken(token);

  if (!payload) {
    return unauthorized(c, 'Invalid or expired token');
  }

  const session: SessionData = {
    userId: payload.sub,
    email: payload.email,
    name: payload.name,
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    role: payload.role as SessionData['role'],
    permissions: payload.permissions ?? [],
  };

  c.set('session', session);

  await next();
});

export const optionalAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const jwtService = createJWTService(c.env.JWT_SIGNING_KEY);
    const payload = await jwtService.verifyAccessToken(token);

    if (payload) {
      const session: SessionData = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        role: payload.role as SessionData['role'],
        permissions: payload.permissions ?? [],
      };
      c.set('session', session);
    }
  }

  await next();
});

export function requireAuth() {
  return authMiddleware;
}

export function requirePermission(...permissions: Permission[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const session = c.get('session');

    if (!session) {
      return unauthorized(c);
    }

    const hasAll = permissions.every((p) => session.permissions.includes(p));

    if (!hasAll) {
      return forbidden(c, 'Insufficient permissions');
    }

    await next();
  });
}

export function requireAnyPermission(...permissions: Permission[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const session = c.get('session');

    if (!session) {
      return unauthorized(c);
    }

    const hasAny = permissions.some((p) => session.permissions.includes(p));

    if (!hasAny) {
      return forbidden(c, 'Insufficient permissions');
    }

    await next();
  });
}

export function requireRole(...roles: string[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const session = c.get('session');

    if (!session) {
      return unauthorized(c);
    }

    if (!session.role || !roles.includes(session.role)) {
      return forbidden(c, 'Insufficient role');
    }

    await next();
  });
}
