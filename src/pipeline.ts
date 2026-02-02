import { join } from 'path';
import { nanoid } from 'nanoid';
import { env, loadHavocConfig, detectTestCommand, HavocConfig } from './config.js';
import { createRun, updateRunStatus, updateRunPlan, updateRunArtifacts, updateRunPR, Run } from './db/index.js';
import { createSandbox, Sandbox } from './sandbox/manager.js';
import { SandboxRunner } from './sandbox/runner.js';
import { cloneRepo, createBranch, commitAndPush, createPullRequest, addPRComment, addIssueComment, generateBranchName, getDefaultBranch } from './github/api.js';
import { getInstallationId } from './github/app.js';
import { analyzeIssue, AnalysisResult } from './agents/analyzer.js';
import { createPlan, sortTasks, Plan } from './agents/planner.js';
import { executeTasks, combineDiffs, TaskResult } from './agents/editor.js';
import { runTests, runLint, TestResults, LintResults } from './agents/tester.js';
import { selfReview, ReviewResult, formatReviewResult } from './agents/reviewer.js';
import { calculateConfidenceScore } from './artifacts/confidence.js';
import { generateIntentCard, formatIntentCard, generatePRTitle, generatePRBody } from './artifacts/intent-card.js';
import { checkPolicyGates, formatPolicyResult, getPolicySummary, PolicyResult } from './policy.js';
import { simpleGit, SimpleGit } from 'simple-git';
import { emitRunEvent } from './run-events.js';

/**
 * Pipeline input configuration
 */
export interface PipelineInput {
  runId?: string;
  owner: string;
  repo: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  installationId?: number;
  userId?: string;
}

/**
 * Pipeline result
 */
export interface PipelineResult {
  runId: string;
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  confidenceScore: number;
  policyPassed: boolean;
  error?: string;
}

