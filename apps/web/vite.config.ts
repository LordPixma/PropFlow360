import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
  ],
  ssr: {
    resolve: {
      conditions: ['workerd', 'worker', 'browser'],
    },
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
  },
  build: {
    minify: true,
  },
});
