import { FastifyInstance } from 'fastify';
import {
  createDeviceCode,
  pollDeviceCode,
  validateAccessToken,
  revokeAccessToken,
  getUserTokens,
  getPendingAuthByUserCode,
  authorizeDeviceCode,
} from './cli.js';

/**
 * Register CLI authentication routes
 */
export function registerAuthRoutes(app: FastifyInstance) {
  /**
   * Start device code flow
   * CLI calls this to get a code to show the user
   */
  app.post('/api/auth/device', async (request, reply) => {
    const result = createDeviceCode();
    return reply.send(result);
  });

  /**
   * Poll for authorization
   * CLI polls this until the user authorizes
   */
  app.post('/api/auth/device/poll', async (request, reply) => {
    const { device_code } = request.body as { device_code: string };
    
    if (!device_code) {
      return reply.status(400).send({ error: 'device_code required' });
    }

    const result = pollDeviceCode(device_code);
    return reply.send(result);
  });

  /**
   * Validate a token
   * Used by API to check if a request is authenticated
   */
  app.get('/api/auth/validate', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ valid: false });
    }

    const token = authHeader.slice(7);
    const result = validateAccessToken(token);
    return reply.send(result);
  });

  /**
   * Revoke a token
   */
  app.delete('/api/auth/token', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.slice(7);
    const revoked = revokeAccessToken(token);
    return reply.send({ revoked });
  });

  /**
   * List user's tokens (requires user context from dashboard)
   */
  app.get('/api/auth/tokens', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const tokens = getUserTokens(userId);
    return reply.send({ tokens });
  });

  /**
   * Authorize a device code (called from dashboard)
   */
  app.post('/api/auth/device/authorize', async (request, reply) => {
    const { userCode, userId } = request.body as { userCode: string; userId: string };
    
    if (!userCode || !userId) {
      return reply.status(400).send({ error: 'userCode and userId required' });
    }

    const pending = getPendingAuthByUserCode(userCode);
    if (!pending) {
      return reply.status(400).send({ success: false, error: 'Invalid or expired code' });
    }

    const success = authorizeDeviceCode(pending.deviceCode, userId);
    if (!success) {
      return reply.status(400).send({ success: false, error: 'Authorization failed' });
    }

    return reply.send({ success: true });
  });
}
