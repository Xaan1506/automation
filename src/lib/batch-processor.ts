/**
 * Batch processing engine with queue management
 * Supports pause, resume, cancel, retry with exponential backoff
 */

import { prisma } from '@/lib/prisma';
import { processQuestion } from '@/lib/ai-processor';
import { exponentialBackoff } from '@/lib/utils';
import { BatchStatus, JobStatus, JobStage, QuestionStatus } from '@/lib/constants';

interface BatchConfig {
  maxConcurrentAI: number;
  maxConcurrentBrowser: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: BatchConfig = {
  maxConcurrentAI: parseInt(process.env.MAX_CONCURRENT_AI || '3'),
  maxConcurrentBrowser: parseInt(process.env.MAX_CONCURRENT_BROWSER || '2'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
};

// In-memory tracking of active batches (survives as long as server is up)
const activeBatches = new Map<string, { cancelled: boolean; paused: boolean }>();

/**
 * Create a new batch from selected assignments
 */
export async function createBatch(
  name: string,
  assignmentIds: string[],
  config?: Partial<BatchConfig>
): Promise<string> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Get all questions for selected assignments
  const assignments = await prisma.assignment.findMany({
    where: { id: { in: assignmentIds } },
    include: {
      questions: { select: { id: true } },
      subject: { select: { id: true } },
    },
  });

  const totalQuestions = assignments.reduce((sum, a) => sum + a.questions.length, 0);

  const batch = await prisma.batch.create({
    data: {
      name,
      status: BatchStatus.PENDING,
      totalAssignments: assignments.length,
      totalQuestions,
      config: JSON.stringify(mergedConfig),
      assignments: {
        create: assignments.map((a) => ({
          assignmentId: a.id,
          subjectId: a.subject.id,
          status: BatchStatus.PENDING,
        })),
      },
    },
  });

  return batch.id;
}

/**
 * Start or resume processing a batch
 */
export async function startBatch(batchId: string): Promise<void> {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      assignments: {
        include: {
          assignment: {
            include: {
              questions: {
                where: {
                  processingStatus: {
                    in: ['DISCOVERED', 'FAILED'],
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!batch) throw new Error(`Batch ${batchId} not found`);

  activeBatches.set(batchId, { cancelled: false, paused: false });

  await prisma.batch.update({
    where: { id: batchId },
    data: { status: BatchStatus.RUNNING, startedAt: batch.startedAt || new Date() },
  });

  // Create processing jobs for all unprocessed questions
  const questionIds: string[] = [];
  for (const ba of batch.assignments) {
    for (const question of ba.assignment.questions) {
      questionIds.push(question.id);
    }
  }

  // Create jobs if they don't exist
  for (const questionId of questionIds) {
    const existing = await prisma.processingJob.findFirst({
      where: { batchId, questionId, status: { not: JobStatus.CANCELLED } },
    });
    if (!existing) {
      await prisma.processingJob.create({
        data: {
          batchId,
          questionId,
          stage: JobStage.QUEUED,
          status: JobStatus.PENDING,
          maxRetries: DEFAULT_CONFIG.maxRetries,
        },
      });
    }
  }

  // Process jobs with concurrency control
  await processBatchJobs(batchId);
}

async function processBatchJobs(batchId: string): Promise<void> {
  const config = DEFAULT_CONFIG;
  const semaphore = { count: 0, max: config.maxConcurrentAI };

  const getPendingJobs = () =>
    prisma.processingJob.findMany({
      where: {
        batchId,
        status: { in: ['PENDING', 'RETRYING'] },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 20,
    });

  while (true) {
    const state = activeBatches.get(batchId);
    if (!state || state.cancelled) break;

    if (state.paused) {
      await sleep(2000);
      continue;
    }

    const pendingJobs = await getPendingJobs();
    if (pendingJobs.length === 0) break;

    const promises: Promise<void>[] = [];

    for (const job of pendingJobs) {
      if (semaphore.count >= semaphore.max) {
        await Promise.race(promises);
        continue;
      }

      semaphore.count++;
      const p = processJob(job.id, batchId)
        .finally(() => semaphore.count--)
        .catch(() => {}); // errors handled inside processJob

      promises.push(p);
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    } else {
      await sleep(1000);
    }
  }

  // Update batch completion
  const state = activeBatches.get(batchId);
  if (state?.cancelled) {
    await prisma.batch.update({
      where: { id: batchId },
      data: { status: BatchStatus.CANCELLED, completedAt: new Date() },
    });
  } else if (!state?.paused) {
    const failedJobs = await prisma.processingJob.count({
      where: { batchId, status: JobStatus.FAILED },
    });
    const completedJobs = await prisma.processingJob.count({
      where: { batchId, status: JobStatus.COMPLETED },
    });

    await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: failedJobs > 0 && completedJobs === 0 ? BatchStatus.FAILED : BatchStatus.COMPLETED,
        completedAt: new Date(),
        processedCount: completedJobs,
        failedCount: failedJobs,
      },
    });
  }

  activeBatches.delete(batchId);
}

async function processJob(jobId: string, batchId: string): Promise<void> {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
    include: { question: true },
  });

  if (!job || job.status === JobStatus.CANCELLED) return;

  try {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { status: JobStatus.RUNNING, stage: JobStage.EXTRACTING, startedAt: job.startedAt || new Date() },
    });

    // Generate solution
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { stage: JobStage.GENERATING_SOLUTION },
    });

