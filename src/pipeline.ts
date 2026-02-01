import { join } from 'path';
import { nanoid } from 'nanoid';
import { env, loadHavocConfig, detectTestCommand, HavocConfig } from './config.js';
import { createRun, updateRunStatus, updateRunPlan, updateRunArtifacts, updateRunPR, Run } from './db.js';
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
  const { owner, repo, issueNumber, issueTitle, issueBody, installationId } = input;
  
  console.log(`[Pipeline] Starting run ${runId} for ${owner}/${repo}#${issueNumber}`);

  // Create workspace directory
  const workspaceDir = join(env.workspaceDir, runId);
  let sandbox: Sandbox | null = null;
  let git: SimpleGit | null = null;

  try {
    // Initialize run in database
    const run = createRun(runId, `${owner}/${repo}`, issueNumber, issueTitle, issueBody, {});
    
    // Create sandbox container
    updateRunStatus(runId, 'cloning');
    console.log(`[Pipeline] Creating sandbox...`);
    sandbox = await createSandbox({ runId, workspaceDir });
    
    // Clone repository
    console.log(`[Pipeline] Cloning ${owner}/${repo}...`);
    git = await cloneRepo(owner, repo, workspaceDir, installationId);
    
    // Load configuration
    const havocConfig = loadHavocConfig(workspaceDir);
    havocConfig.test_command = detectTestCommand(workspaceDir) || havocConfig.test_command;
    
    // Create sandbox runner
    const runner = new SandboxRunner(sandbox, havocConfig);
    
    // Get default branch
    const defaultBranch = await getDefaultBranch(owner, repo, installationId);
    
    // Create branch for changes
    const branchName = generateBranchName(issueNumber, runId);
    await createBranch(git, branchName, defaultBranch);
    console.log(`[Pipeline] Created branch: ${branchName}`);

    // === ANALYZE ===
    updateRunStatus(runId, 'analyzing');
    console.log(`[Pipeline] Analyzing issue...`);
    const analysis = await analyzeIssue(issueTitle, issueBody, runner);
    console.log(`[Pipeline] Issue type: ${analysis.spec.type}`);

    // === PLAN ===
    updateRunStatus(runId, 'planning');
    console.log(`[Pipeline] Creating plan...`);
    const plan = await createPlan(analysis, runner);
    updateRunPlan(runId, plan);
    console.log(`[Pipeline] Plan has ${plan.tasks.length} tasks`);

    // === EDIT ===
    updateRunStatus(runId, 'editing');
    console.log(`[Pipeline] Executing tasks...`);
    const sortedTasks = sortTasks(plan.tasks);
    const taskResults = await executeTasks(sortedTasks, runner, havocConfig, {
      language: analysis.context.language,
      framework: analysis.context.framework
    });
    
    const successfulTasks = taskResults.filter(t => t.success).length;
    console.log(`[Pipeline] Completed ${successfulTasks}/${taskResults.length} tasks`);

    // Stage changes
    await runner.stageAll();

    // === TEST ===
    updateRunStatus(runId, 'testing');
    console.log(`[Pipeline] Running tests...`);
    const testResults = await runTests(runner, havocConfig);
    console.log(`[Pipeline] Tests: ${testResults.passed ? 'PASSED' : 'FAILED'} (${testResults.pass_rate.toFixed(1)}%)`);

    // Run lint
    const lintResults = await runLint(runner);
    console.log(`[Pipeline] Lint: ${lintResults.passed ? 'PASSED' : 'FAILED'}`);

    // === REVIEW ===
    updateRunStatus(runId, 'reviewing');
    console.log(`[Pipeline] Self-reviewing changes...`);
    const review = await selfReview(taskResults, testResults, lintResults, {
      title: issueTitle,
      body: issueBody
    });
    console.log(`[Pipeline] Review assessment: ${review.overallAssessment}`);

    // === CONFIDENCE ===
    const { score: confidenceScore, breakdown } = calculateConfidenceScore(
      taskResults, testResults, lintResults, review, plan
    );
    console.log(`[Pipeline] Confidence score: ${confidenceScore}%`);

    // === POLICY GATES ===
    const policyResult = checkPolicyGates(
      havocConfig, confidenceScore, testResults, lintResults, review
    );
    console.log(`[Pipeline] Policy gates: ${policyResult.passed ? 'PASSED' : 'FAILED'}`);

    // === GENERATE ARTIFACTS ===
    const intentCard = generateIntentCard(
      runId, issueNumber, issueTitle, analysis, plan, taskResults,
      testResults, lintResults, review, confidenceScore, breakdown
    );

    // Update run with artifacts
    updateRunArtifacts(runId, {
      intentCard: formatIntentCard(intentCard),
      review: review,
      confidence: confidenceScore,
      policyResult: policyResult
    });

    // === PUBLISH ===
    updateRunStatus(runId, 'publishing');

    if (policyResult.passed) {
      // Commit and push changes
      const commitMessage = generatePRTitle(intentCard);
      await runner.commit(commitMessage);
      await commitAndPush(git, commitMessage, branchName);
      console.log(`[Pipeline] Pushed changes to ${branchName}`);

      // Create PR
      const prTitle = generatePRTitle(intentCard);
      const prBody = generatePRBody(intentCard, combineDiffs(taskResults));
      
      const pr = await createPullRequest(
        owner, repo, prTitle, prBody, branchName, defaultBranch, installationId
      );
      console.log(`[Pipeline] Created PR #${pr.number}: ${pr.url}`);

      // Add self-review as comment
      await addPRComment(owner, repo, pr.number, formatReviewResult(review), installationId);
      
      // Add policy result as comment
      await addPRComment(owner, repo, pr.number, formatPolicyResult(policyResult), installationId);

      // Update run with PR info
      updateRunPR(runId, pr.url, pr.number, branchName);
      updateRunStatus(runId, 'done');

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
      
      updateRunStatus(runId, 'failed', 'Policy gates not passed');

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
    updateRunStatus(runId, 'failed', errorMessage);

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

/**
 * Export for webhook handler
 */
export { PipelineInput, PipelineResult };
