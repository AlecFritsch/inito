import { Octokit } from 'octokit';
import { simpleGit, SimpleGit } from 'simple-git';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { getOctokit, getInstallationId, parseRepo } from './app.js';
import { env } from '../config.js';

/**
 * Issue data
 */
export interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  user: string;
  state: string;
}

/**
 * PR data
 */
export interface PullRequest {
  number: number;
  url: string;
  title: string;
  body: string;
  head: string;
  base: string;
}

/**
 * Get issue details
 */
export async function getIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  installationId?: number
): Promise<Issue> {
  const octokit = await getOctokit(installationId);
  
  const response = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber
  });

  return {
    number: response.data.number,
    title: response.data.title,
    body: response.data.body || '',
    labels: response.data.labels.map((l: any) => 
      typeof l === 'string' ? l : l.name
    ),
    user: response.data.user?.login || 'unknown',
    state: response.data.state
  };
}

/**
 * Clone a repository to a local directory
 */
export async function cloneRepo(
  owner: string,
  repo: string,
  targetDir: string,
  installationId?: number
): Promise<SimpleGit> {
  // Create target directory
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Get auth token
  let authToken: string;
  if (installationId) {
    const { getInstallationToken } = await import('./app.js');
    authToken = await getInstallationToken(installationId);
  } else {
    authToken = env.githubToken;
  }

  if (!authToken) {
    throw new Error('No authentication token available');
  }

  // Clone with auth
  const cloneUrl = `https://x-access-token:${authToken}@github.com/${owner}/${repo}.git`;
  
  const git = simpleGit();
  await git.clone(cloneUrl, targetDir, ['--depth', '1']);

  return simpleGit(targetDir);
}

/**
 * Create a new branch
 */
export async function createBranch(
  git: SimpleGit,
  branchName: string,
  baseBranch: string = 'main'
): Promise<void> {
  // Fetch to make sure we have the base branch
  await git.fetch('origin', baseBranch);
  
  // Create and checkout new branch
  await git.checkoutBranch(branchName, `origin/${baseBranch}`);
}

/**
 * Stage, commit, and push changes
 */
export async function commitAndPush(
  git: SimpleGit,
  message: string,
  branchName: string
): Promise<void> {
  // Stage all changes
  await git.add('.');
  
  // Commit
  await git.commit(message);
  
  // Push to origin
  await git.push('origin', branchName, ['--set-upstream']);
}

/**
 * Get the diff of current changes
 */
export async function getDiff(git: SimpleGit): Promise<string> {
  return git.diff(['--cached']);
}

/**
 * Get the diff between two branches
 */
export async function getBranchDiff(
  git: SimpleGit,
  baseBranch: string,
  headBranch: string
): Promise<string> {
  return git.diff([`origin/${baseBranch}...${headBranch}`]);
}

/**
 * Create a pull request
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string = 'main',
  installationId?: number
): Promise<PullRequest> {
  const octokit = await getOctokit(installationId);

  const response = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base
  });

  return {
    number: response.data.number,
    url: response.data.html_url,
    title: response.data.title,
    body: response.data.body || '',
    head: response.data.head.ref,
    base: response.data.base.ref
  };
}

/**
 * Add a comment to a PR
 */
export async function addPRComment(
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  installationId?: number
): Promise<void> {
  const octokit = await getOctokit(installationId);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body
  });
}

/**
 * Add a comment to an issue
 */
export async function addIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  installationId?: number
): Promise<void> {
  const octokit = await getOctokit(installationId);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });
}

/**
 * Add labels to an issue/PR
 */
export async function addLabels(
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
  installationId?: number
): Promise<void> {
  const octokit = await getOctokit(installationId);

  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels
  });
}

/**
 * Get repository default branch
 */
export async function getDefaultBranch(
  owner: string,
  repo: string,
  installationId?: number
): Promise<string> {
  const octokit = await getOctokit(installationId);

  const response = await octokit.rest.repos.get({
    owner,
    repo
  });

  return response.data.default_branch;
}

/**
 * Get file content from repository
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
  installationId?: number
): Promise<string | null> {
  const octokit = await getOctokit(installationId);

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    if ('content' in response.data) {
      return Buffer.from(response.data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * List files in repository directory
 */
export async function listRepoFiles(
  owner: string,
  repo: string,
  path: string = '',
  ref?: string,
  installationId?: number
): Promise<string[]> {
  const octokit = await getOctokit(installationId);

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    if (Array.isArray(response.data)) {
      return response.data.map((item: any) => item.path);
    }
    return [path];
  } catch (error: any) {
    if (error.status === 404) {
      return [];
    }
    throw error;
  }
}

/**
 * Clean up workspace directory
 */
export function cleanupWorkspace(workspaceDir: string): void {
  if (existsSync(workspaceDir)) {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
}

/**
 * Generate a branch name for a run
 */
export function generateBranchName(issueNumber: number, runId: string): string {
  return `havoc/issue-${issueNumber}-${runId.slice(0, 8)}`;
}