/**
 * Run the complete pipeline
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const runId = input.runId || nanoid();
  const { owner, repo, issueNumber, issueTitle, issueBody, installationId, userId } = input;
  
  console.log(`[Pipeline] Starting run ${runId} for ${owner}/${repo}#${issueNumber}`);
  emitRunEvent(runId, { type: 'status', message: `Run started for ${owner}/${repo}#${issueNumber}` });

  // Create workspace directory
  const workspaceDir = join(env.workspaceDir, runId);
  let sandbox: Sandbox | null = null;
  let git: SimpleGit | null = null;

  try {
    // Initialize run in database
    await createRun({
      id: runId,
      repo: `${owner}/${repo}`,
      issueNumber,
      issueTitle,
      issueBody,
      userId,
      config: {}
    });
    emitRunEvent(runId, { type: 'status', message: 'Run initialized' });
    
    // Create sandbox container
    await updateRunStatus(runId, 'cloning');
    console.log(`[Pipeline] Creating sandbox...`);
    emitRunEvent(runId, { type: 'status', message: 'Creating sandbox', data: { status: 'cloning' } });
    sandbox = await createSandbox({ runId, workspaceDir });
    emitRunEvent(runId, { type: 'log', message: 'Sandbox created' });
    
    // Clone repository IN THE CONTAINER
    console.log(`[Pipeline] Cloning ${owner}/${repo}...`);
    emitRunEvent(runId, { type: 'status', message: `Cloning ${owner}/${repo}` });
    
    // Get auth token
    let authToken: string;
    if (installationId) {
      const { getInstallationToken } = await import('./github/app.js');
      authToken = await getInstallationToken(installationId);
    } else {
      authToken = env.githubToken;
    }
    
    if (!authToken) {
      throw new Error('No authentication token available');
    }
    
    // Clone directly in the container
    const cloneUrl = `https://x-access-token:${authToken}@github.com/${owner}/${repo}.git`;
    await sandbox.exec(['git', 'clone', '--depth', '1', cloneUrl, '/workspace/repo']);
    await sandbox.exec(['sh', '-c', 'cd /workspace/repo && git config user.email "havoc@usehavoc.dev"']);
    await sandbox.exec(['sh', '-c', 'cd /workspace/repo && git config user.name "Havoc"']);
    emitRunEvent(runId, { type: 'log', message: 'Repository cloned' });
    
    // Load configuration from container
    const havocConfigResult = await sandbox.exec(['cat', '/workspace/repo/.havoc.yaml']);
    const havocConfig = havocConfigResult.exitCode === 0 
      ? loadHavocConfig(workspaceDir) 
      : { version: 1, max_iterations: 50, timeout_minutes: 10, test_command: '', min_confidence: 70, min_test_pass_rate: 90, allowed_commands: ['git', 'npm', 'yarn', 'pnpm', 'node', 'npx'], protected_files: ['.env', '.env.*', '*.key', '*.pem', 'secrets.*'] };
    
    // Detect test command in container
    const packageJsonResult = await sandbox.exec(['cat', '/workspace/repo/package.json']);
    if (packageJsonResult.exitCode === 0) {
      try {
        const pkg = JSON.parse(packageJsonResult.stdout);
        if (pkg.scripts?.test) havocConfig.test_command = 'npm test';
      } catch {}
    }
    
    // Create sandbox runner with updated working directory
    const runner = new SandboxRunner(sandbox, havocConfig, (event) => {
      emitRunEvent(runId, {
        type: event.type,
        message: event.message,
        data: event.data
      });
    }, '/workspace/repo');
    
    // Get default branch
    const defaultBranch = await getDefaultBranch(owner, repo, installationId);
    
    // Create branch for changes IN THE CONTAINER
    const branchName = generateBranchName(issueNumber, runId);
    await sandbox.exec(['sh', '-c', `cd /workspace/repo && git checkout -b ${branchName}`]);
    console.log(`[Pipeline] Created branch: ${branchName}`);
    emitRunEvent(runId, { type: 'log', message: `Created branch ${branchName}` });

    // === ANALYZE ===
    await updateRunStatus(runId, 'analyzing');
    console.log(`[Pipeline] Analyzing issue...`);
    emitRunEvent(runId, { type: 'status', message: 'Analyzing issue', data: { status: 'analyzing' } });
    const analysis = await analyzeIssue(issueTitle, issueBody, runner);
    console.log(`[Pipeline] Issue type: ${analysis.spec.type}`);
    emitRunEvent(runId, { type: 'log', message: `Issue type: ${analysis.spec.type}` });

    // === PLAN ===
    await updateRunStatus(runId, 'planning');
    console.log(`[Pipeline] Creating plan...`);
    emitRunEvent(runId, { type: 'status', message: 'Creating plan', data: { status: 'planning' } });
    const plan = await createPlan(analysis, runner);
    await updateRunPlan(runId, plan);
    console.log(`[Pipeline] Plan has ${plan.tasks.length} tasks`);
    emitRunEvent(runId, { type: 'log', message: `Plan created with ${plan.tasks.length} tasks` });

    // === EDIT ===
    await updateRunStatus(runId, 'editing');
    console.log(`[Pipeline] Executing tasks...`);
    emitRunEvent(runId, { type: 'status', message: 'Executing tasks', data: { status: 'editing' } });
    const sortedTasks = sortTasks(plan.tasks);
    const taskResults = await executeTasks(sortedTasks, runner, havocConfig, {
      language: analysis.context.language,
      framework: analysis.context.framework
    }, (event) => emitRunEvent(runId, event));
    
    const successfulTasks = taskResults.filter(t => t.success).length;
    console.log(`[Pipeline] Completed ${successfulTasks}/${taskResults.length} tasks`);
    emitRunEvent(runId, { type: 'log', message: `Completed ${successfulTasks}/${taskResults.length} tasks` });

    // Check for unstaged changes first
    const unstagedDiff = await runner.getGitDiff();
    console.log(`[Pipeline] Unstaged diff length: ${unstagedDiff.length}`);
    
    // Stage changes
    await runner.stageAll();
    emitRunEvent(runId, { type: 'log', message: 'Staged changes' });
    
    // Get staged diff
    const stagedDiff = await runner.getStagedDiff();
    console.log(`[Pipeline] Staged diff length: ${stagedDiff.length}`);
    
    if (!stagedDiff.trim()) {
      // Check if there were any task results with diffs
      const tasksWithDiffs = taskResults.filter(t => t.diff && t.diff.length > 0);
      console.log(`[Pipeline] Tasks with diffs: ${tasksWithDiffs.length}`);
      
      if (tasksWithDiffs.length > 0) {
        // We have diffs but git doesn't see them - this is a sync issue
        console.error(`[Pipeline] Sync issue: ${tasksWithDiffs.length} tasks produced diffs but git sees no changes`);
        const syncMessage = 'Code changes were generated but not properly staged. This may be a sandbox sync issue.';
        await updateRunStatus(runId, 'failed', syncMessage);
        emitRunEvent(runId, { type: 'error', message: syncMessage });
        await addIssueComment(
          owner,
          repo,
          issueNumber,
          `## Havoc Run Failed\n\n❌ ${syncMessage}\n\nRun ID: \`${runId}\`\n\nDebug: ${tasksWithDiffs.length} tasks completed successfully but changes were not visible to git.`,
          installationId
        );
      } else {
        const noChangeMessage = 'No code changes were generated. PR not created.';
        await updateRunStatus(runId, 'failed', noChangeMessage);
        emitRunEvent(runId, { type: 'error', message: noChangeMessage });
        await addIssueComment(
          owner,
          repo,
          issueNumber,
          `## Havoc Run Failed\n\n❌ ${noChangeMessage}\n\nRun ID: \`${runId}\``,
          installationId
        );
      }

      return {
        runId,
        success: false,
        confidenceScore: 0,
        policyPassed: false,
        error: stagedDiff.trim() ? 'Sync issue' : 'No changes generated'
      };
    }

    // === TEST ===
    await updateRunStatus(runId, 'testing');
    console.log(`[Pipeline] Running tests...`);
    emitRunEvent(runId, { type: 'status', message: 'Running tests', data: { status: 'testing' } });
    const testResults = await runTests(runner, havocConfig);
    console.log(`[Pipeline] Tests: ${testResults.passed ? 'PASSED' : 'FAILED'} (${testResults.pass_rate.toFixed(1)}%)`);
    emitRunEvent(runId, { type: 'log', message: `Tests ${testResults.passed ? 'PASSED' : 'FAILED'} (${testResults.pass_rate.toFixed(1)}%)` });

    // Run lint
    const lintResults = await runLint(runner);
    console.log(`[Pipeline] Lint: ${lintResults.passed ? 'PASSED' : 'FAILED'}`);
    emitRunEvent(runId, { type: 'log', message: `Lint ${lintResults.passed ? 'PASSED' : 'FAILED'}` });

    // === REVIEW ===
    await updateRunStatus(runId, 'reviewing');
    console.log(`[Pipeline] Self-reviewing changes...`);
    emitRunEvent(runId, { type: 'status', message: 'Self-reviewing changes', data: { status: 'reviewing' } });
    const review = await selfReview(taskResults, testResults, lintResults, {
      title: issueTitle,
      body: issueBody
    });
    console.log(`[Pipeline] Review assessment: ${review.overallAssessment}`);
    emitRunEvent(runId, { type: 'log', message: `Review assessment: ${review.overallAssessment}` });

    // === CONFIDENCE ===
    const { score: confidenceScore, breakdown } = calculateConfidenceScore(
      taskResults, testResults, lintResults, review, plan
    );
    console.log(`[Pipeline] Confidence score: ${confidenceScore}%`);
    emitRunEvent(runId, { type: 'log', message: `Confidence score: ${confidenceScore}%` });

    // === POLICY GATES ===
    const policyResult = checkPolicyGates(
      havocConfig, confidenceScore, testResults, lintResults, review
    );
    console.log(`[Pipeline] Policy gates: ${policyResult.passed ? 'PASSED' : 'FAILED'}`);
    emitRunEvent(runId, { type: 'log', message: `Policy gates ${policyResult.passed ? 'PASSED' : 'FAILED'}` });

    // === GENERATE ARTIFACTS ===
    const intentCard = generateIntentCard(
      runId, issueNumber, issueTitle, analysis, plan, taskResults,
      testResults, lintResults, review, confidenceScore, breakdown
    );
    emitRunEvent(runId, { type: 'log', message: 'Generated Intent Card' });

    // Update run with artifacts
    await updateRunArtifacts(runId, {
      intentCard: formatIntentCard(intentCard),
      review: review,
      confidence: confidenceScore,
      policyResult: policyResult
    });

    // === PUBLISH ===
    await updateRunStatus(runId, 'publishing');
    emitRunEvent(runId, { type: 'status', message: 'Publishing', data: { status: 'publishing' } });

    if (policyResult.passed) {
      // Commit and push changes IN THE CONTAINER
      const commitMessage = generatePRTitle(intentCard);
      await runner.commit(commitMessage);
      
      // Push from container
      const pushResult = await sandbox.exec(['sh', '-c', `cd /workspace/repo && git push https://x-access-token:${authToken}@github.com/${owner}/${repo}.git ${branchName}`]);
      if (pushResult.exitCode !== 0) {
        throw new Error(`Failed to push: ${pushResult.stderr}`);
      }
      console.log(`[Pipeline] Pushed changes to ${branchName}`);
      emitRunEvent(runId, { type: 'log', message: `Pushed changes to ${branchName}` });

      // Create PR
      const prTitle = generatePRTitle(intentCard);
      const prBody = generatePRBody(intentCard, combineDiffs(taskResults));
      
      const pr = await createPullRequest(
        owner, repo, prTitle, prBody, branchName, defaultBranch, installationId
      );
      console.log(`[Pipeline] Created PR #${pr.number}: ${pr.url}`);
      emitRunEvent(runId, { type: 'log', message: `Created PR #${pr.number}` });

      // Add self-review as comment
      await addPRComment(owner, repo, pr.number, formatReviewResult(review), installationId);
      
      // Add policy result as comment
      await addPRComment(owner, repo, pr.number, formatPolicyResult(policyResult), installationId);

      // Update run with PR info
      await updateRunPR(runId, pr.url, pr.number, branchName);
      await updateRunStatus(runId, 'done');
      emitRunEvent(runId, { type: 'status', message: 'Run completed', data: { status: 'done' } });

      return {
        runId,
        success: true,
        prUrl: pr.url,
        prNumber: pr.number,
        confidenceScore,
        policyPassed: true
      };
    } else {
      // Policy gates failed - post comment to issue instead
      const failureMessage = `## Havoc Run Failed Policy Gates

${formatPolicyResult(policyResult)}

### Summary
${getPolicySummary(policyResult)}

<details>
<summary>📋 View Intent Card</summary>

${formatIntentCard(intentCard)}

</details>

---
Run ID: \`${runId}\`
`;

      await addIssueComment(owner, repo, issueNumber, failureMessage, installationId);
      
      await updateRunStatus(runId, 'failed', 'Policy gates not passed');
      emitRunEvent(runId, { type: 'status', message: 'Policy gates failed', data: { status: 'failed' } });

      return {
        runId,
        success: false,
        confidenceScore,
        policyPassed: false,
        error: getPolicySummary(policyResult)
      };
    }

  } catch (error) {
    console.error(`[Pipeline] Error:`, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateRunStatus(runId, 'failed', errorMessage);
    emitRunEvent(runId, { type: 'error', message: errorMessage });

    // Try to post error to issue
    try {
      await addIssueComment(
        owner, repo, issueNumber,
        `## Havoc Run Failed\n\n❌ Error: ${errorMessage}\n\nRun ID: \`${runId}\``,
        input.installationId
      );
    } catch {
      // Ignore comment errors
    }

    return {
      runId,
      success: false,
      confidenceScore: 0,
      policyPassed: false,
      error: errorMessage
    };

  } finally {
    // Cleanup sandbox
    if (sandbox) {
      console.log(`[Pipeline] Cleaning up sandbox...`);
      await sandbox.cleanup();
    }
  }
}

