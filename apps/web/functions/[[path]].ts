import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages';

// @ts-expect-error - virtual module from build
import * as build from '../build/server';

export const onRequest = createPagesFunctionHandler({
  build,
  getLoadContext: (context) => ({
    env: context.env,
  }),
});
