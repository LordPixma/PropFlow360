import { ChakraProvider, ColorModeScript, extendTheme } from '@chakra-ui/react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from '@remix-run/react';
import type { LinksFunction, MetaFunction, LoaderFunctionArgs } from '@remix-run/cloudflare';

const DEFAULT_ENV = {
  API_URL: 'https://propflow360-api-dev.samuel-1e5.workers.dev',
};

export async function loader({ context }: LoaderFunctionArgs) {
  return {
    ENV: {
      API_URL: context.cloudflare?.env?.API_BASE_URL || DEFAULT_ENV.API_URL,
    },
  };
}

const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  colors: {
    brand: {
      50: '#e6f2ff',
      100: '#b3d9ff',
      200: '#80bfff',
      300: '#4da6ff',
      400: '#1a8cff',
      500: '#0073e6',
      600: '#005bb3',
      700: '#004280',
      800: '#002a4d',
      900: '#00111a',
    },
  },
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`,
  },
});

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

export const meta: MetaFunction = () => {
  return [
    { title: 'PropFlow360 - Property Management Platform' },
    {
      name: 'description',
      content: 'Multi-tenant property management platform for short, medium, and long-term lets.',
    },
  ];
};

export function Layout({ children }: { children: React.ReactNode }) {
  // Use useRouteLoaderData which returns undefined if loader hasn't run (e.g., in error boundaries)
  const data = useRouteLoaderData<typeof loader>('root');
  const env = data?.ENV || DEFAULT_ENV;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(env)}`,
          }}
        />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ChakraProvider theme={theme}>
      <Outlet />
    </ChakraProvider>
  );
}
