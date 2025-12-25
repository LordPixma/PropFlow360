import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import {
  createJWTService,
  hashPassword,
  verifyPassword,
  getPermissionsForRole,
  generateSecureToken,
} from '@propflow360/auth';
import { loginSchema, registerSchema } from '@propflow360/validators';
import { users, sessions, refreshTokens, tenantMemberships, tenants } from '@propflow360/db/schema';
import type { AppEnv } from '../../lib/context';
import { success, created, badRequest, unauthorized, notFound } from '../../lib/responses';
import { authMiddleware } from '../../middleware/auth';

const auth = new Hono<AppEnv>();

// Register a new user
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name } = c.req.valid('json');
  const db = c.get('db');

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return badRequest(c, 'User with this email already exists');
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const userId = nanoid();

  await db.insert(users).values({
    id: userId,
    email,
    name,
    passwordHash,
  });

  // Create tokens
  const jwtService = createJWTService(c.env.JWT_SIGNING_KEY);
  const refreshTokenId = nanoid();
  const refreshTokenValue = generateSecureToken();

  const tokens = await jwtService.createTokenPair(
    {
      sub: userId,
      email,
      name,
    },
    refreshTokenId
  );

  // Store refresh token hash
  const refreshTokenHash = await hashTokenForStorage(refreshTokenValue);
  const refreshExpiry = new Date(Date.now() + jwtService.getRefreshTokenExpiry() * 1000);

  await db.insert(refreshTokens).values({
    id: refreshTokenId,
    userId,
    tokenHash: refreshTokenHash,
    expiresAt: refreshExpiry,
  });

  // Set refresh token cookie
  setCookie(c, 'refresh_token', refreshTokenValue, refreshExpiry);

  return created(c, {
    user: {
      id: userId,
      email,
      name,
    },
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
  });
});

// Login
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, tenantSlug } = c.req.valid('json');
  const db = c.get('db');

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return unauthorized(c, 'Invalid email or password');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return unauthorized(c, 'Invalid email or password');
  }

  // If tenant specified, verify membership
  let tenantId: string | undefined;
  let tenantSlugResolved: string | undefined;
  let role: string | undefined;
  let permissions: string[] = [];

  if (tenantSlug) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, tenantSlug),
    });

    if (!tenant) {
      return notFound(c, 'Tenant');
    }

    const membership = await db.query.tenantMemberships.findFirst({
      where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, user.id)),
    });

    if (!membership) {
      return unauthorized(c, 'You are not a member of this organization');
    }

    tenantId = tenant.id;
    tenantSlugResolved = tenant.slug;
    role = membership.role;
    permissions = getPermissionsForRole(membership.role);
  }

  // Create tokens
  const jwtService = createJWTService(c.env.JWT_SIGNING_KEY);
  const refreshTokenId = nanoid();
  const refreshTokenValue = generateSecureToken();

  const tokens = await jwtService.createTokenPair(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      tenantId,
      tenantSlug: tenantSlugResolved,
      role,
      permissions,
    },
    refreshTokenId
  );

  // Store refresh token hash
  const refreshTokenHash = await hashTokenForStorage(refreshTokenValue);
  const refreshExpiry = new Date(Date.now() + jwtService.getRefreshTokenExpiry() * 1000);

  await db.insert(refreshTokens).values({
    id: refreshTokenId,
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: refreshExpiry,
  });

  // Create session record
  await db.insert(sessions).values({
    id: nanoid(),
    userId: user.id,
    tenantId,
    userAgent: c.req.header('user-agent'),
    ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for'),
    expiresAt: refreshExpiry,
  });

  // Set refresh token cookie
  setCookie(c, 'refresh_token', refreshTokenValue, refreshExpiry);

  return success(c, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId,
      tenantSlug: tenantSlugResolved,
      role,
    },
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
  });
});

// Refresh token
auth.post('/refresh', async (c) => {
  const db = c.get('db');
  const cookieHeader = c.req.header('cookie');
  const refreshTokenValue = getCookieValue(cookieHeader, 'refresh_token');

  if (!refreshTokenValue) {
    return unauthorized(c, 'No refresh token provided');
  }

  const jwtService = createJWTService(c.env.JWT_SIGNING_KEY);
  const payload = await jwtService.verifyRefreshToken(refreshTokenValue);

  if (!payload) {
    clearCookie(c, 'refresh_token');
    return unauthorized(c, 'Invalid refresh token');
  }

  // Find the refresh token record
  const tokenHash = await hashTokenForStorage(refreshTokenValue);
  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.userId, payload.sub)),
  });

  if (!storedToken || storedToken.revokedAt) {
    clearCookie(c, 'refresh_token');
    return unauthorized(c, 'Refresh token has been revoked');
  }

  if (storedToken.expiresAt < new Date()) {
    clearCookie(c, 'refresh_token');
    return unauthorized(c, 'Refresh token has expired');
  }

  // Get user and tenant info
  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });

  if (!user) {
    clearCookie(c, 'refresh_token');
    return unauthorized(c, 'User not found');
  }

  // Revoke old token and create new one (token rotation)
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, storedToken.id));

  const newRefreshTokenId = nanoid();
  const newRefreshTokenValue = generateSecureToken();

  const tokens = await jwtService.createTokenPair(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    newRefreshTokenId
  );

  const newTokenHash = await hashTokenForStorage(newRefreshTokenValue);
  const refreshExpiry = new Date(Date.now() + jwtService.getRefreshTokenExpiry() * 1000);

  await db.insert(refreshTokens).values({
    id: newRefreshTokenId,
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt: refreshExpiry,
  });

  setCookie(c, 'refresh_token', newRefreshTokenValue, refreshExpiry);

  return success(c, {
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
  });
});

// Logout
auth.post('/logout', authMiddleware, async (c) => {
  const db = c.get('db');
  const session = c.get('session')!;
  const cookieHeader = c.req.header('cookie');
  const refreshTokenValue = getCookieValue(cookieHeader, 'refresh_token');

  // Revoke refresh token if present
  if (refreshTokenValue) {
    const tokenHash = await hashTokenForStorage(refreshTokenValue);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(refreshTokens.userId, session.userId)));
  }

  // Delete session
  await db.delete(sessions).where(eq(sessions.userId, session.userId));

  clearCookie(c, 'refresh_token');

  return success(c, { message: 'Logged out successfully' });
});

// Get current user
auth.get('/me', authMiddleware, async (c) => {
  const db = c.get('db');
  const session = c.get('session')!;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      emailVerified: true,
      mfaEnabled: true,
      createdAt: true,
    },
  });

  if (!user) {
    return notFound(c, 'User');
  }

  return success(c, {
    ...user,
    tenantId: session.tenantId,
    tenantSlug: session.tenantSlug,
    role: session.role,
    permissions: session.permissions,
  });
});

// Helper functions
async function hashTokenForStorage(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function setCookie(c: any, name: string, value: string, expires: Date) {
  c.header(
    'Set-Cookie',
    `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}`
  );
}

function clearCookie(c: any, name: string) {
  c.header('Set-Cookie', `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

export { auth };
