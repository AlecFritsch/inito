import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, desc, and, or, isNull, sql } from 'drizzle-orm';
import * as schema from './schema.js';
import { env } from '../config.js';

// Database connection pool
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize database connection
 */
export function initDatabase() {
  if (db) return db;

  pool = new Pool({
    connectionString: env.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  db = drizzle(pool, { schema });
  
  console.log('[DB] PostgreSQL connection initialized');
  return db;
}

/**
 * Get database instance
 */
export function getDb() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

// ============ RUNS ============

/**
 * Create a new run
 */
export async function createRun(data: schema.NewRun): Promise<schema.Run> {
  const database = getDb();
  const [run] = await database.insert(schema.runs).values(data).returning();
  return run;
}

/**
 * Get run by ID
 */
export async function getRun(id: string): Promise<schema.Run | null> {
  const database = getDb();
  const [run] = await database.select().from(schema.runs).where(eq(schema.runs.id, id));
  return run || null;
}

/**
 * Update run status
 */
export async function updateRunStatus(
  id: string, 
  status: schema.RunStatus, 
  error?: string
): Promise<void> {
  const database = getDb();
  
  const updates: Partial<schema.Run> = { status };
  
  if (status === 'done' || status === 'failed') {
    updates.completedAt = new Date();
  }
  
  if (error) {
    updates.error = error;
  }
  
  await database.update(schema.runs).set(updates).where(eq(schema.runs.id, id));
}

/**
 * Update run plan
 */
export async function updateRunPlan(id: string, plan: object): Promise<void> {
  const database = getDb();
  await database.update(schema.runs).set({ plan }).where(eq(schema.runs.id, id));
}

/**
 * Update run artifacts
 */
export async function updateRunArtifacts(
  id: string,
  artifacts: {
    intentCard?: string;
    review?: object;
    confidence?: number;
    policyResult?: object;
  }
): Promise<void> {
  const database = getDb();
  await database.update(schema.runs).set(artifacts).where(eq(schema.runs.id, id));
}

/**
 * Update run PR info
 */
export async function updateRunPR(
  id: string, 
  prUrl: string, 
  prNumber: number, 
  branch: string
): Promise<void> {
  const database = getDb();
  await database.update(schema.runs)
    .set({ prUrl, prNumber, branch })
    .where(eq(schema.runs.id, id));
}

/**
 * Get recent runs
 */
export async function getRecentRuns(limit: number = 20): Promise<schema.Run[]> {
  const database = getDb();
  return database.select()
    .from(schema.runs)
    .orderBy(desc(schema.runs.startedAt))
    .limit(limit);
}

/**
 * Get runs by user
 */
export async function getRunsByUser(userId: string, limit: number = 50): Promise<schema.Run[]> {
  const database = getDb();
  return database.select()
    .from(schema.runs)
    .where(or(
      eq(schema.runs.userId, userId),
      isNull(schema.runs.userId)
    ))
    .orderBy(desc(schema.runs.startedAt))
    .limit(limit);
}

/**
 * Get runs by repo
 */
export async function getRunsByRepo(repo: string, limit: number = 20): Promise<schema.Run[]> {
  const database = getDb();
  return database.select()
    .from(schema.runs)
    .where(eq(schema.runs.repo, repo))
    .orderBy(desc(schema.runs.startedAt))
    .limit(limit);
}

/**
 * Get run stats for user
 */
export async function getUserRunStats(userId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  avgConfidence: number;
}> {
  const database = getDb();
  
  const [stats] = await database.select({
    total: sql<number>`count(*)::int`,
    successful: sql<number>`count(*) filter (where status = 'done')::int`,
    failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    avgConfidence: sql<number>`coalesce(avg(confidence), 0)::real`,
  })
  .from(schema.runs)
  .where(or(
    eq(schema.runs.userId, userId),
    isNull(schema.runs.userId)
  ));
  
  return stats || { total: 0, successful: 0, failed: 0, avgConfidence: 0 };
}

// ============ USERS ============

/**
 * Upsert user from Clerk
 */
export async function upsertUser(data: schema.NewUser): Promise<schema.User> {
  const database = getDb();
  const [user] = await database.insert(schema.users)
    .values(data)
    .onConflictDoUpdate({
      target: schema.users.id,
      set: {
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
        githubUsername: data.githubUsername,
        updatedAt: new Date(),
      }
    })
    .returning();
  return user;
}

/**
 * Get user by ID
 */
export async function getUser(id: string): Promise<schema.User | null> {
  const database = getDb();
  const [user] = await database.select().from(schema.users).where(eq(schema.users.id, id));
  return user || null;
}

/**
 * Increment user run count
 */
export async function incrementUserRuns(userId: string): Promise<void> {
  const database = getDb();
  await database.update(schema.users)
    .set({ runsThisMonth: sql`runs_this_month + 1` })
    .where(eq(schema.users.id, userId));
}

// ============ REPOSITORIES ============

/**
 * Add repository for user
 */
export async function addRepository(data: schema.NewRepository): Promise<schema.Repository> {
  const database = getDb();
  const [repo] = await database.insert(schema.repositories).values(data).returning();
  return repo;
}

/**
 * Get user repositories
 */
export async function getUserRepositories(userId: string): Promise<schema.Repository[]> {
  const database = getDb();
  return database.select()
    .from(schema.repositories)
    .where(and(
      eq(schema.repositories.userId, userId),
      eq(schema.repositories.isActive, 1)
    ));
}

/**
 * Get repository by full name
 */
export async function getRepositoryByFullName(
  fullName: string
): Promise<schema.Repository | null> {
  const database = getDb();
  const [repo] = await database.select()
    .from(schema.repositories)
    .where(eq(schema.repositories.fullName, fullName));
  return repo || null;
}

// Re-export schema types
export * from './schema.js';
