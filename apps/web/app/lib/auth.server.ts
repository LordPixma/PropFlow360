import { redirect } from '@remix-run/cloudflare';
import type { AppLoadContext } from '@remix-run/cloudflare';
import { getSession } from './session.server';

export async function requireAuth(request: Request, context: AppLoadContext) {
  const session = await getSession(request, context);
  const user = session.get('user');
  const accessToken = session.get('accessToken');

  if (!user || !accessToken) {
    const url = new URL(request.url);
    throw redirect(`/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }

  return { user, accessToken };
}

export async function getOptionalAuth(request: Request, context: AppLoadContext) {
  const session = await getSession(request, context);
  const user = session.get('user');
  const accessToken = session.get('accessToken');

  if (!user || !accessToken) {
    return null;
  }

  return { user, accessToken };
}
