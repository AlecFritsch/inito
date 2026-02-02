import { Sandbox, ExecResult } from './manager.js';
import { HavocConfig, isCommandAllowed } from '../config.js';
import type { RunEventType } from '../run-events.js';

/**
 * Safe command runner that respects allowlist
 */
export class SandboxRunner {
  private sandbox: Sandbox;
  private config: HavocConfig;
  private executedCommands: Array<{ command: string; result: ExecResult }> = [];
  private onEvent?: (event: { type: RunEventType; message: string; data?: Record<string, unknown> }) => void;

  constructor(
    sandbox: Sandbox,
    config: HavocConfig,
    onEvent?: (event: { type: RunEventType; message: string; data?: Record<string, unknown> }) => void
  ) {
    this.sandbox = sandbox;
    this.config = config;
    this.onEvent = onEvent;
  }

  private emit(type: RunEventType, message: string, data?: Record<string, unknown>) {
    if (this.onEvent) {
      this.onEvent({ type, message, data });
    }
  }

  /**
   * Run a command in the sandbox
   */
  async run(command: string): Promise<ExecResult> {
    // Check if command is allowed
    if (!isCommandAllowed(command, this.config)) {
      const result: ExecResult = {
        exitCode: 1,
        stdout: '',
        stderr: `Command not allowed: ${command}. Allowed commands: ${this.config.allowed_commands.join(', ')}`
      };
      this.executedCommands.push({ command, result });
      return result;
    }

    // Parse command into array
    const parts = parseCommand(command);
    
    // Execute in sandbox
    this.emit('command', command);
    const result = await this.sandbox.exec(['sh', '-c', command]);
    
    this.executedCommands.push({ command, result });
    
    return result;
  }

  /**
   * Run multiple commands sequentially
   */
  async runAll(commands: string[]): Promise<ExecResult[]> {
    const results: ExecResult[] = [];
    
    for (const command of commands) {
      const result = await this.run(command);
      results.push(result);
      
      // Stop on first failure
      if (result.exitCode !== 0) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Run npm/yarn install
   */
  async installDependencies(): Promise<ExecResult> {
    // Try to detect package manager
    const checkYarn = await this.sandbox.exec(['test', '-f', 'yarn.lock']);
    const checkPnpm = await this.sandbox.exec(['test', '-f', 'pnpm-lock.yaml']);
    
    if (checkPnpm.exitCode === 0) {
      return this.run('pnpm install');
    } else if (checkYarn.exitCode === 0) {
      return this.run('yarn install');
    } else {
      return this.run('npm install');
    }
  }

  /**
   * Run tests
   */
  async runTests(testCommand?: string): Promise<ExecResult> {
    const command = testCommand || this.config.test_command;
    return this.run(command);
  }

  /**
   * Run linter
   */
  async runLint(): Promise<ExecResult> {
    // Try common lint commands
    const checkNpmLint = await this.sandbox.exec(['sh', '-c', 'npm run lint --if-present 2>/dev/null']);
    if (checkNpmLint.exitCode === 0) {
      return checkNpmLint;
    }

    // Try eslint directly
    const checkEslint = await this.sandbox.exec(['sh', '-c', 'npx eslint . --ext .js,.ts,.jsx,.tsx 2>/dev/null || true']);
    return checkEslint;
  }

  /**
   * Get git diff
   */
  async getGitDiff(): Promise<string> {
    const result = await this.sandbox.exec(['git', 'diff']);
    return result.stdout;
  }

  /**
   * Get staged git diff
   */
  async getStagedDiff(): Promise<string> {
    const result = await this.sandbox.exec(['git', 'diff', '--cached']);
    return result.stdout;
  }

  /**
   * Stage all changes
   */
  async stageAll(): Promise<ExecResult> {
    this.emit('command', 'git add .');
    return this.sandbox.exec(['git', 'add', '.']);
  }

  /**
   * Commit changes
   */
  async commit(message: string): Promise<ExecResult> {
    // Configure git user for commit
    await this.sandbox.exec(['git', 'config', 'user.email', 'havoc@usehavoc.dev']);
    await this.sandbox.exec(['git', 'config', 'user.name', 'Havoc']);
    
    this.emit('command', `git commit -m "${message}"`);
    return this.sandbox.exec(['git', 'commit', '-m', message]);
  }

  /**
   * Read a file
   */
  async readFile(filePath: string): Promise<string | null> {
    this.emit('file', `read ${filePath}`);
    const result = await this.sandbox.exec(['cat', filePath]);
    if (result.exitCode !== 0) {
      return null;
    }
    return result.stdout;
  }

  /**
   * Write a file
   */
  async writeFile(filePath: string, content: string): Promise<ExecResult> {
    // Use printf to handle special characters
    const escapedContent = content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "'\\''");
    this.emit('file', `write ${filePath}`);
    return this.sandbox.exec(['sh', '-c', `printf '%s' '${escapedContent}' > ${filePath}`]);
  }

  /**
   * List files in directory
   */
  async listFiles(dir: string = '.'): Promise<string[]> {
    const result = await this.sandbox.exec(['find', dir, '-type', 'f', '-name', '*.ts', '-o', '-name', '*.js', '-o', '-name', '*.tsx', '-o', '-name', '*.jsx']);
    if (result.exitCode !== 0) {
      return [];
    }
    return result.stdout.split('\n').filter(f => f.length > 0);
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    const result = await this.sandbox.exec(['test', '-f', filePath]);
    return result.exitCode === 0;
  }

  /**
   * Create directory
   */
  async mkdir(dirPath: string): Promise<ExecResult> {
    this.emit('file', `mkdir ${dirPath}`);
    return this.sandbox.exec(['mkdir', '-p', dirPath]);
  }

  /**
   * Get executed commands log
   */
  getCommandLog(): Array<{ command: string; result: ExecResult }> {
    return [...this.executedCommands];
  }

  /**
   * Get workspace path
   */
  getWorkspacePath(): string {
    return this.sandbox.workspaceDir;
  }
}

/**
 * Parse a command string into an array
 */
function parseCommand(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (const char of command) {
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
}
