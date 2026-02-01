import { pgTable, text, integer, timestamp, real, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Run status enum values
 */
export const runStatuses = [
  'pending',
  'cloning',
  'analyzing',
  'planning',
  'editing',
  'testing',
  'reviewing',
  'publishing',
  'done',
  'failed'
] as const;

export type RunStatus = typeof runStatuses[number];

/**
 * Runs table - stores all Havoc runs
 */
export const runs = pgTable('runs', {
  id: text('id').primaryKey(),
  repo: text('repo').notNull(),
  issueNumber: integer('issue_number').notNull(),
  issueTitle: text('issue_title').notNull(),
  issueBody: text('issue_body').notNull(),
  status: text('status').$type<RunStatus>().notNull().default('pending'),
  config: jsonb('config').notNull().default({}),
  plan: jsonb('plan'),
  intentCard: text('intent_card'),
  review: jsonb('review'),
  confidence: real('confidence'),
  policyResult: jsonb('policy_result'),
  prUrl: text('pr_url'),
  prNumber: integer('pr_number'),
  branch: text('branch'),
  error: text('error'),
  userId: text('user_id'), // Clerk user ID
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  repoIdx: index('runs_repo_idx').on(table.repo),
  statusIdx: index('runs_status_idx').on(table.status),
  userIdx: index('runs_user_idx').on(table.userId),
  startedAtIdx: index('runs_started_at_idx').on(table.startedAt),
}));

/**
 * Users table - synced from Clerk
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  githubUsername: text('github_username'),
  plan: text('plan').$type<'free' | 'pro' | 'enterprise'>().notNull().default('free'),
  runsThisMonth: integer('runs_this_month').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Repositories table - installed repos
 */
export const repositories = pgTable('repositories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  installationId: integer('installation_id'),
  isActive: integer('is_active').notNull().default(1),
  config: jsonb('config').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('repos_user_idx').on(table.userId),
  fullNameIdx: index('repos_full_name_idx').on(table.fullName),
}));

/**
 * Jobs table - for BullMQ job tracking
 */
export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id),
  queueName: text('queue_name').notNull(),
  status: text('status').$type<'waiting' | 'active' | 'completed' | 'failed'>().notNull().default('waiting'),
  data: jsonb('data').notNull(),
  result: jsonb('result'),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

// Type exports for use in application
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
