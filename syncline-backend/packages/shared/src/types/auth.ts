/** JWT token pair returned after authentication */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/** JWT payload embedded in access tokens */
export interface AccessTokenPayload {
  sub: string;          // userId
  deviceId: string;
  platform: string;
  iat: number;
  exp: number;
  jti?: string;          // unique token ID
}

/** Refresh token stored in database */
export interface RefreshTokenRecord {
  id: string;
  userId: string;
  deviceId: string;
  tokenHash: string;
  familyId: string;     // for rotation tracking
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
  createdAt: Date;
}

/** Device registration request body */
export interface RegisterRequest {
  uuid: string;
  fingerprint: string;
  platform: 'android' | 'ios';
  pushToken: string;
  model: string;
  osVersion: string;
}

/** Device registration response */
export interface RegisterResponse {
  deviceId: string;
  tokens: TokenPair;
  pairCode: string;
}

/** Pairing request body */
export interface PairRequest {
  code: string;
}

/** Pairing response */
export interface PairResponse {
  userId: string;
  pairedDeviceId: string;
  pairedAt: string;
}

/** Token refresh request */
export interface RefreshRequest {
  refreshToken: string;
}

/** Logout request */
export interface LogoutRequest {
  refreshToken: string;
  allDevices?: boolean;
}
