import * as jose from 'jose';
import type { AccessTokenPayload, RefreshTokenPayload, TokenPair, JWTConfig } from './types';

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

export class JWTService {
  private secret: Uint8Array;
  private accessTokenExpiry: number;
  private refreshTokenExpiry: number;

  constructor(config: JWTConfig) {
    this.secret = new TextEncoder().encode(config.signingKey);
    this.accessTokenExpiry = config.accessTokenExpiry ?? ACCESS_TOKEN_EXPIRY;
    this.refreshTokenExpiry = config.refreshTokenExpiry ?? REFRESH_TOKEN_EXPIRY;
  }

  async createAccessToken(payload: Omit<AccessTokenPayload, 'exp' | 'iat'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    return new jose.SignJWT({
      ...payload,
      iat: now,
      exp: now + this.accessTokenExpiry,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(`${this.accessTokenExpiry}s`)
      .sign(this.secret);
  }

  async createRefreshToken(userId: string, tokenId: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    return new jose.SignJWT({
      sub: userId,
      jti: tokenId,
      iat: now,
      exp: now + this.refreshTokenExpiry,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(`${this.refreshTokenExpiry}s`)
      .sign(this.secret);
  }

  async createTokenPair(
    accessPayload: Omit<AccessTokenPayload, 'exp' | 'iat'>,
    refreshTokenId: string
  ): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.createAccessToken(accessPayload),
      this.createRefreshToken(accessPayload.sub, refreshTokenId),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiry,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
      });
      return payload as unknown as AccessTokenPayload;
    } catch {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
      });
      return payload as unknown as RefreshTokenPayload;
    } catch {
      return null;
    }
  }

  async decodeToken<T>(token: string): Promise<T | null> {
    try {
      const decoded = jose.decodeJwt(token);
      return decoded as unknown as T;
    } catch {
      return null;
    }
  }

  getAccessTokenExpiry(): number {
    return this.accessTokenExpiry;
  }

  getRefreshTokenExpiry(): number {
    return this.refreshTokenExpiry;
  }
}

export function createJWTService(signingKey: string): JWTService {
  return new JWTService({ signingKey });
}
