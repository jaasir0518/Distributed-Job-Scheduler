import { prisma } from '../services/db';
import { RetryManager } from '../retry/retry-manager';
import { Job, JobStatus, ExecutionStatus, LogLevel, WorkerStatus } from '@prisma/client';
import parser from 'cron-parser';

export class TaskExecutor {
  private workerId: string;

  constructor(workerId: string) {
    this.workerId = workerId;
  }

  async executeJob(job: Job) {
    // 1. Fetch attempt count
    const attemptCount = await prisma.jobExecution.count({
      where: { jobId: job.id },
    }) + 1;

    // 2. Create job execution log
    const execution = await prisma.jobExecution.create({
      data: {
        jobId: job.id,
        workerId: this.workerId,
        attempt: attemptCount,
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    // Helper function to write logs
    const writeLog = async (level: LogLevel, message: string) => {
      await prisma.jobLog.create({
        data: {
          executionId: execution.id,
          level,
          message,
        },
      });
    };

    const payload = JSON.parse(job.payload);
    const startTime = Date.now();

    try {
      await writeLog(LogLevel.INFO, `Starting execution attempt #${attemptCount} for job '${job.name}' on worker ID ${this.workerId}`);
      
      // Execute based on job name
      switch (job.name.toUpperCase()) {
        case 'SEND_EMAIL':
          await writeLog(LogLevel.INFO, 'SMTP Connection initialized...');
          await new Promise((r) => setTimeout(r, 1000));
          
          if (payload.shouldFail) {
            throw new Error(payload.errorMessage || 'SMTP connection timed out.');
          }

          await writeLog(LogLevel.DEBUG, `Rendering email template with data: ${JSON.stringify(payload.data || {})}`);
          await new Promise((r) => setTimeout(r, 1000));
          await writeLog(LogLevel.INFO, `Email dispatched successfully to ${payload.to || 'recipient@domain.com'}`);
          break;

        case 'GENERATE_REPORT':
          await writeLog(LogLevel.INFO, 'Querying database tables...');
          await new Promise((r) => setTimeout(r, 1200));

          if (payload.shouldFail) {
            throw new Error(payload.errorMessage || 'Database query syntax error near SELECT.');
          }

          await writeLog(LogLevel.INFO, 'Aggregating metrics and charts...');
          await new Promise((r) => setTimeout(r, 1000));
          await writeLog(LogLevel.INFO, `Report saved as PDF under artifact #${payload.reportId || 9091}`);
          break;

        case 'SYNC_DATA':
          await writeLog(LogLevel.INFO, 'Fetching delta updates from remote webhook API...');
          await new Promise((r) => setTimeout(r, 1500));

          if (payload.shouldFail) {
            throw new Error(payload.errorMessage || 'Target server returned 503 Service Unavailable.');
          }

          const count = payload.itemsCount ?? 142;
          await writeLog(LogLevel.INFO, `Synchronized ${count} data records into primary store.`);
          break;

        default:
          throw new Error(`Unsupported job execution task: '${job.name}'`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 3. Mark execution as SUCCESS
      await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.SUCCESS,
          endedAt: new Date(),
          duration,
          output: 'SUCCESS',
        },
      });

      await writeLog(LogLevel.INFO, `Job execution completed successfully in ${duration}ms.`);

      // 4. Handle scheduled recurring cron / intervals, or mark COMPLETED
      const scheduled = await prisma.scheduledJob.findUnique({
        where: { jobId: job.id },
      });

      if (scheduled) {
        let nextRunAt = new Date();
        if (scheduled.cronExpression) {
          const cronExpr = parser.parse(scheduled.cronExpression);
          nextRunAt = cronExpr.next().toDate();
        } else if (scheduled.intervalMs) {
          nextRunAt = new Date(Date.now() + scheduled.intervalMs);
        }

        await prisma.$transaction([
          // Reset job status back to PENDING for the next run
          prisma.job.update({
            where: { id: job.id },
            data: {
              status: JobStatus.PENDING,
              workerId: null,
              runAt: nextRunAt,
            },
          }),
          // Update scheduled rule next run time
          prisma.scheduledJob.update({
            where: { id: scheduled.id },
            data: {
              lastRunAt: new Date(),
              nextRunAt,
            },
          }),
        ]);

        console.log(`Cron/Interval Job ${job.id} re-scheduled for ${nextRunAt.toISOString()}`);
      } else {
        // Standard non-recurring job -> mark COMPLETED
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.COMPLETED,
          },
        });
      }
    } catch (err: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMessage = err.message || 'Unknown execution error';

      // Mark execution as FAILED
      await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: ExecutionStatus.FAILED,
          endedAt: new Date(),
          duration,
          error: errorMessage,
        },
      });

      await writeLog(LogLevel.ERROR, `Job failed during execution. Error: ${errorMessage}`);

      // Pass failure to RetryManager
      await RetryManager.handleFailure(job, execution.id, attemptCount, errorMessage);
    } finally {
      // 5. Decrement worker load
      try {
        const worker = await prisma.worker.findUnique({
          where: { id: this.workerId },
          select: { currentLoad: true },
        });

        if (worker) {
          const newLoad = Math.max(0, worker.currentLoad - 1);
          const status = newLoad > 0 ? WorkerStatus.BUSY : WorkerStatus.IDLE;

          await prisma.worker.update({
            where: { id: this.workerId },
            data: {
              currentLoad: newLoad,
              status,
            },
          });
        }
      } catch (err) {
        console.error(`Failed to update worker load decrement:`, err);
      }
    }
  }
}
