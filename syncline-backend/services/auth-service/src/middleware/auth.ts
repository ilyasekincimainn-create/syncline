import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, JwtOptions } from '@syncline/shared';
import * as fs from 'fs';
import * as path from 'path';

let jwtOptions: JwtOptions;

function getJwtOptions(): JwtOptions {
  if (jwtOptions) return jwtOptions;

  const algorithm = (process.env.JWT_ALGORITHM || 'HS256') as any;
  let privateKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
  let publicKeyOrSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';

  if (algorithm === 'RS256') {
    try {
      const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../../keys/private.pem');
      const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../../keys/public.pem');
      
      privateKeyOrSecret = fs.readFileSync(privateKeyPath, 'utf8');
      publicKeyOrSecret = fs.readFileSync(publicKeyPath, 'utf8');
    } catch (err) {
      console.warn('Could not read RS256 key files. Falling back to secret or throwing.', err);
    }
  }

  jwtOptions = {
    privateKeyOrSecret,
    publicKeyOrSecret,
    algorithm,
  };

  return jwtOptions;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Malformed token' });
    }

    const payload = verifyAccessToken(token, getJwtOptions());
    request.user = payload;
  } catch (err) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

// Extend fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user?: any;
  }
}
export { getJwtOptions };
