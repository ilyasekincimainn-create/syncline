import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../services/db';
import { getJwtOptions, authenticate } from '../middleware/auth';
import { signAccessToken } from '@syncline/shared';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export async function authRoutes(fastify: FastifyInstance) {
  
  // POST /register
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { uuid, fingerprint, platform, pushToken, model, osVersion } = request.body as any;

    if (!uuid || !fingerprint || !platform || !pushToken) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Missing required fields' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create or update device
      const deviceRes = await client.query(
        `INSERT INTO devices (uuid, platform, fingerprint, push_token, model, os_version, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (uuid) 
         DO UPDATE SET push_token = $4, fingerprint = $3, model = $5, os_version = $6, last_seen = CURRENT_TIMESTAMP
         RETURNING id, platform`,
        [uuid, platform, fingerprint, pushToken, model || 'Unknown', osVersion || 'Unknown']
      );

      const deviceId = deviceRes.rows[0].id;
      const devPlatform = deviceRes.rows[0].platform;

      let userId: string;
      let pairCode = '';

      if (devPlatform === 'android') {
        // Android device represents the core source. Ensure there is a user row.
        const userRes = await client.query(
          `SELECT id, pair_code FROM users WHERE android_device_id = $1`,
          [deviceId]
        );

        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
          pairCode = userRes.rows[0].pair_code;
        } else {
          // Generate 6 digit pairing code
          pairCode = Math.floor(100000 + Math.random() * 900000).toString();
          userId = uuidv4();
          await client.query(
            `INSERT INTO users (id, android_device_id, pair_code)
             VALUES ($1, $2, $3)`,
            [userId, deviceId, pairCode]
          );
        }
      } else {
        // iOS device doesn't have a user yet, or check if it's already paired
        const userRes = await client.query(
          `SELECT id FROM users WHERE ios_device_id = $1`,
          [deviceId]
        );

        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
        } else {
          // Stands alone until paired
          userId = uuidv4();
        }
      }

      // Generate initial tokens
      const jwtOpts = getJwtOptions();
      const accessToken = signAccessToken({ sub: userId, deviceId, platform: devPlatform }, jwtOpts);
      
      const refreshTokenValue = crypto.randomBytes(40).toString('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
      const familyId = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await client.query(
        `INSERT INTO refresh_tokens (user_id, device_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, deviceId, refreshTokenHash, familyId, expiresAt]
      );

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, device_id, action, details, ip_address)
         VALUES ($1, $2, 'device_register', $3, $4)`,
        [userId, deviceId, JSON.stringify({ platform: devPlatform }), request.ip]
      );

      await client.query('COMMIT');

      return reply.code(200).send({
        deviceId,
        userId,
        pairCode: devPlatform === 'android' ? pairCode : undefined,
        tokens: {
          accessToken,
          refreshToken: refreshTokenValue,
          expiresIn: 900, // 15 mins
          tokenType: 'Bearer'
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to register device' });
    } finally {
      client.release();
    }
  });

  // POST /pair
  // Triggered by iOS client to pair with an Android device using the 6-digit code
  fastify.post('/pair', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.body as any;
    const jwtUser = request.user; // { sub: userId, deviceId, platform }

    if (!code || !/^\d{6}$/.test(code)) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Invalid pairing code format' });
    }

    if (jwtUser.platform !== 'ios') {
      return reply.code(403).send({ error: 'Forbidden', message: 'Only iOS devices can pair via code' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find user/android device with this pairing code where iOS device is not yet paired
      const userRes = await client.query(
        `SELECT id, android_device_id, paired_at FROM users WHERE pair_code = $1`,
        [code]
      );

      if (userRes.rows.length === 0) {
        await client.query('COMMIT');
        return reply.code(404).send({ error: 'Not Found', message: 'Invalid pairing code' });
      }

      const userRow = userRes.rows[0];

      if (userRow.paired_at) {
        await client.query('COMMIT');
        return reply.code(400).send({ error: 'Bad Request', message: 'Pairing code already used' });
      }

      // Update the user record to link this iOS device
      await client.query(
        `UPDATE users 
         SET ios_device_id = $1, paired_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [jwtUser.deviceId, userRow.id]
      );

      // We should swap out the iOS device's current refresh token to associate with the new user_id
      // Clean up standalone tokens for this iOS device
      await client.query(
        `DELETE FROM refresh_tokens WHERE device_id = $1 AND user_id != $2`,
        [jwtUser.deviceId, userRow.id]
      );

      // Generate new tokens for the iOS device associated with the new unified user ID
      const jwtOpts = getJwtOptions();
      const accessToken = signAccessToken({ sub: userRow.id, deviceId: jwtUser.deviceId, platform: 'ios' }, jwtOpts);
      
      const refreshTokenValue = crypto.randomBytes(40).toString('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
      const familyId = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, device_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userRow.id, jwtUser.deviceId, refreshTokenHash, familyId, expiresAt]
      );

      // Audit logs
      await client.query(
        `INSERT INTO audit_logs (user_id, device_id, action, details, ip_address)
         VALUES ($1, $2, 'device_pair', $3, $4)`,
        [userRow.id, jwtUser.deviceId, JSON.stringify({ androidDeviceId: userRow.android_device_id }), request.ip]
      );

      await client.query('COMMIT');

      return reply.code(200).send({
        paired: true,
        userId: userRow.id,
        androidDeviceId: userRow.android_device_id,
        tokens: {
          accessToken,
          refreshToken: refreshTokenValue,
          expiresIn: 900,
          tokenType: 'Bearer'
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to pair device' });
    } finally {
      client.release();
    }
  });

  // POST /token/refresh
  fastify.post('/token/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as any;

    if (!refreshToken) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Missing refresh token' });
    }

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Look up token
      const tokenRes = await client.query(
        `SELECT id, user_id, device_id, family_id, expires_at, revoked_at, replaced_by_token_id 
         FROM refresh_tokens 
         WHERE token_hash = $1`,
        [refreshTokenHash]
      );

      if (tokenRes.rows.length === 0) {
        await client.query('COMMIT');
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid refresh token' });
      }

      const token = tokenRes.rows[0];

      // Detect reuse: if token is already revoked or replaced, revoke the whole family immediately
      if (token.revoked_at || token.replaced_by_token_id) {
        await client.query(
          `UPDATE refresh_tokens 
           SET revoked_at = CURRENT_TIMESTAMP 
           WHERE family_id = $1`,
          [token.family_id]
        );
        await client.query('COMMIT');
        return reply.code(401).send({ error: 'Unauthorized', message: 'Token reuse detected. All tokens revoked.' });
      }

      // Check expiry
      if (new Date() > new Date(token.expires_at)) {
        await client.query('COMMIT');
        return reply.code(401).send({ error: 'Unauthorized', message: 'Refresh token expired' });
      }

      // Load device platform
      const devRes = await client.query('SELECT platform FROM devices WHERE id = $1', [token.device_id]);
      if (devRes.rows.length === 0) {
        await client.query('COMMIT');
        return reply.code(401).send({ error: 'Unauthorized', message: 'Device not found' });
      }
      const platform = devRes.rows[0].platform;

      // Generate new tokens
      const jwtOpts = getJwtOptions();
      const newAccessToken = signAccessToken({ sub: token.user_id, deviceId: token.device_id, platform }, jwtOpts);
      
      const newRefreshTokenValue = crypto.randomBytes(40).toString('hex');
      const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshTokenValue).digest('hex');
      const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const newRecordId = uuidv4();

      // Invalidate current token and store new one
      await client.query(
        `UPDATE refresh_tokens 
         SET replaced_by_token_id = $1 
         WHERE id = $2`,
        [newRecordId, token.id]
      );

      await client.query(
        `INSERT INTO refresh_tokens (id, user_id, device_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newRecordId, token.user_id, token.device_id, newRefreshTokenHash, token.family_id, newExpiresAt]
      );

      await client.query('COMMIT');

      return reply.code(200).send({
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshTokenValue,
          expiresIn: 900,
          tokenType: 'Bearer'
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to refresh token' });
    } finally {
      client.release();
    }
  });

  // DELETE /logout
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as any;

    if (!refreshToken) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Missing refresh token' });
    }

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    try {
      const result = await pool.query(
        `UPDATE refresh_tokens 
         SET revoked_at = CURRENT_TIMESTAMP 
         WHERE token_hash = $1 
         RETURNING user_id, device_id`,
        [refreshTokenHash]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        await pool.query(
          `INSERT INTO audit_logs (user_id, device_id, action, ip_address)
           VALUES ($1, $2, 'logout', $3)`,
          [row.user_id, row.device_id, request.ip]
        );
      }

      return reply.code(200).send({ success: true });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal Server Error', message: 'Failed to log out' });
    }
  });
}
