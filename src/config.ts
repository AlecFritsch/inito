import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';

// Load .env file
loadDotenv();

/**
 * Havoc configuration from .havoc.yaml
 */
export interface HavocConfig {
  version: number;
  max_iterations: number;
  timeout_minutes: number;
  test_command: string;
  min_confidence: number;
  min_test_pass_rate: number;
  allowed_commands: string[];
  protected_files: string[];
}

/**
 * Environment configuration
 */
export interface EnvConfig {
  port: number;
  host: string;
  geminiApiKey: string;
  githubAppId: string;
  githubPrivateKey: string;
  githubWebhookSecret: string;
  githubToken: string;
  // Database
  databaseUrl: string;
  // Redis
  redisUrl: string;
  redisHost: string;
  redisPort: number;
  // Sandbox
  sandboxImage: string;
  sandboxTimeout: number;
  workspaceDir: string;
  // Other
  logLevel: string;
  maxConcurrentRuns: number;
  // URLs
  apiUrl: string;
  dashboardUrl: string;
}

/**
 * Default .havoc.yaml configuration
 */
export const DEFAULT_HAVOC_CONFIG: HavocConfig = {
  version: 1,
  max_iterations: 50,
  timeout_minutes: 10,
  test_command: 'npm test',
  min_confidence: 70,
  min_test_pass_rate: 90,
  allowed_commands: [
    'git',
    'npm',
    'yarn',
    'pnpm',
    'node',
    'npx',
    'pytest',
    'python',
    'go',
    'cargo'
  ],
  protected_files: [
    '.env',
    '.env.*',
    '*.key',
    '*.pem',
    'secrets.*',
    '.git/**'
  ]
};

/**
 * Parse Redis URL into host and port
 */
function parseRedisUrl(url: string): { host: string; port: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

/**
 * Load environment configuration
 */
export function loadEnvConfig(): EnvConfig {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const { host: redisHost, port: redisPort } = parseRedisUrl(redisUrl);

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    githubAppId: process.env.GITHUB_APP_ID || '',
    githubPrivateKey: process.env.GITHUB_PRIVATE_KEY || '',
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
    githubToken: process.env.GITHUB_TOKEN || '',
    // Database
    databaseUrl: process.env.DATABASE_URL || 'postgres://havoc:havoc_secret@localhost:5432/havoc',
    // Redis
    redisUrl,
    redisHost,
    redisPort,
    // Sandbox
    sandboxImage: process.env.SANDBOX_IMAGE || 'havoc-sandbox',
    sandboxTimeout: parseInt(process.env.SANDBOX_TIMEOUT || '600000', 10),
    workspaceDir: process.env.WORKSPACE_DIR || './workspaces',
    // Other
    logLevel: process.env.LOG_LEVEL || 'info',
    maxConcurrentRuns: parseInt(process.env.MAX_CONCURRENT_RUNS || '3', 10),
    // URLs (default to production)
    apiUrl: process.env.API_URL || 'https://api.usehavoc.com',
    dashboardUrl: process.env.DASHBOARD_URL || 'https://usehavoc.com',
  };
}

/**
 * Load .havoc.yaml configuration from a repository directory
 */
export function loadHavocConfig(repoDir: string): HavocConfig {
  const configPaths = [
    join(repoDir, '.havoc.yaml'),
    join(repoDir, '.havoc.yml'),
    join(repoDir, 'havoc.yaml'),
    join(repoDir, 'havoc.yml')
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const parsed = parseYaml(content) as Partial<HavocConfig>;
        return {
          ...DEFAULT_HAVOC_CONFIG,
          ...parsed,
          // Merge arrays instead of replacing
          allowed_commands: [
            ...DEFAULT_HAVOC_CONFIG.allowed_commands,
            ...(parsed.allowed_commands || [])
          ],
          protected_files: [
            ...DEFAULT_HAVOC_CONFIG.protected_files,
            ...(parsed.protected_files || [])
          ]
        };
      } catch (error) {
        console.warn(`Failed to parse ${configPath}:`, error);
      }
    }
  }

  return DEFAULT_HAVOC_CONFIG;
}

/**
 * Detect test command based on repo contents
 */
export function detectTestCommand(repoDir: string): string {
  const packageJsonPath = join(repoDir, 'package.json');
  
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return 'npm test';
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check for other test frameworks
  if (existsSync(join(repoDir, 'pytest.ini')) || existsSync(join(repoDir, 'pyproject.toml'))) {
    return 'pytest';
  }
  
  if (existsSync(join(repoDir, 'go.mod'))) {
    return 'go test ./...';
  }
  
  if (existsSync(join(repoDir, 'Cargo.toml'))) {
    return 'cargo test';
  }

  return 'npm test';
}

/**
 * Check if a command is allowed
 */
export function isCommandAllowed(command: string, config: HavocConfig): boolean {
  const baseCommand = command.split(' ')[0];
  return config.allowed_commands.some(allowed => 
    baseCommand === allowed || baseCommand.startsWith(`${allowed} `)
  );
}

/**
 * Check if a file path is protected
 */
export function isFileProtected(filePath: string, config: HavocConfig): boolean {
  return config.protected_files.some(pattern => {
    // Simple glob matching
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      return regex.test(filePath);
    }
    return filePath === pattern || filePath.startsWith(pattern);
  });
}

// Global environment config instance
export const env = loadEnvConfig();
