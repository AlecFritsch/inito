import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyWebhookSignature } from './app.js';
import { runPipeline } from '../pipeline.js';
import { getRepositoryByFullName } from '../db/index.js';
import { nanoid } from 'nanoid';

/**
 * GitHub webhook event types we handle
 */
type WebhookEvent = 'issues' | 'issue_comment' | 'ping';

/**
 * Issue event payload
 */
interface IssueEvent {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string;
    labels: Array<{ name: string }>;
    user: { login: string };
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
  installation?: {
    id: number;
  };
}

/**
 * Issue comment event payload
 */
interface IssueCommentEvent {
  action: string;
  comment: {
    body: string;
    user: { login: string };
  };
  issue: {
    number: number;
    title: string;
    body: string;
    labels: Array<{ name: string }>;
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
  installation?: {
    id: number;
  };
}

/**
 * Check if issue has havoc label
 */
function hasHavocLabel(labels: Array<{ name: string }>): boolean {
  return labels.some(l => 
    l.name.toLowerCase() === 'havoc' || 
    l.name.toLowerCase() === 'havoc-run'
  );
}

/**
 * Check if comment is a havoc command
 */
function isHavocCommand(body: string): boolean {
  const trimmed = body.trim().toLowerCase();
  return (
    trimmed === '/havoc' ||
    trimmed === '/havoc run' ||
    trimmed.startsWith('/havoc run')
  );
}

/**
 * Handle issue labeled event
 */
async function handleIssueLabeled(event: IssueEvent): Promise<void> {
  if (!hasHavocLabel(event.issue.labels)) {
    return;
  }

  console.log(`[Webhook] Issue #${event.issue.number} labeled with havoc, starting run`);
  
  const runId = nanoid();
  
  // Try to get userId from repository
  const repository = await getRepositoryByFullName(event.repository.full_name);
  const userId = repository?.userId;
  
  // Start pipeline in background
  runPipeline({
    runId,
    owner: event.repository.owner.login,
    repo: event.repository.name,
    issueNumber: event.issue.number,
    issueTitle: event.issue.title,
    issueBody: event.issue.body || '',
    installationId: event.installation?.id,
    userId
  }).catch(error => {
    console.error(`[Webhook] Pipeline failed for run ${runId}:`, error);
  });
}

/**
 * Handle issue comment event
 */
async function handleIssueComment(event: IssueCommentEvent): Promise<void> {
  if (event.action !== 'created') {
    return;
  }

  if (!isHavocCommand(event.comment.body)) {
    return;
  }

  console.log(`[Webhook] Havoc command on issue #${event.issue.number}, starting run`);
  
  const runId = nanoid();
  
  // Try to get userId from repository
  const repository = await getRepositoryByFullName(event.repository.full_name);
  const userId = repository?.userId;
  
  // Start pipeline in background
  runPipeline({
    runId,
    owner: event.repository.owner.login,
    repo: event.repository.name,
    issueNumber: event.issue.number,
    issueTitle: event.issue.title,
    issueBody: event.issue.body || '',
    installationId: event.installation?.id,
    userId
  }).catch(error => {
    console.error(`[Webhook] Pipeline failed for run ${runId}:`, error);
  });
}

/**
 * Register webhook routes
 */
export function registerWebhookRoutes(app: FastifyInstance): void {
  app.post('/webhooks/github', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['x-hub-signature-256'] as string;
    const event = request.headers['x-github-event'] as WebhookEvent;
    const deliveryId = request.headers['x-github-delivery'] as string;

    console.log(`[Webhook] Received ${event} event (delivery: ${deliveryId})`);

    // Verify signature
    const payload = JSON.stringify(request.body);
    if (signature && !verifyWebhookSignature(payload, signature)) {
      console.error('[Webhook] Invalid signature');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // Handle ping event
    if (event === 'ping') {
      console.log('[Webhook] Ping received');
      return reply.send({ message: 'pong' });
    }

    // Handle issue events
    if (event === 'issues') {
      const issueEvent = request.body as IssueEvent;
      
      if (issueEvent.action === 'labeled') {
        await handleIssueLabeled(issueEvent);
      }
      
      return reply.send({ message: 'ok' });
    }

    // Handle issue comment events
    if (event === 'issue_comment') {
      const commentEvent = request.body as IssueCommentEvent;
      await handleIssueComment(commentEvent);
      return reply.send({ message: 'ok' });
    }

    // Unknown event
    console.log(`[Webhook] Ignoring event: ${event}`);
    return reply.send({ message: 'ignored' });
  });
}

/**
 * Export types for use in other modules
 */
export type { IssueEvent, IssueCommentEvent };
