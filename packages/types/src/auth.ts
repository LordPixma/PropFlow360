import type { TenantRole } from './tenant';

export interface AccessTokenPayload {
  sub: string; // user_id
  email: string;
  name: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: TenantRole;
  permissions?: string[];
  exp: number;
  iat: number;
}

export interface RefreshTokenPayload {
  sub: string; // user_id
  jti: string; // token id for revocation
  exp: number;
  iat: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: TenantRole;
  permissions: string[];
}
