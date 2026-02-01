import { nanoid } from 'nanoid';
import { env } from '../config.js';

/**
 * CLI authentication tokens stored in memory (use Redis in production)
 */
const pendingAuths = new Map<string, {
  deviceCode: string;
  userCode: string;
  expiresAt: number;
  userId?: string;
  status: 'pending' | 'authorized' | 'expired';
}>();

const accessTokens = new Map<string, {
  userId: string;
  createdAt: number;
}>();

/**
 * Generate a device code for CLI authentication
 * Similar to GitHub CLI / Vercel CLI flow
 */
export function createDeviceCode(): {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
} {
  const deviceCode = nanoid(32);
  const userCode = generateUserCode();
  const expiresIn = 900; // 15 minutes

  pendingAuths.set(deviceCode, {
    deviceCode,
    userCode,
    expiresAt: Date.now() + expiresIn * 1000,
    status: 'pending',
  });

  // Cleanup expired codes
  cleanupExpiredCodes();

  return {
    deviceCode,
    userCode,
    verificationUrl: `${env.dashboardUrl}/cli/authorize`,
    expiresIn,
  };
}

/**
 * Generate a human-readable user code (e.g., "ABCD-1234")
 */
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Get pending auth by user code (for the web UI)
 */
export function getPendingAuthByUserCode(userCode: string) {
  for (const [code, auth] of pendingAuths) {
    if (auth.userCode === userCode.toUpperCase() && auth.status === 'pending') {
      if (Date.now() > auth.expiresAt) {
        auth.status = 'expired';
        return null;
      }
      return auth;
    }
  }
  return null;
}

/**
 * Authorize a device code (called from web UI after user logs in)
 */
export function authorizeDeviceCode(deviceCode: string, userId: string): boolean {
  const auth = pendingAuths.get(deviceCode);
  if (!auth || auth.status !== 'pending') {
    return false;
  }
  if (Date.now() > auth.expiresAt) {
    auth.status = 'expired';
    return false;
  }
  
  auth.userId = userId;
  auth.status = 'authorized';
  return true;
}

/**
 * Poll for device code authorization (called from CLI)
 */
export function pollDeviceCode(deviceCode: string): {
  status: 'pending' | 'authorized' | 'expired';
  accessToken?: string;
} {
  const auth = pendingAuths.get(deviceCode);
  if (!auth) {
    return { status: 'expired' };
  }

  if (Date.now() > auth.expiresAt) {
    auth.status = 'expired';
    return { status: 'expired' };
  }

  if (auth.status === 'authorized' && auth.userId) {
    // Generate access token
    const accessToken = nanoid(64);
    accessTokens.set(accessToken, {
      userId: auth.userId,
      createdAt: Date.now(),
    });
    
    // Cleanup the pending auth
    pendingAuths.delete(deviceCode);
    
    return { status: 'authorized', accessToken };
  }

  return { status: auth.status };
}

/**
 * Validate an access token
 */
export function validateAccessToken(token: string): { valid: boolean; userId?: string } {
  const tokenData = accessTokens.get(token);
  if (!tokenData) {
    return { valid: false };
  }
  return { valid: true, userId: tokenData.userId };
}

/**
 * Revoke an access token
 */
export function revokeAccessToken(token: string): boolean {
  return accessTokens.delete(token);
}

/**
 * Get all tokens for a user
 */
export function getUserTokens(userId: string): Array<{ token: string; createdAt: number }> {
  const tokens: Array<{ token: string; createdAt: number }> = [];
  for (const [token, data] of accessTokens) {
    if (data.userId === userId) {
      tokens.push({ token: token.slice(0, 8) + '...', createdAt: data.createdAt });
    }
  }
  return tokens;
}

/**
 * Cleanup expired pending auths
 */
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [code, auth] of pendingAuths) {
    if (now > auth.expiresAt) {
      pendingAuths.delete(code);
    }
  }
}
