export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  tenantId?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}
