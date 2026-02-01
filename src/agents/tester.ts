import { SandboxRunner } from '../sandbox/runner.js';
import { HavocConfig } from '../config.js';

/**
 * Test results
 */
export interface TestResults {
  ran: boolean;
  passed: boolean;
  total: number;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  pass_rate: number;
  duration_ms: number;
  output: string;
  error?: string;
}

/**
 * Lint results
 */
export interface LintResults {
  ran: boolean;
  passed: boolean;
  errors: number;
  warnings: number;
  output: string;
}

/**
 * Run tests in the sandbox
 */
export async function runTests(
  runner: SandboxRunner,
  config: HavocConfig
): Promise<TestResults> {
  console.log('[Tester] Running tests...');
  
  const startTime = Date.now();
  
  // First, install dependencies
  console.log('[Tester] Installing dependencies...');
  const installResult = await runner.installDependencies();
  
  if (installResult.exitCode !== 0) {
    return {
      ran: false,
      passed: false,
      total: 0,
      passed_count: 0,
      failed_count: 0,
      skipped_count: 0,
      pass_rate: 0,
      duration_ms: Date.now() - startTime,
      output: installResult.stdout,
      error: `Failed to install dependencies: ${installResult.stderr}`
    };
  }

  // Run tests
  console.log(`[Tester] Running: ${config.test_command}`);
  const testResult = await runner.runTests(config.test_command);
  
  const duration = Date.now() - startTime;
  
  // Parse test output
  const parsed = parseTestOutput(testResult.stdout + '\n' + testResult.stderr);
  
  return {
    ran: true,
    passed: testResult.exitCode === 0,
    total: parsed.total,
    passed_count: parsed.passed,
    failed_count: parsed.failed,
    skipped_count: parsed.skipped,
    pass_rate: parsed.total > 0 ? (parsed.passed / parsed.total) * 100 : 0,
    duration_ms: duration,
    output: testResult.stdout,
    error: testResult.exitCode !== 0 ? testResult.stderr : undefined
  };
}

/**
 * Run linter in the sandbox
 */
export async function runLint(runner: SandboxRunner): Promise<LintResults> {
  console.log('[Tester] Running linter...');
  
  const result = await runner.runLint();
  
  // Parse lint output
  const errors = (result.stdout.match(/error/gi) || []).length;
  const warnings = (result.stdout.match(/warning/gi) || []).length;
  
  return {
    ran: true,
    passed: result.exitCode === 0 || errors === 0,
    errors,
    warnings,
    output: result.stdout
  };
}

/**
 * Parse test output to extract metrics
 */
function parseTestOutput(output: string): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
} {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Jest format: Tests: X passed, Y failed, Z total
  const jestMatch = output.match(/Tests:\s*(\d+)\s*passed,?\s*(\d+)?\s*failed,?\s*(\d+)?\s*skipped,?\s*(\d+)\s*total/i);
  if (jestMatch) {
    passed = parseInt(jestMatch[1] || '0', 10);
    failed = parseInt(jestMatch[2] || '0', 10);
    skipped = parseInt(jestMatch[3] || '0', 10);
    total = parseInt(jestMatch[4] || '0', 10);
    return { total, passed, failed, skipped };
  }

  // Vitest format: X passed | Y failed | Z skipped
  const vitestMatch = output.match(/(\d+)\s*passed.*?(\d+)?\s*failed.*?(\d+)?\s*skipped/i);
  if (vitestMatch) {
    passed = parseInt(vitestMatch[1] || '0', 10);
    failed = parseInt(vitestMatch[2] || '0', 10);
    skipped = parseInt(vitestMatch[3] || '0', 10);
    total = passed + failed + skipped;
    return { total, passed, failed, skipped };
  }

  // Mocha format: X passing, Y failing
  const mochaMatch = output.match(/(\d+)\s*passing.*?(\d+)?\s*failing/i);
  if (mochaMatch) {
    passed = parseInt(mochaMatch[1] || '0', 10);
    failed = parseInt(mochaMatch[2] || '0', 10);
    total = passed + failed;
    return { total, passed, failed, skipped };
  }

  // Pytest format: X passed, Y failed
  const pytestMatch = output.match(/(\d+)\s*passed.*?(\d+)?\s*failed/i);
  if (pytestMatch) {
    passed = parseInt(pytestMatch[1] || '0', 10);
    failed = parseInt(pytestMatch[2] || '0', 10);
    total = passed + failed;
    return { total, passed, failed, skipped };
  }

  // Go test format: ok/FAIL
  const goPassMatch = output.match(/ok\s+/g);
  const goFailMatch = output.match(/FAIL\s+/g);
  if (goPassMatch || goFailMatch) {
    passed = (goPassMatch || []).length;
    failed = (goFailMatch || []).length;
    total = passed + failed;
    return { total, passed, failed, skipped };
  }

  // Fallback: count checkmarks and X marks
  const passMarks = (output.match(/[✓✔]/g) || []).length;
  const failMarks = (output.match(/[✗✘×]/g) || []).length;
  if (passMarks > 0 || failMarks > 0) {
    passed = passMarks;
    failed = failMarks;
    total = passed + failed;
  }

  return { total, passed, failed, skipped };
}

/**
 * Format test results for display
 */
export function formatTestResults(results: TestResults): string {
  if (!results.ran) {
    return `## Test Results

❌ Tests did not run

**Error:** ${results.error || 'Unknown error'}
`;
  }

  const statusIcon = results.passed ? '✅' : '❌';
  
  return `## Test Results

${statusIcon} **${results.passed ? 'PASSED' : 'FAILED'}**

| Metric | Value |
|--------|-------|
| Total | ${results.total} |
| Passed | ${results.passed_count} |
| Failed | ${results.failed_count} |
| Skipped | ${results.skipped_count} |
| Pass Rate | ${results.pass_rate.toFixed(1)}% |
| Duration | ${(results.duration_ms / 1000).toFixed(2)}s |

${results.error ? `\n**Error:**\n\`\`\`\n${results.error}\n\`\`\`` : ''}
`;
}

/**
 * Format lint results for display
 */
export function formatLintResults(results: LintResults): string {
  const statusIcon = results.passed ? '✅' : '⚠️';
  
  return `## Lint Results

${statusIcon} **${results.passed ? 'PASSED' : 'ISSUES FOUND'}**

- Errors: ${results.errors}
- Warnings: ${results.warnings}
`;
}
