import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config.js';
import { runPipeline, PipelineInput } from '../pipeline.js';
import { updateRunStatus } from '../db/index.js';

// Redis connection config
const connection = {
  host: env.redisHost,
  port: env.redisPort,
};

// Pipeline job queue
export const pipelineQueue = new Queue('havoc-pipeline', { connection });

// Pipeline job data type
interface PipelineJobData extends PipelineInput {
  userId?: string;
}

// Worker for processing pipeline jobs
let worker: Worker | null = null;

/**
 * Initialize the queue worker
 */
export function initQueueWorker() {
  if (worker) return worker;

  worker = new Worker<PipelineJobData>(
    'havoc-pipeline',
    async (job: Job<PipelineJobData>) => {
      console.log(`[Queue] Processing job ${job.id} for run ${job.data.runId}`);
      
      try {
        const result = await runPipeline(job.data);
        return result;
      } catch (error) {
        console.error(`[Queue] Job ${job.id} failed:`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: parseInt(process.env.MAX_CONCURRENT_RUNS || '3', 10),
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Queue] Job ${job.id} completed:`, result.success ? 'SUCCESS' : 'FAILED');
  });

  worker.on('failed', (job, error) => {
    console.error(`[Queue] Job ${job?.id} failed:`, error.message);
    if (job?.data.runId) {
      updateRunStatus(job.data.runId, 'failed', error.message).catch(console.error);
    }
  });

  worker.on('error', (error) => {
    console.error('[Queue] Worker error:', error);
  });

  console.log('[Queue] Worker initialized');
  return worker;
}

/**
 * Add a pipeline job to the queue
 */
export async function enqueuePipelineJob(data: PipelineJobData): Promise<Job<PipelineJobData>> {
  const job = await pipelineQueue.add('run-pipeline', data, {
    jobId: data.runId,
    attempts: 1,
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed for 7 days
    },
  });

  console.log(`[Queue] Enqueued job ${job.id} for ${data.owner}/${data.repo}#${data.issueNumber}`);
  return job;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job<PipelineJobData> | undefined> {
  return pipelineQueue.getJob(jobId);
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    pipelineQueue.getWaitingCount(),
    pipelineQueue.getActiveCount(),
    pipelineQueue.getCompletedCount(),
    pipelineQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

/**
 * Close queue and worker
 */
export async function closeQueue() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  await pipelineQueue.close();
}

/**
 * Pause the queue
 */
export async function pauseQueue() {
  await pipelineQueue.pause();
}

/**
 * Resume the queue
 */
export async function resumeQueue() {
  await pipelineQueue.resume();
}
