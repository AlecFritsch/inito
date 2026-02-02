import jwt from 'jsonwebtoken';
import { Octokit } from 'octokit';
import { env } from '../config.js';

/**
 * GitHub App authentication
 */

let appOctokit: Octokit | null = null;
const installationTokens: Map<number, { token: string; expiresAt: number }> = new Map();

/**
 * Generate a JWT for GitHub App authentication
 */
export function generateAppJWT(): string {
  if (!env.githubAppId || !env.githubPrivateKey) {
    throw new Error('GitHub App credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued 60 seconds ago to account for clock drift
    exp: now + 600, // Expires in 10 minutes
    iss: env.githubAppId
  };

  // Handle escaped newlines in private key
  const privateKey = env.githubPrivateKey.replace(/\\n/g, '\n');
  
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}

/**
 * Get Octokit instance authenticated as the GitHub App
 */
export function getAppOctokit(): Octokit {
  if (!appOctokit) {
    const token = generateAppJWT();
    appOctokit = new Octokit({ auth: token });
  }
  return appOctokit;
}

/**
 * Get an installation access token for a specific installation
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  // Check cache
  const cached = installationTokens.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  const app = getAppOctokit();
  const response = await app.rest.apps.createInstallationAccessToken({
    installation_id: installationId
  });

  const token = response.data.token;
  const expiresAt = new Date(response.data.expires_at).getTime();

  installationTokens.set(installationId, { token, expiresAt });

  return token;
}

/**
 * Get Octokit instance for a specific installation
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const token = await getInstallationToken(installationId);
  return new Octokit({ auth: token });
}

/**
 * Get Octokit using personal access token (for CLI mode)
 */
export function getTokenOctokit(): Octokit {
  if (!env.githubToken) {
    throw new Error('GITHUB_TOKEN is not set');
  }
  return new Octokit({ auth: env.githubToken });
}

/**
 * Get the appropriate Octokit instance
 * Uses installation token if available, otherwise falls back to personal token
 */
export async function getOctokit(installationId?: number): Promise<Octokit> {
  if (installationId) {
    return getInstallationOctokit(installationId);
  }
  return getTokenOctokit();
}

/**
 * Get installation ID for a repository
 */
export async function getInstallationId(owner: string, repo: string): Promise<number | null> {
  try {
    const app = getAppOctokit();
    const response = await app.rest.apps.getRepoInstallation({
      owner,
      repo
    });
    return response.data.id;
  } catch (error) {
    // App not installed on this repo
    return null;
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!env.githubWebhookSecret) {
    console.warn('GITHUB_WEBHOOK_SECRET not set, skipping signature verification');
    return true;
  }

  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', env.githubWebhookSecret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

/**
 * Parse repository owner and name from various formats
 */
export function parseRepo(repoInput: string): { owner: string; repo: string } {
  // Handle full URL: https://github.com/owner/repo
  if (repoInput.includes('github.com')) {
    const match = repoInput.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') };
    }
  }

  // Handle owner/repo format
  const parts = repoInput.split('/');
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }

  throw new Error(`Invalid repository format: ${repoInput}`);
}

/**
 * Parse issue URL to get owner, repo, and issue number
 */
export function parseIssueUrl(issueUrl: string): {
  owner: string;
  repo: string;
  issueNumber: number;
} {
  const match = issueUrl.match(
    /github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/
  );
  
  if (!match) {
    throw new Error(`Invalid issue URL: ${issueUrl}`);
  }

  return {
    owner: match[1],
    repo: match[2],
    issueNumber: parseInt(match[3], 10)
  };
}

/**
 * Get all installations of the GitHub App and their repositories
 */
export async function getAppInstallations(): Promise<Array<{
  installationId: number;
  account: string;
  repos: Array<{ id: number; fullName: string; owner: string; name: string }>;
}>> {
  try {
    const app = getAppOctokit();
    const installations = await app.rest.apps.listInstallations();
    
    const results = [];
    
    for (const installation of installations.data) {
      const installationOctokit = await getInstallationOctokit(installation.id);
      const reposResponse = await installationOctokit.rest.apps.listReposAccessibleToInstallation();
      
      results.push({
        installationId: installation.id,
        account: installation.account?.login || 'unknown',
        repos: reposResponse.data.repositories.map(repo => ({
          id: repo.id,
          fullName: repo.full_name,
          owner: repo.owner.login,
          name: repo.name
        }))
      });
    }
    
    return results;
  } catch (error) {
    console.error('Failed to get app installations:', error);
    return [];
  }
}