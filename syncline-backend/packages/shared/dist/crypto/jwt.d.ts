import * as jwt from 'jsonwebtoken';
import { AccessTokenPayload } from '../types/auth';
export interface JwtOptions {
    privateKeyOrSecret: string;
    publicKeyOrSecret: string;
    algorithm: jwt.Algorithm;
}
export declare function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>, options: JwtOptions, expiresIn?: jwt.SignOptions['expiresIn']): string;
export declare function verifyAccessToken(token: string, options: JwtOptions): AccessTokenPayload;
export declare function decodeToken(token: string): AccessTokenPayload | null;
//# sourceMappingURL=jwt.d.ts.map