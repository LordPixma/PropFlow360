/// <reference types="@remix-run/cloudflare" />
/// <reference types="vite/client" />

interface Env {
  API_BASE_URL: string;
  SESSION_SECRET: string;
}

declare module '@remix-run/cloudflare' {
  interface AppLoadContext {
    env: Env;
  }
}
