import { createCookieSessionStorage } from '@remix-run/cloudflare';
import type { AppLoadContext } from '@remix-run/cloudflare';

export interface SessionData {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    tenantId?: string;
    tenantSlug?: string;
    role?: string;
  };
  tenant?: {
    id: string;
    name: string;
  };
}

export interface SessionFlashData {
  error?: string;
  success?: string;
}

function createSessionStorage(context: AppLoadContext) {
  const sessionSecret = context.env?.SESSION_SECRET || 'propflow360-session-secret-change-in-production';

  return createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: '__session',
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'lax',
      secrets: [sessionSecret],
      secure: process.env.NODE_ENV === 'production',
    },
  });
}

export async function getSession(request: Request, context: AppLoadContext) {
  const storage = createSessionStorage(context);
  return storage.getSession(request.headers.get('Cookie'));
}

export async function commitSession(session: any, context: AppLoadContext) {
  const storage = createSessionStorage(context);
  return storage.commitSession(session);
}

export async function destroySession(session: any, context: AppLoadContext) {
  const storage = createSessionStorage(context);
  return storage.destroySession(session);
}
