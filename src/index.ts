#!/usr/bin/env node

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { nanoid } from 'nanoid';
import { env } from './config.js';
import { initDatabase, getRun, getRecentRuns } from './db/index.js';
import { registerWebhookRoutes } from './github/webhooks.js';
import { registerAuthRoutes } from './auth/routes.js';
import { parseIssueUrl, getInstallationId } from './github/app.js';
import { getIssue } from './github/api.js';
import { runPipeline } from './pipeline.js';
import { checkDocker, checkSandboxImage } from './sandbox/manager.js';

/**
 * Start the Fastify server
 */
async function startServer() {
  const app = Fastify({
    logger: {
      level: env.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  });

  // Register CORS
  await app.register(cors, {
    origin: true
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register webhook routes
  registerWebhookRoutes(app);

  // Register auth routes
  registerAuthRoutes(app);

  // Manual run trigger endpoint
  app.post('/api/runs', async (request, reply) => {
    const body = request.body as {
      repo: string;
      issue_number: number;
      template?: 'bugfix' | 'feature' | 'refactor';
    };

    if (!body.repo || !body.issue_number) {
      return reply.status(400).send({ error: 'Missing repo or issue_number' });
    }
    
    // Template is optional, defaults to auto-detect based on issue content
    const template = body.template;

    const [owner, repo] = body.repo.split('/');
    if (!owner || !repo) {
      return reply.status(400).send({ error: 'Invalid repo format. Use owner/repo' });
    }

    const runId = nanoid();
    
    // Get issue details
    const installationId = await getInstallationId(owner, repo);
    const issue = await getIssue(owner, repo, body.issue_number, installationId || undefined);

    // Start pipeline in background
    runPipeline({
      runId,
      owner,
      repo,
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body,
      installationId: installationId || undefined
    }).catch(error => {
      console.error(`Pipeline error:`, error);
    });

    return reply.status(202).send({
      run_id: runId,
      status: 'started',
      message: 'Pipeline started'
    });
  });

  // Get run status endpoint
  app.get('/api/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await getRun(id);

    if (!run) {
      return reply.status(404).send({ error: 'Run not found' });
    }

    return {
      id: run.id,
      repo: run.repo,
      issue_number: run.issueNumber,
      status: run.status,
      confidence: run.confidence,
      pr_url: run.prUrl,
      pr_number: run.prNumber,
      error: run.error,
      started_at: run.startedAt,
      completed_at: run.completedAt
    };
  });

  // Get run intent card endpoint
  app.get('/api/runs/:id/intent-card', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await getRun(id);

    if (!run) {
      return reply.status(404).send({ error: 'Run not found' });
    }

    if (!run.intentCard) {
      return reply.status(404).send({ error: 'Intent card not yet generated' });
    }

    reply.header('Content-Type', 'text/markdown');
    return run.intentCard;
  });

  // List recent runs endpoint
  app.get('/api/runs', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const runs = await getRecentRuns(limit ? parseInt(limit, 10) : 20);

    return runs.map(run => ({
      id: run.id,
      repo: run.repo,
      issue_number: run.issueNumber,
      status: run.status,
      confidence: run.confidence,
      pr_url: run.prUrl,
      started_at: run.startedAt,
      completed_at: run.completedAt
    }));
  });

  // Initialize database
  initDatabase();

  // Start server
  try {
    await app.listen({ port: env.port, host: env.host });
    console.log(chalk.green(`\n🚀 Havoc server running on http://${env.host}:${env.port}\n`));
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

/**
 * CLI Commands
 */
const program = new Command();

program
  .name('havoc')
  .description('The Trust Layer for AI-Generated Code')
  .version('1.0.0');

// Server command
program
  .command('server')
  .description('Start the Havoc API server')
  .action(async () => {
    console.log(chalk.cyan('\n🌀 Havoc - The Trust Layer for AI-Generated Code\n'));
    
    // Check prerequisites
    const spinner = ora('Checking prerequisites...').start();
    
    const dockerOk = await checkDocker();
    if (!dockerOk) {
      spinner.fail('Docker is not running');
      console.log(chalk.red('\n❌ Please start Docker and try again\n'));
      process.exit(1);
    }
    
    const imageOk = await checkSandboxImage();
    if (!imageOk) {
      spinner.warn('Sandbox image not found');
      console.log(chalk.yellow('\n⚠️  Build the sandbox image first: docker build -t havoc-sandbox -f docker/Dockerfile.sandbox .\n'));
    }
    
    spinner.succeed('Prerequisites checked');
    
    await startServer();
  });

// Run command
program
  .command('run <issue-url>')
  .description('Run Havoc on a GitHub issue')
  .option('-v, --verbose', 'Verbose output')
  .action(async (issueUrl: string, options: { verbose?: boolean }) => {
    console.log(chalk.cyan('\n🌀 Havoc - The Trust Layer for AI-Generated Code\n'));
    
    // Parse issue URL
    let owner: string, repo: string, issueNumber: number;
    try {
      const parsed = parseIssueUrl(issueUrl);
      owner = parsed.owner;
      repo = parsed.repo;
      issueNumber = parsed.issueNumber;
    } catch (error) {
      console.log(chalk.red(`\n❌ Invalid issue URL: ${issueUrl}\n`));
      console.log('Expected format: https://github.com/owner/repo/issues/123\n');
      process.exit(1);
    }

    console.log(chalk.dim(`Repository: ${owner}/${repo}`));
    console.log(chalk.dim(`Issue: #${issueNumber}\n`));

    // Initialize database
    initDatabase();

    // Check prerequisites
    const spinner = ora('Checking prerequisites...').start();
    
    const dockerOk = await checkDocker();
    if (!dockerOk) {
      spinner.fail('Docker is not running');
      console.log(chalk.red('\n❌ Please start Docker and try again\n'));
      process.exit(1);
    }
    spinner.succeed('Docker is running');

    // Get issue details
    spinner.start('Fetching issue details...');
    const installationId = await getInstallationId(owner, repo);
    const issue = await getIssue(owner, repo, issueNumber, installationId || undefined);
    spinner.succeed(`Issue: ${issue.title}`);

    // Run pipeline
    const runId = nanoid();
    console.log(chalk.dim(`\nRun ID: ${runId}\n`));

    spinner.start('Running pipeline...');
    
    try {
      const result = await runPipeline({
        runId,
        owner,
        repo,
        issueNumber,
        issueTitle: issue.title,
        issueBody: issue.body,
        installationId: installationId || undefined
      });

      if (result.success) {
        spinner.succeed('Pipeline completed successfully');
        console.log(chalk.green(`\n✅ PR Created: ${result.prUrl}\n`));
        console.log(chalk.dim(`Confidence Score: ${result.confidenceScore}%`));
        console.log(chalk.dim(`Policy Gates: ${result.policyPassed ? 'PASSED' : 'FAILED'}\n`));
      } else {
        spinner.fail('Pipeline failed');
        console.log(chalk.red(`\n❌ Error: ${result.error}\n`));
        console.log(chalk.dim(`Confidence Score: ${result.confidenceScore}%`));
        console.log(chalk.dim(`Policy Gates: ${result.policyPassed ? 'PASSED' : 'FAILED'}\n`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Pipeline failed');
      console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : error}\n`));
      process.exit(1);
    }
  });

// Status command
program
  .command('status <run-id>')
  .description('Check the status of a run')
  .action(async (runId: string) => {
    initDatabase();
    
    const run = await getRun(runId);
    if (!run) {
      console.log(chalk.red(`\n❌ Run not found: ${runId}\n`));
      process.exit(1);
    }

    console.log(chalk.cyan('\n🌀 Havoc Run Status\n'));
    console.log(`Run ID:     ${run.id}`);
    console.log(`Repository: ${run.repo}`);
    console.log(`Issue:      #${run.issueNumber}`);
    console.log(`Status:     ${run.status}`);
    
    if (run.confidence !== null) {
      console.log(`Confidence: ${run.confidence}%`);
    }
    
    if (run.prUrl) {
      console.log(`PR:         ${run.prUrl}`);
    }
    
    if (run.error) {
      console.log(chalk.red(`Error:      ${run.error}`));
    }
    
    console.log('');
  });

// Init command - create .havoc.yaml template
program
  .command('init')
  .description('Create a .havoc.yaml configuration file')
  .action(async () => {
    const fs = await import('fs');
    
    const configContent = `# Havoc Configuration
# https://usehavoc.dev/docs/config

version: 1

# Maximum iterations for the agent
max_iterations: 50

# Timeout for the entire run (minutes)
timeout_minutes: 10

# Test command (auto-detected if not specified)
# test_command: npm test

# Minimum confidence score to create PR (0-100)
min_confidence: 70

# Minimum test pass rate to create PR (0-100)
min_test_pass_rate: 90

# Commands the agent is allowed to run
allowed_commands:
  - git
  - npm
  - yarn
  - pnpm
  - node
  - npx

# Files the agent should never modify
protected_files:
  - .env
  - .env.*
  - "*.key"
  - "*.pem"
  - secrets.*
`;

    if (fs.existsSync('.havoc.yaml')) {
      console.log(chalk.yellow('\n⚠️  .havoc.yaml already exists\n'));
      return;
    }

    fs.writeFileSync('.havoc.yaml', configContent);
    console.log(chalk.green('\n✅ Created .havoc.yaml\n'));
  });

// Login command - authenticate CLI with your account
program
  .command('login')
  .description('Log in to your Havoc account')
  .action(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const readline = await import('readline');

    console.log(chalk.cyan('\n🌀 Havoc CLI Login\n'));

    const configDir = path.join(os.homedir(), '.havoc');
    const tokenFile = path.join(configDir, 'token');

    // Check if already logged in
    if (fs.existsSync(tokenFile)) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise<string>((resolve) => {
        rl.question('Already logged in. Log in again? (y/N) ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log(chalk.dim('Cancelled.\n'));
        return;
      }
    }

    const spinner = ora('Requesting device code...').start();

    try {
      // Request device code from API
      const response = await fetch(`${env.apiUrl || 'http://localhost:3001'}/api/auth/device`, {
        method: 'POST',
      });
      const { deviceCode, userCode, verificationUrl } = await response.json() as any;

      spinner.stop();

      console.log(chalk.bold('Open this URL in your browser:\n'));
      console.log(chalk.cyan(`  ${verificationUrl}\n`));
      console.log(chalk.bold('Enter this code:\n'));
      console.log(chalk.yellow.bold(`  ${userCode}\n`));

      // Poll for authorization
      const pollSpinner = ora('Waiting for authorization...').start();
      
      let authorized = false;
      let accessToken = '';
      
      for (let i = 0; i < 60; i++) { // Poll for up to 5 minutes
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const pollResponse = await fetch(`${env.apiUrl || 'http://localhost:3001'}/api/auth/device/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code: deviceCode }),
        });
        const result = await pollResponse.json() as any;
        
        if (result.status === 'authorized') {
          authorized = true;
          accessToken = result.accessToken;
          break;
        }
        if (result.status === 'expired') {
          pollSpinner.fail('Authorization expired');
          console.log(chalk.red('\n❌ Code expired. Please try again.\n'));
          return;
        }
      }

      if (!authorized) {
        pollSpinner.fail('Authorization timed out');
        console.log(chalk.red('\n❌ Timed out. Please try again.\n'));
        return;
      }

      pollSpinner.succeed('Authorized!');

      // Save token
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(tokenFile, accessToken, { mode: 0o600 });

      console.log(chalk.green('\n✅ Logged in successfully!\n'));
      console.log(chalk.dim(`Token saved to ${tokenFile}\n`));

    } catch (error) {
      spinner.fail('Failed to login');
      console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : error}\n`));
    }
  });

// Logout command
program
  .command('logout')
  .description('Log out of your Havoc account')
  .action(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const tokenFile = path.join(os.homedir(), '.havoc', 'token');

    if (!fs.existsSync(tokenFile)) {
      console.log(chalk.yellow('\n⚠️  Not logged in\n'));
      return;
    }

    // Revoke token on server
    const token = fs.readFileSync(tokenFile, 'utf-8');
    try {
      await fetch(`${env.apiUrl || 'http://localhost:3001'}/api/auth/token`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch {
      // Ignore errors
    }

    // Delete local token
    fs.unlinkSync(tokenFile);
    console.log(chalk.green('\n✅ Logged out\n'));
  });

// Whoami command
program
  .command('whoami')
  .description('Show current logged in user')
  .action(async () => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const tokenFile = path.join(os.homedir(), '.havoc', 'token');

    if (!fs.existsSync(tokenFile)) {
      console.log(chalk.yellow('\n⚠️  Not logged in. Run `havoc login` first.\n'));
      return;
    }

    const token = fs.readFileSync(tokenFile, 'utf-8');

    try {
      const response = await fetch(`${env.apiUrl || 'http://localhost:3001'}/api/auth/validate`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json() as any;

      if (result.valid) {
        console.log(chalk.green(`\n✅ Logged in as user ${result.userId}\n`));
      } else {
        console.log(chalk.yellow('\n⚠️  Token invalid. Run `havoc login` to re-authenticate.\n'));
      }
    } catch (error) {
      console.log(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : error}\n`));
    }
  });

// Parse CLI args
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
