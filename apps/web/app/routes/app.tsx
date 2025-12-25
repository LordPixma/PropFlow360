import { Outlet, useLoaderData } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { AppLayout } from '~/components/layout/AppLayout';
import { getSession } from '~/lib/session.server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const session = await getSession(request, context);
  const user = session.get('user');
  const tenant = session.get('tenant');

  if (!user) {
    const url = new URL(request.url);
    return redirect(`/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }

  return json({
    user,
    tenantName: tenant?.name || user.tenantSlug || 'My Organization',
  });
}

export default function AppRoute() {
  const { user, tenantName } = useLoaderData<typeof loader>();

  return (
    <AppLayout user={user} tenantName={tenantName}>
      <Outlet />
    </AppLayout>
  );
}
