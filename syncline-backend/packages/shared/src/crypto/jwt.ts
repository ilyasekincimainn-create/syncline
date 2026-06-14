import * as jwt from 'jsonwebtoken';
import { AccessTokenPayload } from '../types/auth';

export interface JwtOptions {
  privateKeyOrSecret: string;
  publicKeyOrSecret: string;
  algorithm: jwt.Algorithm;
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>,
  options: JwtOptions,
  expiresIn: jwt.SignOptions['expiresIn'] = '15m'
): string {
  return jwt.sign(payload, options.privateKeyOrSecret, {
    algorithm: options.algorithm,
    expiresIn,
  });
}

export function verifyAccessToken(
  token: string,
  options: JwtOptions
): AccessTokenPayload {
  return jwt.verify(token, options.publicKeyOrSecret, {
    algorithms: [options.algorithm],
  }) as AccessTokenPayload;
}

export function decodeToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.decode(token) as AccessTokenPayload;
  } catch {
    return null;
  }
}
