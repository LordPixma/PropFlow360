export interface AccessTokenPayload {
  sub: string; // user_id
  email: string;
  name: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: string;
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

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTConfig {
  signingKey: string;
  accessTokenExpiry?: number; // seconds, default 15 min
  refreshTokenExpiry?: number; // seconds, default 7 days
}