    await processQuestion(job.questionId);

    // Mark completed
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
        stage: JobStage.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Update batch processed count
    await prisma.batch.update({
      where: { id: batchId },
      data: { processedCount: { increment: 1 } },
    });
  } catch (err) {
    const retryCount = job.retryCount + 1;
    const shouldRetry = retryCount < job.maxRetries;

    if (shouldRetry) {
      const nextRetryAt = new Date(Date.now() + exponentialBackoff(retryCount));
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.RETRYING,
          retryCount,
          nextRetryAt,
          errorMessage: String(err),
        },
      });
    } else {
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          retryCount,
          errorMessage: String(err),
          completedAt: new Date(),
        },
      });

      await prisma.batch.update({
        where: { id: batchId },
        data: { failedCount: { increment: 1 } },
      });
    }
  }
}

export async function pauseBatch(batchId: string): Promise<void> {
  const state = activeBatches.get(batchId);
  if (state) state.paused = true;
  await prisma.batch.update({ where: { id: batchId }, data: { status: BatchStatus.PAUSED } });
}

export async function resumeBatch(batchId: string): Promise<void> {
  const state = activeBatches.get(batchId);
  if (state) {
    state.paused = false;
  } else {
    // Restart from persisted state
    await startBatch(batchId);
    return;
  }
  await prisma.batch.update({ where: { id: batchId }, data: { status: BatchStatus.RUNNING } });
}

export async function cancelBatch(batchId: string): Promise<void> {
  const state = activeBatches.get(batchId);
  if (state) state.cancelled = true;

  await prisma.processingJob.updateMany({
    where: { batchId, status: { in: [JobStatus.PENDING, JobStatus.RETRYING] } },
    data: { status: JobStatus.CANCELLED },
  });
  await prisma.batch.update({ where: { id: batchId }, data: { status: BatchStatus.CANCELLED } });
}

export async function retryFailedJobs(batchId: string): Promise<void> {
  await prisma.processingJob.updateMany({
    where: { batchId, status: JobStatus.FAILED },
    data: { status: JobStatus.PENDING, retryCount: 0, nextRetryAt: null, errorMessage: null },
  });
  await startBatch(batchId);
}

export async function getBatchProgress(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      assignments: {
        include: {
          subject: { select: { name: true, code: true } },
          assignment: { select: { title: true } },
        },
      },
      jobs: {
        orderBy: { createdAt: 'desc' },
        include: {
          question: { select: { title: true } },
        },
      },
    },
  });
  return batch;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
