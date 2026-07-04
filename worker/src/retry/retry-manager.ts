import { prisma } from '../services/db';
import { Job, RetryStrategy, JobStatus, LogLevel } from '@prisma/client';

export class RetryManager {
  static async handleFailure(job: Job, executionId: string, attempt: number, error: string) {
    try {
      // 1. Fetch the queue retry policy, or fall back to default
      const queue = await prisma.queue.findUnique({
        where: { id: job.queueId },
        include: { retryPolicy: true },
      });

      const policy = queue?.retryPolicy || {
        maxRetries: 3,
        strategy: RetryStrategy.EXPONENTIAL,
        backoffMs: 1000,
      };

      if (attempt < policy.maxRetries) {
        // Calculate backoff duration based on strategy
        let backoffDelay = policy.backoffMs;
        if (policy.strategy === RetryStrategy.LINEAR) {
          backoffDelay = attempt * policy.backoffMs;
        } else if (policy.strategy === RetryStrategy.EXPONENTIAL) {
          backoffDelay = Math.pow(2, attempt - 1) * policy.backoffMs;
        }

        const nextRunAt = new Date(Date.now() + backoffDelay);

        await prisma.$transaction(async (tx) => {
          // Update job status to RETRYING and reset workerId
          await tx.job.update({
            where: { id: job.id },
            data: {
              status: JobStatus.RETRYING,
              workerId: null,
              runAt: nextRunAt,
            },
          });

          // Log the retry event
          await tx.jobLog.create({
            data: {
              executionId,
              level: LogLevel.WARN,
              message: `Job execution failed. Scheduled attempt #${attempt + 1} at ${nextRunAt.toISOString()} (Backoff: ${backoffDelay}ms). Error: ${error.slice(0, 200)}`,
            },
          });
        });

        console.log(`Job ${job.id} failed. Retry scheduled (#${attempt + 1}) in ${backoffDelay}ms`);
      } else {
        // Move to DLQ
        await prisma.$transaction(async (tx) => {
          // Update Job status to DEAD
          await tx.job.update({
            where: { id: job.id },
            data: {
              status: JobStatus.DEAD,
              workerId: null,
            },
          });

          // Create DLQ entry
          await tx.deadLetterJob.create({
            data: {
              jobId: job.id,
              reason: error,
              retryCount: attempt,
            },
          });

          // Log permanent failure
          await tx.jobLog.create({
            data: {
              executionId,
              level: LogLevel.ERROR,
              message: `Job failed permanently after ${attempt} attempts. Quarantined to Dead Letter Queue (DLQ). Reason: ${error.slice(0, 500)}`,
            },
          });
        });

        console.log(`Job ${job.id} failed permanently. Moved to Dead Letter Queue (DLQ).`);
      }
    } catch (err) {
      console.error(`Failed to handle job retry/DLQ transition for job ${job.id}:`, err);
    }
  }
}
