import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { redirect } from '@remix-run/cloudflare';
import { destroySession, getSession } from '~/lib/session.server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  return redirect('/login');
}

export async function action({ request, context }: ActionFunctionArgs) {
  const session = await getSession(request, context);

  return redirect('/login', {
    headers: {
      'Set-Cookie': await destroySession(session, context),
    },
  });
}
